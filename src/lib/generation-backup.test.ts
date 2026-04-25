import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createRequire } from 'node:module';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';

import {
    backupGenerationBatch,
    listGenerationHistoryBatches,
    listGenerationBackupRecords,
    markAllGenerationBackupsDeleted,
    markGenerationBackupsDeletedByFilenames,
    openGenerationBackupDatabase
} from './generation-backup.ts';

const require = createRequire(import.meta.url);
const { DatabaseSync } = require('node:sqlite') as {
    DatabaseSync: new (filename: string) => {
        exec(sql: string): void;
        close(): void;
    };
};

function withTempDb(callback: (dbPath: string) => void) {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'generation-backup-'));
    const dbPath = path.join(dir, 'backup.sqlite');

    try {
        callback(dbPath);
    } finally {
        fs.rmSync(dir, { recursive: true, force: true });
    }
}

test('backupGenerationBatch stores prompt and generated image filenames', () => {
    withTempDb((dbPath) => {
        const db = openGenerationBackupDatabase(dbPath);

        backupGenerationBatch(
            {
                batchTimestamp: 1000,
                userId: 'user-a',
                mode: 'generate',
                prompt: 'a test prompt',
                model: 'gpt-image-2',
                quality: 'auto',
                background: 'auto',
                moderation: 'auto',
                output_format: 'png',
                durationMs: 1200,
                storageModeUsed: 'fs',
                images: [
                    { filename: '1000-0.png', path: '/api/image/1000-0.png', output_format: 'png' },
                    { filename: '1000-1.png', path: '/api/image/1000-1.png', output_format: 'png' }
                ]
            },
            db
        );

        assert.deepEqual(listGenerationBackupRecords(db), [
            {
                batch_timestamp: 1000,
                user_id: 'user-a',
                prompt: 'a test prompt',
                deleted_by_user: 0,
                deleted_at: null,
                filename: '1000-0.png'
            },
            {
                batch_timestamp: 1000,
                user_id: 'user-a',
                prompt: 'a test prompt',
                deleted_by_user: 0,
                deleted_at: null,
                filename: '1000-1.png'
            }
        ]);

        db.close();
    });
});

test('backupGenerationBatch can be retried without duplicating image rows', () => {
    withTempDb((dbPath) => {
        const db = openGenerationBackupDatabase(dbPath);
        const batch = {
            batchTimestamp: 2000,
            userId: 'user-a',
            mode: 'generate' as const,
            prompt: 'original prompt',
            model: 'gpt-image-2',
            storageModeUsed: 'fs' as const,
            images: [{ filename: '2000-0.png', path: '/api/image/2000-0.png', output_format: 'png' }]
        };

        backupGenerationBatch(batch, db);
        backupGenerationBatch({ ...batch, prompt: 'updated prompt' }, db);

        assert.deepEqual(listGenerationBackupRecords(db), [
            {
                batch_timestamp: 2000,
                user_id: 'user-a',
                prompt: 'updated prompt',
                deleted_by_user: 0,
                deleted_at: null,
                filename: '2000-0.png'
            }
        ]);

        db.close();
    });
});

test('markGenerationBackupsDeletedByFilenames soft-deletes the matching batch', () => {
    withTempDb((dbPath) => {
        const db = openGenerationBackupDatabase(dbPath);

        backupGenerationBatch(
            {
                batchTimestamp: 3000,
                userId: 'user-a',
                mode: 'edit',
                prompt: 'edit prompt',
                model: 'gpt-image-2',
                storageModeUsed: 'fs',
                images: [{ filename: '3000-0.png', path: '/api/image/3000-0.png', output_format: 'png' }]
            },
            db
        );

        assert.equal(markGenerationBackupsDeletedByFilenames('user-a', ['3000-0.png'], db), 1);
        const [record] = listGenerationBackupRecords(db);
        assert.equal(record.deleted_by_user, 1);
        assert.equal(typeof record.deleted_at, 'number');

        db.close();
    });
});

test('markAllGenerationBackupsDeleted soft-deletes all active batches', () => {
    withTempDb((dbPath) => {
        const db = openGenerationBackupDatabase(dbPath);

        backupGenerationBatch(
            {
                batchTimestamp: 4000,
                userId: 'user-a',
                mode: 'generate',
                prompt: 'first prompt',
                model: 'gpt-image-2',
                storageModeUsed: 'fs',
                images: [{ filename: '4000-0.png', path: '/api/image/4000-0.png', output_format: 'png' }]
            },
            db
        );
        backupGenerationBatch(
            {
                batchTimestamp: 5000,
                userId: 'user-a',
                mode: 'generate',
                prompt: 'second prompt',
                model: 'gpt-image-2',
                storageModeUsed: 'fs',
                images: [{ filename: '5000-0.png', path: '/api/image/5000-0.png', output_format: 'png' }]
            },
            db
        );

        assert.equal(markAllGenerationBackupsDeleted('user-a', db), 2);
        assert.deepEqual(
            listGenerationBackupRecords(db).map((record) => record.deleted_by_user),
            [1, 1]
        );

        db.close();
    });
});

test('history records are filtered and deleted by user id', () => {
    withTempDb((dbPath) => {
        const db = openGenerationBackupDatabase(dbPath);

        backupGenerationBatch(
            {
                batchTimestamp: 6000,
                userId: 'user-a',
                mode: 'generate',
                prompt: 'user a prompt',
                model: 'gpt-image-2',
                storageModeUsed: 'fs',
                images: [{ filename: 'shared.png', path: '/api/image/shared.png', output_format: 'png' }]
            },
            db
        );
        backupGenerationBatch(
            {
                batchTimestamp: 7000,
                userId: 'user-b',
                mode: 'generate',
                prompt: 'user b prompt',
                model: 'gpt-image-2',
                storageModeUsed: 'fs',
                images: [{ filename: 'shared.png', path: '/api/image/shared.png', output_format: 'png' }]
            },
            db
        );

        assert.deepEqual(
            listGenerationBackupRecords(db, 'user-a').map((record) => record.prompt),
            ['user a prompt']
        );
        assert.equal(markGenerationBackupsDeletedByFilenames('user-a', ['shared.png'], db), 1);
        assert.deepEqual(
            listGenerationBackupRecords(db, 'user-a').map((record) => record.deleted_by_user),
            [1]
        );
        assert.deepEqual(
            listGenerationBackupRecords(db, 'user-b').map((record) => record.deleted_by_user),
            [0]
        );

        db.close();
    });
});

test('openGenerationBackupDatabase migrates legacy history databases before querying user history', () => {
    withTempDb((dbPath) => {
        const legacyDb = new DatabaseSync(dbPath);
        legacyDb.exec(`
            CREATE TABLE generation_batches (
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

            CREATE TABLE generation_images (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                batch_id INTEGER NOT NULL,
                filename TEXT NOT NULL UNIQUE,
                path TEXT,
                output_format TEXT,
                FOREIGN KEY(batch_id) REFERENCES generation_batches(id) ON DELETE CASCADE
            );

            INSERT INTO generation_batches (
                id,
                batch_timestamp,
                created_at,
                mode,
                prompt,
                model,
                storage_mode_used
            ) VALUES (1, 8000, 8000, 'generate', 'legacy prompt', 'gpt-image-2', 'fs');

            INSERT INTO generation_images (
                batch_id,
                filename,
                path,
                output_format
            ) VALUES (1, 'legacy.png', '/api/image/legacy.png', 'png');
        `);
        legacyDb.close();

        const db = openGenerationBackupDatabase(dbPath);

        backupGenerationBatch(
            {
                batchTimestamp: 9000,
                userId: 'user-a',
                mode: 'generate',
                prompt: 'user a migrated prompt',
                model: 'gpt-image-2',
                storageModeUsed: 'fs',
                images: [{ filename: 'shared-after-migration.png', path: '/api/image/shared-after-migration.png' }]
            },
            db
        );
        backupGenerationBatch(
            {
                batchTimestamp: 9000,
                userId: 'user-b',
                mode: 'generate',
                prompt: 'user b migrated prompt',
                model: 'gpt-image-2',
                storageModeUsed: 'fs',
                images: [{ filename: 'shared-after-migration.png', path: '/api/image/shared-after-migration.png' }]
            },
            db
        );

        assert.deepEqual(listGenerationHistoryBatches('legacy', db), [
            {
                batch_timestamp: 8000,
                user_id: 'legacy',
                mode: 'generate',
                prompt: 'legacy prompt',
                model: 'gpt-image-2',
                quality: undefined,
                background: undefined,
                moderation: undefined,
                output_format: undefined,
                duration_ms: undefined,
                storage_mode_used: 'fs',
                deleted_by_user: 0,
                deleted_at: null,
                images: [{ filename: 'legacy.png', path: '/api/image/legacy.png', output_format: 'png' }]
            }
        ]);
        assert.deepEqual(
            listGenerationHistoryBatches('user-a', db).map((batch) => batch.prompt),
            ['user a migrated prompt']
        );
        assert.deepEqual(
            listGenerationHistoryBatches('user-b', db).map((batch) => batch.prompt),
            ['user b migrated prompt']
        );

        db.close();
    });
});
