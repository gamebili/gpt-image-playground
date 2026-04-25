import { NextRequest, NextResponse } from 'next/server';

import { createUser, isSignupAllowed } from '@/lib/auth';
import { noStoreHeaders } from '@/lib/no-store';

type RegisterRequestBody = {
    username?: string;
    password?: string;
    signupCode?: string;
};

export async function POST(request: NextRequest) {
    let body: RegisterRequestBody;

    try {
        body = await request.json();
    } catch {
        return NextResponse.json({ error: '请求体无效：必须是 JSON。' }, { status: 400 });
    }

    if (!isSignupAllowed()) {
        return NextResponse.json({ error: '当前不允许注册新用户。' }, { status: 403 });
    }

    if (process.env.APP_PASSWORD && body.signupCode !== process.env.APP_PASSWORD) {
        return NextResponse.json({ error: '注册码无效。' }, { status: 401 });
    }

    try {
        const user = createUser({
            username: body.username ?? '',
            password: body.password ?? ''
        });
        return NextResponse.json({ user, loginRequired: true }, { headers: noStoreHeaders });
    } catch (error) {
        return NextResponse.json(
            { error: error instanceof Error ? error.message : '注册失败。' },
            { status: 400 }
        );
    }
}
