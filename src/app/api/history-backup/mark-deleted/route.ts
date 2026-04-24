import crypto from 'crypto';
import { NextRequest, NextResponse } from 'next/server';

import { markAllGenerationBackupsDeleted, markGenerationBackupsDeletedByFilenames } from '@/lib/generation-backup';

type MarkDeletedRequestBody = {
    all?: boolean;
    filenames?: string[];
    passwordHash?: string;
};

function sha256(data: string): string {
    return crypto.createHash('sha256').update(data).digest('hex');
}

function isValidFilename(filename: string): boolean {
    return !!filename && !filename.includes('..') && !filename.includes('/') && !filename.includes('\\');
}

export async function POST(request: NextRequest) {
    let body: MarkDeletedRequestBody;

    try {
        body = await request.json();
    } catch (error) {
        console.error('Error parsing request body for /api/history-backup/mark-deleted:', error);
        return NextResponse.json({ error: '请求体无效：必须是 JSON。' }, { status: 400 });
    }

    if (process.env.APP_PASSWORD) {
        if (!body.passwordHash) {
            return NextResponse.json({ error: '未授权：缺少密码哈希。' }, { status: 401 });
        }

        const serverPasswordHash = sha256(process.env.APP_PASSWORD);
        if (body.passwordHash !== serverPasswordHash) {
            return NextResponse.json({ error: '未授权：密码无效。' }, { status: 401 });
        }
    }

    try {
        if (body.all) {
            const markedCount = markAllGenerationBackupsDeleted();
            return NextResponse.json({ markedCount });
        }

        const filenames = body.filenames ?? [];
        if (!Array.isArray(filenames) || filenames.some((filename) => typeof filename !== 'string')) {
            return NextResponse.json({ error: '文件名无效：必须是字符串数组。' }, { status: 400 });
        }

        const validFilenames = filenames.filter(isValidFilename);
        const markedCount = markGenerationBackupsDeletedByFilenames(validFilenames);

        return NextResponse.json({ markedCount });
    } catch (error) {
        console.error('Failed to mark generation backups deleted:', error);
        return NextResponse.json({ error: '标记生成备份删除状态失败。' }, { status: 500 });
    }
}
