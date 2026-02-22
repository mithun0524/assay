'use client';

import { useRef, useState, DragEvent } from 'react';
import { RiAttachmentLine, RiUploadLine } from '@remixicon/react';
import { cn } from '@/lib/utils';
import { validateImage, processImage } from '@/lib/imageUtils';

interface ImageUploadProps {
  onImagesAdded: (images: string[]) => void;
  maxImages?: number;
  currentImageCount?: number;
}

export function ImageUpload({
  onImagesAdded,
  maxImages = 4,
  currentImageCount = 0,
}: ImageUploadProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);

  const handleFiles = async (files: FileList | null) => {
    if (!files || files.length === 0) return;

    setError(null);
    setUploading(true);

    const filesArray = Array.from(files);
    const remainingSlots = maxImages - currentImageCount;

    if (filesArray.length > remainingSlots) {
      setError(`You can only upload ${remainingSlots} more image${remainingSlots !== 1 ? 's' : ''}`);
      setUploading(false);
      return;
    }

    try {
      const processedImages: string[] = [];

      for (const file of filesArray) {
        const validation = validateImage(file);
        if (!validation.valid) {
          setError(validation.error || 'Invalid image');
          setUploading(false);
          return;
        }

        const dataUrl = await processImage(file);
        processedImages.push(dataUrl);
      }

      onImagesAdded(processedImages);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to process image');
    } finally {
      setUploading(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const handleDragEnter = (e: DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  };

  const handleDragLeave = (e: DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    // Only set dragging to false if leaving the main container
    if (e.currentTarget === e.target) {
      setIsDragging(false);
    }
  };

  const handleDragOver = (e: DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  };

  const handleDrop = (e: DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);

    const files = e.dataTransfer.files;
    handleFiles(files);
  };

  const handleButtonClick = () => {
    fileInputRef.current?.click();
  };

  return (
    <>
      {/* Drag-drop overlay */}
      {isDragging && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
          onDragEnter={handleDragEnter}
          onDragLeave={handleDragLeave}
          onDragOver={handleDragOver}
          onDrop={handleDrop}
        >
          <div className="glass-strong rounded-2xl p-12 text-center">
            <RiUploadLine size={48} className="mx-auto mb-4 text-violet-400" />
            <p className="text-lg font-semibold text-zinc-100 mb-1">
              Drop images here
            </p>
            <p className="text-sm text-zinc-400">
              PNG, JPEG, or WebP (max 5MB each)
            </p>
          </div>
        </div>
      )}

      {/* Upload button */}
      <button
        type="button"
        onClick={handleButtonClick}
        disabled={uploading || currentImageCount >= maxImages}
        onDragEnter={handleDragEnter}
        onDragOver={handleDragOver}
        onDrop={handleDrop}
        className={cn(
          'p-2 rounded-lg transition-colors',
          uploading || currentImageCount >= maxImages
            ? 'text-zinc-600 cursor-not-allowed'
            : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800'
        )}
        title={
          currentImageCount >= maxImages
            ? `Maximum ${maxImages} images`
            : 'Add image'
        }
      >
        <RiAttachmentLine size={18} />
      </button>

      {/* Hidden file input */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/png,image/jpeg,image/jpg,image/webp"
        multiple
        onChange={(e) => handleFiles(e.target.files)}
        className="hidden"
      />

      {/* Error message */}
      {error && (
        <div className="absolute bottom-full left-0 right-0 mb-2 px-3 py-2 rounded-lg bg-red-500/10 border border-red-500/20 text-xs text-red-400">
          {error}
        </div>
      )}
    </>
  );
}
