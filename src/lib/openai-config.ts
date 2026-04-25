import { ProxyAgent } from 'undici';

type BuildOpenAIClientOptionsInput = {
    apiKey: string;
    baseURL?: string;
    proxyURL?: string;
};

type OpenAIProxyEnvironment = Record<string, string | undefined>;

export function normalizeOpenAIBaseUrl(baseUrl: string | undefined): string | undefined {
    if (!baseUrl) {
        return undefined;
    }

    try {
        const url = new URL(baseUrl);
        const pathname = url.pathname.replace(/\/+$/, '');

        // OpenAI-compatible gateways often live under /v1 even when users paste only the bare origin.
        if (pathname === '') {
            url.pathname = '/v1';
        }

        return url.toString().replace(/\/$/, '');
    } catch {
        return baseUrl.replace(/\/$/, '');
    }
}

export function resolveOpenAIProxyUrl(env: OpenAIProxyEnvironment): string | undefined {
    const proxyURL =
        env.OPENAI_API_PROXY_URL?.trim() ||
        env.HTTP_PROXY?.trim() ||
        env.http_proxy?.trim() ||
        env.HTTPS_PROXY?.trim() ||
        env.https_proxy?.trim();

    return proxyURL || undefined;
}

export function buildOpenAIClientOptions({ apiKey, baseURL, proxyURL }: BuildOpenAIClientOptionsInput) {
    const normalizedBaseURL = normalizeOpenAIBaseUrl(baseURL);
    const normalizedProxyURL = proxyURL?.trim();

    return {
        apiKey,
        baseURL: normalizedBaseURL,
        fetchOptions: normalizedProxyURL
            ? {
                  dispatcher: new ProxyAgent(normalizedProxyURL)
              }
            : undefined
    };
}
