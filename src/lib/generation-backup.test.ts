import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';

import {
    backupGenerationBatch,
    listGenerationBackupRecords,
    markAllGenerationBackupsDeleted,
    markGenerationBackupsDeletedByFilenames,
    openGenerationBackupDatabase
} from './generation-backup.ts';

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
                prompt: 'a test prompt',
                deleted_by_user: 0,
                deleted_at: null,
                filename: '1000-0.png'
            },
            {
                batch_timestamp: 1000,
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
                mode: 'edit',
                prompt: 'edit prompt',
                model: 'gpt-image-2',
                storageModeUsed: 'fs',
                images: [{ filename: '3000-0.png', path: '/api/image/3000-0.png', output_format: 'png' }]
            },
            db
        );

        assert.equal(markGenerationBackupsDeletedByFilenames(['3000-0.png'], db), 1);
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
                mode: 'generate',
                prompt: 'second prompt',
                model: 'gpt-image-2',
                storageModeUsed: 'fs',
                images: [{ filename: '5000-0.png', path: '/api/image/5000-0.png', output_format: 'png' }]
            },
            db
        );

        assert.equal(markAllGenerationBackupsDeleted(db), 2);
        assert.deepEqual(
            listGenerationBackupRecords(db).map((record) => record.deleted_by_user),
            [1, 1]
        );

        db.close();
    });
});
