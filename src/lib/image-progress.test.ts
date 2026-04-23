import test from 'node:test';
import assert from 'node:assert/strict';

import { getStreamingStatusText } from './image-progress.ts';

test('getStreamingStatusText shows initial generate state before any preview arrives', () => {
    assert.equal(getStreamingStatusText('generate', 0), 'Generating preview...');
});

test('getStreamingStatusText mentions preview count while generating', () => {
    assert.equal(getStreamingStatusText('generate', 2), 'Received 2 preview updates');
});

test('getStreamingStatusText uses edit wording in edit mode', () => {
    assert.equal(getStreamingStatusText('edit', 1), 'Received 1 edit preview');
});
