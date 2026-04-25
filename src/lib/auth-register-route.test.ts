import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';

import { createUser, getUserCount, openAuthDatabase } from './auth.ts';

function withTempAuthDb(callback: () => Promise<void>) {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'auth-register-route-'));
    const previousAuthDbPath = process.env.AUTH_DB_PATH;
    const previousAppPassword = process.env.APP_PASSWORD;
    const previousAllowSignup = process.env.ALLOW_SIGNUP;

    process.env.AUTH_DB_PATH = path.join(dir, 'auth.sqlite');
    delete process.env.APP_PASSWORD;
    delete process.env.ALLOW_SIGNUP;

    return callback().finally(() => {
        if (previousAuthDbPath === undefined) {
            delete process.env.AUTH_DB_PATH;
        } else {
            process.env.AUTH_DB_PATH = previousAuthDbPath;
        }

        if (previousAppPassword === undefined) {
            delete process.env.APP_PASSWORD;
        } else {
            process.env.APP_PASSWORD = previousAppPassword;
        }

        if (previousAllowSignup === undefined) {
            delete process.env.ALLOW_SIGNUP;
        } else {
            process.env.ALLOW_SIGNUP = previousAllowSignup;
        }

        fs.rmSync(dir, { recursive: true, force: true });
    });
}

test('registration creates an account but leaves login as a separate step', async () => {
    await withTempAuthDb(async () => {
        const db = openAuthDatabase();
        const user = createUser({ username: 'alice', password: 'secret' }, db);

        assert.equal(user.username, 'alice');
        assert.equal(getUserCount(db), 1);

        db.close();
    });
});
