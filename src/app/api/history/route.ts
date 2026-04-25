import { NextRequest, NextResponse } from 'next/server';

import { listGenerationHistoryBatches } from '@/lib/generation-backup';
import { noStoreHeaders } from '@/lib/no-store';
import { requireCurrentUser } from '@/lib/request-auth';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
    const user = requireCurrentUser(request);
    if (user instanceof NextResponse) {
        return user;
    }

    const history = listGenerationHistoryBatches(user.id).map((batch) => ({
        timestamp: batch.batch_timestamp,
        images: batch.images.map((image) => ({ filename: image.filename })),
        storageModeUsed: batch.storage_mode_used,
        durationMs: batch.duration_ms ?? 0,
        quality: batch.quality ?? 'auto',
        background: batch.background ?? 'auto',
        moderation: batch.moderation ?? 'auto',
        output_format: batch.output_format ?? 'png',
        prompt: batch.prompt,
        mode: batch.mode,
        costDetails: null,
        model: batch.model
    }));

    return NextResponse.json({ history }, { headers: noStoreHeaders });
}
