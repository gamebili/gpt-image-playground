import { NextRequest, NextResponse } from 'next/server';

import { noStoreHeaders } from '@/lib/no-store';
import { clearSessionCookie, deleteRequestSession } from '@/lib/request-auth';

export async function POST(request: NextRequest) {
    deleteRequestSession(request);
    const response = NextResponse.json({ ok: true }, { headers: noStoreHeaders });
    clearSessionCookie(request, response);
    return response;
}
