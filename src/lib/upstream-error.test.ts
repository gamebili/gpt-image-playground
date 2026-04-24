import assert from 'node:assert/strict';
import test from 'node:test';

import { getUpstreamErrorMessage } from './upstream-error.ts';

test('getUpstreamErrorMessage replaces SDK JSON parse failures with a provider-oriented message', () => {
    const message = getUpstreamErrorMessage(
        new SyntaxError(`Unexpected token 'A', "All suppli"... is not valid JSON`)
    );

    assert.equal(
        message,
        'Upstream image provider returned a non-JSON streaming error. The provider likely failed all suppliers. Please retry later or disable streaming for this edit.'
    );
});

test('getUpstreamErrorMessage preserves ordinary Error messages', () => {
    assert.equal(getUpstreamErrorMessage(new Error('Image generation failed')), 'Image generation failed');
});

test('getUpstreamErrorMessage uses fallback for unknown errors', () => {
    assert.equal(getUpstreamErrorMessage(null, 'fallback message'), 'fallback message');
});
