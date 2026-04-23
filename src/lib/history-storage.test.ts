import assert from 'node:assert/strict';
import test from 'node:test';

import { mergeHistoryEntries, parseStoredHistory } from './history-storage.ts';

type TestHistoryItem = {
    timestamp: number;
    label: string;
};

test('mergeHistoryEntries keeps entries from multiple tabs and sorts newest first', () => {
    const firstTabEntry: TestHistoryItem = { timestamp: 1000, label: 'first-tab' };
    const secondTabEntry: TestHistoryItem = { timestamp: 2000, label: 'second-tab' };

    assert.deepEqual(mergeHistoryEntries([firstTabEntry], [secondTabEntry]), [secondTabEntry, firstTabEntry]);
});

test('mergeHistoryEntries prefers earlier lists when timestamps collide', () => {
    const currentEntry: TestHistoryItem = { timestamp: 1000, label: 'current-state' };
    const staleStoredEntry: TestHistoryItem = { timestamp: 1000, label: 'stale-storage' };

    assert.deepEqual(mergeHistoryEntries([currentEntry], [staleStoredEntry]), [currentEntry]);
});

test('parseStoredHistory ignores invalid JSON and invalid shapes', () => {
    assert.deepEqual(parseStoredHistory<TestHistoryItem>('not json'), []);
    assert.deepEqual(parseStoredHistory<TestHistoryItem>('{"timestamp":1}'), []);
    assert.deepEqual(parseStoredHistory<TestHistoryItem>('[{"timestamp":"1"}]'), []);
});
