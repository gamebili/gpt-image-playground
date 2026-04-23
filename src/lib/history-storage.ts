type HistoryTimestamped = {
    timestamp: number;
};

export const HISTORY_STORAGE_KEY = 'openaiImageHistory';

export function parseStoredHistory<T extends HistoryTimestamped>(raw: string | null): T[] {
    if (!raw) {
        return [];
    }

    try {
        const parsed = JSON.parse(raw) as unknown;
        if (!Array.isArray(parsed)) {
            return [];
        }

        return parsed.filter(
            (item): item is T =>
                typeof item === 'object' &&
                item !== null &&
                'timestamp' in item &&
                typeof item.timestamp === 'number'
        );
    } catch {
        return [];
    }
}

export function mergeHistoryEntries<T extends HistoryTimestamped>(
    ...lists: Array<ReadonlyArray<T> | null | undefined>
): T[] {
    const merged = new Map<number, T>();

    for (const list of lists) {
        if (!list) continue;

        for (const item of list) {
            if (!merged.has(item.timestamp)) {
                merged.set(item.timestamp, item);
            }
        }
    }

    return Array.from(merged.values()).sort((a, b) => b.timestamp - a.timestamp);
}
