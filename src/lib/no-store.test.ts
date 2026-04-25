import assert from 'node:assert/strict';
import test from 'node:test';

import { noStoreHeaders } from './no-store.ts';

test('noStoreHeaders disables browser and intermediary caching', () => {
    assert.equal(noStoreHeaders['Cache-Control'], 'no-store');
});
