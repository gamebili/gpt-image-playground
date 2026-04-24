const NON_JSON_STREAMING_ERROR =
    '上游图片服务返回了非 JSON 的流式错误。可能是供应商全部失败，请稍后重试，或在本次编辑中关闭流式生成。';

export function getUpstreamErrorMessage(error: unknown, fallback = '发生未知错误。'): string {
    if (error instanceof SyntaxError && /Unexpected token .*JSON/.test(error.message)) {
        return NON_JSON_STREAMING_ERROR;
    }

    if (error instanceof Error) {
        return error.message;
    }

    if (typeof error === 'object' && error !== null && 'message' in error && typeof error.message === 'string') {
        return error.message;
    }

    return fallback;
}
