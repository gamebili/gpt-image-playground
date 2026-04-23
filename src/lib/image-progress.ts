export type StreamingMode = 'generate' | 'edit';

export function getStreamingStatusText(mode: StreamingMode, updateCount: number): string {
    if (updateCount <= 0) {
        return mode === 'edit' ? 'Generating edit preview...' : 'Generating preview...';
    }

    const noun = mode === 'edit' ? 'edit preview' : 'preview update';
    const suffix = updateCount === 1 ? noun : `${noun}s`;

    return `Received ${updateCount} ${suffix}`;
}
