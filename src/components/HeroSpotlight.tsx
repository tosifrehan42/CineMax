import React, { useState, useEffect, useRef } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { HomeHubMode, MediaItem } from '../types';
import { MediaPoster } from './MediaPoster';
import {
  CINEMATIC_EASE,
  CINEMATIC_EXIT_EASE,
  staggerContainerVariants,
  staggerItemVariants,
  useCinematicMotion,
} from '../utils/motionSystem';
import {
  Play,
  Bookmark,
  Check,
  Info,
  Star,
  ChevronLeft,
  ChevronRight,
  Flame,
} from 'lucide-react';

interface HeroSpotlightProps {
  featuredItems: MediaItem[];
  hubMode?: HomeHubMode;
  isInWatchlist: (id: string) => boolean;
  onToggleWatchlist: (id: string) => void;
  onSelectMedia: (media: MediaItem) => void;
  onPlayTrailer: (media: MediaItem) => void;
}

const HeroSpotlightComponent: React.FC<HeroSpotlightProps> = ({
  featuredItems,
  hubMode = 'all',
  isInWatchlist,
  onToggleWatchlist,
  onSelectMedia,
  onPlayTrailer,
}) => {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isPaused, setIsPaused] = useState(false);
  const [isInViewport, setIsInViewport] = useState(true);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const { prefersReducedMotion, canHoverDesktop } = useCinematicMotion();

  // Reset index if featured items change (e.g. switching between All / Movies / Series)
  useEffect(() => {
    setCurrentIndex(0);
  }, [hubMode, featuredItems.length]);

  // Pause auto-rotation when HeroSpotlight is scrolled out of the viewport on mobile/desktop
  useEffect(() => {
    const el = containerRef.current;
    if (!el || typeof IntersectionObserver === 'undefined') return;
    const observer = new IntersectionObserver(
      (entries) => {
        const entry = entries[0];
        if (entry) {
          setIsInViewport(entry.isIntersecting);
        }
      },
      { threshold: 0.1 }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  // Auto-advance spotlight every 8 seconds unless paused on hover/focus or offscreen
  useEffect(() => {
    if (featuredItems.length <= 1 || isPaused || !isInViewport) return;
    const timer = setInterval(() => {
      setCurrentIndex((prev) => (prev + 1) % featuredItems.length);
    }, 8000);
    return () => clearInterval(timer);
  }, [featuredItems.length, isPaused, isInViewport]);

  if (!featuredItems || featuredItems.length === 0) return null;

  const safeIndex = currentIndex % featuredItems.length;
  const current = featuredItems[safeIndex];
  const inWatchlist = isInWatchlist(current.id);

  const hubKicker =
    hubMode === 'movies'
      ? 'Featured Cinema Spotlight'
      : hubMode === 'series'
      ? 'Featured Series Spotlight'
      : 'Featured Spotlight';

  return (
    <motion.div
      ref={containerRef}
      initial={prefersReducedMotion ? false : { opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.42, ease: CINEMATIC_EASE }}
      onMouseEnter={() => setIsPaused(true)}
      onMouseLeave={() => setIsPaused(false)}
      className="relative w-full overflow-hidden rounded-2xl border border-white/10 bg-[#0A0D12] shadow-2xl"
    >
      {/* Wide Cinematic Backdrop with Smooth Crossfade & Subtle One-Shot Scale Settle */}
      <AnimatePresence mode="sync" initial={false}>
        <motion.div
          key={current.id}
          initial={
            prefersReducedMotion
              ? { opacity: 0 }
              : { opacity: 0, scale: 1.03 }
          }
          animate={{ opacity: 1, scale: 1 }}
          exit={{
            opacity: 0,
            transition: { duration: 0.35, ease: CINEMATIC_EXIT_EASE },
          }}
          transition={{ duration: 0.85, ease: CINEMATIC_EASE }}
          className="absolute inset-0 w-full h-full"
        >
          <MediaPoster
            media={current}
            aspect="backdrop"
            priority={true}
            className="w-full h-full min-h-[360px] sm:min-h-[430px] lg:min-h-[510px]"
          />
        </motion.div>
      </AnimatePresence>

      {/* Multi-Stop Vignette Gradients & Subtle Amber Ambient Lighting */}
      <div className="absolute inset-0 bg-gradient-to-t from-[#0A0D12] via-[#0A0D12]/55 to-transparent pointer-events-none" />
      <div className="absolute inset-0 bg-gradient-to-r from-[#0A0D12] via-[#0A0D12]/80 to-transparent pointer-events-none" />
      <div
        aria-hidden="true"
        className="absolute -bottom-24 -left-24 w-96 h-96 rounded-full bg-amber-500/[0.07] blur-3xl pointer-events-none"
      />

      {/* Hero Foreground Content */}
      <div className="relative z-10 px-5 sm:px-8 lg:px-10 py-6 sm:py-9 lg:py-12 flex flex-col justify-between min-h-[360px] sm:min-h-[430px] lg:min-h-[510px]">
        {/* Top Kicker & Carousel Controls */}
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-2 text-[11px] sm:text-xs font-semibold uppercase tracking-wider text-amber-400">
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-amber-500/15 border border-amber-500/30 text-amber-300 shadow-[0_0_16px_-4px_rgba(245,158,11,0.35)]">
              <Flame className="w-3 h-3 fill-amber-400 text-amber-400" />
              <span>{hubKicker}</span>
            </span>
            <span className="hidden sm:inline text-white/30">/</span>
            <span className="hidden sm:inline text-slate-300">
              {current.type === 'movie' ? 'Theatrical Feature' : 'Original Series'}
            </span>
          </div>

          {/* Rotation Controls */}
          {featuredItems.length > 1 && (
            <div className="flex items-center gap-1 cm-glass-popover p-1 rounded-lg">
              <motion.button
                type="button"
                whileTap={prefersReducedMotion ? undefined : { scale: 0.92 }}
                onClick={() =>
                  setCurrentIndex(
                    (prev) => (prev - 1 + featuredItems.length) % featuredItems.length
                  )
                }
                className="p-1 text-white/75 hover:text-white hover:bg-white/10 rounded transition-colors"
                aria-label="Previous featured title"
              >
                <ChevronLeft className="w-4 h-4" />
              </motion.button>
              <span className="text-[11px] font-mono text-white/70 px-1.5 tabular-nums">
                {safeIndex + 1} / {featuredItems.length}
              </span>
              <motion.button
                type="button"
                whileTap={prefersReducedMotion ? undefined : { scale: 0.92 }}
                onClick={() =>
                  setCurrentIndex((prev) => (prev + 1) % featuredItems.length)
                }
                className="p-1 text-white/75 hover:text-white hover:bg-white/10 rounded transition-colors"
                aria-label="Next featured title"
              >
                <ChevronRight className="w-4 h-4" />
              </motion.button>
            </div>
          )}
        </div>

        {/* Main Hero Split: Left Staggered Metadata & Actions + Right Poster Preview on Desktop */}
        <AnimatePresence mode="wait" initial={false}>
          <motion.div
            key={current.id}
            variants={prefersReducedMotion ? undefined : staggerContainerVariants}
            initial={prefersReducedMotion ? { opacity: 1 } : 'hidden'}
            animate={prefersReducedMotion ? { opacity: 1 } : 'visible'}
            exit={
              prefersReducedMotion
                ? { opacity: 0, transition: { duration: 0.01 } }
                : { opacity: 0, y: -6, transition: { duration: 0.16, ease: CINEMATIC_EXIT_EASE } }
            }
            className="flex flex-col md:flex-row md:items-end justify-between gap-6 lg:gap-10 mt-6 sm:mt-8"
          >
            <div className="max-w-2xl space-y-2.5 sm:space-y-3">
              {/* Unboxed Metadata Line */}
              <motion.div
                variants={prefersReducedMotion ? undefined : staggerItemVariants}
                className="flex flex-wrap items-center gap-2 text-xs text-slate-300 font-medium"
              >
                <span className="px-1.5 py-0.5 rounded bg-white/10 text-white font-mono text-[10px] font-bold uppercase">
                  {current.type === 'movie' ? 'Movie' : 'Series'}
                </span>
                <span className="font-semibold text-white tabular-nums">{current.year}</span>
                <span aria-hidden="true" className="text-slate-500">
                  ·
                </span>
                <span>
                  {current.type === 'movie'
                    ? current.runtime || '2h 15m'
                    : `${current.seasons || 1} ${
                        (current.seasons || 1) === 1 ? 'Season' : 'Seasons'
                      }`}
                </span>
                <span aria-hidden="true" className="text-slate-500">
                  ·
                </span>
                <span className="font-mono text-slate-300">{current.contentRating}</span>
                <span aria-hidden="true" className="text-slate-500">
                  ·
                </span>
                <div className="flex items-center gap-1 text-amber-400 font-mono">
                  <Star className="w-3.5 h-3.5 fill-amber-400 text-amber-400" />
                  <span className="tabular-nums font-bold">{current.rating.toFixed(1)}</span>
                  <span className="text-slate-400 font-normal text-[11px]">
                    ({current.voteCount})
                  </span>
                </div>
                <span aria-hidden="true" className="hidden sm:inline text-slate-500">
                  ·
                </span>
                <span className="text-amber-300/90 font-medium">
                  {current.genres.slice(0, 3).join(' • ')}
                </span>
              </motion.div>

              {/* Hero Display Title */}
              <motion.h1
                variants={prefersReducedMotion ? undefined : staggerItemVariants}
                className="font-['Plus_Jakarta_Sans'] text-2xl sm:text-4xl lg:text-5xl font-extrabold text-white tracking-tight leading-[1.08] text-balance"
              >
                {current.title}
              </motion.h1>

              {/* Overview / Synopsis */}
              <motion.p
                variants={prefersReducedMotion ? undefined : staggerItemVariants}
                className="text-xs sm:text-sm text-slate-300/95 leading-relaxed line-clamp-2 sm:line-clamp-3 max-w-xl"
              >
                {current.synopsis}
              </motion.p>

              {/* Primary & Secondary Actions */}
              <motion.div
                variants={prefersReducedMotion ? undefined : staggerItemVariants}
                className="pt-2 flex flex-wrap items-center gap-2.5 sm:gap-3"
              >
                {/* Primary Action 1: Watch Trailer */}
                <motion.button
                  type="button"
                  whileHover={canHoverDesktop && !prefersReducedMotion ? { scale: 1.025, y: -1 } : undefined}
                  whileTap={prefersReducedMotion ? undefined : { scale: 0.97 }}
                  onClick={() => onPlayTrailer(current)}
                  className="flex items-center gap-2 px-4 sm:px-5 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs sm:text-sm cm-amber-ambient-glow transition-colors"
                >
                  <Play className="w-4 h-4 fill-slate-950" />
                  <span>Watch Trailer</span>
                </motion.button>

                {/* Primary Action 2: View Details */}
                <motion.button
                  type="button"
                  whileHover={canHoverDesktop && !prefersReducedMotion ? { scale: 1.02, y: -1 } : undefined}
                  whileTap={prefersReducedMotion ? undefined : { scale: 0.97 }}
                  onClick={() => onSelectMedia(current)}
                  className="flex items-center gap-2 px-4 sm:px-5 py-2.5 rounded-xl cm-glass-control text-white font-semibold text-xs sm:text-sm"
                >
                  <Info className="w-4 h-4" />
                  <span>View Details</span>
                </motion.button>

                {/* Secondary Action: Add to Watchlist */}
                <motion.button
                  type="button"
                  whileHover={canHoverDesktop && !prefersReducedMotion ? { scale: 1.02, y: -1 } : undefined}
                  whileTap={prefersReducedMotion ? undefined : { scale: 0.97 }}
                  onClick={() => onToggleWatchlist(current.id)}
                  className={`flex items-center gap-2 px-3.5 sm:px-4 py-2.5 rounded-xl font-semibold text-xs sm:text-sm transition-colors ${
                    inWatchlist
                      ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                      : 'cm-glass-control text-slate-200 hover:text-white'
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
                </motion.button>
              </motion.div>
            </div>

            {/* Right Column: Official Portrait Poster Card on Tablet/Desktop */}
            <motion.div
              variants={prefersReducedMotion ? undefined : staggerItemVariants}
              whileHover={
                canHoverDesktop && !prefersReducedMotion
                  ? { y: -5, scale: 1.025 }
                  : undefined
              }
              whileTap={prefersReducedMotion ? undefined : { scale: 0.98 }}
              onClick={() => onSelectMedia(current)}
              className="hidden md:block w-36 lg:w-44 aspect-[2/3] shrink-0 group cursor-pointer rounded-xl overflow-hidden shadow-2xl border border-white/20 hover:border-amber-400/60 transition-colors"
              title={`View ${current.title} details`}
            >
              <MediaPoster media={current} aspect="poster" priority={true} />
            </motion.div>
          </motion.div>
        </AnimatePresence>

        {/* Bottom Indicator Strip */}
        {featuredItems.length > 1 && (
          <div className="mt-6 pt-3.5 border-t border-white/10 flex items-center justify-between gap-4">
            <div className="flex items-center gap-2 overflow-x-auto pb-0.5 max-w-full [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
              {featuredItems.map((item, idx) => {
                const isActiveSlide = idx === safeIndex;
                return (
                  <motion.button
                    key={item.id}
                    type="button"
                    whileTap={prefersReducedMotion ? undefined : { scale: 0.96 }}
                    onClick={() => setCurrentIndex(idx)}
                    className={`relative flex items-center gap-2 px-2.5 py-1 rounded-lg text-left transition-colors shrink-0 ${
                      isActiveSlide
                        ? 'bg-amber-500/20 border border-amber-400/50 text-white shadow-[0_0_14px_-3px_rgba(245,158,11,0.3)]'
                        : 'cm-glass-control text-slate-300 hover:text-white'
                    }`}
                  >
                    <span
                      className={`w-1.5 h-1.5 rounded-full transition-colors ${
                        isActiveSlide ? 'bg-amber-400' : 'bg-slate-600'
                      }`}
                    />
                    <span className="text-xs font-semibold truncate max-w-[110px] sm:max-w-[150px]">
                      {item.title}
                    </span>
                  </motion.button>
                );
              })}
            </div>

            <div className="hidden sm:flex items-center gap-1.5 text-xs text-slate-400 shrink-0">
              <span>Creator / Director:</span>
              <span className="text-slate-200 font-medium">{current.director}</span>
            </div>
          </div>
        )}
      </div>
    </motion.div>
  );
};

export const HeroSpotlight = React.memo(HeroSpotlightComponent);

