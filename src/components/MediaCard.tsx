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
} from 'lucide-react';

interface MediaCardProps {
  media: MediaItem;
  isInWatchlist: boolean;
  watchlistStatus?: WatchStatus;
  onToggleWatchlist: (mediaId: string) => void;
  onUpdateStatus?: (mediaId: string, status: WatchStatus, media?: MediaItem) => void;
  onRemoveFromWatchlist?: (mediaId: string) => void;
  watchedEpisodesCount?: number;
  totalEpisodesCount?: number;
  onClick: (media: MediaItem) => void;
  rankBadge?: number;
}

export const MediaCard: React.FC<MediaCardProps> = ({
  media,
  isInWatchlist,
  watchlistStatus = 'plan_to_watch',
  onToggleWatchlist,
  onUpdateStatus,
  onRemoveFromWatchlist,
  watchedEpisodesCount = 0,
  totalEpisodesCount = 0,
  onClick,
  rankBadge,
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
      // Quick-add as Want to Watch AND open status menu on click
      if (onUpdateStatus) {
        onUpdateStatus(media.id, 'plan_to_watch', media);
      } else {
        onToggleWatchlist(media.id);
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
      onToggleWatchlist(media.id);
    }
    setMenuOpen(false);
  };

  const handleRemove = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (onRemoveFromWatchlist) {
      onRemoveFromWatchlist(media.id);
    } else if (isInWatchlist) {
      onToggleWatchlist(media.id);
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
      return 'bg-black/65 text-white/75 border-white/15 hover:text-white hover:bg-black/85 hover:border-amber-400/50';
    }
    switch (watchlistStatus) {
      case 'completed':
        return 'bg-emerald-500 text-slate-950 border-emerald-400 shadow-md shadow-emerald-500/30';
      case 'watching':
        return 'bg-sky-500 text-slate-950 border-sky-400 shadow-md shadow-sky-500/30';
      case 'on_hold':
        return 'bg-amber-500/90 text-slate-950 border-amber-300 shadow-md shadow-amber-500/20';
      case 'dropped':
        return 'bg-rose-500/90 text-white border-rose-400 shadow-md shadow-rose-500/20';
      case 'plan_to_watch':
      default:
        return 'bg-amber-500 text-slate-950 border-amber-400 shadow-md shadow-amber-500/30';
    }
  };

  return (
    <div
      onClick={() => onClick(media)}
      className="group relative flex flex-col cursor-pointer transition-all duration-300 transform-gpu hover:-translate-y-1.5 focus:outline-none"
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onClick(media);
        }
      }}
    >
      {/* Poster Container */}
      <div className="relative overflow-hidden rounded-xl border border-white/10 bg-slate-900 shadow-lg group-hover:border-amber-400/40 group-hover:shadow-amber-500/10 group-hover:shadow-2xl transition-all">
        {/* Optional Rank Number for Trending/Top Rated strips */}
        {rankBadge && (
          <div className="absolute top-2 left-2 z-20 w-7 h-7 rounded-md bg-black/80 backdrop-blur-md border border-white/20 flex items-center justify-center text-xs font-mono font-bold text-amber-400 shadow-md">
            #{rankBadge}
          </div>
        )}

        {/* Watchlist Checklist Quick Action & Status Menu Trigger */}
        <div ref={menuRef} className="absolute top-2 right-2 z-30">
          <button
            type="button"
            onClick={handleChecklistButtonClick}
            aria-label={
              isInWatchlist
                ? `Checklist status: ${WATCH_STATUS_LABELS[watchlistStatus]}. Click to change status`
                : 'Add to checklist and choose status'
            }
            aria-expanded={menuOpen}
            className={`p-2 rounded-lg backdrop-blur-md border transition-all flex items-center gap-1 ${getButtonAppearance()}`}
            title={
              isInWatchlist
                ? `${WATCH_STATUS_LABELS[watchlistStatus]} (Click to change)`
                : 'Quick-add to Checklist'
            }
          >
            {isInWatchlist ? (
              renderStatusIcon(watchlistStatus)
            ) : (
              <Bookmark className="w-3.5 h-3.5" />
            )}
          </button>

          {/* Quick Status Popover Menu */}
          {menuOpen && (
            <div
              onClick={(e) => e.stopPropagation()}
              className="absolute right-0 mt-1.5 w-44 rounded-xl bg-[#0e1017]/95 backdrop-blur-xl border border-white/15 shadow-2xl p-1.5 z-40 animate-in fade-in zoom-in-95 duration-150"
            >
              <div className="px-2 py-1 text-[10px] font-semibold uppercase tracking-wider text-slate-400 border-b border-white/5 mb-1">
                Checklist Status
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
                    <span>Remove from Checklist</span>
                  </button>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Actual Poster Artwork */}
        <MediaPoster media={media} aspect="poster" />

        {/* Subtle Bottom Progress Bar for TV Shows with Watched Episodes */}
        {media.type === 'tv' && watchedEpisodesCount > 0 && (
          <div className="absolute bottom-0 inset-x-0 z-20 h-1 bg-black/70">
            <div
              className="h-full bg-amber-400 transition-all duration-300"
              style={{ width: `${tvProgressPct > 0 ? tvProgressPct : 15}%` }}
            />
          </div>
        )}

        {/* Hover Quick Preview Reveal */}
        <div className="absolute inset-0 z-10 bg-gradient-to-t from-black via-black/40 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex flex-col justify-end p-4 pointer-events-none">
          <div className="flex items-center gap-1.5 text-xs text-amber-300 font-medium mb-1">
            <Play className="w-3 h-3 fill-amber-300" />
            <span>View Details & Checklist</span>
          </div>
          <p className="text-[11px] text-slate-300 line-clamp-2 leading-relaxed">
            {media.synopsis}
          </p>
        </div>
      </div>

      {/* Card Content & Metadata - Clean unboxed text with typographic separators */}
      <div className="mt-2.5 px-0.5">
        <div className="flex items-center justify-between gap-2 text-xs text-slate-400">
          <div className="flex items-center gap-1.5 truncate">
            <span className="tabular-nums">{media.year > 0 ? media.year : 'TBA'}</span>
            <span aria-hidden="true" className="text-slate-600">·</span>
            <span>
              {media.type === 'movie'
                ? 'Film'
                : watchedEpisodesCount > 0
                ? effectiveTotalEpisodes > 0
                  ? `${watchedEpisodesCount}/${effectiveTotalEpisodes} eps`
                  : `${watchedEpisodesCount} eps`
                : media.seasons
                ? `${media.seasons} ${media.seasons === 1 ? 'Season' : 'Seasons'}`
                : 'TV Series'}
            </span>
            <span aria-hidden="true" className="text-slate-600">·</span>
            <span className="truncate">
              {isInWatchlist ? WATCH_STATUS_LABELS[watchlistStatus] : media.genres[0]}
            </span>
          </div>
          <div className="flex items-center gap-1 text-amber-400/90 font-mono font-medium shrink-0">
            <Star className="w-3 h-3 fill-amber-400 text-amber-400" />
            <span className="tabular-nums text-xs">
              {media.rating > 0 ? media.rating.toFixed(1) : 'NR'}
            </span>
          </div>
        </div>

        <h3 className="mt-1 text-sm font-semibold text-white tracking-tight group-hover:text-amber-400 transition-colors line-clamp-1">
          {media.title}
        </h3>
      </div>
    </div>
  );
};
