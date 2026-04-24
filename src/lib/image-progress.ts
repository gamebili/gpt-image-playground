export type StreamingMode = 'generate' | 'edit';

export function getStreamingStatusText(mode: StreamingMode, updateCount: number): string {
    if (updateCount <= 0) {
        return mode === 'edit' ? '正在生成编辑预览...' : '正在生成预览...';
    }

    return mode === 'edit' ? `已收到 ${updateCount} 次编辑预览` : `已收到 ${updateCount} 次过程预览`;
}
