import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';

import {
    createSession,
    createUser,
    deleteSession,
    getSessionUser,
    getUserCount,
    isSignupAllowed,
    openAuthDatabase,
    verifyUserCredentials
} from './auth.ts';

function withTempDb(callback: (dbPath: string) => void) {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'auth-'));
    const dbPath = path.join(dir, 'auth.sqlite');

    try {
        callback(dbPath);
    } finally {
        fs.rmSync(dir, { recursive: true, force: true });
    }
}

test('createUser stores a normalized user and verifyUserCredentials checks the password', () => {
    withTempDb((dbPath) => {
        const db = openAuthDatabase(dbPath);
        const user = createUser({ username: ' Alice ', password: 'secret123' }, db);

        assert.equal(user.username, 'Alice');
        assert.equal(user.normalizedUsername, 'alice');
        assert.equal(getUserCount(db), 1);
        assert.equal(verifyUserCredentials({ username: 'alice', password: 'wrong' }, db), null);

        const verified = verifyUserCredentials({ username: 'ALICE', password: 'secret123' }, db);
        assert.equal(verified?.id, user.id);
        assert.equal(verified?.username, 'Alice');

        db.close();
    });
});

test('createUser rejects duplicate usernames case-insensitively', () => {
    withTempDb((dbPath) => {
        const db = openAuthDatabase(dbPath);

        createUser({ username: 'Alice', password: 'secret123' }, db);
        assert.throws(() => createUser({ username: 'alice', password: 'secret456' }, db), /用户名已存在/);

        db.close();
    });
});

test('createUser accepts six character passwords and rejects shorter passwords', () => {
    withTempDb((dbPath) => {
        const db = openAuthDatabase(dbPath);

        const user = createUser({ username: 'SixPwd', password: 'secret' }, db);
        assert.equal(user.username, 'SixPwd');
        assert.throws(() => createUser({ username: 'ShortPwd', password: 'short' }, db), /密码至少需要 6 个字符/);

        db.close();
    });
});

test('createSession creates an expiring token that can be read and deleted', () => {
    withTempDb((dbPath) => {
        const db = openAuthDatabase(dbPath);
        const user = createUser({ username: 'Bob', password: 'secret123' }, db);
        const session = createSession(user.id, db);

        assert.equal(typeof session.token, 'string');
        assert.ok(session.expiresAt > Date.now());
        assert.equal(getSessionUser(session.token, db)?.id, user.id);

        deleteSession(session.token, db);
        assert.equal(getSessionUser(session.token, db), null);

        db.close();
    });
});

test('isSignupAllowed permits the first user and then respects ALLOW_SIGNUP', () => {
    withTempDb((dbPath) => {
        const db = openAuthDatabase(dbPath);

        assert.equal(isSignupAllowed({}, db), true);
        createUser({ username: 'Carol', password: 'secret123' }, db);
        assert.equal(isSignupAllowed({}, db), false);
        assert.equal(isSignupAllowed({ ALLOW_SIGNUP: 'true' }, db), true);
        assert.equal(isSignupAllowed({ ALLOW_SIGNUP: '1' }, db), true);

        db.close();
    });
});
