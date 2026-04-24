import crypto from 'crypto';
import { NextRequest, NextResponse } from 'next/server';
import OpenAI from 'openai';

import { buildOpenAIClientOptions, normalizeOpenAIBaseUrl } from '@/lib/openai-config';
import { cleanOptimizedPrompt } from '@/lib/prompt-optimizer';
import { getUpstreamErrorMessage } from '@/lib/upstream-error';

const openai = new OpenAI({
    ...buildOpenAIClientOptions({
        apiKey: process.env.OPENAI_API_KEY || '',
        baseURL: process.env.OPENAI_API_BASE_URL,
        proxyURL: process.env.OPENAI_API_PROXY_URL
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
    if (process.env.OPENAI_API_PROXY_URL) {
        console.log(`Using OpenAI proxy: ${process.env.OPENAI_API_PROXY_URL}`);
    }

    if (!process.env.OPENAI_API_KEY) {
        return NextResponse.json({ error: 'Server configuration error: API key not found.' }, { status: 500 });
    }

    try {
        const formData = await request.formData();

        if (process.env.APP_PASSWORD) {
            const clientPasswordHash = formData.get('passwordHash') as string | null;
            if (!clientPasswordHash) {
                return NextResponse.json({ error: 'Unauthorized: Missing password hash.' }, { status: 401 });
            }

            const serverPasswordHash = sha256(process.env.APP_PASSWORD);
            if (clientPasswordHash !== serverPasswordHash) {
                return NextResponse.json({ error: 'Unauthorized: Invalid password.' }, { status: 401 });
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
            return NextResponse.json({ error: 'At least one reference image is required.' }, { status: 400 });
        }

        const invalidImage = imageFiles.find((file) => !file.type.startsWith('image/') || file.size > MAX_IMAGE_BYTES);
        if (invalidImage) {
            return NextResponse.json(
                { error: `Invalid image ${invalidImage.name}: images must be under 20MB.` },
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
                        'You optimize image editing prompts. Return only one polished prompt, no explanations. Preserve the user intent, describe visible subjects from the reference images, specify composition, style, constraints, and what should remain unchanged.'
                },
                {
                    role: 'user',
                    content: [
                        {
                            type: 'text',
                            text: `Target image model: ${targetModel}\nCurrent prompt:\n${prompt || '(no prompt yet)'}\n\nRewrite this into a concise, production-ready image edit prompt.`
                        },
                        ...imageParts
                    ]
                }
            ]
        });

        const optimizedPrompt = cleanOptimizedPrompt(completion.choices[0]?.message?.content || '');
        if (!optimizedPrompt) {
            return NextResponse.json({ error: 'Prompt optimizer returned an empty result.' }, { status: 502 });
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
