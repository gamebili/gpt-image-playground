import test from 'node:test';
import assert from 'node:assert/strict';

import { parseStreamingEvent } from './streaming-events.ts';

test('parseStreamingEvent returns partial image events', () => {
    const event = parseStreamingEvent('{"type":"partial_image","index":0,"b64_json":"abc"}');

    assert.equal(event.type, 'partial_image');
    assert.equal(event.index, 0);
});

test('parseStreamingEvent throws for streaming error events so the UI can surface the failure', () => {
    assert.throws(
        () =>
            parseStreamingEvent(
                '{"type":"error","error":"Your request was rejected by the safety system."}'
            ),
        /rejected by the safety system/
    );
});
