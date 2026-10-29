import React, { useState, useMemo } from 'react';
import {
  MediaItem,
  WatchedEpisodeEntry,
  WatchStatus,
  WatchlistEntry,
  WATCH_STATUS_LABELS,
  WATCH_STATUS_ORDER,
} from '../types';
import { MediaPoster } from './MediaPoster';
import { LiquidTabBubble, useLiquidTabBubble } from './LiquidTabBubble';
import {
  parseRuntimeMinutes,
  SUPABASE_SCHEMA_SQL,
  SUPABASE_CHECKLIST_MIGRATION_SQL,
} from '../services/supabaseClient';
import {
  Bookmark,
  Trash2,
  Heart,
  Cloud,
  LogIn,
  AlertCircle,
  RefreshCw,
  Loader2,
  Copy,
  Check,
  UploadCloud,
  Search,
  X,
  Tv,
  CheckSquare,
  Square,
  SlidersHorizontal,
} from 'lucide-react';

interface WatchlistViewProps {
  watchlist: WatchlistEntry[];
  watchedEpisodes?: WatchedEpisodeEntry[];
  allMedia: MediaItem[];
  onRemoveFromWatchlist: (mediaId: string) => void;
  onUpdateStatus: (mediaId: string, status: WatchStatus, media?: MediaItem) => void;
  onToggleFavourite?: (mediaId: string, media?: MediaItem) => void;
  onSelectMedia: (media: MediaItem) => void;
  onNavigateHome: () => void;
  onNavigateDiscover?: () => void;
  isAuthenticated?: boolean;
  isLoading?: boolean;
  error?: string | null;
  schemaMissing?: boolean;
  migrationNeeded?: boolean;
  onRetry?: () => void;
  onOpenAuthModal?: (mode?: 'signin' | 'signup') => void;
  pendingLocalCount?: number;
  onImportLocalWatchlist?: () => void;
  onOpenImportCompleted?: () => void;
}

type SortOption = 'date_added' | 'title' | 'rating' | 'personal_rating';

export const WatchlistView: React.FC<WatchlistViewProps> = ({
  watchlist,
  watchedEpisodes = [],
  allMedia,
  onRemoveFromWatchlist,
  onUpdateStatus,
  onToggleFavourite,
  onSelectMedia,
  onNavigateHome,
  onNavigateDiscover,
  isAuthenticated = false,
  isLoading = false,
  error = null,
  schemaMissing = false,
  migrationNeeded = false,
  onRetry,
  onOpenAuthModal,
  pendingLocalCount = 0,
  onImportLocalWatchlist,
  onOpenImportCompleted,
}) => {
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [mediaTypeFilter, setMediaTypeFilter] = useState<'all' | 'movie' | 'tv'>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [sortBy, setSortBy] = useState<SortOption>('date_added');
  const [viewMode, setViewMode] = useState<'grid' | 'table'>('grid');
  const [copiedSql, setCopiedSql] = useState(false);
  const [copiedMigrationSql, setCopiedMigrationSql] = useState(false);

  // Map watchlist entries to their media items (supporting dynamically paginated titles)
  const entriesWithMedia = useMemo(() => {
    return watchlist
      .map((entry, index) => {
        const media = allMedia.find((m) => m.id === entry.mediaId) || entry.mediaSnapshot;
        return { entry, media, index };
      })
      .filter(
        (
          item
        ): item is { entry: WatchlistEntry; media: MediaItem; index: number } =>
          item.media !== undefined
      );
  }, [watchlist, allMedia]);

  // Episode count lookup map by mediaId
  const watchedEpCountByMedia = useMemo(() => {
    const map = new Map<string, number>();
    for (const ep of watchedEpisodes) {
      map.set(ep.mediaId, (map.get(ep.mediaId) || 0) + 1);
    }
    return map;
  }, [watchedEpisodes]);

  // Calculate statistics & progress summary
  const totalCount = entriesWithMedia.length;
  const moviesCount = entriesWithMedia.filter((i) => i.media.type === 'movie').length;
  const tvCount = entriesWithMedia.filter((i) => i.media.type === 'tv').length;
  const favouritesCount = entriesWithMedia.filter((i) => i.entry.isFavourite).length;

  const completedCount = entriesWithMedia.filter((i) => i.entry.status === 'completed').length;
  const watchingCount = entriesWithMedia.filter((i) => i.entry.status === 'watching').length;
  const planCount = entriesWithMedia.filter((i) => i.entry.status === 'plan_to_watch').length;
  const onHoldCount = entriesWithMedia.filter((i) => i.entry.status === 'on_hold').length;
  const droppedCount = entriesWithMedia.filter((i) => i.entry.status === 'dropped').length;

  const viewModeBubble = useLiquidTabBubble<'grid' | 'table'>(
    totalCount > 0 ? viewMode : null,
    [totalCount]
  );
  const statusBubble = useLiquidTabBubble<string>(filterStatus, [
    totalCount,
    planCount,
    watchingCount,
    completedCount,
    onHoldCount,
    droppedCount,
    favouritesCount,
  ]);
  const mediaTypeBubble = useLiquidTabBubble<'all' | 'movie' | 'tv'>(
    totalCount > 0 ? mediaTypeFilter : null,
    [totalCount, moviesCount, tvCount]
  );
  const remainingCount = Math.max(0, totalCount - completedCount - droppedCount);
  const completionPct =
    totalCount > 0 ? Math.min(100, Math.round((completedCount / totalCount) * 100)) : 0;

  const totalEstimatedMinutes = entriesWithMedia.reduce((acc, curr) => {
    return acc + parseRuntimeMinutes(curr.media);
  }, 0);
  const totalEstimatedHours = totalEstimatedMinutes / 60;

  const ratedEntries = entriesWithMedia.filter(
    (i) => i.entry.personalRating && i.entry.personalRating > 0
  );
  const avgPersonalRating =
    ratedEntries.length > 0
      ? (
          ratedEntries.reduce((acc, i) => acc + (i.entry.personalRating || 0), 0) /
          ratedEntries.length
        ).toFixed(1)
      : null;

  // Filtered & sorted list
  const filteredAndSorted = useMemo(() => {
    const cleanQ = searchQuery.trim().toLowerCase();

    const matches = entriesWithMedia.filter(({ entry, media }) => {
      if (filterStatus === 'favourites') {
        if (!entry.isFavourite) return false;
      } else if (filterStatus !== 'all') {
        if (entry.status !== filterStatus) return false;
      }

      if (mediaTypeFilter !== 'all' && media.type !== mediaTypeFilter) {
        return false;
      }

      if (cleanQ) {
        const titleMatch = media.title.toLowerCase().includes(cleanQ);
        const directorMatch = (media.director || '').toLowerCase().includes(cleanQ);
        const genreMatch = media.genres.some((g) => g.toLowerCase().includes(cleanQ));
        const yearMatch = String(media.year).includes(cleanQ);
        if (!titleMatch && !directorMatch && !genreMatch && !yearMatch) {
          return false;
        }
      }

      return true;
    });

    matches.sort((a, b) => {
      if (sortBy === 'title') {
        return a.media.title.localeCompare(b.media.title);
      }
      if (sortBy === 'rating') {
        return (b.media.rating || 0) - (a.media.rating || 0);
      }
      if (sortBy === 'personal_rating') {
        return (b.entry.personalRating || 0) - (a.entry.personalRating || 0);
      }
      // Default: date_added (newest first, falling back to array order)
      const timeA = a.entry.addedAt ? new Date(a.entry.addedAt).getTime() : 0;
      const timeB = b.entry.addedAt ? new Date(b.entry.addedAt).getTime() : 0;
      if (timeB !== timeA) return timeB - timeA;
      return a.index - b.index;
    });

    return matches;
  }, [entriesWithMedia, filterStatus, mediaTypeFilter, searchQuery, sortBy]);

  const handleCopySql = () => {
    navigator.clipboard?.writeText(SUPABASE_SCHEMA_SQL);
    setCopiedSql(true);
    setTimeout(() => setCopiedSql(false), 2500);
  };

  const handleCopyMigrationSql = () => {
    navigator.clipboard?.writeText(SUPABASE_CHECKLIST_MIGRATION_SQL);
    setCopiedMigrationSql(true);
    setTimeout(() => setCopiedMigrationSql(false), 2500);
  };

  const resetChecklistFilters = () => {
    setFilterStatus('all');
    setMediaTypeFilter('all');
    setSearchQuery('');
    setSortBy('date_added');
  };

  const getStatusBadgeClasses = (status: WatchStatus) => {
    switch (status) {
      case 'completed':
        return 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30';
      case 'watching':
        return 'bg-sky-500/15 text-sky-300 border-sky-500/30';
      case 'on_hold':
        return 'bg-amber-500/15 text-amber-300 border-amber-500/30';
      case 'dropped':
        return 'bg-rose-500/15 text-rose-300 border-rose-500/30';
      case 'plan_to_watch':
      default:
        return 'bg-white/10 text-slate-200 border-white/15';
    }
  };

  return (
    <div className="space-y-7 pb-16">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="font-['Outfit'] text-3xl font-extrabold text-white tracking-tight flex items-center gap-2.5">
            <Bookmark className="w-7 h-7 text-amber-400 stroke-[2.2]" />
            <span>My Checklist & Watchlist</span>
          </h1>
          <p className="text-sm text-slate-400 mt-1">
            Personal viewing checklist, watch statuses, episode progress, and cinephile ratings
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3 self-start sm:self-auto">
          {onOpenImportCompleted && (
            <button
              type="button"
              onClick={onOpenImportCompleted}
              className="cm-glass-control px-3.5 py-2 rounded-xl text-xs font-semibold text-amber-300 hover:text-amber-200 flex items-center gap-1.5 transition-colors whitespace-nowrap shrink-0"
            >
              <UploadCloud className="w-3.5 h-3.5 text-amber-400" />
              <span>Import Completed List</span>
            </button>
          )}
          {totalCount > 0 && (
            <div
              ref={viewModeBubble.containerRef}
              className="relative cm-glass-segmented flex items-center gap-1.5 p-1 rounded-lg text-xs overflow-hidden"
            >
              <LiquidTabBubble
                controller={viewModeBubble}
                variant="glass"
                className="top-1 bottom-1 rounded"
              />
              <button
                ref={viewModeBubble.registerTab('grid')}
                onClick={() => setViewMode('grid')}
                className={`relative z-10 px-3 py-1.5 rounded transition-colors whitespace-nowrap ${
                  viewMode === 'grid'
                    ? viewModeBubble.ready
                      ? 'text-white font-semibold'
                      : 'bg-white/20 text-white font-semibold'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                Poster Grid
              </button>
              <button
                ref={viewModeBubble.registerTab('table')}
                onClick={() => setViewMode('table')}
                className={`relative z-10 px-3 py-1.5 rounded transition-colors whitespace-nowrap ${
                  viewMode === 'table'
                    ? viewModeBubble.ready
                      ? 'text-white font-semibold'
                      : 'bg-white/20 text-white font-semibold'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                Checklist Table
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Signed-Out or Cloud Sync Banner */}
      {!isAuthenticated ? (
        <div className="p-4 sm:p-5 rounded-2xl bg-slate-900/80 border border-white/10 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2 text-xs font-semibold text-amber-400">
              <Cloud className="w-4 h-4" />
              <span>Signed-Out Browser Session (Local Checklist Active)</span>
            </div>
            <p className="text-xs text-slate-300 leading-relaxed max-w-2xl">
              Your checklist, watch statuses, and TV episode progress are saved locally in this browser. Sign in to sync your library across devices with Supabase.
            </p>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <button
              onClick={() => onOpenAuthModal?.('signin')}
              className="px-4 py-2 rounded-xl bg-gradient-to-r from-amber-400 to-amber-500 hover:from-amber-300 hover:to-amber-400 text-slate-950 font-bold text-xs flex items-center gap-1.5 shadow-sm shadow-amber-500/20 whitespace-nowrap"
            >
              <LogIn className="w-3.5 h-3.5" />
              <span>Sign In to Sync</span>
            </button>
          </div>
        </div>
      ) : (
        pendingLocalCount > 0 &&
        onImportLocalWatchlist && (
          <div className="p-4 rounded-2xl bg-amber-500/10 border border-amber-500/30 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="text-xs text-amber-200">
              <strong className="text-amber-300">Local Checklist Detected:</strong> You have{' '}
              <span className="font-mono font-bold tabular-nums">{pendingLocalCount}</span> local browser{' '}
              {pendingLocalCount === 1 ? 'item' : 'items'} ready to merge into your cloud account.
            </div>
            <button
              onClick={onImportLocalWatchlist}
              className="px-3.5 py-1.5 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs flex items-center gap-1.5 shrink-0 whitespace-nowrap"
            >
              <UploadCloud className="w-3.5 h-3.5" />
              <span>Merge to Cloud</span>
            </button>
          </div>
        )
      )}

      {/* Migration Helper Banner (when watched_episodes or status constraint update is needed) */}
      {isAuthenticated && migrationNeeded && (
        <div className="p-4 rounded-2xl bg-amber-500/10 border border-amber-500/30 text-xs text-amber-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="space-y-1">
            <p className="font-semibold text-amber-300">
              Optional Database Upgrade: Enable Cloud Sync for On Hold, Dropped & TV Episodes
            </p>
            <p className="text-amber-200/80">
              Your changes are preserved locally. Copy and run the non-destructive Checklist Migration SQL in your Supabase SQL Editor to sync all 5 statuses and episode progress to the cloud.
            </p>
          </div>
          <button
            onClick={handleCopyMigrationSql}
            className="px-3.5 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold flex items-center gap-1.5 shrink-0 whitespace-nowrap"
          >
            {copiedMigrationSql ? (
              <>
                <Check className="w-3.5 h-3.5" />
                <span>Migration SQL Copied</span>
              </>
            ) : (
              <>
                <Copy className="w-3.5 h-3.5" />
                <span>Copy Migration SQL</span>
              </>
            )}
          </button>
        </div>
      )}

      {/* Error State Banner */}
      {error && (
        <div className="p-4 rounded-2xl bg-red-500/10 border border-red-500/30 text-xs text-red-200 space-y-3">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-start gap-2.5">
              <AlertCircle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
              <div>
                <p className="font-semibold text-red-300">Checklist Sync Notice</p>
                <p className="text-red-200/80 mt-0.5">{error}</p>
              </div>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              {(schemaMissing || migrationNeeded) && (
                <button
                  onClick={schemaMissing ? handleCopySql : handleCopyMigrationSql}
                  className="px-3 py-1.5 rounded-lg bg-white/10 hover:bg-white/15 text-white font-medium flex items-center gap-1.5 whitespace-nowrap"
                >
                  {copiedSql || copiedMigrationSql ? (
                    <>
                      <Check className="w-3.5 h-3.5 text-emerald-400" />
                      <span>SQL Copied</span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-3.5 h-3.5" />
                      <span>Copy SQL Schema</span>
                    </>
                  )}
                </button>
              )}
              {onRetry && (
                <button
                  onClick={onRetry}
                  className="px-3 py-1.5 rounded-lg bg-red-500/20 hover:bg-red-500/30 border border-red-500/40 text-red-200 font-semibold flex items-center gap-1.5 whitespace-nowrap"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                  <span>Retry</span>
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Checklist Progress Summary & KPI Strip */}
      <div className="cm-glass-surface p-5 rounded-2xl space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div>
            <h2 className="font-['Outfit'] text-sm font-bold text-white uppercase tracking-wider">
              Checklist Completion Progress
            </h2>
            <p className="text-xs text-slate-400 mt-0.5">
              <span className="font-mono text-white font-semibold tabular-nums">{completedCount}</span>{' '}
              completed ·{' '}
              <span className="font-mono text-sky-300 font-semibold tabular-nums">{watchingCount}</span>{' '}
              watching ·{' '}
              <span className="font-mono text-amber-300 font-semibold tabular-nums">{remainingCount}</span>{' '}
              remaining in queue
              {watchedEpisodes.length > 0 && (
                <>
                  {' '}
                  ·{' '}
                  <span className="font-mono text-emerald-300 font-semibold tabular-nums">
                    {watchedEpisodes.length}
                  </span>{' '}
                  TV episodes logged
                </>
              )}
            </p>
          </div>
          <div className="flex items-baseline gap-2">
            <span className="font-mono text-2xl font-extrabold text-amber-400 tabular-nums">
              {completionPct}%
            </span>
            <span className="text-xs text-slate-400">completed</span>
          </div>
        </div>

        {/* Visual Progress Bar */}
        <div className="w-full h-2.5 bg-black/50 rounded-full overflow-hidden border border-white/5">
          <div
            className="h-full bg-gradient-to-r from-amber-500 via-amber-400 to-emerald-400 transition-all duration-500"
            style={{ width: `${completionPct}%` }}
          />
        </div>

        {/* 4-Column KPI Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-1">
          <div className="p-3.5 rounded-xl bg-black/30 border border-white/5 flex flex-col justify-between">
            <span className="text-[11px] uppercase tracking-wider text-slate-400 font-medium">
              Total Saved
            </span>
            <div className="mt-1.5 flex items-baseline gap-2">
              <span className="font-mono text-2xl font-bold text-white tabular-nums">
                {totalCount}
              </span>
              <span className="text-xs text-slate-400 font-mono tabular-nums">
                {moviesCount} films · {tvCount} shows
              </span>
            </div>
          </div>

          <div className="p-3.5 rounded-xl bg-black/30 border border-white/5 flex flex-col justify-between">
            <span className="text-[11px] uppercase tracking-wider text-slate-400 font-medium">
              Completed
            </span>
            <div className="mt-1.5 flex items-baseline gap-2">
              <span className="font-mono text-2xl font-bold text-emerald-400 tabular-nums">
                {completedCount}
              </span>
              <span className="text-xs text-slate-400 font-mono tabular-nums">
                of {totalCount} titles
              </span>
            </div>
          </div>

          <div className="p-3.5 rounded-xl bg-black/30 border border-white/5 flex flex-col justify-between">
            <span className="text-[11px] uppercase tracking-wider text-slate-400 font-medium">
              Remaining
            </span>
            <div className="mt-1.5 flex items-baseline gap-2">
              <span className="font-mono text-2xl font-bold text-amber-400 tabular-nums">
                {remainingCount}
              </span>
              <span className="text-xs text-slate-400 font-mono tabular-nums">
                ~{Math.round(totalEstimatedHours)}h total runtime
              </span>
            </div>
          </div>

          <div className="p-3.5 rounded-xl bg-black/30 border border-white/5 flex flex-col justify-between">
            <span className="text-[11px] uppercase tracking-wider text-slate-400 font-medium">
              Avg My Rating
            </span>
            <div className="mt-1.5 flex items-baseline gap-2">
              <span className="font-mono text-2xl font-bold text-amber-300 tabular-nums">
                {avgPersonalRating ? `${avgPersonalRating} ★` : '—'}
              </span>
              <span className="text-xs text-slate-400 font-mono tabular-nums">
                {ratedEntries.length} rated · {favouritesCount} favs
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Status Segmented Tabs (All, Want to Watch, Watching, Completed, On Hold, Dropped, Favourites) */}
      <div
        ref={statusBubble.containerRef}
        className="relative cm-glass-segmented flex items-center gap-1.5 p-1.5 rounded-xl overflow-x-auto max-w-full"
      >
        <LiquidTabBubble
          controller={statusBubble}
          variant={filterStatus === 'favourites' ? 'rose' : 'amber'}
          className="top-1.5 bottom-1.5 rounded-lg"
        />
        <button
          ref={statusBubble.registerTab('all')}
          onClick={() => setFilterStatus('all')}
          className={`relative z-10 px-3 py-1.5 text-xs font-medium rounded-lg transition-colors whitespace-nowrap ${
            filterStatus === 'all'
              ? statusBubble.ready
                ? 'text-slate-950 font-bold'
                : 'bg-amber-500 text-slate-950 font-bold'
              : 'text-slate-400 hover:text-white'
          }`}
        >
          All ({totalCount})
        </button>
        <button
          ref={statusBubble.registerTab('plan_to_watch')}
          onClick={() => setFilterStatus('plan_to_watch')}
          className={`relative z-10 px-3 py-1.5 text-xs font-medium rounded-lg transition-colors whitespace-nowrap ${
            filterStatus === 'plan_to_watch'
              ? statusBubble.ready
                ? 'text-slate-950 font-bold'
                : 'bg-amber-500 text-slate-950 font-bold'
              : 'text-slate-400 hover:text-white'
          }`}
        >
          Want to Watch ({planCount})
        </button>
        <button
          ref={statusBubble.registerTab('watching')}
          onClick={() => setFilterStatus('watching')}
          className={`relative z-10 px-3 py-1.5 text-xs font-medium rounded-lg transition-colors whitespace-nowrap ${
            filterStatus === 'watching'
              ? statusBubble.ready
                ? 'text-slate-950 font-bold'
                : 'bg-amber-500 text-slate-950 font-bold'
              : 'text-slate-400 hover:text-white'
          }`}
        >
          Watching ({watchingCount})
        </button>
        <button
          ref={statusBubble.registerTab('completed')}
          onClick={() => setFilterStatus('completed')}
          className={`relative z-10 px-3 py-1.5 text-xs font-medium rounded-lg transition-colors whitespace-nowrap ${
            filterStatus === 'completed'
              ? statusBubble.ready
                ? 'text-slate-950 font-bold'
                : 'bg-amber-500 text-slate-950 font-bold'
              : 'text-slate-400 hover:text-white'
          }`}
        >
          Completed ({completedCount})
        </button>
        <button
          ref={statusBubble.registerTab('on_hold')}
          onClick={() => setFilterStatus('on_hold')}
          className={`relative z-10 px-3 py-1.5 text-xs font-medium rounded-lg transition-colors whitespace-nowrap ${
            filterStatus === 'on_hold'
              ? statusBubble.ready
                ? 'text-slate-950 font-bold'
                : 'bg-amber-500 text-slate-950 font-bold'
              : 'text-slate-400 hover:text-white'
          }`}
        >
          On Hold ({onHoldCount})
        </button>
        <button
          ref={statusBubble.registerTab('dropped')}
          onClick={() => setFilterStatus('dropped')}
          className={`relative z-10 px-3 py-1.5 text-xs font-medium rounded-lg transition-colors whitespace-nowrap ${
            filterStatus === 'dropped'
              ? statusBubble.ready
                ? 'text-slate-950 font-bold'
                : 'bg-amber-500 text-slate-950 font-bold'
              : 'text-slate-400 hover:text-white'
          }`}
        >
          Dropped ({droppedCount})
        </button>
        <button
          ref={statusBubble.registerTab('favourites')}
          onClick={() => setFilterStatus('favourites')}
          className={`relative z-10 px-3 py-1.5 text-xs font-medium rounded-lg transition-colors whitespace-nowrap flex items-center gap-1.5 ${
            filterStatus === 'favourites'
              ? statusBubble.ready
                ? 'text-white font-bold'
                : 'bg-rose-500 text-white font-bold'
              : 'text-slate-400 hover:text-white'
          }`}
        >
          <Heart className="w-3 h-3 fill-current" />
          <span>Favourites ({favouritesCount})</span>
        </button>
      </div>

      {/* Search Within Saved Titles, Format Filter & Sort Controls */}
      {totalCount > 0 && (
        <div className="cm-glass-surface flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3 p-3.5 rounded-xl">
          {/* Search Input */}
          <div className="relative flex-1 max-w-md">
            <Search className="w-4 h-4 text-amber-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search saved titles by name, director, or genre..."
              className="cm-glass-input w-full pl-9 pr-8 py-2 rounded-lg text-xs text-white placeholder:text-slate-500 focus:outline-none"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white"
                aria-label="Clear checklist search"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-3">
            {/* Media Type Filter */}
            <div
              ref={mediaTypeBubble.containerRef}
              className="relative cm-glass-segmented flex items-center gap-1 p-1 rounded-lg text-xs overflow-hidden"
            >
              <LiquidTabBubble
                controller={mediaTypeBubble}
                variant="glass"
                className="top-1 bottom-1 rounded"
              />
              <button
                ref={mediaTypeBubble.registerTab('all')}
                type="button"
                onClick={() => setMediaTypeFilter('all')}
                className={`relative z-10 px-2.5 py-1 rounded transition-colors whitespace-nowrap ${
                  mediaTypeFilter === 'all'
                    ? mediaTypeBubble.ready
                      ? 'text-white font-semibold'
                      : 'bg-white/15 text-white font-semibold'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                All Types
              </button>
              <button
                ref={mediaTypeBubble.registerTab('movie')}
                type="button"
                onClick={() => setMediaTypeFilter('movie')}
                className={`relative z-10 px-2.5 py-1 rounded transition-colors whitespace-nowrap ${
                  mediaTypeFilter === 'movie'
                    ? mediaTypeBubble.ready
                      ? 'text-white font-semibold'
                      : 'bg-white/15 text-white font-semibold'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                Movies ({moviesCount})
              </button>
              <button
                ref={mediaTypeBubble.registerTab('tv')}
                type="button"
                onClick={() => setMediaTypeFilter('tv')}
                className={`relative z-10 px-2.5 py-1 rounded transition-colors whitespace-nowrap ${
                  mediaTypeFilter === 'tv'
                    ? mediaTypeBubble.ready
                      ? 'text-white font-semibold'
                      : 'bg-white/15 text-white font-semibold'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                TV Series ({tvCount})
              </button>
            </div>

            {/* Sort Selector */}
            <div className="flex items-center gap-2 text-xs">
              <span className="text-slate-400 flex items-center gap-1 whitespace-nowrap">
                <SlidersHorizontal className="w-3.5 h-3.5 text-amber-400" />
                <span>Sort by:</span>
              </span>
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as SortOption)}
                className="cm-glass-input text-xs text-slate-200 rounded-lg px-2.5 py-1.5 focus:outline-none"
              >
                <option value="date_added">Date Added (Newest)</option>
                <option value="title">Title (A–Z)</option>
                <option value="rating">TMDB Rating (High–Low)</option>
                <option value="personal_rating">My Rating (High–Low)</option>
              </select>
            </div>
          </div>
        </div>
      )}

      {/* Main Content Area */}
      {isLoading ? (
        <div className="py-20 text-center rounded-2xl border border-white/5 bg-slate-900/30 space-y-3">
          <Loader2 className="w-8 h-8 mx-auto text-amber-400 animate-spin" />
          <p className="text-sm font-medium text-slate-300">Loading your cloud checklist...</p>
        </div>
      ) : filteredAndSorted.length === 0 ? (
        <div className="py-20 text-center rounded-2xl border border-white/5 bg-slate-900/30">
          <Bookmark className="w-12 h-12 mx-auto stroke-1 text-slate-600 mb-3" />
          <h3 className="font-['Outfit'] text-lg font-bold text-white">
            {totalCount === 0
              ? 'Your Checklist is empty'
              : searchQuery.trim()
              ? `No saved titles matching "${searchQuery}"`
              : filterStatus === 'favourites'
              ? 'No Favourite titles yet'
              : `No titles marked as "${
                  WATCH_STATUS_LABELS[filterStatus as WatchStatus] || filterStatus
                }"`}
          </h3>
          <p className="text-xs text-slate-400 max-w-md mx-auto mt-1 leading-relaxed">
            {totalCount === 0
              ? 'Start discovering visionary films and television series to curate your personal checklist and track episode progress.'
              : 'Try clearing your search filter, switching status tabs, or exploring new releases in the Discover catalogue.'}
          </p>
          <div className="mt-5 flex items-center justify-center gap-3">
            {totalCount > 0 && (
              <button
                type="button"
                onClick={resetChecklistFilters}
                className="px-4 py-2.5 rounded-xl bg-white/10 hover:bg-white/15 text-white font-semibold text-xs transition-colors"
              >
                Reset Checklist Filters
              </button>
            )}
            <button
              type="button"
              onClick={onNavigateDiscover || onNavigateHome}
              className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-amber-400 to-amber-500 text-slate-950 font-bold text-xs hover:from-amber-300 hover:to-amber-400 shadow-md shadow-amber-500/20"
            >
              Discover Movies & TV Shows
            </button>
          </div>
        </div>
      ) : viewMode === 'grid' ? (
        /* Poster Grid View */
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4 sm:gap-6">
          {filteredAndSorted.map(({ entry, media }) => {
            const watchedEps = watchedEpCountByMedia.get(media.id) || 0;
            const totalEps = media.totalEpisodes || (media.seasons ? media.seasons * 8 : 0);
            const tvPct =
              media.type === 'tv' && totalEps > 0
                ? Math.min(100, Math.round((watchedEps / totalEps) * 100))
                : 0;
            const isCompleted = entry.status === 'completed';

            return (
              <div
                key={media.id}
                className="group relative flex flex-col bg-slate-900/60 rounded-xl border border-white/5 p-2.5 hover:border-amber-400/30 transition-all"
              >
                <div
                  onClick={() => onSelectMedia(media)}
                  className="cursor-pointer overflow-hidden rounded-lg relative"
                >
                  <MediaPoster media={media} aspect="poster" />

                  {/* Top-left Quick Checkable Completion Control */}
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      onUpdateStatus(
                        media.id,
                        isCompleted ? 'plan_to_watch' : 'completed',
                        media
                      );
                    }}
                    aria-label={
                      isCompleted ? 'Mark as Want to Watch' : 'Mark as Completed'
                    }
                    title={
                      isCompleted
                        ? 'Completed (Click to uncheck)'
                        : 'Mark as Completed'
                    }
                    className={`absolute top-2 left-2 p-1.5 rounded-lg backdrop-blur-md border transition-all flex items-center gap-1 text-[11px] font-semibold ${
                      isCompleted
                        ? 'bg-emerald-500 text-slate-950 border-emerald-400 shadow-md'
                        : 'bg-black/65 text-white/80 border-white/15 hover:bg-black/85 hover:text-white'
                    }`}
                  >
                    {isCompleted ? (
                      <CheckSquare className="w-3.5 h-3.5 stroke-[2.5]" />
                    ) : (
                      <Square className="w-3.5 h-3.5" />
                    )}
                  </button>

                  {/* Top-right Favourite Heart Button */}
                  {onToggleFavourite && (
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        onToggleFavourite(media.id, media);
                      }}
                      aria-label={
                        entry.isFavourite ? 'Remove from favourites' : 'Mark as favourite'
                      }
                      className={`absolute top-2 right-2 p-1.5 rounded-full backdrop-blur-md border transition-colors ${
                        entry.isFavourite
                          ? 'bg-rose-500/90 border-rose-400 text-white'
                          : 'bg-black/60 border-white/10 text-white/70 hover:text-white'
                      }`}
                    >
                      <Heart
                        className={`w-3.5 h-3.5 ${entry.isFavourite ? 'fill-current' : ''}`}
                      />
                    </button>
                  )}

                  {/* Bottom Progress Bar for TV Series */}
                  {media.type === 'tv' && watchedEps > 0 && (
                    <div className="absolute bottom-0 inset-x-0 h-1.5 bg-black/75">
                      <div
                        className="h-full bg-amber-400 transition-all duration-300"
                        style={{ width: `${tvPct > 0 ? tvPct : 15}%` }}
                      />
                    </div>
                  )}
                </div>

                {/* Title & Metadata */}
                <div className="mt-2.5 px-1 flex-1 flex flex-col justify-between">
                  <div>
                    <div className="flex items-center justify-between text-xs text-slate-400">
                      <div className="flex items-center gap-1.5">
                        <span className="tabular-nums">
                          {media.year > 0 ? media.year : 'TBA'}
                        </span>
                        <span aria-hidden="true" className="text-slate-600">·</span>
                        <span>{media.type === 'movie' ? 'Movie' : 'TV'}</span>
                      </div>
                      <span className="font-mono text-amber-400 tabular-nums">
                        ★ {media.rating.toFixed(1)}
                      </span>
                    </div>

                    <h4
                      onClick={() => onSelectMedia(media)}
                      className={`text-sm font-semibold tracking-tight line-clamp-1 group-hover:text-amber-400 transition-colors cursor-pointer mt-0.5 ${
                        isCompleted ? 'text-slate-200' : 'text-white'
                      }`}
                    >
                      {media.title}
                    </h4>

                    {/* TV Episode Progress Pill / Action */}
                    {media.type === 'tv' && (
                      <div className="mt-1.5 flex items-center justify-between text-[11px] text-slate-400">
                        <span className="font-mono tabular-nums flex items-center gap-1">
                          <Tv className="w-3 h-3 text-amber-400" />
                          <span>
                            {watchedEps}/{totalEps || '?'} eps
                          </span>
                        </span>
                        <button
                          type="button"
                          onClick={() => onSelectMedia(media)}
                          className="text-amber-400 hover:text-amber-300 font-medium"
                        >
                          Track Episodes →
                        </button>
                      </div>
                    )}
                  </div>

                  {/* 5-Stage Status Switcher & Remove action */}
                  <div className="mt-3 pt-2.5 border-t border-white/5 flex items-center justify-between gap-1.5">
                    <select
                      value={entry.status}
                      onChange={(e) =>
                        onUpdateStatus(media.id, e.target.value as WatchStatus, media)
                      }
                      aria-label={`Change status for ${media.title}`}
                      className={`flex-1 border text-[11px] font-medium rounded-lg px-2 py-1 focus:outline-none focus:border-amber-400 ${getStatusBadgeClasses(
                        entry.status
                      )}`}
                    >
                      {WATCH_STATUS_ORDER.map((st) => (
                        <option key={st} value={st} className="bg-slate-900 text-white">
                          {WATCH_STATUS_LABELS[st]}
                        </option>
                      ))}
                    </select>

                    <button
                      type="button"
                      onClick={() => onRemoveFromWatchlist(media.id)}
                      aria-label={`Remove ${media.title} from checklist`}
                      className="p-1.5 text-slate-500 hover:text-red-400 rounded-lg hover:bg-white/5 transition-colors shrink-0"
                      title="Remove from Checklist"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        /* Detailed Checklist Table View */
        <div className="overflow-x-auto rounded-xl border border-white/5 bg-slate-900/50">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="border-b border-white/10 bg-black/40 text-slate-400 uppercase tracking-wider font-semibold">
                <th className="py-3 px-4 w-10">Done</th>
                <th className="py-3 px-4">Title</th>
                <th className="py-3 px-4">Type & Progress</th>
                <th className="py-3 px-4">TMDB</th>
                <th className="py-3 px-4">Watch Status</th>
                <th className="py-3 px-4">My Rating</th>
                <th className="py-3 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {filteredAndSorted.map(({ entry, media }) => {
                const isCompleted = entry.status === 'completed';
                const watchedEps = watchedEpCountByMedia.get(media.id) || 0;
                const totalEps =
                  media.totalEpisodes || (media.seasons ? media.seasons * 8 : 0);

                return (
                  <tr key={media.id} className="hover:bg-white/5 transition-colors">
                    <td className="py-3 px-4">
                      <button
                        type="button"
                        onClick={() =>
                          onUpdateStatus(
                            media.id,
                            isCompleted ? 'plan_to_watch' : 'completed',
                            media
                          )
                        }
                        aria-label={
                          isCompleted ? 'Unmark Completed' : 'Mark Completed'
                        }
                        className={`p-1 rounded transition-colors ${
                          isCompleted
                            ? 'text-emerald-400 hover:text-emerald-300'
                            : 'text-slate-500 hover:text-white'
                        }`}
                      >
                        {isCompleted ? (
                          <CheckSquare className="w-4 h-4" />
                        ) : (
                          <Square className="w-4 h-4" />
                        )}
                      </button>
                    </td>

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
                          <div className="text-[11px] text-slate-400 tabular-nums">
                            {media.year > 0 ? media.year : 'TBA'} ·{' '}
                            {media.type === 'movie' ? 'Movie' : 'TV Series'} · Added{' '}
                            {entry.addedAt}
                          </div>
                        </div>
                      </div>
                    </td>

                    <td className="py-3 px-4 text-slate-300 font-mono tabular-nums">
                      {media.type === 'movie' ? (
                        <span>{media.runtime || 'Feature Film'}</span>
                      ) : (
                        <button
                          type="button"
                          onClick={() => onSelectMedia(media)}
                          className="text-left hover:text-amber-400 transition-colors"
                        >
                          <div>
                            {watchedEps} / {totalEps || '?'} eps watched
                          </div>
                          <div className="text-[10px] text-amber-400">
                            Click to track episodes
                          </div>
                        </button>
                      )}
                    </td>

                    <td className="py-3 px-4 font-mono font-medium text-amber-400 tabular-nums">
                      ★ {media.rating.toFixed(1)}
                    </td>

                    <td className="py-3 px-4">
                      <select
                        value={entry.status}
                        onChange={(e) =>
                          onUpdateStatus(media.id, e.target.value as WatchStatus, media)
                        }
                        className={`border text-xs rounded-lg px-2.5 py-1 focus:outline-none ${getStatusBadgeClasses(
                          entry.status
                        )}`}
                      >
                        {WATCH_STATUS_ORDER.map((st) => (
                          <option key={st} value={st} className="bg-slate-900 text-white">
                            {WATCH_STATUS_LABELS[st]}
                          </option>
                        ))}
                      </select>
                    </td>

                    <td className="py-3 px-4 font-mono text-amber-300 tabular-nums">
                      {entry.personalRating ? `${entry.personalRating} / 10 ★` : '—'}
                    </td>

                    <td className="py-3 px-4 text-right">
                      <div className="flex items-center justify-end gap-1">
                        {onToggleFavourite && (
                          <button
                            type="button"
                            onClick={() => onToggleFavourite(media.id, media)}
                            className={`p-1.5 rounded hover:bg-white/5 transition-colors ${
                              entry.isFavourite
                                ? 'text-rose-400'
                                : 'text-slate-400 hover:text-rose-300'
                            }`}
                            title={
                              entry.isFavourite
                                ? 'Remove from Favourites'
                                : 'Add to Favourites'
                            }
                          >
                            <Heart
                              className={`w-4 h-4 ${entry.isFavourite ? 'fill-current' : ''}`}
                            />
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={() => onRemoveFromWatchlist(media.id)}
                          className="p-1.5 text-slate-400 hover:text-red-400 rounded hover:bg-white/5 transition-colors"
                          title="Remove from Checklist"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};
