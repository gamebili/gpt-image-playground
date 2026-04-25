import { NextRequest, NextResponse } from 'next/server';

import { deleteSession, getSessionUser, type AuthUser } from '@/lib/auth';
import { shouldUseSecureSessionCookie } from '@/lib/session-cookie';

export const SESSION_COOKIE_NAME = 'image_playground_session';

export function getSessionToken(request: NextRequest): string | undefined {
    return request.cookies.get(SESSION_COOKIE_NAME)?.value;
}

export function getCurrentUser(request: NextRequest): AuthUser | null {
    return getSessionUser(getSessionToken(request));
}

export function requireCurrentUser(request: NextRequest): AuthUser | NextResponse {
    const user = getCurrentUser(request);
    if (!user) {
        return NextResponse.json({ error: '未登录。' }, { status: 401 });
    }

    return user;
}

function getSecureCookieSetting(request: NextRequest): boolean {
    return shouldUseSecureSessionCookie({
        protocol: request.nextUrl.protocol,
        forwardedProto: request.headers.get('x-forwarded-proto'),
        nodeEnv: process.env.NODE_ENV
    });
}

export function setSessionCookie(request: NextRequest, response: NextResponse, token: string, expiresAt: number): void {
    response.cookies.set({
        name: SESSION_COOKIE_NAME,
        value: token,
        httpOnly: true,
        sameSite: 'lax',
        secure: getSecureCookieSetting(request),
        path: '/',
        expires: new Date(expiresAt)
    });
}

export function clearSessionCookie(request: NextRequest, response: NextResponse): void {
    response.cookies.set({
        name: SESSION_COOKIE_NAME,
        value: '',
        httpOnly: true,
        sameSite: 'lax',
        secure: getSecureCookieSetting(request),
        path: '/',
        expires: new Date(0)
    });
}

export function deleteRequestSession(request: NextRequest): void {
    deleteSession(getSessionToken(request));
}
