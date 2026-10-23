import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  X,
  ZoomIn,
  ZoomOut,
  RotateCcw,
  Upload,
  Loader2,
  AlertCircle,
  ShieldCheck,
  Copy,
  Check,
  Move,
} from 'lucide-react';
import { SUPABASE_AVATARS_BUCKET_SQL } from '../services/supabaseClient';

interface AvatarCropModalProps {
  file: File | null;
  isOpen: boolean;
  isUploading: boolean;
  error: string | null;
  bucketSetupNeeded?: boolean;
  onClose: () => void;
  onConfirmUpload: (croppedBlob: Blob, mimeType: string) => Promise<void>;
}

const VIEWPORT_SIZE = 240;
const EXPORT_SIZE = 512;

export const AvatarCropModal: React.FC<AvatarCropModalProps> = ({
  file,
  isOpen,
  isUploading,
  error,
  bucketSetupNeeded = false,
  onClose,
  onConfirmUpload,
}) => {
  const [imageElement, setImageElement] = useState<HTMLImageElement | null>(null);
  const [imageLoadError, setImageLoadError] = useState<string | null>(null);
  const [zoom, setZoom] = useState<number>(1);
  const [offset, setOffset] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState<boolean>(false);
  const [dragStart, setDragStart] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [copiedSql, setCopiedSql] = useState<boolean>(false);

  const previewCanvasRef = useRef<HTMLCanvasElement | null>(null);

  // Load selected File into an HTMLImageElement for local preview & cropping
  useEffect(() => {
    if (!file || !isOpen) {
      setImageElement(null);
      setImageLoadError(null);
      setZoom(1);
      setOffset({ x: 0, y: 0 });
      return;
    }

    const objectUrl = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      if (img.naturalWidth <= 0 || img.naturalHeight <= 0) {
        setImageLoadError('The selected file is not a valid image.');
        return;
      }
      setImageElement(img);
      setImageLoadError(null);
      setZoom(1);
      setOffset({ x: 0, y: 0 });
    };
    img.onerror = () => {
      setImageLoadError(
        'Could not decode the selected image. Please choose a valid JPEG, PNG, or WebP file.'
      );
    };
    img.src = objectUrl;

    return () => {
      URL.revokeObjectURL(objectUrl);
    };
  }, [file, isOpen]);

  // Draw the current crop frame onto the preview canvas
  const renderCanvas = useCallback(
    (targetCanvas: HTMLCanvasElement, size: number) => {
      if (!imageElement) return;
      const ctx = targetCanvas.getContext('2d');
      if (!ctx) return;

      ctx.clearRect(0, 0, size, size);

      // Fill dark studio background for non-transparent images
      ctx.fillStyle = '#090a0f';
      ctx.fillRect(0, 0, size, size);

      const imgW = imageElement.naturalWidth;
      const imgH = imageElement.naturalHeight;

      // Base scale so the shorter side covers the square viewport
      const baseScale = Math.max(size / imgW, size / imgH);
      const effectiveScale = baseScale * zoom;

      const drawW = imgW * effectiveScale;
      const drawH = imgH * effectiveScale;

      // Scale offset proportionally when exporting at 512px vs 240px preview
      const ratio = size / VIEWPORT_SIZE;
      const centerX = (size - drawW) / 2 + offset.x * ratio;
      const centerY = (size - drawH) / 2 + offset.y * ratio;

      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = 'high';
      ctx.drawImage(imageElement, centerX, centerY, drawW, drawH);
    },
    [imageElement, zoom, offset]
  );

  useEffect(() => {
    if (previewCanvasRef.current && imageElement) {
      renderCanvas(previewCanvasRef.current, VIEWPORT_SIZE);
    }
  }, [imageElement, zoom, offset, renderCanvas]);

  if (!isOpen || !file) return null;

  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (isUploading || !imageElement) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    setIsDragging(true);
    setDragStart({ x: e.clientX - offset.x, y: e.clientY - offset.y });
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!isDragging || isUploading || !imageElement) return;
    const nextX = e.clientX - dragStart.x;
    const nextY = e.clientY - dragStart.y;
    const maxPan = VIEWPORT_SIZE * 0.75 * zoom;
    setOffset({
      x: Math.max(-maxPan, Math.min(maxPan, nextX)),
      y: Math.max(-maxPan, Math.min(maxPan, nextY)),
    });
  };

  const handlePointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!isDragging) return;
    e.currentTarget.releasePointerCapture(e.pointerId);
    setIsDragging(false);
  };

  const handleResetCrop = () => {
    setZoom(1);
    setOffset({ x: 0, y: 0 });
  };

  const handleCopyBucketSql = () => {
    navigator.clipboard?.writeText(SUPABASE_AVATARS_BUCKET_SQL);
    setCopiedSql(true);
    setTimeout(() => setCopiedSql(false), 2500);
  };

  const handleConfirm = async () => {
    if (isUploading || !imageElement) return;

    const exportCanvas = document.createElement('canvas');
    exportCanvas.width = EXPORT_SIZE;
    exportCanvas.height = EXPORT_SIZE;
    renderCanvas(exportCanvas, EXPORT_SIZE);

    // Choose target MIME type (preserve original format among JPEG/PNG/WebP)
    const rawMime = (file.type || 'image/jpeg').toLowerCase();
    const targetMime =
      rawMime === 'image/png' || rawMime === 'image/webp' ? rawMime : 'image/jpeg';

    const toBlobPromise = (mime: string, quality?: number): Promise<Blob | null> =>
      new Promise((resolve) => exportCanvas.toBlob(resolve, mime, quality));

    let blob = await toBlobPromise(targetMime, targetMime === 'image/png' ? undefined : 0.9);
    let finalMime = targetMime;

    // Guarantee output is well under 5 MB (Supabase bucket limit)
    if (!blob || blob.size > 4.5 * 1024 * 1024) {
      blob = await toBlobPromise('image/webp', 0.86);
      finalMime = 'image/webp';
    }
    if (!blob) {
      blob = await toBlobPromise('image/jpeg', 0.85);
      finalMime = 'image/jpeg';
    }

    if (!blob) return;
    await onConfirmUpload(blob, finalMime);
  };

  const fileSizeMb = (file.size / (1024 * 1024)).toFixed(2);

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-black/85 backdrop-blur-md flex items-center justify-center p-4 animate-in fade-in duration-200">
      <div
        className="fixed inset-0"
        onClick={() => {
          if (!isUploading) onClose();
        }}
      />

      <div className="relative z-10 w-full max-w-md bg-[#0d0e14] border border-white/10 rounded-2xl shadow-2xl overflow-hidden my-auto">
        {/* Header */}
        <div className="px-6 py-4 border-b border-white/5 flex items-center justify-between">
          <div>
            <h3 className="font-['Outfit'] text-lg font-bold text-white">
              Preview &amp; Frame Profile Photo
            </h3>
            <p className="text-xs text-slate-400 font-mono">
              {file.name} ({fileSizeMb} MB)
            </p>
          </div>
          <button
            type="button"
            disabled={isUploading}
            onClick={onClose}
            aria-label="Close crop modal"
            className="p-1.5 text-slate-400 hover:text-white rounded-lg disabled:opacity-40"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Body */}
        <div className="p-6 space-y-5">
          {/* Error Banner */}
          {(error || imageLoadError) && (
            <div className="p-3.5 rounded-xl bg-red-500/10 border border-red-500/30 text-xs text-red-200 space-y-2.5">
              <div className="flex items-start gap-2">
                <AlertCircle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
                <span>{imageLoadError || error}</span>
              </div>

              {bucketSetupNeeded && (
                <div className="pt-2 border-t border-red-500/20 flex items-center justify-between gap-2">
                  <span className="text-[11px] text-amber-300">
                    Run the storage setup script in Supabase SQL Editor:
                  </span>
                  <button
                    type="button"
                    onClick={handleCopyBucketSql}
                    className="px-2.5 py-1 rounded-lg bg-amber-500 text-slate-950 font-bold text-[11px] flex items-center gap-1 shrink-0 hover:bg-amber-400"
                  >
                    {copiedSql ? (
                      <>
                        <Check className="w-3 h-3" />
                        <span>SQL Copied!</span>
                      </>
                    ) : (
                      <>
                        <Copy className="w-3 h-3" />
                        <span>Copy Storage SQL</span>
                      </>
                    )}
                  </button>
                </div>
              )}
            </div>
          )}

          {/* Interactive Circular Crop Viewport */}
          <div className="flex flex-col items-center space-y-3">
            <div
              onPointerDown={handlePointerDown}
              onPointerMove={handlePointerMove}
              onPointerUp={handlePointerUp}
              onPointerCancel={handlePointerUp}
              className={`relative w-[240px] h-[240px] rounded-2xl overflow-hidden border-2 border-amber-400/50 bg-[#090a0f] shadow-xl select-none touch-none ${
                isUploading ? 'opacity-60 cursor-wait' : 'cursor-grab active:cursor-grabbing'
              }`}
              title="Drag to reposition your photo"
            >
              <canvas
                ref={previewCanvasRef}
                width={VIEWPORT_SIZE}
                height={VIEWPORT_SIZE}
                className="w-full h-full block"
              />

              {/* Circular & Rounded-Square Framing Guide Overlay */}
              <div className="absolute inset-0 pointer-events-none rounded-full border-2 border-amber-400/70 shadow-[0_0_0_9999px_rgba(9,10,15,0.48)]" />

              {isUploading && (
                <div className="absolute inset-0 bg-black/65 flex flex-col items-center justify-center gap-2 text-xs font-semibold text-amber-300">
                  <Loader2 className="w-6 h-6 animate-spin text-amber-400" />
                  <span>Uploading to Supabase Storage...</span>
                </div>
              )}
            </div>

            <span className="inline-flex items-center gap-1.5 text-[11px] text-slate-400">
              <Move className="w-3 h-3 text-amber-400" />
              <span>Drag image to reposition · Use slider below to zoom</span>
            </span>
          </div>

          {/* Zoom & Reset Controls */}
          <div className="flex items-center gap-3 bg-black/40 border border-white/5 px-3.5 py-2.5 rounded-xl">
            <ZoomOut className="w-4 h-4 text-slate-400 shrink-0" />
            <input
              type="range"
              min="1"
              max="3"
              step="0.05"
              disabled={isUploading || !imageElement}
              value={zoom}
              onChange={(e) => setZoom(parseFloat(e.target.value))}
              aria-label="Zoom profile photo"
              className="w-full accent-amber-400 cursor-pointer"
            />
            <ZoomIn className="w-4 h-4 text-slate-400 shrink-0" />
            <button
              type="button"
              disabled={isUploading}
              onClick={handleResetCrop}
              title="Reset position and zoom"
              className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-white/5 transition-colors"
            >
              <RotateCcw className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* Public Avatar URL & RLS Security Notice */}
          <div className="p-3 rounded-xl bg-white/[0.03] border border-white/10 flex items-start gap-2.5 text-[11px] text-slate-400 leading-relaxed">
            <ShieldCheck className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
            <span>
              Profile photos are stored in the public <code className="text-slate-200 font-mono">avatars</code> bucket so your avatar can be displayed across CineMax. Public avatar URLs can be viewed by anyone who has the URL, while upload and delete permissions are strictly restricted to your account via Supabase RLS.
            </span>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center justify-end gap-2.5 pt-1">
            <button
              type="button"
              disabled={isUploading}
              onClick={onClose}
              className="px-4 py-2 rounded-xl text-xs font-medium text-slate-400 hover:text-white disabled:opacity-40"
            >
              Cancel
            </button>
            <button
              type="button"
              disabled={isUploading || !imageElement || Boolean(imageLoadError)}
              onClick={handleConfirm}
              className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-amber-400 to-amber-500 hover:from-amber-300 hover:to-amber-400 text-slate-950 font-bold text-xs flex items-center gap-2 shadow-md shadow-amber-500/20 disabled:opacity-40 transition-all"
            >
              {isUploading ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  <span>Uploading Photo...</span>
                </>
              ) : (
                <>
                  <Upload className="w-3.5 h-3.5 stroke-[2.5]" />
                  <span>Confirm &amp; Upload Photo</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
