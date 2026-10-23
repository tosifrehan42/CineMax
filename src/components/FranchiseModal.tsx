import React, { useEffect } from 'react';
import {
  FranchiseCollection,
  MediaItem,
  WatchStatus,
  WATCH_STATUS_LABELS,
} from '../types';
import { MediaPoster } from './MediaPoster';
import {
  X,
  Play,
  Info,
  Check,
  Bookmark,
  Star,
  Layers,
  Sparkles,
} from 'lucide-react';

interface FranchiseModalProps {
  collection: FranchiseCollection | null;
  onClose: () => void;
  isInWatchlist: (id: string) => boolean;
  getWatchlistStatus?: (id: string) => WatchStatus | undefined;
  onToggleWatchlist: (id: string, media?: MediaItem) => void;
  onUpdateStatus?: (id: string, status: WatchStatus, media?: MediaItem) => void;
  onSelectMedia: (media: MediaItem) => void;
  onPlayTrailer: (media: MediaItem) => void;
}

export const FranchiseModal: React.FC<FranchiseModalProps> = ({
  collection,
  onClose,
  isInWatchlist,
  getWatchlistStatus,
  onToggleWatchlist,
  onUpdateStatus,
  onSelectMedia,
  onPlayTrailer,
}) => {
  useEffect(() => {
    if (!collection) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [collection, onClose]);

  if (!collection) return null;

  const totalCount = collection.items.length;
  const completedCount = collection.items.filter(
    (item) => getWatchlistStatus?.(item.id) === 'completed'
  ).length;
  const progressPct =
    totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-black/85 backdrop-blur-md overflow-y-auto"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label={collection.title}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="relative w-full max-w-4xl max-h-[90vh] overflow-y-auto rounded-2xl bg-[#0E131C] border border-white/15 shadow-2xl text-slate-100"
      >
        {/* Top Cinematic Banner */}
        <div className="relative h-56 sm:h-64 w-full overflow-hidden">
          <img
            src={collection.backdropUrl}
            alt={collection.title}
            className="w-full h-full object-cover object-center opacity-45"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-[#0E131C] via-[#0E131C]/70 to-black/30" />

          <button
            onClick={onClose}
            aria-label="Close franchise modal"
            className="absolute top-4 right-4 z-20 p-2 rounded-full bg-black/60 hover:bg-black/85 text-slate-300 hover:text-white border border-white/15 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>

          <div className="absolute bottom-5 inset-x-5 sm:inset-x-8 flex flex-col sm:flex-row sm:items-end justify-between gap-4">
            <div>
              <div className="flex items-center gap-2 text-xs font-mono uppercase tracking-wider text-amber-400 mb-1.5">
                <Layers className="w-3.5 h-3.5" />
                <span>{collection.subtitle}</span>
              </div>
              <h2 className="font-['Plus_Jakarta_Sans'] text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
                {collection.title}
              </h2>
              <p className="text-xs sm:text-sm text-slate-300 mt-1 max-w-2xl">
                {collection.description}
              </p>
            </div>

            {/* Franchise Completion Progress Pill */}
            <div className="shrink-0 bg-black/60 backdrop-blur-md border border-white/10 rounded-xl p-3 min-w-[170px]">
              <div className="flex items-center justify-between text-xs mb-1.5">
                <span className="text-slate-400 font-medium">Saga Progress</span>
                <span className="font-mono font-bold text-amber-400">
                  {completedCount}/{totalCount} Watched
                </span>
              </div>
              <div className="w-full h-1.5 rounded-full bg-white/10 overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-amber-400 to-emerald-400 transition-all duration-300"
                  style={{ width: `${progressPct}%` }}
                />
              </div>
            </div>
          </div>
        </div>

        {/* Watch Order Note & Installment List */}
        <div className="p-5 sm:p-8 space-y-6">
          <div className="p-3.5 rounded-xl bg-amber-500/10 border border-amber-500/25 flex items-start gap-2.5 text-xs text-amber-200/90">
            <Sparkles className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
            <span>{collection.watchOrderNote}</span>
          </div>

          <div className="space-y-4">
            {collection.items.map((item, idx) => {
              const inList = isInWatchlist(item.id);
              const status = getWatchlistStatus?.(item.id);
              const isCompleted = status === 'completed';

              return (
                <div
                  key={item.id}
                  className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 p-4 rounded-xl bg-[#131924] hover:bg-[#171F2E] border border-white/[0.08] transition-colors"
                >
                  <div className="flex items-start sm:items-center gap-4 min-w-0">
                    {/* Watch Order Step Number */}
                    <div className="w-8 h-8 rounded-lg bg-amber-500/15 border border-amber-500/30 text-amber-400 font-mono text-xs font-bold flex items-center justify-center shrink-0">
                      #{idx + 1}
                    </div>

                    {/* Poster */}
                    <div
                      onClick={() => {
                        onClose();
                        onSelectMedia(item);
                      }}
                      className="w-16 sm:w-20 aspect-[2/3] rounded-lg overflow-hidden shrink-0 border border-white/10 cursor-pointer"
                    >
                      <MediaPoster media={item} aspect="poster" />
                    </div>

                    {/* Metadata */}
                    <div className="min-w-0 space-y-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h3
                          onClick={() => {
                            onClose();
                            onSelectMedia(item);
                          }}
                          className="font-bold text-base text-white hover:text-amber-400 cursor-pointer transition-colors"
                        >
                          {item.title}
                        </h3>
                        <span className="px-2 py-0.5 text-[10px] font-mono uppercase rounded bg-white/5 text-slate-300 border border-white/10">
                          {item.type === 'movie' ? 'Movie' : 'Series'}
                        </span>
                      </div>

                      <div className="flex items-center gap-2 text-xs text-slate-400 flex-wrap">
                        <span className="font-mono text-slate-300">{item.year}</span>
                        <span>·</span>
                        <span>
                          {item.type === 'movie'
                            ? item.runtime || 'Feature'
                            : `${item.seasons || 1} Seasons`}
                        </span>
                        <span>·</span>
                        <span className="flex items-center gap-1 text-amber-400 font-mono">
                          <Star className="w-3 h-3 fill-amber-400 text-amber-400" />
                          {item.rating.toFixed(1)}
                        </span>
                        <span>·</span>
                        <span className="text-slate-300">{item.genres.join(', ')}</span>
                      </div>

                      <p className="text-xs text-slate-400 line-clamp-2 max-w-xl">
                        {item.synopsis}
                      </p>
                    </div>
                  </div>

                  {/* Installment Actions */}
                  <div className="flex items-center gap-2 self-end sm:self-center shrink-0">
                    <button
                      type="button"
                      onClick={() => onPlayTrailer(item)}
                      className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs transition-colors"
                    >
                      <Play className="w-3.5 h-3.5 fill-slate-950" />
                      <span>Trailer</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        if (onUpdateStatus) {
                          onUpdateStatus(
                            item.id,
                            isCompleted ? 'plan_to_watch' : 'completed',
                            item
                          );
                        } else {
                          onToggleWatchlist(item.id, item);
                        }
                      }}
                      className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold border transition-colors ${
                        isCompleted
                          ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
                          : inList
                          ? 'bg-amber-500/20 text-amber-300 border-amber-500/40'
                          : 'bg-white/5 hover:bg-white/10 text-slate-200 border-white/10'
                      }`}
                    >
                      {isCompleted ? (
                        <>
                          <Check className="w-3.5 h-3.5" />
                          <span>Completed</span>
                        </>
                      ) : inList && status ? (
                        <>
                          <Bookmark className="w-3.5 h-3.5" />
                          <span>{WATCH_STATUS_LABELS[status]}</span>
                        </>
                      ) : (
                        <>
                          <Bookmark className="w-3.5 h-3.5" />
                          <span>Watchlist</span>
                        </>
                      )}
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        onClose();
                        onSelectMedia(item);
                      }}
                      className="p-2 rounded-lg bg-white/5 hover:bg-white/10 text-slate-300 hover:text-white border border-white/10 transition-colors"
                      title="View Details"
                    >
                      <Info className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
};
