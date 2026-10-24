import React, { useState, useRef, useEffect } from 'react';
import {
  MediaItem,
  WatchStatus,
  WATCH_STATUS_LABELS,
  WATCH_STATUS_ORDER,
} from '../types';
import { MediaPoster } from './MediaPoster';
import {
  Bookmark,
  Star,
  Play,
  Check,
  Clock,
  PauseCircle,
  XCircle,
  Trash2,
  Eye,
  Info,
} from 'lucide-react';

interface MediaCardProps {
  media: MediaItem;
  isInWatchlist: boolean;
  watchlistStatus?: WatchStatus;
  onToggleWatchlist: (mediaId: string, media?: MediaItem) => void;
  onUpdateStatus?: (mediaId: string, status: WatchStatus, media?: MediaItem) => void;
  onRemoveFromWatchlist?: (mediaId: string) => void;
  watchedEpisodesCount?: number;
  totalEpisodesCount?: number;
  onClick: (media: MediaItem) => void;
  onPlayTrailer?: (media: MediaItem) => void;
  rankBadge?: number;
  compact?: boolean;
}

const MediaCardComponent: React.FC<MediaCardProps> = ({
  media,
  isInWatchlist,
  watchlistStatus = 'plan_to_watch',
  onToggleWatchlist,
  onUpdateStatus,
  onRemoveFromWatchlist,
  watchedEpisodesCount = 0,
  totalEpisodesCount = 0,
  onClick,
  onPlayTrailer,
  rankBadge,
  compact = false,
}) => {
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!menuOpen) return;
    const handleOutsideClick = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    };
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handleOutsideClick);
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handleOutsideClick);
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [menuOpen]);

  const effectiveTotalEpisodes =
    totalEpisodesCount > 0 ? totalEpisodesCount : media.totalEpisodes || 0;
  const tvProgressPct =
    media.type === 'tv' && watchedEpisodesCount > 0 && effectiveTotalEpisodes > 0
      ? Math.min(100, Math.round((watchedEpisodesCount / effectiveTotalEpisodes) * 100))
      : 0;

  const handleChecklistButtonClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!isInWatchlist) {
      if (onUpdateStatus) {
        onUpdateStatus(media.id, 'plan_to_watch', media);
      } else {
        onToggleWatchlist(media.id, media);
      }
      setMenuOpen(true);
    } else {
      setMenuOpen((prev) => !prev);
    }
  };

  const handleSelectStatus = (e: React.MouseEvent, status: WatchStatus) => {
    e.stopPropagation();
    if (onUpdateStatus) {
      onUpdateStatus(media.id, status, media);
    } else if (!isInWatchlist) {
      onToggleWatchlist(media.id, media);
    }
    setMenuOpen(false);
  };

  const handleRemove = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (onRemoveFromWatchlist) {
      onRemoveFromWatchlist(media.id);
    } else if (isInWatchlist) {
      onToggleWatchlist(media.id, media);
    }
    setMenuOpen(false);
  };

  const renderStatusIcon = (status: WatchStatus, className = 'w-3.5 h-3.5') => {
    switch (status) {
      case 'completed':
        return <Check className={`${className} stroke-[3]`} />;
      case 'watching':
        return <Eye className={className} />;
      case 'on_hold':
        return <PauseCircle className={className} />;
      case 'dropped':
        return <XCircle className={className} />;
      case 'plan_to_watch':
      default:
        return <Clock className={className} />;
    }
  };

  const getButtonAppearance = () => {
    if (!isInWatchlist) {
      return 'bg-[#0B0E14]/90 md:bg-black/70 md:backdrop-blur-md text-white/85 border-white/15 hover:text-white hover:bg-black/90 hover:border-amber-400/50';
    }
    switch (watchlistStatus) {
      case 'completed':
        return 'bg-emerald-500 text-slate-950 border-emerald-400 shadow-sm';
      case 'watching':
        return 'bg-sky-500 text-slate-950 border-sky-400 shadow-sm';
      case 'on_hold':
        return 'bg-amber-500/95 text-slate-950 border-amber-300 shadow-sm';
      case 'dropped':
        return 'bg-rose-500/95 text-white border-rose-400 shadow-sm';
      case 'plan_to_watch':
      default:
        return 'bg-amber-500 text-slate-950 border-amber-400 shadow-sm';
    }
  };

  const durationOrSeasonText =
    media.type === 'movie'
      ? media.runtime || 'Film'
      : watchedEpisodesCount > 0
      ? effectiveTotalEpisodes > 0
        ? `${watchedEpisodesCount}/${effectiveTotalEpisodes} eps`
        : `${watchedEpisodesCount} eps`
      : media.seasons
      ? `${media.seasons} ${media.seasons === 1 ? 'Season' : 'Seasons'}`
      : 'Series';

  return (
    <div
      onClick={() => onClick(media)}
      className="group relative flex flex-col cursor-pointer md:transition-transform md:duration-200 md:hover:-translate-y-1 focus:outline-none"
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onClick(media);
        }
      }}
    >
      {/* Portrait 2:3 Poster Surface */}
      <div className="relative aspect-[2/3] w-full overflow-hidden rounded-xl border border-white/[0.08] bg-[#121721] shadow-md md:group-hover:border-amber-400/45 md:group-hover:shadow-xl transition-colors">
        {/* Optional Rank Number Badge (Solid on mobile, glassmorphic on desktop) */}
        {rankBadge && (
          <div className="absolute top-2 left-2 z-20 px-2 py-0.5 rounded-md bg-[#0B0E14]/95 md:bg-black/80 md:backdrop-blur-md border border-amber-400/30 flex items-center justify-center text-[11px] font-mono font-bold text-amber-400 shadow-sm">
            #{rankBadge}
          </div>
        )}

        {/* Watchlist Quick Action & Status Menu Trigger */}
        <div ref={menuRef} className="absolute top-2 right-2 z-30">
          <button
            type="button"
            onClick={handleChecklistButtonClick}
            aria-label={
              isInWatchlist
                ? `Watchlist status: ${WATCH_STATUS_LABELS[watchlistStatus]}. Click to change`
                : 'Add to Watchlist'
            }
            aria-expanded={menuOpen}
            className={`p-1.5 sm:p-2 rounded-lg border transition-colors flex items-center justify-center ${getButtonAppearance()}`}
            title={
              isInWatchlist
                ? `${WATCH_STATUS_LABELS[watchlistStatus]} (Click to change)`
                : 'Add to Watchlist'
            }
          >
            {isInWatchlist ? (
              renderStatusIcon(watchlistStatus, 'w-3.5 h-3.5')
            ) : (
              <Bookmark className="w-3.5 h-3.5" />
            )}
          </button>

          {/* Status Popover Menu */}
          {menuOpen && (
            <div
              onClick={(e) => e.stopPropagation()}
              className="absolute right-0 mt-1.5 w-44 rounded-xl bg-[#0E121A] border border-white/15 shadow-2xl p-1.5 z-40"
            >
              <div className="px-2 py-1 text-[10px] font-semibold uppercase tracking-wider text-slate-400 border-b border-white/5 mb-1">
                Watchlist Status
              </div>
              {WATCH_STATUS_ORDER.map((st) => {
                const active = isInWatchlist && watchlistStatus === st;
                return (
                  <button
                    key={st}
                    type="button"
                    onClick={(e) => handleSelectStatus(e, st)}
                    className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg text-xs transition-colors whitespace-nowrap ${
                      active
                        ? 'bg-amber-500/20 text-amber-300 font-semibold'
                        : 'text-slate-300 hover:bg-white/10 hover:text-white'
                    }`}
                  >
                    <span className="flex items-center gap-2">
                      {renderStatusIcon(st, 'w-3.5 h-3.5')}
                      <span>{WATCH_STATUS_LABELS[st]}</span>
                    </span>
                    {active && <Check className="w-3 h-3 text-amber-400 stroke-[2.5]" />}
                  </button>
                );
              })}

              {isInWatchlist && (
                <div className="mt-1 pt-1 border-t border-white/10">
                  <button
                    type="button"
                    onClick={handleRemove}
                    className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-xs text-red-300 hover:bg-red-500/15 hover:text-red-200 transition-colors whitespace-nowrap"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>Remove</span>
                  </button>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Poster Artwork */}
        <MediaPoster media={media} aspect="poster" className="w-full h-full" />

        {/* Progress Bar for TV Shows or Watching Status */}
        {(tvProgressPct > 0 || watchlistStatus === 'watching') && (
          <div className="absolute bottom-0 inset-x-0 z-20 h-1 bg-black/80">
            <div
              className="h-full bg-amber-400 transition-all duration-300"
              style={{ width: `${tvProgressPct > 0 ? tvProgressPct : 25}%` }}
            />
          </div>
        )}

        {/* Desktop Restrained Hover Quick-Action Overlay */}
        <div className="hidden md:flex absolute inset-0 z-10 bg-gradient-to-t from-[#0A0D12] via-[#0A0D12]/50 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-200 flex-col justify-end p-3 pointer-events-none">
          <div className="flex items-center gap-1.5 pointer-events-auto">
            {onPlayTrailer && (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onPlayTrailer(media);
                }}
                className="flex-1 flex items-center justify-center gap-1 py-1.5 px-2 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-[11px] shadow-md transition-colors"
                title={`Watch ${media.title} trailer`}
              >
                <Play className="w-3 h-3 fill-slate-950" />
                <span>Trailer</span>
              </button>
            )}
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onClick(media);
              }}
              className={`${
                onPlayTrailer ? 'px-2.5' : 'flex-1 px-2.5'
              } flex items-center justify-center gap-1 py-1.5 rounded-lg bg-white/15 hover:bg-white/25 text-white font-semibold text-[11px] border border-white/15 transition-colors`}
              title="View Details"
            >
              <Info className="w-3 h-3" />
              {!onPlayTrailer && <span>Details</span>}
            </button>
          </div>
        </div>
      </div>

      {/* Unboxed Clean Card Metadata */}
      <div className="mt-2 px-0.5">
        <h3
          className={`font-semibold text-white tracking-tight group-hover:text-amber-400 transition-colors line-clamp-1 ${
            compact ? 'text-xs sm:text-sm' : 'text-sm'
          }`}
        >
          {media.title}
        </h3>

        <div className="mt-0.5 flex items-center justify-between gap-1.5 text-[11px] text-slate-400">
          <div className="flex items-center gap-1 truncate">
            <span className="tabular-nums font-medium text-slate-300">
              {media.year > 0 ? media.year : 'TBA'}
            </span>
            <span aria-hidden="true" className="text-slate-600">
              ·
            </span>
            <span className="truncate">{durationOrSeasonText}</span>
          </div>

          <div className="flex items-center gap-0.5 text-amber-400 font-mono font-semibold shrink-0">
            <Star className="w-2.5 h-2.5 fill-amber-400 text-amber-400" />
            <span className="tabular-nums text-[11px]">
              {media.rating > 0 ? media.rating.toFixed(1) : 'NR'}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};

export const MediaCard = React.memo(
  MediaCardComponent,
  (prev, next) =>
    prev.media.id === next.media.id &&
    prev.media.posterUrl === next.media.posterUrl &&
    prev.media.rating === next.media.rating &&
    prev.isInWatchlist === next.isInWatchlist &&
    prev.watchlistStatus === next.watchlistStatus &&
    prev.watchedEpisodesCount === next.watchedEpisodesCount &&
    prev.totalEpisodesCount === next.totalEpisodesCount &&
    prev.rankBadge === next.rankBadge &&
    prev.compact === next.compact &&
    prev.onClick === next.onClick &&
    prev.onPlayTrailer === next.onPlayTrailer &&
    prev.onToggleWatchlist === next.onToggleWatchlist &&
    prev.onUpdateStatus === next.onUpdateStatus &&
    prev.onRemoveFromWatchlist === next.onRemoveFromWatchlist
);
