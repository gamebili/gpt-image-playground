import test from 'node:test';
import assert from 'node:assert/strict';

import { buildOpenAIClientOptions, normalizeOpenAIBaseUrl } from './openai-config.ts';

test('normalizeOpenAIBaseUrl appends /v1 for bare origins', () => {
    assert.equal(normalizeOpenAIBaseUrl('https://api.aig-ai.com/'), 'https://api.aig-ai.com/v1');
});

test('buildOpenAIClientOptions omits proxy fetch options when no proxy is configured', () => {
    const options = buildOpenAIClientOptions({
        apiKey: 'test-key',
        baseURL: 'https://api.aig-ai.com/'
    });

    assert.equal(options.apiKey, 'test-key');
    assert.equal(options.baseURL, 'https://api.aig-ai.com/v1');
    assert.equal(options.fetchOptions, undefined);
});

test('buildOpenAIClientOptions attaches an undici proxy dispatcher when a proxy is configured', () => {
    const options = buildOpenAIClientOptions({
        apiKey: 'test-key',
        baseURL: 'https://api.aig-ai.com/v1',
        proxyURL: 'http://192.168.1.35:8080'
    });

    assert.equal(options.apiKey, 'test-key');
    assert.equal(options.baseURL, 'https://api.aig-ai.com/v1');
    assert.ok(options.fetchOptions);
    assert.equal(typeof options.fetchOptions, 'object');
    assert.ok('dispatcher' in options.fetchOptions);
    assert.equal(options.fetchOptions?.dispatcher?.constructor?.name, 'ProxyAgent');
});
