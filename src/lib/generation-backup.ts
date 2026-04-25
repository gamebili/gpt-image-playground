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
    userId: string;
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
    user_id: string;
    prompt: string;
    deleted_by_user: number;
    deleted_at: number | null;
    filename: string;
};

export type GenerationHistoryBatch = {
    batch_timestamp: number;
    user_id: string;
    mode: 'generate' | 'edit';
    prompt: string;
    model: string;
    quality?: string;
    background?: string;
    moderation?: string;
    output_format?: string;
    duration_ms?: number;
    storage_mode_used: 'fs' | 'indexeddb';
    deleted_by_user: number;
    deleted_at: number | null;
    images: GenerationBackupImage[];
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
            batch_timestamp INTEGER NOT NULL,
            user_id TEXT NOT NULL DEFAULT 'legacy',
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
            deleted_at INTEGER,
            UNIQUE(user_id, batch_timestamp)
        );

        CREATE TABLE IF NOT EXISTS generation_images (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            batch_id INTEGER NOT NULL,
            user_id TEXT NOT NULL DEFAULT 'legacy',
            filename TEXT NOT NULL,
            path TEXT,
            output_format TEXT,
            FOREIGN KEY(batch_id) REFERENCES generation_batches(id) ON DELETE CASCADE,
            UNIQUE(user_id, filename)
        );

        CREATE INDEX IF NOT EXISTS idx_generation_batches_created_at
            ON generation_batches(created_at);
        CREATE INDEX IF NOT EXISTS idx_generation_batches_user_id_created_at
            ON generation_batches(user_id, created_at);
        CREATE INDEX IF NOT EXISTS idx_generation_images_filename
            ON generation_images(filename);
        CREATE INDEX IF NOT EXISTS idx_generation_images_user_id_filename
            ON generation_images(user_id, filename);
    `);

    migrateGenerationBackupSchema(db);
}

function tableHasColumn(db: DatabaseSync, tableName: string, columnName: string): boolean {
    return db.prepare(`PRAGMA table_info(${tableName})`).all().some((row) => row.name === columnName);
}

function migrateGenerationBackupSchema(db: DatabaseSync): void {
    if (!tableHasColumn(db, 'generation_batches', 'user_id')) {
        db.exec("ALTER TABLE generation_batches ADD COLUMN user_id TEXT NOT NULL DEFAULT 'legacy'");
    }

    if (!tableHasColumn(db, 'generation_images', 'user_id')) {
        db.exec("ALTER TABLE generation_images ADD COLUMN user_id TEXT NOT NULL DEFAULT 'legacy'");
    }

    db.exec(`
        CREATE UNIQUE INDEX IF NOT EXISTS idx_generation_batches_user_timestamp_unique
            ON generation_batches(user_id, batch_timestamp);
        CREATE UNIQUE INDEX IF NOT EXISTS idx_generation_images_user_filename_unique
            ON generation_images(user_id, filename);
        CREATE INDEX IF NOT EXISTS idx_generation_batches_user_id_created_at
            ON generation_batches(user_id, created_at);
        CREATE INDEX IF NOT EXISTS idx_generation_images_user_id_filename
            ON generation_images(user_id, filename);
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
                user_id,
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
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, NULL)
            ON CONFLICT(user_id, batch_timestamp) DO UPDATE SET
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
            batch.userId,
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
            .prepare('SELECT id FROM generation_batches WHERE user_id = ? AND batch_timestamp = ?')
            .get(batch.userId, batch.batchTimestamp);
        const batchId = batchRow?.id;

        if (typeof batchId !== 'number' && typeof batchId !== 'bigint') {
            throw new Error('Failed to load generation backup batch id.');
        }

        const insertImage = activeDb.prepare(`
            INSERT INTO generation_images (batch_id, user_id, filename, path, output_format)
            VALUES (?, ?, ?, ?, ?)
            ON CONFLICT(user_id, filename) DO UPDATE SET
                batch_id = excluded.batch_id,
                path = excluded.path,
                output_format = excluded.output_format
        `);

        for (const image of batch.images) {
            insertImage.run(batchId, batch.userId, image.filename, image.path ?? null, image.output_format ?? null);
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
    userId: string,
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
                    WHERE user_id = ?
                      AND filename IN (${placeholders})
                )
                AND user_id = ?
            `)
            .run(Date.now(), userId, ...filenames, userId);

        return Number(result.changes ?? 0);
    } finally {
        if (shouldClose) {
            activeDb.close();
        }
    }
}

export function markAllGenerationBackupsDeleted(userId: string, db?: DatabaseSync): number {
    const activeDb = db ?? openGenerationBackupDatabase();
    const shouldClose = !db;

    try {
        const result = activeDb
            .prepare(
                'UPDATE generation_batches SET deleted_by_user = 1, deleted_at = ? WHERE user_id = ? AND deleted_by_user = 0'
            )
            .run(Date.now(), userId);

        return Number(result.changes ?? 0);
    } finally {
        if (shouldClose) {
            activeDb.close();
        }
    }
}

export function listGenerationBackupRecords(db?: DatabaseSync, userId?: string): GenerationBackupRecord[] {
    const activeDb = db ?? openGenerationBackupDatabase();
    const shouldClose = !db;

    try {
        const rows = userId
            ? activeDb.prepare(`
                SELECT
                    b.batch_timestamp,
                    b.user_id,
                    b.prompt,
                    b.deleted_by_user,
                    b.deleted_at,
                    i.filename
                FROM generation_batches b
                JOIN generation_images i ON i.batch_id = b.id
                WHERE b.user_id = ?
                ORDER BY b.batch_timestamp DESC, i.filename ASC
            `).all(userId)
            : activeDb.prepare(`
            SELECT
                b.batch_timestamp,
                b.user_id,
                b.prompt,
                b.deleted_by_user,
                b.deleted_at,
                i.filename
            FROM generation_batches b
            JOIN generation_images i ON i.batch_id = b.id
            ORDER BY b.batch_timestamp DESC, i.filename ASC
        `).all();

        return rows.map((row) => ({
            batch_timestamp: Number(row.batch_timestamp),
            user_id: String(row.user_id),
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

export function listGenerationHistoryBatches(userId: string, db?: DatabaseSync): GenerationHistoryBatch[] {
    const activeDb = db ?? openGenerationBackupDatabase();
    const shouldClose = !db;

    try {
        const rows = activeDb
            .prepare(
                `
                    SELECT
                        b.batch_timestamp,
                        b.user_id,
                        b.mode,
                        b.prompt,
                        b.model,
                        b.quality,
                        b.background,
                        b.moderation,
                        b.output_format,
                        b.duration_ms,
                        b.storage_mode_used,
                        b.deleted_by_user,
                        b.deleted_at,
                        i.filename,
                        i.path,
                        i.output_format AS image_output_format
                    FROM generation_batches b
                    JOIN generation_images i ON i.batch_id = b.id
                    WHERE b.user_id = ?
                      AND b.deleted_by_user = 0
                    ORDER BY b.batch_timestamp DESC, i.filename ASC
                `
            )
            .all(userId);

        const batches = new Map<number, GenerationHistoryBatch>();

        for (const row of rows) {
            const batchTimestamp = Number(row.batch_timestamp);
            const existing = batches.get(batchTimestamp);
            const batch =
                existing ??
                ({
                    batch_timestamp: batchTimestamp,
                    user_id: String(row.user_id),
                    mode: row.mode === 'edit' ? 'edit' : 'generate',
                    prompt: String(row.prompt),
                    model: String(row.model),
                    quality: row.quality === null ? undefined : String(row.quality),
                    background: row.background === null ? undefined : String(row.background),
                    moderation: row.moderation === null ? undefined : String(row.moderation),
                    output_format: row.output_format === null ? undefined : String(row.output_format),
                    duration_ms: row.duration_ms === null ? undefined : Number(row.duration_ms),
                    storage_mode_used: row.storage_mode_used === 'indexeddb' ? 'indexeddb' : 'fs',
                    deleted_by_user: Number(row.deleted_by_user),
                    deleted_at: row.deleted_at === null ? null : Number(row.deleted_at),
                    images: []
                } satisfies GenerationHistoryBatch);

            batch.images.push({
                filename: String(row.filename),
                path: row.path === null ? undefined : String(row.path),
                output_format: row.image_output_format === null ? undefined : String(row.image_output_format)
            });
            batches.set(batchTimestamp, batch);
        }

        return Array.from(batches.values());
    } finally {
        if (shouldClose) {
            activeDb.close();
        }
    }
}
