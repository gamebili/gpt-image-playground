import assert from 'node:assert/strict';
import test from 'node:test';

import { cleanOptimizedPrompt } from './prompt-optimizer.ts';

test('cleanOptimizedPrompt trims wrapping quotes and markdown fences', () => {
    assert.equal(cleanOptimizedPrompt('```text\n"make the dog wear a red hat"\n```'), 'make the dog wear a red hat');
});

test('cleanOptimizedPrompt preserves normal prompt text', () => {
    assert.equal(cleanOptimizedPrompt('Add cinematic rim lighting.'), 'Add cinematic rim lighting.');
});
