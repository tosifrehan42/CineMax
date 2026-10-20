import React, { useState, useEffect } from 'react';
import { MediaItem } from '../types';
import { X, Play, Pause, Volume2, VolumeX, Maximize2, RotateCcw, Sparkles } from 'lucide-react';

interface TrailerModalProps {
  media: MediaItem | null;
  onClose: () => void;
}

export const TrailerModal: React.FC<TrailerModalProps> = ({ media, onClose }) => {
  const [isPlaying, setIsPlaying] = useState(true);
  const [isMuted, setIsMuted] = useState(false);
  const [progress, setProgress] = useState(25);
  const [duration] = useState(134); // 2m 14s

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
      if (e.key === ' ') {
        e.preventDefault();
        setIsPlaying((p) => !p);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  // Simulate progress when playing
  useEffect(() => {
    if (!isPlaying) return;
    const interval = setInterval(() => {
      setProgress((prev) => {
        if (prev >= 100) return 0;
        return prev + 0.5;
      });
    }, 400);
    return () => clearInterval(interval);
  }, [isPlaying]);

  if (!media) return null;

  const currentSeconds = Math.floor((progress / 100) * duration);
  const formatTime = (secs: number) => {
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return `${m}:${s < 10 ? '0' : ''}${s}`;
  };

  return (
    <div className="fixed inset-0 z-50 overflow-hidden bg-black/90 backdrop-blur-xl flex items-center justify-center p-4 sm:p-8 animate-in fade-in duration-200">
      <div className="fixed inset-0" onClick={onClose} />

      <div className="relative z-10 w-full max-w-5xl bg-black border border-white/10 rounded-2xl shadow-2xl overflow-hidden flex flex-col">
        {/* Top bar with title and close */}
        <div className="flex items-center justify-between px-6 py-4 bg-slate-950/80 border-b border-white/10">
          <div className="flex items-center gap-3">
            <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
            <span className="text-xs uppercase tracking-wider font-semibold text-slate-400">
              Official Teaser Preview
            </span>
            <span className="text-slate-600">·</span>
            <span className="text-sm font-semibold text-white truncate max-w-sm">
              {media.title}
            </span>
          </div>

          <button
            onClick={onClose}
            aria-label="Close trailer"
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-white/10 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Video Canvas Container */}
        <div className="relative w-full aspect-video bg-black flex items-center justify-center overflow-hidden">
          {/* Backdrop still behind trailer teaser */}
          {(media.backdropUrl || media.posterUrl) && (
            <img
              src={media.backdropUrl || media.posterUrl}
              alt={media.title}
              referrerPolicy="no-referrer"
              className={`absolute inset-0 w-full h-full object-cover object-center opacity-40 transition-transform duration-1000 ${
                isPlaying ? 'scale-105' : 'scale-100'
              }`}
            />
          )}
          <div className="absolute inset-0 bg-black/50 pointer-events-none" />

          {/* Ambient colored lighting reflecting movie tone */}
          <div
            className="absolute inset-0 opacity-30 blur-3xl pointer-events-none"
            style={{
              background: `radial-gradient(circle at 50% 50%, ${media.themeColor} 0%, transparent 70%)`,
            }}
          />

          {/* Anamorphic cinema bars */}
          <div className="absolute top-0 left-0 right-0 h-10 bg-black/95 z-10 pointer-events-none" />
          <div className="absolute bottom-0 left-0 right-0 h-10 bg-black/95 z-10 pointer-events-none" />

          {/* Film Grain & Scanline effect */}
          <div className="absolute inset-0 opacity-15 pointer-events-none bg-[radial-gradient(#ffffff_1px,transparent_1px)] [background-size:16px_16px]" />

          {/* Simulated Cinematic Teaser Scene */}
          <div className="relative z-0 text-center px-6 max-w-2xl flex flex-col items-center">
            {/* Pulsing Audio waveform representation */}
            <div className="flex items-center gap-1.5 h-12 mb-6">
              {[40, 65, 30, 85, 95, 45, 70, 100, 80, 50, 90, 60, 75, 40, 85, 30].map(
                (h, idx) => (
                  <div
                    key={idx}
                    className="w-1.5 rounded-full transition-all duration-300"
                    style={{
                      backgroundColor: media.posterVisual.accent,
                      height: isPlaying ? `${Math.max(12, (h * (progress % 20 + 10)) / 25)}px` : '8px',
                      opacity: isPlaying ? 0.9 : 0.4,
                    }}
                  />
                )
              )}
            </div>

            <div className="text-xs uppercase tracking-widest text-white/50 mb-2 font-mono">
              DIRECTED BY {media.director.toUpperCase()}
            </div>
            <h2 className="font-['Outfit'] text-3xl sm:text-5xl font-extrabold text-white tracking-tight leading-none mb-3">
              {media.title}
            </h2>
            <p className="text-sm sm:text-base text-amber-200/90 font-medium italic">
              "{media.tagline}"
            </p>

            <div className="mt-6 flex items-center gap-2 text-xs text-white/40 font-mono">
              <span>CINEMATOGRAPHY 4K ULTRA HD</span>
              <span>·</span>
              <span>DOLBY ATMOS 7.1</span>
            </div>
          </div>

          {/* Play/Pause Center Overlay */}
          <button
            onClick={() => setIsPlaying((p) => !p)}
            className="absolute inset-0 w-full h-full flex items-center justify-center bg-black/10 hover:bg-black/20 group transition-colors"
          >
            <div className="p-4 rounded-full bg-white/20 backdrop-blur-md border border-white/20 text-white group-hover:scale-110 transition-transform shadow-2xl">
              {isPlaying ? <Pause className="w-8 h-8 fill-white" /> : <Play className="w-8 h-8 fill-white ml-1" />}
            </div>
          </button>
        </div>

        {/* Video Player Controls Bar */}
        <div className="px-6 py-4 bg-slate-950 border-t border-white/10 space-y-3">
          {/* Progress Timeline Scrubber */}
          <div className="relative w-full h-1.5 bg-white/10 rounded-full cursor-pointer overflow-hidden group">
            <div
              className="absolute left-0 top-0 bottom-0 bg-gradient-to-r from-amber-500 to-amber-300 rounded-full transition-all duration-150"
              style={{ width: `${progress}%` }}
            />
          </div>

          {/* Controls Row */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <button
                onClick={() => setIsPlaying((p) => !p)}
                className="text-white hover:text-amber-400 transition-colors"
              >
                {isPlaying ? <Pause className="w-5 h-5 fill-current" /> : <Play className="w-5 h-5 fill-current" />}
              </button>

              <button
                onClick={() => setProgress(0)}
                className="text-slate-400 hover:text-white transition-colors"
                title="Restart"
              >
                <RotateCcw className="w-4 h-4" />
              </button>

              <button
                onClick={() => setIsMuted((m) => !m)}
                className="text-slate-400 hover:text-white transition-colors"
              >
                {isMuted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
              </button>

              <span className="text-xs font-mono text-slate-400 tabular-nums">
                {formatTime(currentSeconds)} / {formatTime(duration)}
              </span>
            </div>

            <div className="flex items-center gap-3 text-xs text-slate-400">
              <span className="hidden sm:inline-block">Press Space to Pause · ESC to Close</span>
              <Maximize2 className="w-4 h-4 text-slate-400 hover:text-white cursor-pointer" />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
