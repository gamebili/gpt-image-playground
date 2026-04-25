import crypto from 'crypto';
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

const DEFAULT_AUTH_DB_PATH = path.resolve(process.cwd(), '.server-data', 'auth.sqlite');
const PASSWORD_KEY_LENGTH = 64;
const SESSION_TTL_MS = 1000 * 60 * 60 * 24 * 30;

function getDatabaseSyncConstructor(): DatabaseSyncConstructor {
    if (!databaseSyncConstructor) {
        const sqlite = require('node:sqlite') as { DatabaseSync: DatabaseSyncConstructor };
        databaseSyncConstructor = sqlite.DatabaseSync;
    }

    return databaseSyncConstructor;
}

export type AuthUser = {
    id: string;
    username: string;
    normalizedUsername: string;
};

export type AuthSession = {
    token: string;
    expiresAt: number;
};

export type SignupEnvironment = Record<string, string | undefined>;

export function getAuthDbPath(): string {
    return process.env.AUTH_DB_PATH || DEFAULT_AUTH_DB_PATH;
}

export function openAuthDatabase(dbPath = getAuthDbPath()): DatabaseSync {
    fs.mkdirSync(path.dirname(dbPath), { recursive: true });
    const DatabaseSync = getDatabaseSyncConstructor();
    const db = new DatabaseSync(dbPath);
    ensureAuthSchema(db);
    return db;
}

export function ensureAuthSchema(db: DatabaseSync): void {
    db.exec(`
        PRAGMA journal_mode = WAL;
        PRAGMA foreign_keys = ON;

        CREATE TABLE IF NOT EXISTS users (
            id TEXT PRIMARY KEY,
            username TEXT NOT NULL,
            normalized_username TEXT NOT NULL UNIQUE,
            password_hash TEXT NOT NULL,
            salt TEXT NOT NULL,
            created_at INTEGER NOT NULL
        );

        CREATE TABLE IF NOT EXISTS sessions (
            token_hash TEXT PRIMARY KEY,
            user_id TEXT NOT NULL,
            created_at INTEGER NOT NULL,
            expires_at INTEGER NOT NULL,
            FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
        );

        CREATE INDEX IF NOT EXISTS idx_sessions_user_id
            ON sessions(user_id);
        CREATE INDEX IF NOT EXISTS idx_sessions_expires_at
            ON sessions(expires_at);
    `);
}

function normalizeUsername(username: string): string {
    return username.trim().toLowerCase();
}

function validateUsername(username: string): string {
    const trimmed = username.trim();
    if (trimmed.length < 2 || trimmed.length > 40) {
        throw new Error('用户名长度必须在 2 到 40 个字符之间。');
    }

    if (!/^[a-zA-Z0-9_.-]+$/.test(trimmed)) {
        throw new Error('用户名只能包含字母、数字、下划线、点和短横线。');
    }

    return trimmed;
}

function validatePassword(password: string): void {
    if (password.length < 6) {
        throw new Error('密码至少需要 6 个字符。');
    }
}

function hashPassword(password: string, salt: string): string {
    return crypto.scryptSync(password, salt, PASSWORD_KEY_LENGTH).toString('hex');
}

function hashSessionToken(token: string): string {
    return crypto.createHash('sha256').update(token).digest('hex');
}

function rowToUser(row: Record<string, unknown>): AuthUser {
    return {
        id: String(row.id),
        username: String(row.username),
        normalizedUsername: String(row.normalized_username)
    };
}

export function getUserCount(db?: DatabaseSync): number {
    const activeDb = db ?? openAuthDatabase();
    const shouldClose = !db;

    try {
        const row = activeDb.prepare('SELECT COUNT(*) AS count FROM users').get();
        return Number(row?.count ?? 0);
    } finally {
        if (shouldClose) activeDb.close();
    }
}

export function isSignupAllowed(env: SignupEnvironment = process.env, db?: DatabaseSync): boolean {
    if (getUserCount(db) === 0) {
        return true;
    }

    return env.ALLOW_SIGNUP === 'true' || env.ALLOW_SIGNUP === '1';
}

export function createUser(
    input: {
        username: string;
        password: string;
    },
    db?: DatabaseSync
): AuthUser {
    const activeDb = db ?? openAuthDatabase();
    const shouldClose = !db;

    try {
        const username = validateUsername(input.username);
        validatePassword(input.password);

        const normalizedUsername = normalizeUsername(username);
        const existing = activeDb
            .prepare('SELECT id FROM users WHERE normalized_username = ?')
            .get(normalizedUsername);

        if (existing) {
            throw new Error('用户名已存在。');
        }

        const id = crypto.randomUUID();
        const salt = crypto.randomBytes(16).toString('hex');
        const passwordHash = hashPassword(input.password, salt);

        activeDb
            .prepare(
                'INSERT INTO users (id, username, normalized_username, password_hash, salt, created_at) VALUES (?, ?, ?, ?, ?, ?)'
            )
            .run(id, username, normalizedUsername, passwordHash, salt, Date.now());

        return { id, username, normalizedUsername };
    } finally {
        if (shouldClose) activeDb.close();
    }
}

export function verifyUserCredentials(
    input: {
        username: string;
        password: string;
    },
    db?: DatabaseSync
): AuthUser | null {
    const activeDb = db ?? openAuthDatabase();
    const shouldClose = !db;

    try {
        const row = activeDb
            .prepare('SELECT * FROM users WHERE normalized_username = ?')
            .get(normalizeUsername(input.username));

        if (!row) {
            return null;
        }

        const expectedHash = String(row.password_hash);
        const actualHash = hashPassword(input.password, String(row.salt));
        const expected = Buffer.from(expectedHash, 'hex');
        const actual = Buffer.from(actualHash, 'hex');

        if (expected.length !== actual.length || !crypto.timingSafeEqual(expected, actual)) {
            return null;
        }

        return rowToUser(row);
    } finally {
        if (shouldClose) activeDb.close();
    }
}

export function createSession(userId: string, db?: DatabaseSync): AuthSession {
    const activeDb = db ?? openAuthDatabase();
    const shouldClose = !db;

    try {
        const token = crypto.randomBytes(32).toString('base64url');
        const tokenHash = hashSessionToken(token);
        const now = Date.now();
        const expiresAt = now + SESSION_TTL_MS;

        activeDb
            .prepare('INSERT INTO sessions (token_hash, user_id, created_at, expires_at) VALUES (?, ?, ?, ?)')
            .run(tokenHash, userId, now, expiresAt);

        return { token, expiresAt };
    } finally {
        if (shouldClose) activeDb.close();
    }
}

export function getSessionUser(token: string | undefined | null, db?: DatabaseSync): AuthUser | null {
    if (!token) {
        return null;
    }

    const activeDb = db ?? openAuthDatabase();
    const shouldClose = !db;

    try {
        const row = activeDb
            .prepare(
                `
                    SELECT u.id, u.username, u.normalized_username
                    FROM sessions s
                    JOIN users u ON u.id = s.user_id
                    WHERE s.token_hash = ?
                      AND s.expires_at > ?
                `
            )
            .get(hashSessionToken(token), Date.now());

        return row ? rowToUser(row) : null;
    } finally {
        if (shouldClose) activeDb.close();
    }
}

export function deleteSession(token: string | undefined | null, db?: DatabaseSync): void {
    if (!token) {
        return;
    }

    const activeDb = db ?? openAuthDatabase();
    const shouldClose = !db;

    try {
        activeDb.prepare('DELETE FROM sessions WHERE token_hash = ?').run(hashSessionToken(token));
    } finally {
        if (shouldClose) activeDb.close();
    }
}
