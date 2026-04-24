import assert from 'node:assert/strict';
import test from 'node:test';

import { getStreamingPreviewKey } from './streaming-preview.ts';

test('getStreamingPreviewKey prefers partial image index so multiple previews do not overwrite each other', () => {
    assert.equal(
        getStreamingPreviewKey(
            {
                type: 'partial_image',
                index: 0,
                partial_image_index: 2,
                b64_json: 'abc'
            },
            0
        ),
        2
    );
});

test('getStreamingPreviewKey falls back to event index and then received order', () => {
    assert.equal(getStreamingPreviewKey({ type: 'partial_image', index: 1, b64_json: 'abc' }, 0), 1);
    assert.equal(getStreamingPreviewKey({ type: 'partial_image', b64_json: 'abc' }, 3), 3);
});
