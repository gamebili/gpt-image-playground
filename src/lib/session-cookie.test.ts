import assert from 'node:assert/strict';
import test from 'node:test';

import { shouldUseSecureSessionCookie } from './session-cookie.ts';

test('shouldUseSecureSessionCookie returns false for plain HTTP even in production', () => {
    assert.equal(
        shouldUseSecureSessionCookie({
            protocol: 'http:',
            forwardedProto: null,
            nodeEnv: 'production'
        }),
        false
    );
});

test('shouldUseSecureSessionCookie returns true for direct HTTPS', () => {
    assert.equal(
        shouldUseSecureSessionCookie({
            protocol: 'https:',
            forwardedProto: null,
            nodeEnv: 'production'
        }),
        true
    );
});

test('shouldUseSecureSessionCookie trusts HTTPS forwarded protocol from a proxy', () => {
    assert.equal(
        shouldUseSecureSessionCookie({
            protocol: 'http:',
            forwardedProto: 'https',
            nodeEnv: 'production'
        }),
        true
    );
});
