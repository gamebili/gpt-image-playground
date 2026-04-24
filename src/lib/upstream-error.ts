const NON_JSON_STREAMING_ERROR =
    'Upstream image provider returned a non-JSON streaming error. The provider likely failed all suppliers. Please retry later or disable streaming for this edit.';

export function getUpstreamErrorMessage(error: unknown, fallback = 'An unexpected error occurred.'): string {
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
