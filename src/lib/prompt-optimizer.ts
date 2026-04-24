export function cleanOptimizedPrompt(text: string): string {
    const withoutFence = text
        .trim()
        .replace(/^```(?:text|markdown)?\s*/i, '')
        .replace(/```$/i, '')
        .trim();

    return withoutFence.replace(/^["']|["']$/g, '').trim();
}
