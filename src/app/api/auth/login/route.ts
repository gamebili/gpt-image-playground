import { NextRequest, NextResponse } from 'next/server';

import { createSession, verifyUserCredentials } from '@/lib/auth';
import { noStoreHeaders } from '@/lib/no-store';
import { setSessionCookie } from '@/lib/request-auth';

type LoginRequestBody = {
    username?: string;
    password?: string;
};

export async function POST(request: NextRequest) {
    let body: LoginRequestBody;

    try {
        body = await request.json();
    } catch {
        return NextResponse.json({ error: '请求体无效：必须是 JSON。' }, { status: 400 });
    }

    const user = verifyUserCredentials({
        username: body.username ?? '',
        password: body.password ?? ''
    });

    if (!user) {
        return NextResponse.json({ error: '用户名或密码无效。' }, { status: 401 });
    }

    const session = createSession(user.id);
    const response = NextResponse.json({ user }, { headers: noStoreHeaders });
    setSessionCookie(request, response, session.token, session.expiresAt);
    return response;
}
