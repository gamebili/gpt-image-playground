# Multi-User Support Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Convert the single shared-password image playground into a real multi-user app with per-user sessions, generated images, and history.

**Architecture:** Add a local SQLite auth/session store, require a session cookie for protected API routes, and attach every generated batch/image to a user. Filesystem images move under `generated-images/<userId>/`, and browser history becomes a projection of server-owned per-user history.

**Tech Stack:** Next.js route handlers, React client components, Node `crypto`, Node `sqlite`, HTTP-only cookies, existing Node test runner.

---

### Task 1: Auth Core

**Files:**
- Create: `src/lib/auth.ts`
- Test: `src/lib/auth.test.ts`

- [ ] Write failing tests for creating users, preventing duplicates, verifying passwords, creating sessions, reading sessions, and deleting sessions.
- [ ] Implement SQLite schema: `users` and `sessions`.
- [ ] Implement `createUser`, `verifyUserCredentials`, `createSession`, `getSessionUser`, `deleteSession`, `getUserCount`, and `isSignupAllowed`.
- [ ] Run `node --test src/lib/auth.test.ts`.

### Task 2: Request Auth Helpers

**Files:**
- Create: `src/lib/request-auth.ts`
- Modify: `src/app/api/auth-status/route.ts`
- Create: `src/app/api/auth/login/route.ts`
- Create: `src/app/api/auth/register/route.ts`
- Create: `src/app/api/auth/logout/route.ts`

- [ ] Add helpers to read the session cookie, require a user, and create/clear secure cookie options.
- [ ] Replace password status with `{ authenticated, user, signupAllowed }`.
- [ ] Add login/register/logout routes.
- [ ] Keep `APP_PASSWORD` as an optional signup code: when set, registration must provide it.

### Task 3: User-Owned Generation Backups

**Files:**
- Modify: `src/lib/generation-backup.ts`
- Modify: `src/lib/generation-backup.test.ts`
- Create: `src/app/api/history/route.ts`

- [ ] Add `user_id` to backup batches.
- [ ] Backfill existing rows to a legacy user marker so migrations are deterministic.
- [ ] List and mark history by `user_id`.
- [ ] Add `/api/history` GET for the current user's batches.
- [ ] Run `node --test src/lib/generation-backup.test.ts`.

### Task 4: Protect Image APIs

**Files:**
- Modify: `src/app/api/images/route.ts`
- Modify: `src/app/api/image/[filename]/route.ts`
- Modify: `src/app/api/image-delete/route.ts`
- Modify: `src/app/api/history-backup/mark-deleted/route.ts`
- Modify: `src/app/api/prompt-optimize/route.ts`

- [ ] Require login for generation, prompt optimization, image read, image delete, and history delete.
- [ ] Save filesystem images under `generated-images/<userId>/`.
- [ ] Generate filenames with UUIDs to avoid concurrent collisions.
- [ ] Ensure delete and read only operate in the authenticated user's directory/history.

### Task 5: Client Login and Server History

**Files:**
- Create: `src/components/auth-dialog.tsx`
- Modify: `src/app/page.tsx`
- Modify: `src/components/history-panel.tsx`

- [ ] Replace shared password dialog with login/register UI.
- [ ] Fetch `/api/auth-status` on load and block app actions until authenticated.
- [ ] Fetch `/api/history` after login and after generation/delete changes.
- [ ] Keep IndexedDB image blobs local, but keep history metadata server-owned.
- [ ] Add logout button and clear local UI state on logout.

### Task 6: Verification

**Files:**
- Existing test files and app build.

- [ ] Run `node --test src/lib/*.test.ts`.
- [ ] Run `npm run lint`.
- [ ] Run `npm run build`.
