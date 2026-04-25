import { NextRequest, NextResponse } from 'next/server';

import { isSignupAllowed } from '@/lib/auth';
import { noStoreHeaders } from '@/lib/no-store';
import { getCurrentUser } from '@/lib/request-auth';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
    const user = getCurrentUser(request);
    return NextResponse.json(
        {
            authenticated: !!user,
            user,
            signupAllowed: isSignupAllowed(),
            signupCodeRequired: !!process.env.APP_PASSWORD,
            passwordRequired: false
        },
        { headers: noStoreHeaders }
    );
}
