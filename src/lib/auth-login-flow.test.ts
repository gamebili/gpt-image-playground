import assert from 'node:assert/strict';
import test from 'node:test';

import { getPostLoginAuthError } from './auth-login-flow.ts';

test('getPostLoginAuthError explains when login response did not establish a session', () => {
    assert.equal(
        getPostLoginAuthError({
            authenticated: false,
            user: null
        }),
        '登录请求已完成，但会话没有生效。请刷新页面后重试。'
    );
});

test('getPostLoginAuthError returns null when login establishes a session', () => {
    assert.equal(
        getPostLoginAuthError({
            authenticated: true,
            user: { id: 'user-a', username: 'alice' }
        }),
        null
    );
});
