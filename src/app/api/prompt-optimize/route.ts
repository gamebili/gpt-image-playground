import crypto from 'crypto';
import { NextRequest, NextResponse } from 'next/server';
import OpenAI from 'openai';

import { buildOpenAIClientOptions, normalizeOpenAIBaseUrl, resolveOpenAIProxyUrl } from '@/lib/openai-config';
import { cleanOptimizedPrompt } from '@/lib/prompt-optimizer';
import { getUpstreamErrorMessage } from '@/lib/upstream-error';

const openai = new OpenAI({
    ...buildOpenAIClientOptions({
        apiKey: process.env.OPENAI_API_KEY || '',
        baseURL: process.env.OPENAI_API_BASE_URL,
        proxyURL: resolveOpenAIProxyUrl(process.env)
    })
});

const MAX_OPTIMIZER_IMAGES = 10;
const MAX_IMAGE_BYTES = 20 * 1024 * 1024;

function sha256(data: string): string {
    return crypto.createHash('sha256').update(data).digest('hex');
}

async function fileToDataUrl(file: File): Promise<string> {
    const buffer = Buffer.from(await file.arrayBuffer());
    return `data:${file.type || 'image/png'};base64,${buffer.toString('base64')}`;
}

export async function POST(request: NextRequest) {
    if (process.env.OPENAI_API_BASE_URL) {
        console.log(`Using OpenAI base URL: ${normalizeOpenAIBaseUrl(process.env.OPENAI_API_BASE_URL)}`);
    }
    const openAIProxyUrl = resolveOpenAIProxyUrl(process.env);
    if (openAIProxyUrl) {
        console.log(`Using OpenAI proxy: ${openAIProxyUrl}`);
    }

    if (!process.env.OPENAI_API_KEY) {
        return NextResponse.json({ error: '服务器配置错误：未找到 API Key。' }, { status: 500 });
    }

    try {
        const formData = await request.formData();

        if (process.env.APP_PASSWORD) {
            const clientPasswordHash = formData.get('passwordHash') as string | null;
            if (!clientPasswordHash) {
                return NextResponse.json({ error: '未授权：缺少密码哈希。' }, { status: 401 });
            }

            const serverPasswordHash = sha256(process.env.APP_PASSWORD);
            if (clientPasswordHash !== serverPasswordHash) {
                return NextResponse.json({ error: '未授权：密码无效。' }, { status: 401 });
            }
        }

        const prompt = ((formData.get('prompt') as string | null) || '').trim();
        const targetModel = ((formData.get('targetModel') as string | null) || 'gpt-image-2').trim();
        const imageFiles: File[] = [];

        for (const [key, value] of formData.entries()) {
            if (key.startsWith('image_') && value instanceof File) {
                imageFiles.push(value);
            }
        }

        if (imageFiles.length === 0) {
            return NextResponse.json({ error: '至少需要一张参考图。' }, { status: 400 });
        }

        const invalidImage = imageFiles.find((file) => !file.type.startsWith('image/') || file.size > MAX_IMAGE_BYTES);
        if (invalidImage) {
            return NextResponse.json(
                { error: `图片 ${invalidImage.name} 无效：图片必须小于 20MB。` },
                { status: 400 }
            );
        }

        const selectedImages = imageFiles.slice(0, MAX_OPTIMIZER_IMAGES);
        const imageParts = await Promise.all(
            selectedImages.map(async (file) => ({
                type: 'image_url' as const,
                image_url: {
                    url: await fileToDataUrl(file),
                    detail: 'low' as const
                }
            }))
        );

        const optimizerModel = process.env.PROMPT_OPTIMIZER_MODEL || 'gpt-4o-mini';
        const completion = await openai.chat.completions.create({
            model: optimizerModel,
            temperature: 0.4,
            messages: [
                {
                    role: 'system',
                    content:
                        '你负责优化图片编辑提示词。只返回一条润色后的提示词，不要解释。保持用户原意，描述参考图中的可见主体，明确构图、风格、限制条件，以及哪些内容需要保持不变。请优先使用用户原提示词的语言。'
                },
                {
                    role: 'user',
                    content: [
                        {
                            type: 'text',
                            text: `目标图片模型：${targetModel}\n当前提示词：\n${prompt || '（还没有提示词）'}\n\n请把它改写成简洁、可直接用于生产的图片编辑提示词。`
                        },
                        ...imageParts
                    ]
                }
            ]
        });

        const optimizedPrompt = cleanOptimizedPrompt(completion.choices[0]?.message?.content || '');
        if (!optimizedPrompt) {
            return NextResponse.json({ error: '提示词优化器返回了空结果。' }, { status: 502 });
        }

        return NextResponse.json({
            prompt: optimizedPrompt,
            model: optimizerModel,
            imagesUsed: selectedImages.length
        });
    } catch (error) {
        console.error('Error in /api/prompt-optimize:', error);
        const status =
            typeof error === 'object' && error !== null && 'status' in error && typeof error.status === 'number'
                ? error.status
                : 500;

        return NextResponse.json({ error: getUpstreamErrorMessage(error) }, { status });
    }
}
