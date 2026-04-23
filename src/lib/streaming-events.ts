export type ParsedStreamingEvent = {
    type: 'partial_image' | 'completed' | 'error' | 'done';
    index?: number;
    partial_image_index?: number;
    b64_json?: string;
    filename?: string;
    path?: string;
    output_format?: string;
    usage?: {
        input_tokens_details?: {
            text_tokens?: number;
            image_tokens?: number;
        };
        output_tokens?: number;
    };
    images?: Array<{
        filename: string;
        b64_json?: string;
        path?: string;
        output_format?: string;
    }>;
    error?: string;
};

export function parseStreamingEvent(jsonStr: string): ParsedStreamingEvent {
    const event = JSON.parse(jsonStr) as ParsedStreamingEvent;

    if (event.type === 'error') {
        throw new Error(event.error || 'Streaming error occurred');
    }

    return event;
}
