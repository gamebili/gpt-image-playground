import fs from 'fs/promises';
import { NextRequest, NextResponse } from 'next/server';
import path from 'path';

import { markGenerationBackupsDeletedByFilenames } from '@/lib/generation-backup';
import { requireCurrentUser } from '@/lib/request-auth';

const outputDir = path.resolve(process.cwd(), 'generated-images');

type DeleteRequestBody = {
    filenames: string[];
};

type FileDeletionResult = {
    filename: string;
    success: boolean;
    error?: string;
};

export async function POST(request: NextRequest) {
    console.log('Received POST request to /api/image-delete');

    const user = requireCurrentUser(request);
    if (user instanceof NextResponse) {
        return user;
    }

    let requestBody: DeleteRequestBody;
    try {
        requestBody = await request.json();
    } catch (e) {
        console.error('Error parsing request body for /api/image-delete:', e);
        return NextResponse.json({ error: '请求体无效：必须是 JSON。' }, { status: 400 });
    }

    const { filenames } = requestBody;

    if (!Array.isArray(filenames) || filenames.some((fn) => typeof fn !== 'string')) {
        return NextResponse.json({ error: '文件名无效：必须是字符串数组。' }, { status: 400 });
    }

    if (filenames.length === 0) {
        return NextResponse.json({ message: '没有提供需要删除的文件名。', results: [] }, { status: 200 });
    }

    const deletionResults: FileDeletionResult[] = [];

    for (const filename of filenames) {
        if (!filename || filename.includes('..') || filename.includes('/') || filename.includes('\\')) {
            console.warn(`Invalid filename for deletion: ${filename}`);
            deletionResults.push({ filename, success: false, error: '文件名格式无效。' });
            continue;
        }

        const filepath = path.join(outputDir, user.id, filename);

        try {
            await fs.unlink(filepath);
            console.log(`Successfully deleted image: ${filepath}`);
            deletionResults.push({ filename, success: true });
        } catch (error: unknown) {
            console.error(`Error deleting image ${filepath}:`, error);
            if (typeof error === 'object' && error !== null && 'code' in error && error.code === 'ENOENT') {
                deletionResults.push({ filename, success: false, error: '文件不存在。' });
            } else {
                deletionResults.push({ filename, success: false, error: '删除文件失败。' });
            }
        }
    }

    const allSucceeded = deletionResults.every((r) => r.success);
    try {
        const markedCount = markGenerationBackupsDeletedByFilenames(user.id, filenames);
        console.log(`Soft-marked ${markedCount} generation backup batch(es) as deleted.`);
    } catch (error) {
        console.error('Failed to soft-mark deleted generation backups:', error);
    }

    return NextResponse.json(
        {
            message: allSucceeded ? '所有文件已删除。' : '部分文件无法删除。',
            results: deletionResults
        },
        { status: allSucceeded ? 200 : 207 } // 207 Multi-Status if some failed
    );
}
