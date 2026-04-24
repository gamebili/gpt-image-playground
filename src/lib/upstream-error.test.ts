import assert from 'node:assert/strict';
import test from 'node:test';

import { getUpstreamErrorMessage } from './upstream-error.ts';

test('getUpstreamErrorMessage replaces SDK JSON parse failures with a provider-oriented message', () => {
    const message = getUpstreamErrorMessage(
        new SyntaxError(`Unexpected token 'A', "All suppli"... is not valid JSON`)
    );

    assert.equal(
        message,
        '上游图片服务返回了非 JSON 的流式错误。可能是供应商全部失败，请稍后重试，或在本次编辑中关闭流式生成。'
    );
});

test('getUpstreamErrorMessage preserves ordinary Error messages', () => {
    assert.equal(getUpstreamErrorMessage(new Error('Image generation failed')), 'Image generation failed');
});

test('getUpstreamErrorMessage uses fallback for unknown errors', () => {
    assert.equal(getUpstreamErrorMessage(null, 'fallback message'), 'fallback message');
});
