import test from 'node:test';
import assert from 'node:assert/strict';

import { getStreamingStatusText } from './image-progress.ts';

test('getStreamingStatusText shows initial generate state before any preview arrives', () => {
    assert.equal(getStreamingStatusText('generate', 0), '正在生成预览...');
});

test('getStreamingStatusText mentions preview count while generating', () => {
    assert.equal(getStreamingStatusText('generate', 2), '已收到 2 次过程预览');
});

test('getStreamingStatusText uses edit wording in edit mode', () => {
    assert.equal(getStreamingStatusText('edit', 1), '已收到 1 次编辑预览');
});
