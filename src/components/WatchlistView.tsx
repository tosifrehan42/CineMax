import React, { useState } from 'react';
import { MediaItem, WatchStatus, WatchlistEntry } from '../types';
import { MediaPoster } from './MediaPoster';
import {
  Bookmark,
  Clock,
  Film,
  Tv,
  Star,
  Trash2,
  Edit3,
  Check,
  ChevronRight,
  Filter,
} from 'lucide-react';

interface WatchlistViewProps {
  watchlist: WatchlistEntry[];
  allMedia: MediaItem[];
  onRemoveFromWatchlist: (mediaId: string) => void;
  onUpdateStatus: (mediaId: string, status: WatchStatus) => void;
  onSelectMedia: (media: MediaItem) => void;
  onNavigateHome: () => void;
}

export const WatchlistView: React.FC<WatchlistViewProps> = ({
  watchlist,
  allMedia,
  onRemoveFromWatchlist,
  onUpdateStatus,
  onSelectMedia,
  onNavigateHome,
}) => {
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [viewMode, setViewMode] = useState<'grid' | 'table'>('grid');

  // Map watchlist entries to their media items (supporting dynamically paginated titles)
  const entriesWithMedia = watchlist
    .map((entry) => {
      const media = allMedia.find((m) => m.id === entry.mediaId) || entry.mediaSnapshot;
      return { entry, media };
    })
    .filter((item): item is { entry: WatchlistEntry; media: MediaItem } => item.media !== undefined);

  // Filtered by status
  const filtered = entriesWithMedia.filter((item) => {
    if (filterStatus === 'all') return true;
    return item.entry.status === filterStatus;
  });

  // Calculate statistics
  const totalCount = entriesWithMedia.length;
  const moviesCount = entriesWithMedia.filter((i) => i.media.type === 'movie').length;
  const tvCount = entriesWithMedia.filter((i) => i.media.type === 'tv').length;

  // Approximate hours: movie = 2.2 hrs avg, TV = seasons * 9 hrs avg
  const totalEstimatedHours = entriesWithMedia.reduce((acc, curr) => {
    if (curr.media.type === 'movie') return acc + 2.3;
    return acc + (curr.media.seasons || 1) * 8.5;
  }, 0);

  const ratedEntries = entriesWithMedia.filter((i) => i.entry.personalRating && i.entry.personalRating > 0);
  const avgPersonalRating =
    ratedEntries.length > 0
      ? (
          ratedEntries.reduce((acc, i) => acc + (i.entry.personalRating || 0), 0) /
          ratedEntries.length
        ).toFixed(1)
      : null;

  const completedCount = entriesWithMedia.filter((i) => i.entry.status === 'completed').length;
  const watchingCount = entriesWithMedia.filter((i) => i.entry.status === 'watching').length;
  const planCount = entriesWithMedia.filter((i) => i.entry.status === 'plan_to_watch').length;

  return (
    <div className="space-y-8 pb-16">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="font-['Outfit'] text-3xl font-extrabold text-white tracking-tight flex items-center gap-2.5">
            <Bookmark className="w-7 h-7 text-amber-400 stroke-[2.2]" />
            <span>My Watchlist & Library</span>
          </h1>
          <p className="text-sm text-slate-400 mt-1">
            Personal curation queue, watch status, and cinephile ratings
          </p>
        </div>

        {totalCount > 0 && (
          <div className="flex items-center gap-1.5 p-1 bg-black/40 rounded-lg border border-white/5 text-xs self-start sm:self-auto">
            <button
              onClick={() => setViewMode('grid')}
              className={`px-3 py-1.5 rounded transition-colors ${
                viewMode === 'grid' ? 'bg-white/20 text-white font-medium' : 'text-slate-400 hover:text-white'
              }`}
            >
              Poster Grid
            </button>
            <button
              onClick={() => setViewMode('table')}
              className={`px-3 py-1.5 rounded transition-colors ${
                viewMode === 'table' ? 'bg-white/20 text-white font-medium' : 'text-slate-400 hover:text-white'
              }`}
            >
              List View
            </button>
          </div>
        )}
      </div>

      {/* KPI Stats Strip */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4">
        <div className="p-4 rounded-xl bg-slate-900/70 border border-white/5 flex flex-col justify-between">
          <span className="text-xs uppercase tracking-wider text-slate-400 font-medium">
            Saved Titles
          </span>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="font-mono text-2xl sm:text-3xl font-bold text-white tabular-nums">
              {totalCount}
            </span>
            <span className="text-xs text-slate-400 font-mono">
              ({moviesCount} films · {tvCount} shows)
            </span>
          </div>
        </div>

        <div className="p-4 rounded-xl bg-slate-900/70 border border-white/5 flex flex-col justify-between">
          <span className="text-xs uppercase tracking-wider text-slate-400 font-medium">
            Est. Screen Time
          </span>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="font-mono text-2xl sm:text-3xl font-bold text-amber-400 tabular-nums">
              {Math.round(totalEstimatedHours)}h
            </span>
            <span className="text-xs text-slate-400">total runtime</span>
          </div>
        </div>

        <div className="p-4 rounded-xl bg-slate-900/70 border border-white/5 flex flex-col justify-between">
          <span className="text-xs uppercase tracking-wider text-slate-400 font-medium">
            Completed
          </span>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="font-mono text-2xl sm:text-3xl font-bold text-emerald-400 tabular-nums">
              {completedCount}
            </span>
            <span className="text-xs text-slate-400">
              {totalCount > 0 ? `${Math.round((completedCount / totalCount) * 100)}% done` : '0%'}
            </span>
          </div>
        </div>

        <div className="p-4 rounded-xl bg-slate-900/70 border border-white/5 flex flex-col justify-between">
          <span className="text-xs uppercase tracking-wider text-slate-400 font-medium">
            Avg My Rating
          </span>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="font-mono text-2xl sm:text-3xl font-bold text-amber-300 tabular-nums">
              {avgPersonalRating ? `${avgPersonalRating} ★` : '—'}
            </span>
            <span className="text-xs text-slate-400">
              {ratedEntries.length} logged
            </span>
          </div>
        </div>
      </div>

      {/* Status Segmented Tabs */}
      <div className="flex items-center gap-1.5 p-1 bg-slate-900/90 rounded-xl border border-white/5 overflow-x-auto max-w-full">
        <button
          onClick={() => setFilterStatus('all')}
          className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors whitespace-nowrap ${
            filterStatus === 'all'
              ? 'bg-amber-500 text-slate-950 font-bold'
              : 'text-slate-400 hover:text-white'
          }`}
        >
          All ({totalCount})
        </button>
        <button
          onClick={() => setFilterStatus('plan_to_watch')}
          className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors whitespace-nowrap ${
            filterStatus === 'plan_to_watch'
              ? 'bg-amber-500 text-slate-950 font-bold'
              : 'text-slate-400 hover:text-white'
          }`}
        >
          Want to Watch ({planCount})
        </button>
        <button
          onClick={() => setFilterStatus('watching')}
          className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors whitespace-nowrap ${
            filterStatus === 'watching'
              ? 'bg-amber-500 text-slate-950 font-bold'
              : 'text-slate-400 hover:text-white'
          }`}
        >
          Currently Watching ({watchingCount})
        </button>
        <button
          onClick={() => setFilterStatus('completed')}
          className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors whitespace-nowrap ${
            filterStatus === 'completed'
              ? 'bg-amber-500 text-slate-950 font-bold'
              : 'text-slate-400 hover:text-white'
          }`}
        >
          Completed ({completedCount})
        </button>
      </div>

      {/* Main Content Area */}
      {filtered.length === 0 ? (
        <div className="py-20 text-center rounded-2xl border border-white/5 bg-slate-900/30">
          <Bookmark className="w-12 h-12 mx-auto stroke-1 text-slate-600 mb-3" />
          <h3 className="font-['Outfit'] text-lg font-bold text-white">
            {totalCount === 0 ? 'Your Watchlist is empty' : 'No titles in this category'}
          </h3>
          <p className="text-xs text-slate-400 max-w-md mx-auto mt-1 leading-relaxed">
            {totalCount === 0
              ? 'Start discovering visionary films and television series to curate your queue and track viewing progress.'
              : 'Switch filter tabs or add more titles from the Discover page.'}
          </p>
          <button
            onClick={onNavigateHome}
            className="mt-5 px-5 py-2.5 rounded-xl bg-gradient-to-r from-amber-400 to-amber-500 text-slate-950 font-bold text-xs hover:from-amber-300 hover:to-amber-400 shadow-md shadow-amber-500/20"
          >
            Explore Featured Titles
          </button>
        </div>
      ) : viewMode === 'grid' ? (
        /* Poster Grid View */
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4 sm:gap-6">
          {filtered.map(({ entry, media }) => (
            <div
              key={media.id}
              className="group relative flex flex-col bg-slate-900/60 rounded-xl border border-white/5 p-2 hover:border-amber-400/30 transition-all"
            >
              <div
                onClick={() => onSelectMedia(media)}
                className="cursor-pointer overflow-hidden rounded-lg relative"
              >
                <MediaPoster media={media} aspect="poster" />
              </div>

              {/* Title & Metadata */}
              <div className="mt-2.5 px-1 flex-1 flex flex-col justify-between">
                <div>
                  <div className="flex items-center justify-between text-xs text-slate-400">
                    <span>{media.year}</span>
                    <span className="font-mono text-amber-400">★ {media.rating.toFixed(1)}</span>
                  </div>
                  <h4
                    onClick={() => onSelectMedia(media)}
                    className="text-sm font-semibold text-white tracking-tight line-clamp-1 group-hover:text-amber-400 transition-colors cursor-pointer mt-0.5"
                  >
                    {media.title}
                  </h4>
                </div>

                {/* Status Switcher & Remove action */}
                <div className="mt-3 pt-2.5 border-t border-white/5 flex items-center justify-between gap-1">
                  <select
                    value={entry.status}
                    onChange={(e) => onUpdateStatus(media.id, e.target.value as WatchStatus)}
                    className="bg-black/40 border border-white/10 text-[11px] text-slate-300 rounded px-1.5 py-1 focus:outline-none focus:border-amber-400"
                  >
                    <option value="plan_to_watch">Want to Watch</option>
                    <option value="watching">Watching</option>
                    <option value="completed">Completed</option>
                  </select>

                  <button
                    onClick={() => onRemoveFromWatchlist(media.id)}
                    aria-label={`Remove ${media.title} from watchlist`}
                    className="p-1.5 text-slate-500 hover:text-red-400 rounded hover:bg-white/5 transition-colors"
                    title="Remove from Watchlist"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : (
        /* Detailed Table / List View */
        <div className="overflow-x-auto rounded-xl border border-white/5 bg-slate-900/50">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="border-b border-white/10 bg-black/40 text-slate-400 uppercase tracking-wider font-semibold">
                <th className="py-3 px-4">Title</th>
                <th className="py-3 px-4">Format</th>
                <th className="py-3 px-4">ReelScore</th>
                <th className="py-3 px-4">Status</th>
                <th className="py-3 px-4">Personal Rating</th>
                <th className="py-3 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {filtered.map(({ entry, media }) => (
                <tr key={media.id} className="hover:bg-white/5 transition-colors">
                  <td className="py-3 px-4">
                    <div
                      onClick={() => onSelectMedia(media)}
                      className="flex items-center gap-3 cursor-pointer group"
                    >
                      <div className="w-10 h-14 rounded overflow-hidden shrink-0 border border-white/10">
                        <MediaPoster media={media} aspect="poster" />
                      </div>
                      <div>
                        <div className="font-semibold text-white group-hover:text-amber-400 transition-colors">
                          {media.title}
                        </div>
                        <div className="text-[11px] text-slate-400">
                          {media.year} · Dir. {media.director.split('&')[0]}
                        </div>
                      </div>
                    </div>
                  </td>

                  <td className="py-3 px-4 text-slate-300">
                    {media.type === 'movie' ? media.runtime : `${media.seasons} Seasons`}
                  </td>

                  <td className="py-3 px-4 font-mono font-medium text-amber-400">
                    ★ {media.rating.toFixed(1)}
                  </td>

                  <td className="py-3 px-4">
                    <select
                      value={entry.status}
                      onChange={(e) => onUpdateStatus(media.id, e.target.value as WatchStatus)}
                      className="bg-black/50 border border-white/10 text-xs text-slate-200 rounded px-2 py-1 focus:outline-none"
                    >
                      <option value="plan_to_watch">Want to Watch</option>
                      <option value="watching">Watching</option>
                      <option value="completed">Completed</option>
                    </select>
                  </td>

                  <td className="py-3 px-4 font-mono text-amber-300">
                    {entry.personalRating ? `${entry.personalRating} / 10 ★` : '—'}
                  </td>

                  <td className="py-3 px-4 text-right">
                    <button
                      onClick={() => onRemoveFromWatchlist(media.id)}
                      className="p-1.5 text-slate-400 hover:text-red-400 rounded hover:bg-white/5 transition-colors"
                      title="Remove"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};
