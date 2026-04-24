import fs from 'fs';
import { createRequire } from 'module';
import path from 'path';

type DatabaseSync = {
    exec(sql: string): void;
    prepare(sql: string): {
        run(...params: unknown[]): { lastInsertRowid?: number | bigint; changes?: number };
        get(...params: unknown[]): Record<string, unknown> | undefined;
        all(...params: unknown[]): Array<Record<string, unknown>>;
    };
    close(): void;
};

type DatabaseSyncConstructor = new (filename: string) => DatabaseSync;

const require = createRequire(import.meta.url);
let databaseSyncConstructor: DatabaseSyncConstructor | null = null;

function getDatabaseSyncConstructor(): DatabaseSyncConstructor {
    if (!databaseSyncConstructor) {
        const sqlite = require('node:sqlite') as { DatabaseSync: DatabaseSyncConstructor };
        databaseSyncConstructor = sqlite.DatabaseSync;
    }

    return databaseSyncConstructor;
}

export type GenerationBackupImage = {
    filename: string;
    path?: string;
    output_format?: string;
};

export type GenerationBackupBatch = {
    batchTimestamp: number;
    mode: 'generate' | 'edit';
    prompt: string;
    model: string;
    quality?: string;
    background?: string;
    moderation?: string;
    output_format?: string;
    durationMs?: number;
    storageModeUsed: 'fs' | 'indexeddb';
    images: GenerationBackupImage[];
};

export type GenerationBackupRecord = {
    batch_timestamp: number;
    prompt: string;
    deleted_by_user: number;
    deleted_at: number | null;
    filename: string;
};

const DEFAULT_BACKUP_DB_PATH = path.resolve(process.cwd(), '.server-data', 'generation-backup.sqlite');

export function getGenerationBackupDbPath(): string {
    return process.env.GENERATION_BACKUP_DB_PATH || DEFAULT_BACKUP_DB_PATH;
}

export function openGenerationBackupDatabase(dbPath = getGenerationBackupDbPath()): DatabaseSync {
    fs.mkdirSync(path.dirname(dbPath), { recursive: true });
    const DatabaseSync = getDatabaseSyncConstructor();
    const db = new DatabaseSync(dbPath);
    ensureGenerationBackupSchema(db);
    return db;
}

export function ensureGenerationBackupSchema(db: DatabaseSync): void {
    db.exec(`
        PRAGMA journal_mode = WAL;
        PRAGMA foreign_keys = ON;

        CREATE TABLE IF NOT EXISTS generation_batches (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            batch_timestamp INTEGER NOT NULL UNIQUE,
            created_at INTEGER NOT NULL,
            mode TEXT NOT NULL,
            prompt TEXT NOT NULL,
            model TEXT NOT NULL,
            quality TEXT,
            background TEXT,
            moderation TEXT,
            output_format TEXT,
            duration_ms INTEGER,
            storage_mode_used TEXT NOT NULL,
            deleted_by_user INTEGER NOT NULL DEFAULT 0,
            deleted_at INTEGER
        );

        CREATE TABLE IF NOT EXISTS generation_images (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            batch_id INTEGER NOT NULL,
            filename TEXT NOT NULL UNIQUE,
            path TEXT,
            output_format TEXT,
            FOREIGN KEY(batch_id) REFERENCES generation_batches(id) ON DELETE CASCADE
        );

        CREATE INDEX IF NOT EXISTS idx_generation_batches_created_at
            ON generation_batches(created_at);
        CREATE INDEX IF NOT EXISTS idx_generation_images_filename
            ON generation_images(filename);
    `);
}

export function backupGenerationBatch(batch: GenerationBackupBatch, db?: DatabaseSync): void {
    if (batch.images.length === 0) {
        return;
    }

    const activeDb = db ?? openGenerationBackupDatabase();
    const shouldClose = !db;

    try {
        activeDb.exec('BEGIN IMMEDIATE');
        const now = Date.now();

        activeDb.prepare(`
            INSERT INTO generation_batches (
                batch_timestamp,
                created_at,
                mode,
                prompt,
                model,
                quality,
                background,
                moderation,
                output_format,
                duration_ms,
                storage_mode_used,
                deleted_by_user,
                deleted_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, NULL)
            ON CONFLICT(batch_timestamp) DO UPDATE SET
                prompt = excluded.prompt,
                model = excluded.model,
                quality = excluded.quality,
                background = excluded.background,
                moderation = excluded.moderation,
                output_format = excluded.output_format,
                duration_ms = excluded.duration_ms,
                storage_mode_used = excluded.storage_mode_used
        `).run(
            batch.batchTimestamp,
            now,
            batch.mode,
            batch.prompt,
            batch.model,
            batch.quality ?? null,
            batch.background ?? null,
            batch.moderation ?? null,
            batch.output_format ?? null,
            batch.durationMs ?? null,
            batch.storageModeUsed
        );

        const batchRow = activeDb
            .prepare('SELECT id FROM generation_batches WHERE batch_timestamp = ?')
            .get(batch.batchTimestamp);
        const batchId = batchRow?.id;

        if (typeof batchId !== 'number' && typeof batchId !== 'bigint') {
            throw new Error('Failed to load generation backup batch id.');
        }

        const insertImage = activeDb.prepare(`
            INSERT INTO generation_images (batch_id, filename, path, output_format)
            VALUES (?, ?, ?, ?)
            ON CONFLICT(filename) DO UPDATE SET
                batch_id = excluded.batch_id,
                path = excluded.path,
                output_format = excluded.output_format
        `);

        for (const image of batch.images) {
            insertImage.run(batchId, image.filename, image.path ?? null, image.output_format ?? null);
        }

        activeDb.exec('COMMIT');
    } catch (error) {
        activeDb.exec('ROLLBACK');
        throw error;
    } finally {
        if (shouldClose) {
            activeDb.close();
        }
    }
}

export function markGenerationBackupsDeletedByFilenames(
    filenames: string[],
    db?: DatabaseSync
): number {
    if (filenames.length === 0) {
        return 0;
    }

    const activeDb = db ?? openGenerationBackupDatabase();
    const shouldClose = !db;

    try {
        const placeholders = filenames.map(() => '?').join(', ');
        const result = activeDb
            .prepare(`
                UPDATE generation_batches
                SET deleted_by_user = 1,
                    deleted_at = ?
                WHERE id IN (
                    SELECT DISTINCT batch_id
                    FROM generation_images
                    WHERE filename IN (${placeholders})
                )
            `)
            .run(Date.now(), ...filenames);

        return Number(result.changes ?? 0);
    } finally {
        if (shouldClose) {
            activeDb.close();
        }
    }
}

export function markAllGenerationBackupsDeleted(db?: DatabaseSync): number {
    const activeDb = db ?? openGenerationBackupDatabase();
    const shouldClose = !db;

    try {
        const result = activeDb
            .prepare(
                'UPDATE generation_batches SET deleted_by_user = 1, deleted_at = ? WHERE deleted_by_user = 0'
            )
            .run(Date.now());

        return Number(result.changes ?? 0);
    } finally {
        if (shouldClose) {
            activeDb.close();
        }
    }
}

export function listGenerationBackupRecords(db?: DatabaseSync): GenerationBackupRecord[] {
    const activeDb = db ?? openGenerationBackupDatabase();
    const shouldClose = !db;

    try {
        return activeDb.prepare(`
            SELECT
                b.batch_timestamp,
                b.prompt,
                b.deleted_by_user,
                b.deleted_at,
                i.filename
            FROM generation_batches b
            JOIN generation_images i ON i.batch_id = b.id
            ORDER BY b.batch_timestamp DESC, i.filename ASC
        `).all().map((row) => ({
            batch_timestamp: Number(row.batch_timestamp),
            prompt: String(row.prompt),
            deleted_by_user: Number(row.deleted_by_user),
            deleted_at: row.deleted_at === null ? null : Number(row.deleted_at),
            filename: String(row.filename)
        }));
    } finally {
        if (shouldClose) {
            activeDb.close();
        }
    }
}
