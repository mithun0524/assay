'use client';

import { RiCloseLine } from '@remixicon/react';
import { cn } from '@/lib/utils';

interface ImagePreviewProps {
  images: string[];
  onRemove: (index: number) => void;
  className?: string;
}

export function ImagePreview({ images, onRemove, className }: ImagePreviewProps) {
  if (images.length === 0) return null;

  return (
    <div className={cn('flex flex-wrap gap-2', className)}>
      {images.map((dataUrl, index) => (
        <div
          key={index}
          className="relative group rounded-lg overflow-hidden border border-white/[0.08]"
        >
          <img
            src={dataUrl}
            alt={`Upload ${index + 1}`}
            className="w-16 h-16 object-cover"
          />
          <button
            onClick={() => onRemove(index)}
            className={cn(
              'absolute inset-0 flex items-center justify-center',
              'bg-black/60 backdrop-blur-sm',
              'opacity-0 group-hover:opacity-100 transition-opacity'
            )}
          >
            <RiCloseLine size={20} className="text-white" />
          </button>
        </div>
      ))}
    </div>
  );
}
