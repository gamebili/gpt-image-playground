import type { ParsedStreamingEvent } from '@/lib/streaming-events';

export function getStreamingPreviewKey(event: ParsedStreamingEvent, fallbackIndex: number): number {
    return event.partial_image_index ?? event.index ?? fallbackIndex;
}
