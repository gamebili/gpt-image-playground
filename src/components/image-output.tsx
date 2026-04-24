'use client';

import { Button } from '@/components/ui/button';
import { getStreamingStatusText } from '@/lib/image-progress';
import { cn } from '@/lib/utils';
import { Loader2, Send, Grid } from 'lucide-react';
import Image from 'next/image';

type ImageInfo = {
    path: string;
    filename: string;
};

type ImageOutputProps = {
    imageBatch: ImageInfo[] | null;
    viewMode: 'grid' | number;
    onViewChange: (view: 'grid' | number) => void;
    altText?: string;
    isLoading: boolean;
    onSendToEdit: (filename: string) => void;
    currentMode: 'generate' | 'edit';
    baseImagePreviewUrl: string | null;
    streamingPreviewImages?: Map<number, string>;
    streamingUpdateCount?: number;
};

const getGridColsClass = (count: number): string => {
    if (count <= 1) return 'grid-cols-1';
    if (count <= 4) return 'grid-cols-2';
    if (count <= 9) return 'grid-cols-3';
    return 'grid-cols-3';
};

export function ImageOutput({
    imageBatch,
    viewMode,
    onViewChange,
    altText = '生成图片输出',
    isLoading,
    onSendToEdit,
    currentMode,
    baseImagePreviewUrl,
    streamingPreviewImages,
    streamingUpdateCount = 0
}: ImageOutputProps) {
    const handleSendClick = () => {
        // Send to edit only works when a single image is selected
        if (typeof viewMode === 'number' && imageBatch && imageBatch[viewMode]) {
            onSendToEdit(imageBatch[viewMode].filename);
        }
    };

    const showCarousel = imageBatch && imageBatch.length > 1;
    const isSingleImageView = typeof viewMode === 'number';
    const canSendToEdit = !isLoading && isSingleImageView && imageBatch && imageBatch[viewMode];

    return (
        <div className='flex h-full min-h-[300px] w-full flex-col items-center justify-between gap-4 overflow-hidden rounded-lg border border-white/20 bg-black p-4'>
            <div className='relative flex h-full w-full flex-grow items-center justify-center overflow-hidden'>
                {isLoading ? (
                    streamingPreviewImages && streamingPreviewImages.size > 0 ? (
                        // Show all requested streaming preview frames instead of only the latest one.
                        <div className='relative flex h-full w-full items-center justify-center'>
                            {(() => {
                                const entries = Array.from(streamingPreviewImages.entries()).sort(([a], [b]) => a - b);
                                if (entries.length === 0) return null;

                                if (entries.length === 1) {
                                    const [, dataUrl] = entries[0];
                                    return (
                                        <Image
                                            src={dataUrl}
                                        alt='流式预览'
                                            width={512}
                                            height={512}
                                            className='max-h-full max-w-full object-contain'
                                            unoptimized
                                        />
                                    );
                                }

                                return (
                                    <div
                                        className={`grid ${getGridColsClass(entries.length)} max-h-full w-full max-w-full gap-1 p-1`}>
                                        {entries.map(([previewIndex, dataUrl]) => (
                                            <div
                                                key={previewIndex}
                                                className='relative aspect-square overflow-hidden rounded border border-white/10'>
                                                <Image
                                                    src={dataUrl}
                                                    alt={`流式预览 ${previewIndex + 1}`}
                                                    fill
                                                    style={{ objectFit: 'contain' }}
                                                    sizes='(max-width: 768px) 50vw, (max-width: 1024px) 33vw, 25vw'
                                                    unoptimized
                                                />
                                            </div>
                                        ))}
                                    </div>
                                );
                            })()}
                            {/* Overlay loader at bottom center */}
                            <div className='absolute bottom-4 left-1/2 flex -translate-x-1/2 items-center gap-2 rounded-full bg-black/70 px-3 py-1.5 text-white/80'>
                                <Loader2 className='h-4 w-4 animate-spin' />
                                <p className='text-sm'>{getStreamingStatusText(currentMode, streamingUpdateCount)}</p>
                            </div>
                        </div>
                    ) : currentMode === 'edit' && baseImagePreviewUrl ? (
                        <div className='relative flex h-full w-full items-center justify-center'>
                            <Image
                                src={baseImagePreviewUrl}
                                alt='用于编辑的基础图片'
                                fill
                                style={{ objectFit: 'contain' }}
                                className='blur-md filter'
                                unoptimized
                            />
                            <div className='absolute inset-0 flex flex-col items-center justify-center bg-black/50 text-white/80'>
                                <Loader2 className='mb-2 h-8 w-8 animate-spin' />
                                <p>{getStreamingStatusText(currentMode, streamingUpdateCount)}</p>
                            </div>
                        </div>
                    ) : (
                        <div className='flex flex-col items-center justify-center text-white/60'>
                            <Loader2 className='mb-2 h-8 w-8 animate-spin' />
                            <p>{getStreamingStatusText(currentMode, streamingUpdateCount)}</p>
                        </div>
                    )
                ) : imageBatch && imageBatch.length > 0 ? (
                    viewMode === 'grid' ? (
                        <div
                            className={`grid ${getGridColsClass(imageBatch.length)} max-h-full w-full max-w-full gap-1 p-1`}>
                            {imageBatch.map((img, index) => (
                                <div
                                    key={img.filename}
                                    className='relative aspect-square overflow-hidden rounded border border-white/10'>
                                    <Image
                                        src={img.path}
                                        alt={`生成图片 ${index + 1}`}
                                        fill
                                        style={{ objectFit: 'contain' }}
                                        sizes='(max-width: 768px) 50vw, (max-width: 1024px) 33vw, 25vw'
                                        unoptimized
                                    />
                                </div>
                            ))}
                        </div>
                    ) : imageBatch[viewMode] ? (
                        <Image
                            src={imageBatch[viewMode].path}
                            alt={altText}
                            width={512}
                            height={512}
                            className='max-h-full max-w-full object-contain'
                            unoptimized
                        />
                    ) : (
                        <div className='text-center text-white/40'>
                            <p>图片显示失败。</p>
                        </div>
                    )
                ) : (
                    <div className='text-center text-white/40'>
                        <p>生成的图片会显示在这里。</p>
                    </div>
                )}
            </div>

            <div className='flex h-10 w-full shrink-0 items-center justify-center gap-4'>
                {showCarousel && (
                    <div className='flex items-center gap-1.5 rounded-md border border-white/10 bg-neutral-800/50 p-1'>
                        <Button
                            variant='ghost'
                            size='icon'
                            className={cn(
                                'h-8 w-8 rounded p-1',
                                viewMode === 'grid'
                                    ? 'bg-white/20 text-white'
                                    : 'text-white/50 hover:bg-white/10 hover:text-white/80'
                            )}
                            onClick={() => onViewChange('grid')}
                            aria-label='显示网格视图'>
                            <Grid className='h-4 w-4' />
                        </Button>
                        {imageBatch.map((img, index) => (
                            <Button
                                key={img.filename}
                                variant='ghost'
                                size='icon'
                                className={cn(
                                    'h-8 w-8 overflow-hidden rounded p-0.5',
                                    viewMode === index
                                        ? 'ring-2 ring-white ring-offset-1 ring-offset-black'
                                        : 'opacity-60 hover:opacity-100'
                                )}
                                onClick={() => onViewChange(index)}
                                aria-label={`选择图片 ${index + 1}`}>
                                <Image
                                    src={img.path}
                                    alt={`缩略图 ${index + 1}`}
                                    width={28}
                                    height={28}
                                    className='h-full w-full object-cover'
                                    unoptimized
                                />
                            </Button>
                        ))}
                    </div>
                )}

                <Button
                    variant='outline'
                    size='sm'
                    onClick={handleSendClick}
                    disabled={!canSendToEdit}
                    className={cn(
                        'shrink-0 border-white/20 text-white/80 hover:bg-white/10 hover:text-white disabled:pointer-events-none disabled:opacity-50',
                        // Hide button completely if grid view is active and there are multiple images
                        showCarousel && viewMode === 'grid' ? 'invisible' : 'visible'
                    )}>
                    <Send className='mr-2 h-4 w-4' />
                    发送到编辑
                </Button>
            </div>
        </div>
    );
}
