import React from 'react';
import { MediaItem } from '../types';
import { MediaPoster } from './MediaPoster';
import { Bookmark, Star, Play, Check } from 'lucide-react';

interface MediaCardProps {
  media: MediaItem;
  isInWatchlist: boolean;
  onToggleWatchlist: (mediaId: string) => void;
  onClick: (media: MediaItem) => void;
  rankBadge?: number;
}

export const MediaCard: React.FC<MediaCardProps> = ({
  media,
  isInWatchlist,
  onToggleWatchlist,
  onClick,
  rankBadge,
}) => {
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

        {/* Watchlist Quick Action Button */}
        <button
          onClick={(e) => {
            e.stopPropagation();
            onToggleWatchlist(media.id);
          }}
          aria-label={isInWatchlist ? 'Remove from watchlist' : 'Add to watchlist'}
          className={`absolute top-2 right-2 z-20 p-2 rounded-lg backdrop-blur-md border transition-all ${
            isInWatchlist
              ? 'bg-amber-500 text-black border-amber-400 shadow-md shadow-amber-500/30'
              : 'bg-black/60 text-white/70 border-white/10 hover:text-white hover:bg-black/80'
          }`}
          title={isInWatchlist ? 'In Watchlist' : 'Add to Watchlist'}
        >
          {isInWatchlist ? (
            <Check className="w-3.5 h-3.5 stroke-[3]" />
          ) : (
            <Bookmark className="w-3.5 h-3.5" />
          )}
        </button>

        {/* Actual Poster Artwork */}
        <MediaPoster media={media} aspect="poster" />

        {/* Hover Quick Preview Reveal */}
        <div className="absolute inset-0 z-10 bg-gradient-to-t from-black via-black/40 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex flex-col justify-end p-4 pointer-events-none">
          <div className="flex items-center gap-1.5 text-xs text-amber-300 font-medium mb-1">
            <Play className="w-3 h-3 fill-amber-300" />
            <span>View Details & Teaser</span>
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
            <span>{media.year}</span>
            <span aria-hidden="true" className="text-slate-600">·</span>
            <span>{media.type === 'movie' ? 'Film' : `${media.seasons} Seasons`}</span>
            <span aria-hidden="true" className="text-slate-600">·</span>
            <span className="truncate">{media.genres[0]}</span>
          </div>
          <div className="flex items-center gap-1 text-amber-400/90 font-mono font-medium shrink-0">
            <Star className="w-3 h-3 fill-amber-400 text-amber-400" />
            <span className="tabular-nums text-xs">{media.rating.toFixed(1)}</span>
          </div>
        </div>

        <h3 className="mt-1 text-sm font-semibold text-white tracking-tight group-hover:text-amber-400 transition-colors line-clamp-1">
          {media.title}
        </h3>
      </div>
    </div>
  );
};
