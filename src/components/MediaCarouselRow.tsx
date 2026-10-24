import React, { useRef, useState, useEffect, useCallback, useMemo } from 'react';
import { MediaItem, WatchStatus } from '../types';
import { MediaCard } from './MediaCard';
import { dedupeMediaItems } from '../utils/mediaIntegrity';
import { ChevronLeft, ChevronRight } from 'lucide-react';

interface MediaCarouselRowProps {
  title: string;
  subtitle?: string;
  badgeText?: string;
  icon?: React.ReactNode;
  items: MediaItem[];
  isTop10?: boolean;
  isInWatchlist: (id: string) => boolean;
  getWatchlistStatus?: (id: string) => WatchStatus | undefined;
  onToggleWatchlist: (id: string, media?: MediaItem) => void;
  onUpdateStatus?: (id: string, status: WatchStatus, media?: MediaItem) => void;
  onRemoveFromWatchlist?: (id: string) => void;
  getWatchedEpisodesCount?: (id: string) => number;
  onSelectMedia: (media: MediaItem) => void;
  onPlayTrailer?: (media: MediaItem) => void;
  onExploreAll?: () => void;
  exploreLabel?: string;
}

const MediaCarouselRowComponent: React.FC<MediaCarouselRowProps> = ({
  title,
  subtitle,
  badgeText,
  icon,
  items,
  isTop10 = false,
  isInWatchlist,
  getWatchlistStatus,
  onToggleWatchlist,
  onUpdateStatus,
  onRemoveFromWatchlist,
  getWatchedEpisodesCount,
  onSelectMedia,
  onPlayTrailer,
  onExploreAll,
  exploreLabel = 'See All',
}) => {
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const rafIdRef = useRef<number | null>(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(true);

  const uniqueItems = useMemo(() => {
    if (!items || items.length === 0) return [];
    return dedupeMediaItems(items);
  }, [items]);

  const updateScrollButtons = useCallback(() => {
    if (rafIdRef.current !== null) return;
    rafIdRef.current = window.requestAnimationFrame(() => {
      rafIdRef.current = null;
      const el = scrollContainerRef.current;
      if (!el) return;
      const { scrollLeft, scrollWidth, clientWidth } = el;
      const nextLeft = scrollLeft > 8;
      const nextRight = scrollLeft + clientWidth < scrollWidth - 8;
      setCanScrollLeft((prev) => (prev === nextLeft ? prev : nextLeft));
      setCanScrollRight((prev) => (prev === nextRight ? prev : nextRight));
    });
  }, []);

  useEffect(() => {
    if (
      typeof window !== 'undefined' &&
      window.matchMedia &&
      !window.matchMedia('(min-width: 768px)').matches
    ) {
      return;
    }
    updateScrollButtons();
    const el = scrollContainerRef.current;
    if (!el) return;
    el.addEventListener('scroll', updateScrollButtons, { passive: true });
    window.addEventListener('resize', updateScrollButtons, { passive: true });
    return () => {
      el.removeEventListener('scroll', updateScrollButtons);
      window.removeEventListener('resize', updateScrollButtons);
      if (rafIdRef.current !== null) {
        window.cancelAnimationFrame(rafIdRef.current);
        rafIdRef.current = null;
      }
    };
  }, [uniqueItems.length, updateScrollButtons]);

  const handleScrollBy = (direction: 'left' | 'right') => {
    const el = scrollContainerRef.current;
    if (!el) return;
    const scrollAmount = Math.max(el.clientWidth * 0.78, 320);
    el.scrollBy({
      left: direction === 'left' ? -scrollAmount : scrollAmount,
      behavior: 'smooth',
    });
  };

  const handleCarouselKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (e.key === 'ArrowRight') {
      e.preventDefault();
      handleScrollBy('right');
    } else if (e.key === 'ArrowLeft') {
      e.preventDefault();
      handleScrollBy('left');
    }
  };

  if (uniqueItems.length === 0) return null;

  return (
    <section className="relative space-y-3 group/row">
      {/* Row Header */}
      <div className="flex items-end justify-between gap-4">
        <div className="min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            {icon && <span className="text-amber-400 shrink-0">{icon}</span>}
            <h2 className="font-['Plus_Jakarta_Sans'] text-lg sm:text-xl font-bold text-white tracking-tight">
              {title}
            </h2>
            {badgeText && (
              <span className="px-2 py-0.5 text-[10px] font-mono font-semibold uppercase tracking-wider rounded bg-amber-500/15 text-amber-300 border border-amber-500/30">
                {badgeText}
              </span>
            )}
          </div>
          {subtitle && (
            <p className="text-xs text-slate-400 mt-0.5 truncate">{subtitle}</p>
          )}
        </div>

        <div className="flex items-center gap-2 shrink-0">
          {/* Desktop Prev / Next Controls */}
          <div className="hidden md:flex items-center gap-1">
            <button
              type="button"
              onClick={() => handleScrollBy('left')}
              disabled={!canScrollLeft}
              aria-label={`Scroll ${title} left`}
              className="p-1.5 rounded-lg bg-white/[0.05] hover:bg-white/[0.12] border border-white/[0.08] text-slate-300 hover:text-white disabled:opacity-25 disabled:pointer-events-none transition-colors"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={() => handleScrollBy('right')}
              disabled={!canScrollRight}
              aria-label={`Scroll ${title} right`}
              className="p-1.5 rounded-lg bg-white/[0.05] hover:bg-white/[0.12] border border-white/[0.08] text-slate-300 hover:text-white disabled:opacity-25 disabled:pointer-events-none transition-colors"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>

          {onExploreAll && (
            <button
              type="button"
              onClick={onExploreAll}
              className="text-xs font-semibold text-amber-400 hover:text-amber-300 flex items-center gap-0.5 transition-colors pl-1"
            >
              <span>{exploreLabel}</span>
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* Horizontal Scroll Track */}
      <div
        ref={scrollContainerRef}
        onKeyDown={handleCarouselKeyDown}
        tabIndex={0}
        role="region"
        aria-label={title}
        className="flex items-stretch gap-3.5 sm:gap-4 overflow-x-auto pb-2 pt-1 scroll-smooth snap-x snap-mandatory touch-auto overscroll-x-contain focus:outline-none [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden"
      >
        {uniqueItems.map((item, idx) => {
          const rankNum = idx + 1;
          if (isTop10) {
            return (
              <div
                key={item.id}
                className="snap-start shrink-0 flex items-end w-[185px] sm:w-[215px] md:w-[235px] lg:w-[250px] group/top10"
              >
                {/* Sculpted Oversized Top 10 Rank Numeral */}
                <div
                  aria-hidden="true"
                  className="select-none font-['Plus_Jakarta_Sans'] font-black text-6xl sm:text-7xl lg:text-8xl leading-none tracking-tighter text-transparent bg-clip-text bg-gradient-to-b from-amber-400/90 via-slate-400/40 to-slate-900/20 pr-1 sm:pr-1.5 pb-6 shrink-0"
                  style={{
                    WebkitTextStroke: '1.5px rgba(245, 158, 11, 0.45)',
                  }}
                >
                  {rankNum}
                </div>
                <div className="flex-1 min-w-0">
                  <MediaCard
                    media={item}
                    compact={true}
                    rankBadge={rankNum}
                    isInWatchlist={isInWatchlist(item.id)}
                    watchlistStatus={getWatchlistStatus?.(item.id)}
                    onToggleWatchlist={onToggleWatchlist}
                    onUpdateStatus={onUpdateStatus}
                    onRemoveFromWatchlist={onRemoveFromWatchlist}
                    watchedEpisodesCount={getWatchedEpisodesCount?.(item.id)}
                    onClick={onSelectMedia}
                    onPlayTrailer={onPlayTrailer}
                  />
                </div>
              </div>
            );
          }

          return (
            <div
              key={item.id}
              className="snap-start shrink-0 w-[142px] sm:w-[164px] md:w-[180px] lg:w-[192px] xl:w-[198px]"
            >
              <MediaCard
                media={item}
                compact={true}
                isInWatchlist={isInWatchlist(item.id)}
                watchlistStatus={getWatchlistStatus?.(item.id)}
                onToggleWatchlist={onToggleWatchlist}
                onUpdateStatus={onUpdateStatus}
                onRemoveFromWatchlist={onRemoveFromWatchlist}
                watchedEpisodesCount={getWatchedEpisodesCount?.(item.id)}
                onClick={onSelectMedia}
                onPlayTrailer={onPlayTrailer}
              />
            </div>
          );
        })}
      </div>
    </section>
  );
};

export const MediaCarouselRow = React.memo(
  MediaCarouselRowComponent,
  (prev, next) =>
    prev.title === next.title &&
    prev.subtitle === next.subtitle &&
    prev.badgeText === next.badgeText &&
    prev.isTop10 === next.isTop10 &&
    prev.exploreLabel === next.exploreLabel &&
    prev.items === next.items &&
    prev.isInWatchlist === next.isInWatchlist &&
    prev.getWatchlistStatus === next.getWatchlistStatus &&
    prev.getWatchedEpisodesCount === next.getWatchedEpisodesCount &&
    prev.onToggleWatchlist === next.onToggleWatchlist &&
    prev.onUpdateStatus === next.onUpdateStatus &&
    prev.onRemoveFromWatchlist === next.onRemoveFromWatchlist &&
    prev.onSelectMedia === next.onSelectMedia &&
    prev.onPlayTrailer === next.onPlayTrailer
);
