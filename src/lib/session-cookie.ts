type SecureSessionCookieInput = {
    protocol: string;
    forwardedProto: string | null;
    nodeEnv: string | undefined;
};

export function shouldUseSecureSessionCookie(input: SecureSessionCookieInput): boolean {
    const forwardedProto = input.forwardedProto?.split(',')[0]?.trim().toLowerCase();

    if (forwardedProto) {
        return forwardedProto === 'https';
    }

    return input.protocol === 'https:';
}
