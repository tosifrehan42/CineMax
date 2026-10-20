import React, { useState, useEffect } from 'react';
import { MediaItem } from '../types';
import { MediaPoster } from './MediaPoster';
import { Play, Bookmark, Check, Info, Star, ChevronLeft, ChevronRight } from 'lucide-react';

interface HeroSpotlightProps {
  featuredItems: MediaItem[];
  isInWatchlist: (id: string) => boolean;
  onToggleWatchlist: (id: string) => void;
  onSelectMedia: (media: MediaItem) => void;
  onPlayTrailer: (media: MediaItem) => void;
}

export const HeroSpotlight: React.FC<HeroSpotlightProps> = ({
  featuredItems,
  isInWatchlist,
  onToggleWatchlist,
  onSelectMedia,
  onPlayTrailer,
}) => {
  const [currentIndex, setCurrentIndex] = useState(0);

  // Auto-advance spotlight every 8 seconds if not interacted
  useEffect(() => {
    if (featuredItems.length <= 1) return;
    const timer = setInterval(() => {
      setCurrentIndex((prev) => (prev + 1) % featuredItems.length);
    }, 8000);
    return () => clearInterval(timer);
  }, [featuredItems.length]);

  if (!featuredItems || featuredItems.length === 0) return null;

  const current = featuredItems[currentIndex];
  const inWatchlist = isInWatchlist(current.id);

  return (
    <div className="relative w-full overflow-hidden rounded-2xl border border-white/10 bg-slate-950 shadow-2xl mb-12">
      {/* Backdrop visual layer with real TMDB backdrop image and filmic glow */}
      <MediaPoster
        media={current}
        aspect="backdrop"
        priority={true}
        className="absolute inset-0 w-full h-full min-h-[500px]"
      />

      {/* Hero Content Container */}
      <div className="relative z-10 max-w-7xl mx-auto px-6 py-10 lg:py-14 flex flex-col justify-between min-h-[460px] lg:min-h-[520px]">
        {/* Top Kicker & Category */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-amber-400">
            <span className="w-2 h-2 rounded-full bg-amber-400" />
            <span>Featured Spotlight</span>
            <span aria-hidden="true" className="text-white/30">/</span>
            <span className="text-white/70">{current.type === 'movie' ? 'Cinematic Feature' : 'Premier Series'}</span>
          </div>

          {/* Quick Spotlight Switcher controls */}
          <div className="flex items-center gap-1.5 bg-black/50 backdrop-blur-md p-1 rounded-lg border border-white/10">
            <button
              onClick={() => setCurrentIndex((prev) => (prev - 1 + featuredItems.length) % featuredItems.length)}
              className="p-1.5 text-white/70 hover:text-white hover:bg-white/10 rounded transition-colors"
              aria-label="Previous spotlight"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <span className="text-xs font-mono text-white/60 px-1 tabular-nums">
              {currentIndex + 1} / {featuredItems.length}
            </span>
            <button
              onClick={() => setCurrentIndex((prev) => (prev + 1) % featuredItems.length)}
              className="p-1.5 text-white/70 hover:text-white hover:bg-white/10 rounded transition-colors"
              aria-label="Next spotlight"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Center Two-Column Split: Left Info + Right Featured Poster */}
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-8 mt-6 lg:mt-8">
          {/* Left Typographic Info */}
          <div className="max-w-2xl">
            {/* Metadata: Unboxed text with subtle typographic separators */}
            <div className="flex flex-wrap items-center gap-2 text-xs text-slate-300 font-medium mb-3">
              <span className="font-semibold text-white">{current.year}</span>
              <span aria-hidden="true" className="text-slate-500">·</span>
              <span>{current.type === 'movie' ? current.runtime : `${current.seasons} Seasons`}</span>
              <span aria-hidden="true" className="text-slate-500">·</span>
              <span>{current.contentRating}</span>
              <span aria-hidden="true" className="text-slate-500">·</span>
              <div className="flex items-center gap-1 text-amber-400 font-mono">
                <Star className="w-3.5 h-3.5 fill-amber-400 text-amber-400" />
                <span className="tabular-nums font-semibold">{current.rating.toFixed(1)}</span>
                <span className="text-slate-400 font-normal text-[11px]">({current.voteCount})</span>
              </div>
              <span aria-hidden="true" className="text-slate-500">·</span>
              <span className="text-amber-300/90">{current.genres.join(', ')}</span>
            </div>

            {/* Title */}
            <h1 className="font-['Outfit'] text-3xl sm:text-4xl lg:text-5xl font-extrabold text-white tracking-tight leading-tight text-balance">
              {current.title}
            </h1>

            {/* Tagline */}
            <p className="mt-2 text-sm sm:text-base text-amber-200/80 font-medium italic">
              "{current.tagline}"
            </p>

            {/* Synopsis */}
            <p className="mt-3 text-sm text-slate-300/90 leading-relaxed line-clamp-3 max-w-xl">
              {current.synopsis}
            </p>

            {/* Interactive Action Buttons */}
            <div className="mt-6 flex flex-wrap items-center gap-3">
              <button
                onClick={() => onPlayTrailer(current)}
                className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-white text-slate-950 font-semibold text-sm hover:bg-slate-200 shadow-lg shadow-white/10 transition-all hover:scale-[1.02] active:scale-[0.98]"
              >
                <Play className="w-4 h-4 fill-slate-950" />
                <span>Watch Preview</span>
              </button>

              <button
                onClick={() => onToggleWatchlist(current.id)}
                className={`flex items-center gap-2 px-4 py-2.5 rounded-xl font-semibold text-sm border transition-all ${
                  inWatchlist
                    ? 'bg-amber-500 text-slate-950 border-amber-400 shadow-md shadow-amber-500/20'
                    : 'bg-white/10 hover:bg-white/20 text-white border-white/15 backdrop-blur-sm'
                }`}
              >
                {inWatchlist ? (
                  <>
                    <Check className="w-4 h-4 stroke-[2.5]" />
                    <span>In Watchlist</span>
                  </>
                ) : (
                  <>
                    <Bookmark className="w-4 h-4" />
                    <span>Add to Watchlist</span>
                  </>
                )}
              </button>

              <button
                onClick={() => onSelectMedia(current)}
                className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-white/5 hover:bg-white/10 text-slate-300 hover:text-white border border-white/10 text-sm font-medium transition-colors backdrop-blur-sm"
              >
                <Info className="w-4 h-4" />
                <span>Details & Cast</span>
              </button>
            </div>
          </div>

          {/* Right Column: Featured Official Poster Card (Desktop/Tablet) */}
          <div
            onClick={() => onSelectMedia(current)}
            className="hidden md:block w-40 lg:w-48 shrink-0 group cursor-pointer rounded-xl overflow-hidden shadow-2xl border-2 border-white/15 hover:border-amber-400/60 transition-all transform hover:-translate-y-1"
            title={`View ${current.title} details`}
          >
            <MediaPoster media={current} aspect="poster" priority={true} />
          </div>
        </div>

        {/* Bottom thumbnail bar for quick navigation between featured titles */}
        <div className="mt-8 pt-4 border-t border-white/10 flex items-center justify-between">
          <div className="flex items-center gap-3 overflow-x-auto pb-1 max-w-full">
            {featuredItems.map((item, idx) => (
              <button
                key={item.id}
                onClick={() => setCurrentIndex(idx)}
                className={`flex items-center gap-2.5 px-2.5 py-1.5 rounded-lg text-left transition-all shrink-0 ${
                  idx === currentIndex
                    ? 'bg-white/15 border border-amber-400/50 text-white shadow-sm'
                    : 'bg-black/40 border border-white/5 text-slate-400 hover:text-white hover:bg-white/10'
                }`}
              >
                <div className="w-6 h-8 rounded overflow-hidden shrink-0 border border-white/10">
                  <MediaPoster media={item} aspect="poster" priority={true} />
                </div>
                <span className="text-xs font-semibold truncate max-w-[120px] sm:max-w-[160px]">
                  {item.title}
                </span>
                <span className="text-[10px] font-mono text-slate-400">
                  {item.year}
                </span>
              </button>
            ))}
          </div>

          <div className="hidden sm:flex items-center gap-2 text-xs text-slate-400 shrink-0 ml-4">
            <span>Directed by</span>
            <span className="text-white font-medium">{current.director}</span>
          </div>
        </div>
      </div>
    </div>
  );
};
