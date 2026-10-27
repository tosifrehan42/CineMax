import React, { useState, useEffect, useMemo } from 'react';
import {
  EpisodeInfo,
  MediaItem,
  SeasonSummary,
  WatchedEpisodeEntry,
  WatchStatus,
  WATCH_STATUS_LABELS,
  WATCH_STATUS_ORDER,
} from '../types';
import { MediaPoster } from './MediaPoster';
import {
  fetchOnlinePlaybackSources,
  fetchTitleDetails,
  fetchTvSeasonEpisodes,
} from '../services/mediaApi';
import {
  buildEpisodeYoutubeSearchUrl,
  getAuthorizedEpisodeSource,
  lookupOnlinePlaybackSources,
} from '../data/onlinePlaybackSources';
import {
  X,
  Star,
  Play,
  Bookmark,
  Check,
  Share2,
  Edit3,
  Heart,
  Calendar,
  Tv,
  CheckSquare,
  Square,
  Loader2,
  Trash2,
  HardDrive,
  MonitorPlay,
  ExternalLink,
  AlertCircle,
  RefreshCw,
} from 'lucide-react';

interface DetailModalProps {
  media: MediaItem | null;
  onClose: () => void;
  isInWatchlist: boolean;
  isFavourite?: boolean;
  watchlistStatus?: WatchStatus;
  personalRating?: number;
  personalNotes?: string;
  watchedAtDate?: string;
  watchedEpisodes?: WatchedEpisodeEntry[];
  onToggleWatchlist: (mediaId: string, media?: MediaItem) => void;
  onToggleFavourite?: (mediaId: string, media?: MediaItem) => void;
  onUpdateWatchlistDetails: (
    mediaId: string,
    status: WatchStatus,
    rating?: number,
    notes?: string,
    media?: MediaItem,
    watchedAt?: string
  ) => void;
  onToggleEpisodeWatched?: (
    media: MediaItem,
    seasonNumber: number,
    episodeNumber: number,
    watched: boolean,
    totalKnownEpisodes: number
  ) => void;
  onToggleSeasonWatched?: (
    media: MediaItem,
    seasonNumber: number,
    episodeNumbers: number[],
    watched: boolean,
    totalKnownEpisodes: number
  ) => void;
  onPlayTrailer: (media: MediaItem) => void;
  onPlayOnline?: (
    media: MediaItem,
    seasonNumber?: number,
    episodeNumber?: number
  ) => void;
  allMedia: MediaItem[];
  onSelectSimilar: (media: MediaItem) => void;
  onRemoveFromWatchlist?: (mediaId: string) => void;
  onRegisterMedia?: (items: MediaItem[]) => void;
  onOpenEstimator?: (media: MediaItem, seasonNumber?: number) => void;
}

export const DetailModal: React.FC<DetailModalProps> = ({
  media,
  onClose,
  isInWatchlist,
  isFavourite = false,
  watchlistStatus = 'plan_to_watch',
  personalRating = 0,
  personalNotes = '',
  watchedAtDate,
  watchedEpisodes = [],
  onToggleWatchlist,
  onToggleFavourite,
  onUpdateWatchlistDetails,
  onToggleEpisodeWatched,
  onToggleSeasonWatched,
  onPlayTrailer,
  onPlayOnline,
  allMedia,
  onSelectSimilar,
  onRegisterMedia,
  onOpenEstimator,
}) => {
  const [enrichedMedia, setEnrichedMedia] = useState<MediaItem | null>(media);
  const [apiSimilar, setApiSimilar] = useState<MediaItem[]>([]);
  const [currentStatus, setCurrentStatus] = useState<WatchStatus>(watchlistStatus);
  const [currentRating, setCurrentRating] = useState<number>(personalRating);
  const [notes, setNotes] = useState<string>(personalNotes);
  const [watchedDate, setWatchedDate] = useState<string>(
    watchedAtDate
      ? watchedAtDate.split('T')[0]
      : new Date().toISOString().split('T')[0]
  );
  const [isEditingNotes, setIsEditingNotes] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);

  // TV Season & Episode state
  const [selectedSeason, setSelectedSeason] = useState<number>(1);
  const [seasonEpisodes, setSeasonEpisodes] = useState<EpisodeInfo[]>([]);
  const [isLoadingEpisodes, setIsLoadingEpisodes] = useState<boolean>(false);
  const [episodeError, setEpisodeError] = useState<string | null>(null);
  const [episodeRetryTick, setEpisodeRetryTick] = useState<number>(0);
  const [isLoadingDetails, setIsLoadingDetails] = useState<boolean>(false);
  const [onlineSourceTick, setOnlineSourceTick] = useState<number>(0);

  useEffect(() => {
    setEnrichedMedia(media);
    setApiSimilar([]);
    setCurrentStatus(watchlistStatus);
    setCurrentRating(personalRating || 0);
    setNotes(personalNotes || '');
    setSelectedSeason(1);
    setSeasonEpisodes([]);
    setEpisodeError(null);
    setWatchedDate(
      watchedAtDate
        ? watchedAtDate.split('T')[0]
        : new Date().toISOString().split('T')[0]
    );

    if (!media) return;
    let active = true;
    setIsLoadingDetails(true);
    fetchTitleDetails(media)
      .then((res) => {
        if (!active) return;
        if (res.item) {
          setEnrichedMedia(res.item);
          onRegisterMedia?.([res.item]);
          if (
            res.item.type === 'tv' &&
            Array.isArray(res.item.seasonsList) &&
            res.item.seasonsList.length > 0
          ) {
            const firstSeasonNum = res.item.seasonsList[0].seasonNumber || 1;
            setSelectedSeason(firstSeasonNum);
          }
        }
        if (Array.isArray(res.similar) && res.similar.length > 0) {
          setApiSimilar(res.similar);
          onRegisterMedia?.(res.similar);
        }
      })
      .catch(() => {
        // Keep base media item
      })
      .finally(() => {
        if (active) setIsLoadingDetails(false);
      });

    fetchOnlinePlaybackSources(media)
      .then(() => {
        if (active) setOnlineSourceTick((t) => t + 1);
      })
      .catch(() => {
        // Ignore optional server-side discovery error
      });

    return () => {
      active = false;
    };
  }, [media, onRegisterMedia]);

  // Keep status/rating/notes synced when updated externally (e.g., via episode auto-status)
  useEffect(() => {
    setCurrentStatus(watchlistStatus);
  }, [watchlistStatus]);

  useEffect(() => {
    setCurrentRating(personalRating || 0);
  }, [personalRating]);

  useEffect(() => {
    setNotes(personalNotes || '');
  }, [personalNotes]);

  const activeMedia = enrichedMedia || media;

  const onlinePlayback = useMemo(
    () => (activeMedia ? lookupOnlinePlaybackSources(activeMedia) : null),
    [activeMedia, onlineSourceTick]
  );

  // Compute seasons list for TV shows from verified metadata (never fabricate 8-episode seasons)
  const seasonsList: SeasonSummary[] = useMemo(() => {
    if (!activeMedia || activeMedia.type !== 'tv') return [];
    if (activeMedia.seasonsList && activeMedia.seasonsList.length > 0) {
      return activeMedia.seasonsList;
    }
    const count = Math.max(1, activeMedia.seasons || 1);
    return Array.from({ length: count }, (_, idx) => ({
      seasonNumber: idx + 1,
      name: `Season ${idx + 1}`,
      episodeCount: 0,
    }));
  }, [activeMedia]);

  const totalKnownEpisodes = useMemo(() => {
    if (!activeMedia || activeMedia.type !== 'tv') return 0;
    if (activeMedia.totalEpisodes && activeMedia.totalEpisodes > 0) {
      return activeMedia.totalEpisodes;
    }
    const fromSeasons = seasonsList.reduce((acc, s) => acc + (s.episodeCount || 0), 0);
    if (fromSeasons > 0) return fromSeasons;
    return seasonEpisodes.length;
  }, [activeMedia, seasonsList, seasonEpisodes.length]);

  // Load real episodes when TV show, selectedSeason, or retry tick changes
  useEffect(() => {
    if (!activeMedia || activeMedia.type !== 'tv') {
      setSeasonEpisodes([]);
      setEpisodeError(null);
      return;
    }
    const controller = new AbortController();
    setIsLoadingEpisodes(true);
    setEpisodeError(null);
    fetchTvSeasonEpisodes(activeMedia.id, selectedSeason, controller.signal)
      .then((res) => {
        if (!controller.signal.aborted) {
          setSeasonEpisodes(Array.isArray(res.episodes) ? res.episodes : []);
          setEpisodeError(null);
        }
      })
      .catch((err: any) => {
        if (!controller.signal.aborted) {
          setSeasonEpisodes([]);
          setEpisodeError(
            err?.message ||
              `Unable to retrieve verified episode metadata for Season ${selectedSeason}.`
          );
        }
      })
      .finally(() => {
        if (!controller.signal.aborted) {
          setIsLoadingEpisodes(false);
        }
      });

    return () => controller.abort();
  }, [activeMedia?.id, activeMedia?.type, selectedSeason, episodeRetryTick]);

  // Handle ESC key to close when modal is open
  useEffect(() => {
    if (!media) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [media, onClose]);

  if (!activeMedia) return null;

  const mediaWatchedEpisodes = watchedEpisodes.filter(
    (ep) => ep.mediaId === activeMedia.id
  );
  const watchedSet = new Set(
    mediaWatchedEpisodes.map((ep) => `${ep.seasonNumber}:${ep.episodeNumber}`)
  );
  const totalWatchedCount = mediaWatchedEpisodes.length;
  const effectiveTotalEpisodes = Math.max(totalKnownEpisodes, totalWatchedCount);
  const overallProgressPct =
    effectiveTotalEpisodes > 0
      ? Math.min(100, Math.round((totalWatchedCount / effectiveTotalEpisodes) * 100))
      : 0;

  const currentSeasonWatchedCount = mediaWatchedEpisodes.filter(
    (ep) => ep.seasonNumber === selectedSeason
  ).length;
  const selectedSeasonKnownCount =
    seasonsList.find((s) => s.seasonNumber === selectedSeason)?.episodeCount || 0;
  const currentSeasonEpisodeNumbers =
    seasonEpisodes.length > 0
      ? seasonEpisodes.map((ep) => ep.episodeNumber)
      : selectedSeasonKnownCount > 0
      ? Array.from({ length: selectedSeasonKnownCount }, (_, i) => i + 1)
      : [];
  const isEntireSeasonWatched =
    currentSeasonEpisodeNumbers.length > 0 &&
    currentSeasonEpisodeNumbers.every((epNum) =>
      watchedSet.has(`${selectedSeason}:${epNum}`)
    );

  // Find similar titles from API or shared genres/moods
  const similarItems =
    apiSimilar.length > 0
      ? apiSimilar
      : allMedia
          .filter(
            (item) =>
              item.id !== activeMedia.id &&
              (item.genres.some((g) => activeMedia.genres.includes(g)) ||
                item.moods.some((m) => activeMedia.moods.includes(m)))
          )
          .slice(0, 4);

  const handleStatusChange = (status: WatchStatus) => {
    setCurrentStatus(status);
    onUpdateWatchlistDetails(
      activeMedia.id,
      status,
      currentRating,
      notes,
      activeMedia,
      status === 'completed' ? watchedDate : undefined
    );
  };

  const handleRatingClick = (starValue: number) => {
    const newRating = currentRating === starValue ? 0 : starValue;
    setCurrentRating(newRating);
    onUpdateWatchlistDetails(
      activeMedia.id,
      currentStatus,
      newRating,
      notes,
      activeMedia,
      currentStatus === 'completed' ? watchedDate : undefined
    );
  };

  const handleWatchedDateChange = (newDate: string) => {
    setWatchedDate(newDate);
    if (currentStatus === 'completed') {
      onUpdateWatchlistDetails(
        activeMedia.id,
        'completed',
        currentRating,
        notes,
        activeMedia,
        newDate
      );
    }
  };

  const handleSaveNotes = () => {
    setIsEditingNotes(false);
    onUpdateWatchlistDetails(
      activeMedia.id,
      currentStatus,
      currentRating,
      notes,
      activeMedia,
      currentStatus === 'completed' ? watchedDate : undefined
    );
  };

  const handleShare = () => {
    navigator.clipboard?.writeText(window.location.href);
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2000);
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto cm-glass-backdrop flex items-center justify-center p-3 sm:p-6 animate-in fade-in duration-200">
      {/* Background click dismiss */}
      <div className="fixed inset-0" onClick={onClose} />

      <div className="relative z-10 w-full max-w-4xl cm-glass-panel rounded-2xl overflow-hidden my-auto max-h-[92vh] flex flex-col">
        {/* Top Backdrop Header */}
        <div className="relative w-full h-48 sm:h-64 shrink-0 overflow-hidden">
          <MediaPoster
            media={activeMedia}
            aspect="backdrop"
            className="w-full h-full"
          />

          {/* Close button */}
          <button
            onClick={onClose}
            aria-label="Close modal"
            className="absolute top-4 right-4 z-20 p-2.5 rounded-full cm-glass-control text-white/85 hover:text-white"
          >
            <X className="w-5 h-5" />
          </button>

          {/* Share button */}
          <button
            onClick={handleShare}
            aria-label="Share title"
            className="absolute top-4 right-16 z-20 p-2.5 rounded-full cm-glass-control text-white/85 hover:text-white"
            title="Copy link"
          >
            <Share2 className="w-5 h-5" />
          </button>
          {copiedLink && (
            <div className="absolute top-4 right-28 z-20 px-3 py-1 bg-amber-500 text-black text-xs font-semibold rounded-md shadow-lg animate-in fade-in">
              Link copied!
            </div>
          )}

          {/* Backdrop Floating Overlay Title Info */}
          <div className="absolute bottom-4 left-6 sm:left-8 right-6 z-10 flex items-end justify-between">
            <div>
              <div className="flex items-center gap-2 text-xs text-amber-300 font-medium mb-1">
                <span className="uppercase tracking-wider">
                  {activeMedia.type === 'movie' ? 'Feature Film' : 'Television Series'}
                </span>
                <span aria-hidden="true">·</span>
                <span>{activeMedia.year}</span>
                <span aria-hidden="true">·</span>
                <span>{activeMedia.contentRating}</span>
              </div>
              <h2 className="font-['Outfit'] text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
                {activeMedia.title}
              </h2>
            </div>
          </div>
        </div>

        {/* Scrollable Content Body */}
        <div className="overflow-y-auto px-6 sm:px-8 py-6 space-y-8">
          {/* Main Two-Column Layout */}
          <div className="grid grid-cols-1 md:grid-cols-12 gap-8">
            {/* Left Column: Poster + Quick Actions */}
            <div className="md:col-span-4 flex flex-col items-center md:items-start">
              <div className="w-48 sm:w-56 -mt-16 md:-mt-20 relative z-20 rounded-xl overflow-hidden shadow-2xl border-2 border-white/10">
                <MediaPoster media={activeMedia} aspect="poster" />
              </div>

              {/* Action Buttons */}
              <div className="w-full mt-4 space-y-2.5">
                {onlinePlayback?.available && onPlayOnline ? (
                  <button
                    type="button"
                    onClick={() => {
                      if (activeMedia.type === 'tv') {
                        const seasonEp =
                          onlinePlayback.sources.find(
                            (s) => s.seasonNumber === selectedSeason
                          ) || onlinePlayback.defaultSource;
                        onPlayOnline(
                          activeMedia,
                          seasonEp?.seasonNumber,
                          seasonEp?.episodeNumber
                        );
                      } else {
                        onPlayOnline(activeMedia);
                      }
                    }}
                    className="w-full flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 border border-emerald-500/40 font-semibold text-sm shadow-md shadow-emerald-950/30 transition-all hover:scale-[1.01]"
                  >
                    <MonitorPlay className="w-4 h-4 text-emerald-400 shrink-0" />
                    <span>
                      {activeMedia.type === 'tv'
                        ? `Play Online (${onlinePlayback.sources.length} Verified ${
                            onlinePlayback.sources.length === 1 ? 'Episode' : 'Episodes'
                          })`
                        : 'Play Online (Full Movie)'}
                    </span>
                  </button>
                ) : null}

                <button
                  onClick={() => onPlayTrailer(activeMedia)}
                  className="w-full flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl bg-gradient-to-r from-amber-400 to-amber-500 hover:from-amber-300 hover:to-amber-400 text-slate-950 font-semibold text-sm shadow-md shadow-amber-500/20 transition-all hover:scale-[1.01]"
                >
                  <Play className="w-4 h-4 fill-slate-950" />
                  <span>Play Teaser Preview</span>
                </button>

                <div className="flex gap-2">
                  <button
                    onClick={() => onToggleWatchlist(activeMedia.id, activeMedia)}
                    className={`flex-1 flex items-center justify-center gap-2 py-2.5 px-3 rounded-xl font-semibold text-xs sm:text-sm transition-all whitespace-nowrap ${
                      isInWatchlist
                        ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40 hover:bg-amber-500/30'
                        : 'cm-glass-control text-white'
                    }`}
                  >
                    {isInWatchlist ? (
                      <>
                        <Check className="w-4 h-4 stroke-[2.5]" />
                        <span>In Checklist ({WATCH_STATUS_LABELS[currentStatus]})</span>
                      </>
                    ) : (
                      <>
                        <Bookmark className="w-4 h-4" />
                        <span>Add to Checklist</span>
                      </>
                    )}
                  </button>

                  {onToggleFavourite && (
                    <button
                      onClick={() => onToggleFavourite(activeMedia.id, activeMedia)}
                      aria-label={isFavourite ? 'Remove from favourites' : 'Add to favourites'}
                      title={isFavourite ? 'In Favourites' : 'Mark as Favourite'}
                      className={`px-3.5 py-2.5 rounded-xl transition-all flex items-center justify-center ${
                        isFavourite
                          ? 'bg-rose-500/20 text-rose-400 border border-rose-500/40 hover:bg-rose-500/30'
                          : 'cm-glass-control text-slate-300 hover:text-white'
                      }`}
                    >
                      <Heart
                        className={`w-4 h-4 ${isFavourite ? 'fill-rose-400 text-rose-400' : ''}`}
                      />
                    </button>
                  )}
                </div>

                {onOpenEstimator && (
                  <button
                    type="button"
                    onClick={() =>
                      onOpenEstimator(
                        activeMedia,
                        activeMedia.type === 'tv' ? selectedSeason : undefined
                      )
                    }
                    className="w-full flex items-center justify-center gap-2 py-2.5 px-3 rounded-xl cm-glass-control text-slate-200 hover:text-amber-300 font-semibold text-xs sm:text-sm"
                  >
                    <HardDrive className="w-4 h-4 text-amber-400" />
                    <span>Estimate Quality &amp; File Size</span>
                  </button>
                )}

                {!onlinePlayback?.available && (
                  <div className="pt-1 space-y-1.5 text-center">
                    <p className="text-[11px] text-slate-500">
                      No authorized online playback source available.
                    </p>
                    {onlinePlayback?.officialChannelGuide && (
                      <a
                        href={onlinePlayback.officialChannelGuide.searchUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center justify-center gap-1.5 text-[11px] text-amber-400 hover:text-amber-300 font-medium underline underline-offset-2 transition-colors"
                        title={onlinePlayback.officialChannelGuide.note}
                      >
                        <span>
                          Check {onlinePlayback.officialChannelGuide.channelName} on YouTube
                        </span>
                        <ExternalLink className="w-3 h-3 shrink-0" />
                      </a>
                    )}
                  </div>
                )}
              </div>

              {/* Streaming Platforms / Where to Watch in India (IN) */}
              <div className="w-full mt-6 pt-5 border-t border-white/5 space-y-2.5">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs uppercase tracking-wider text-slate-400 font-semibold">
                    Where to Watch in India (IN)
                  </span>
                  {activeMedia.watchProviders?.tmdbWatchUrl && (
                    <a
                      href={activeMedia.watchProviders.tmdbWatchUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 text-[11px] text-amber-400 hover:text-amber-300 font-medium transition-colors"
                      title="Open official TMDB / JustWatch India availability page"
                    >
                      <span>All India Options</span>
                      <ExternalLink className="w-3 h-3" />
                    </a>
                  )}
                </div>

                {isLoadingDetails && !activeMedia.watchProviders ? (
                  <div className="flex items-center gap-2 py-2 text-xs text-slate-400">
                    <Loader2 className="w-3.5 h-3.5 text-amber-400 animate-spin shrink-0" />
                    <span>Checking official India (IN) OTT availability...</span>
                  </div>
                ) : activeMedia.watchProviders?.status === 'available' &&
                  activeMedia.watchProviders.offers.length > 0 ? (
                  <div className="space-y-2">
                    <div className="grid grid-cols-1 gap-1.5">
                      {activeMedia.watchProviders.offers.map((offer) => (
                        <a
                          key={`${offer.providerId}-${offer.category}`}
                          href={offer.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="group flex items-center justify-between gap-2.5 p-2 rounded-xl cm-glass-control hover:border-amber-400/40 transition-all"
                          title={`Watch ${activeMedia.title} on ${offer.providerName} (${offer.categoryLabel}) in India`}
                        >
                          <div className="flex items-center gap-2.5 min-w-0">
                            {offer.logoUrl ? (
                              <img
                                src={offer.logoUrl}
                                alt={offer.providerName}
                                className="w-7 h-7 rounded-lg object-cover shrink-0 border border-white/10"
                                loading="lazy"
                              />
                            ) : (
                              <div className="w-7 h-7 rounded-lg bg-slate-800 border border-white/10 flex items-center justify-center text-[11px] font-bold text-amber-400 shrink-0">
                                {offer.providerName.slice(0, 2).toUpperCase()}
                              </div>
                            )}
                            <div className="min-w-0">
                              <div className="text-xs font-semibold text-white group-hover:text-amber-300 truncate transition-colors">
                                {offer.providerName}
                              </div>
                              <div className="text-[10px] text-slate-400 font-medium">
                                {offer.categoryLabel} · India
                              </div>
                            </div>
                          </div>
                          <ExternalLink className="w-3.5 h-3.5 text-slate-400 group-hover:text-amber-300 shrink-0 transition-colors" />
                        </a>
                      ))}
                    </div>
                    <p className="text-[10px] text-slate-500 leading-snug pt-0.5">
                      {activeMedia.watchProviders.attributionText}
                    </p>
                  </div>
                ) : activeMedia.watchProviders?.status === 'none_in_region' ? (
                  <div className="p-3 rounded-xl bg-white/[0.03] border border-white/5 space-y-1.5">
                    <p className="text-xs text-slate-300">
                      No official OTT subscription, free, rental, or purchase providers are currently listed for India (IN).
                    </p>
                    {activeMedia.watchProviders.tmdbWatchUrl && (
                      <a
                        href={activeMedia.watchProviders.tmdbWatchUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 text-[11px] text-amber-400 hover:text-amber-300 font-medium"
                      >
                        <span>Verify regional availability on TMDB</span>
                        <ExternalLink className="w-3 h-3" />
                      </a>
                    )}
                    <p className="text-[10px] text-slate-500">
                      {activeMedia.watchProviders.attributionText}
                    </p>
                  </div>
                ) : (
                  <div className="p-3 rounded-xl bg-white/[0.03] border border-white/5 space-y-1">
                    <p className="text-xs text-slate-400">
                      Verified clickable India (IN) OTT provider links require an active TMDB API connection.
                    </p>
                    <p className="text-[10px] text-slate-500">
                      Streaming availability data powered by JustWatch via TMDB.
                    </p>
                  </div>
                )}
              </div>
            </div>

            {/* Right Column: Detailed Story, Credits & Personal Tracker */}
            <div className="md:col-span-8 space-y-6">
              {/* Unboxed Metadata Strip */}
              <div className="flex flex-wrap items-center gap-3 text-xs text-slate-400 pb-4 border-b border-white/5">
                <div className="flex items-center gap-1 text-amber-400 font-mono">
                  <Star className="w-4 h-4 fill-amber-400 text-amber-400" />
                  <span className="font-bold text-sm text-white tabular-nums">
                    {activeMedia.rating.toFixed(1)}
                  </span>
                  <span className="text-slate-400 text-xs">
                    / 10 ({activeMedia.voteCount} reviews)
                  </span>
                </div>
                <span aria-hidden="true" className="text-slate-600">·</span>
                <span>
                  {activeMedia.type === 'movie'
                    ? activeMedia.runtime || '2h 10m'
                    : `${seasonsList.length || activeMedia.seasons || 1} ${
                        (seasonsList.length || activeMedia.seasons || 1) === 1
                          ? 'Season'
                          : 'Seasons'
                      }${effectiveTotalEpisodes > 0 ? ` · ${effectiveTotalEpisodes} Episodes` : ''}`}
                </span>
                <span aria-hidden="true" className="text-slate-600">·</span>
                <span>{activeMedia.genres.join(' / ')}</span>
                <span aria-hidden="true" className="text-slate-600">·</span>
                <span className="font-mono text-slate-300">4K UHD · Dolby Atmos</span>
              </div>

              {/* Tagline */}
              {activeMedia.tagline && (
                <p className="text-base font-medium text-amber-200/90 italic">
                  "{activeMedia.tagline}"
                </p>
              )}

              {/* Synopsis */}
              <div>
                <h4 className="text-xs uppercase tracking-wider text-slate-400 font-semibold mb-2">
                  Overview
                </h4>
                <p className="text-sm text-slate-300 leading-relaxed">
                  {activeMedia.synopsis}
                </p>
              </div>

              {/* Key Creators & Cast */}
              <div className="space-y-3 pt-2">
                <div className="flex items-baseline gap-2 text-xs">
                  <span className="text-slate-400 font-semibold uppercase tracking-wider shrink-0 w-20">
                    Directed by
                  </span>
                  <span className="text-white font-medium">{activeMedia.director}</span>
                </div>

                {activeMedia.cast.length > 0 && (
                  <div className="flex items-start gap-2 text-xs">
                    <span className="text-slate-400 font-semibold uppercase tracking-wider shrink-0 w-20 pt-0.5">
                      Starring
                    </span>
                    <div className="flex flex-wrap gap-x-3 gap-y-1 text-slate-300">
                      {activeMedia.cast.map((actor, idx) => (
                        <span key={`${actor.name}-${idx}`}>
                          <strong className="text-white font-medium">{actor.name}</strong>
                          <span className="text-slate-500"> as {actor.role}</span>
                          {idx < activeMedia.cast.length - 1 && (
                            <span className="text-slate-600 ml-2">·</span>
                          )}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                <div className="flex items-baseline gap-2 text-xs">
                  <span className="text-slate-400 font-semibold uppercase tracking-wider shrink-0 w-20">
                    Mood / Tone
                  </span>
                  <div className="flex flex-wrap gap-1.5 text-xs text-amber-300/80">
                    {activeMedia.moods.map((m, i) => (
                      <span key={m}>
                        {m.replace(/-/g, ' ')}
                        {i < activeMedia.moods.length - 1 && (
                          <span className="text-slate-600 ml-1.5">·</span>
                        )}
                      </span>
                    ))}
                  </div>
                </div>
              </div>

              {/* Personal Cinephile Checklist, Watch Status & Journal */}
              <div className="mt-6 p-4 rounded-xl cm-glass-surface space-y-3.5">
                <div className="flex items-center justify-between gap-2">
                  <h4 className="text-xs uppercase tracking-wider text-slate-300 font-semibold flex items-center gap-1.5">
                    <Edit3 className="w-3.5 h-3.5 text-amber-400" />
                    <span>My Checklist Status, Rating & Watch Log</span>
                  </h4>
                  {isInWatchlist ? (
                    <div className="flex items-center gap-2">
                      <span className="text-[11px] text-amber-400/90 font-medium">
                        {WATCH_STATUS_LABELS[currentStatus]}
                      </span>
                      <button
                        type="button"
                        onClick={() => onToggleWatchlist(activeMedia.id, activeMedia)}
                        className="text-[11px] text-slate-400 hover:text-red-300 flex items-center gap-1 transition-colors"
                        title="Remove from Checklist"
                      >
                        <Trash2 className="w-3 h-3" />
                        <span>Remove</span>
                      </button>
                    </div>
                  ) : (
                    <span className="text-[11px] text-slate-500">
                      Select any status to add to your checklist
                    </span>
                  )}
                </div>

                {/* 5-Stage Status Selector */}
                <div className="grid grid-cols-2 sm:grid-cols-5 gap-1.5 p-1 cm-glass-segmented rounded-lg">
                  {WATCH_STATUS_ORDER.map((st) => {
                    const isActive = isInWatchlist && currentStatus === st;
                    let activeStyle = 'bg-white/15 text-white border border-white/20 shadow-sm';
                    if (st === 'completed') {
                      activeStyle =
                        'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 font-semibold';
                    } else if (st === 'watching') {
                      activeStyle =
                        'bg-sky-500/20 text-sky-300 border border-sky-500/40 font-semibold';
                    } else if (st === 'on_hold') {
                      activeStyle =
                        'bg-amber-500/20 text-amber-300 border border-amber-500/40 font-semibold';
                    } else if (st === 'dropped') {
                      activeStyle =
                        'bg-rose-500/20 text-rose-300 border border-rose-500/40 font-semibold';
                    } else if (st === 'plan_to_watch') {
                      activeStyle =
                        'bg-amber-500 text-slate-950 font-bold shadow-sm';
                    }

                    return (
                      <button
                        key={st}
                        type="button"
                        onClick={() => handleStatusChange(st)}
                        className={`py-1.5 px-2 text-xs font-medium rounded-md transition-all whitespace-nowrap ${
                          isActive
                            ? activeStyle
                            : 'text-slate-400 hover:text-white hover:bg-white/5'
                        }`}
                      >
                        {WATCH_STATUS_LABELS[st]}
                      </button>
                    );
                  })}
                </div>

                {/* Watched Date Selector (when Completed) */}
                {isInWatchlist && currentStatus === 'completed' && (
                  <div className="flex items-center justify-between pt-1 text-xs">
                    <span className="text-slate-400 flex items-center gap-1.5">
                      <Calendar className="w-3.5 h-3.5 text-amber-400" />
                      <span>Date Watched:</span>
                    </span>
                    <input
                      type="date"
                      value={watchedDate}
                      max={new Date().toISOString().split('T')[0]}
                      onChange={(e) => handleWatchedDateChange(e.target.value)}
                      className="bg-black/50 border border-white/10 rounded-lg px-2.5 py-1 text-xs font-mono text-white focus:outline-none focus:border-amber-400 tabular-nums"
                    />
                  </div>
                )}

                {/* Personal 10-Star Rating */}
                <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
                  <span className="text-xs text-slate-400">My Rating:</span>
                  <div className="flex items-center gap-1">
                    {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((star) => (
                      <button
                        key={star}
                        type="button"
                        onClick={() => handleRatingClick(star)}
                        className="p-0.5 hover:scale-125 transition-transform"
                        title={`Rate ${star}/10`}
                      >
                        <Star
                          className={`w-3.5 h-3.5 ${
                            star <= currentRating
                              ? 'fill-amber-400 text-amber-400'
                              : 'text-slate-600 hover:text-slate-400'
                          }`}
                        />
                      </button>
                    ))}
                    <span className="text-xs font-mono font-semibold text-amber-300 ml-1.5 tabular-nums">
                      {currentRating > 0 ? `${currentRating}/10` : '—'}
                    </span>
                  </div>
                </div>

                {/* Personal Notes / Cinephile Reflections */}
                <div className="pt-1">
                  {isEditingNotes ? (
                    <div className="space-y-2">
                      <textarea
                        value={notes}
                        onChange={(e) => setNotes(e.target.value)}
                        placeholder="Add personal reflections, favorite scenes, or viewing context..."
                        className="w-full h-20 p-2.5 text-xs bg-black/40 border border-white/10 rounded-lg text-slate-200 placeholder:text-slate-500 focus:outline-none focus:border-amber-400 resize-none"
                      />
                      <div className="flex justify-end gap-2">
                        <button
                          type="button"
                          onClick={() => setIsEditingNotes(false)}
                          className="px-3 py-1 text-xs text-slate-400 hover:text-white"
                        >
                          Cancel
                        </button>
                        <button
                          type="button"
                          onClick={handleSaveNotes}
                          className="px-3 py-1 text-xs font-semibold bg-amber-500 text-black rounded hover:bg-amber-400"
                        >
                          Save Reflection
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div
                      onClick={() => setIsEditingNotes(true)}
                      className="p-2.5 rounded-lg bg-black/30 border border-white/5 text-xs cursor-pointer hover:border-white/15 transition-colors"
                    >
                      {notes ? (
                        <p className="text-slate-300 italic">"{notes}"</p>
                      ) : (
                        <p className="text-slate-500 flex items-center justify-between">
                          <span>Click to add a private note or review...</span>
                          <span className="text-amber-400/80">+ Add</span>
                        </p>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* TV Series Episode Progress & Checklist Section */}
          {activeMedia.type === 'tv' && (
            <div className="pt-6 border-t border-white/5 space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <h3 className="font-['Outfit'] text-base font-bold text-white tracking-tight flex items-center gap-2">
                    <Tv className="w-4 h-4 text-amber-400" />
                    <span>Series Episode Progress & Checklist</span>
                  </h3>
                  <p className="text-xs text-slate-400 mt-0.5">
                    Track watched episodes by season. Watching an episode sets status to Watching; completing all episodes marks the series Completed.
                  </p>
                </div>

                <div className="cm-glass-surface flex items-center gap-3 shrink-0 px-3.5 py-2 rounded-xl">
                  <div className="text-right">
                    <div className="text-xs font-mono font-bold text-white tabular-nums">
                      {totalWatchedCount} / {effectiveTotalEpisodes || '?'} Episodes Watched
                    </div>
                    <div className="text-[11px] font-mono text-amber-400 tabular-nums">
                      {overallProgressPct}% Series Complete
                    </div>
                  </div>
                </div>
              </div>

              {/* Overall Series Progress Bar */}
              <div className="w-full h-2 bg-slate-900 rounded-full overflow-hidden border border-white/5">
                <div
                  className="h-full bg-gradient-to-r from-amber-500 to-emerald-400 transition-all duration-300"
                  style={{ width: `${overallProgressPct}%` }}
                />
              </div>

              {/* Season Selector Tabs + Batch Season Toggle */}
              <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
                <div className="flex items-center gap-1.5 overflow-x-auto pb-1 max-w-full">
                  {seasonsList.map((s) => {
                    const sWatched = mediaWatchedEpisodes.filter(
                      (ep) => ep.seasonNumber === s.seasonNumber
                    ).length;
                    const isSelected = selectedSeason === s.seasonNumber;
                    const displayTotalForTab =
                      isSelected && seasonEpisodes.length > 0
                        ? seasonEpisodes.length
                        : s.episodeCount;
                    return (
                      <button
                        key={s.seasonNumber}
                        type="button"
                        onClick={() => setSelectedSeason(s.seasonNumber)}
                        className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors whitespace-nowrap flex items-center gap-1.5 ${
                          isSelected
                            ? 'bg-amber-500 text-slate-950 font-bold'
                            : 'cm-glass-control text-slate-300 hover:text-white'
                        }`}
                      >
                        <span>Season {s.seasonNumber}</span>
                        {displayTotalForTab > 0 && (
                          <span
                            className={`font-mono text-[11px] tabular-nums ${
                              isSelected ? 'text-slate-900' : 'text-slate-400'
                            }`}
                          >
                            ({sWatched}/{displayTotalForTab})
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>

                {onToggleSeasonWatched && currentSeasonEpisodeNumbers.length > 0 && (
                  <button
                    type="button"
                    onClick={() =>
                      onToggleSeasonWatched(
                        activeMedia,
                        selectedSeason,
                        currentSeasonEpisodeNumbers,
                        !isEntireSeasonWatched,
                        effectiveTotalEpisodes
                      )
                    }
                    className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors flex items-center gap-1.5 whitespace-nowrap ${
                      isEntireSeasonWatched
                        ? 'bg-emerald-500/15 text-emerald-300 border border-emerald-500/30 hover:bg-emerald-500/25'
                        : 'cm-glass-control text-slate-200 hover:text-white'
                    }`}
                  >
                    {isEntireSeasonWatched ? (
                      <>
                        <CheckSquare className="w-3.5 h-3.5 text-emerald-400" />
                        <span>Season {selectedSeason} Completed (Unmark All)</span>
                      </>
                    ) : (
                      <>
                        <Square className="w-3.5 h-3.5 text-amber-400" />
                        <span>
                          Mark All Season {selectedSeason} Watched ({currentSeasonWatchedCount}/
                          {currentSeasonEpisodeNumbers.length})
                        </span>
                      </>
                    )}
                  </button>
                )}
              </div>

              {/* Episodes Checklist Grid */}
              {isLoadingEpisodes ? (
                <div className="py-10 text-center rounded-xl bg-slate-900/40 border border-white/5 space-y-2">
                  <Loader2 className="w-5 h-5 mx-auto text-amber-400 animate-spin" />
                  <p className="text-xs text-slate-400">
                    Loading verified Season {selectedSeason} episodes...
                  </p>
                </div>
              ) : episodeError ? (
                <div className="p-6 text-center rounded-xl bg-slate-900/50 border border-rose-500/20 space-y-3">
                  <AlertCircle className="w-6 h-6 mx-auto text-rose-400" />
                  <div className="space-y-1 max-w-md mx-auto">
                    <p className="text-xs sm:text-sm font-semibold text-white">
                      Could not load Season {selectedSeason} episode metadata
                    </p>
                    <p className="text-xs text-slate-400">{episodeError}</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setEpisodeRetryTick((t) => t + 1)}
                    className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border border-amber-500/40 text-xs font-semibold transition-colors"
                  >
                    <RefreshCw className="w-3.5 h-3.5" />
                    <span>Retry Loading Season {selectedSeason}</span>
                  </button>
                </div>
              ) : seasonEpisodes.length === 0 ? (
                <div className="p-6 text-center rounded-xl bg-slate-900/40 border border-white/5 space-y-2">
                  <p className="text-xs sm:text-sm font-medium text-slate-300">
                    No verified episodes found for Season {selectedSeason}.
                  </p>
                  <p className="text-xs text-slate-500">
                    Episode listings will appear here once published in the official catalogue.
                  </p>
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 max-h-72 overflow-y-auto pr-1">
                  {seasonEpisodes.map((ep) => {
                    const isWatched = watchedSet.has(
                      `${selectedSeason}:${ep.episodeNumber}`
                    );
                    const verifiedEpisodeSource = getAuthorizedEpisodeSource(
                      activeMedia,
                      selectedSeason,
                      ep.episodeNumber
                    );
                    const displayEpName =
                      verifiedEpisodeSource?.episodeTitle &&
                      (!ep.name || /^Episode \d+$/i.test(ep.name))
                        ? verifiedEpisodeSource.episodeTitle
                        : ep.name;
                    const displayRuntime =
                      verifiedEpisodeSource?.durationMinutes || ep.runtime;
                    const externalEpisodeSearchUrl = buildEpisodeYoutubeSearchUrl(
                      activeMedia.title,
                      selectedSeason,
                      ep.episodeNumber,
                      displayEpName,
                      onlinePlayback?.officialChannelGuide?.channelName
                    );

                    return (
                      <div
                        key={`${selectedSeason}-${ep.episodeNumber}`}
                        role="button"
                        tabIndex={0}
                        onClick={() =>
                          onToggleEpisodeWatched?.(
                            activeMedia,
                            selectedSeason,
                            ep.episodeNumber,
                            !isWatched,
                            effectiveTotalEpisodes
                          )
                        }
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' || e.key === ' ') {
                            e.preventDefault();
                            onToggleEpisodeWatched?.(
                              activeMedia,
                              selectedSeason,
                              ep.episodeNumber,
                              !isWatched,
                              effectiveTotalEpisodes
                            );
                          }
                        }}
                        className={`flex items-center justify-between gap-3 p-2.5 rounded-xl border text-left transition-all cursor-pointer ${
                          isWatched
                            ? 'bg-emerald-500/10 border-emerald-500/30 text-white'
                            : 'bg-slate-900/50 border-white/5 text-slate-300 hover:border-white/15 hover:bg-slate-900'
                        }`}
                      >
                        <div className="flex items-center gap-2.5 min-w-0">
                          <div
                            className={`w-5 h-5 rounded-md flex items-center justify-center shrink-0 border transition-colors ${
                              isWatched
                                ? 'bg-emerald-500 border-emerald-400 text-slate-950'
                                : 'bg-black/40 border-white/20 text-transparent'
                            }`}
                          >
                            <Check className="w-3.5 h-3.5 stroke-[3]" />
                          </div>
                          <div className="min-w-0">
                            <div className="flex items-center gap-1.5 text-xs">
                              <span className="font-mono font-bold text-amber-400 tabular-nums shrink-0">
                                S{String(selectedSeason).padStart(2, '0')}E
                                {String(ep.episodeNumber).padStart(2, '0')}
                              </span>
                              <span
                                className={`font-medium truncate ${
                                  isWatched ? 'line-through text-slate-300' : 'text-white'
                                }`}
                              >
                                {displayEpName}
                              </span>
                            </div>
                            {(ep.airDate || displayRuntime) && (
                              <div className="flex items-center gap-2 text-[11px] text-slate-400 font-mono tabular-nums mt-0.5">
                                {ep.airDate && <span>{ep.airDate}</span>}
                                {ep.airDate && displayRuntime && <span>·</span>}
                                {displayRuntime && <span>{displayRuntime}m</span>}
                              </div>
                            )}
                          </div>
                        </div>

                        <div className="flex items-center gap-1.5 shrink-0">
                          {verifiedEpisodeSource && onPlayOnline ? (
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                onPlayOnline(
                                  activeMedia,
                                  selectedSeason,
                                  ep.episodeNumber
                                );
                              }}
                              className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 border border-emerald-500/40 text-[11px] font-semibold transition-colors"
                              title={`Play S${String(selectedSeason).padStart(
                                2,
                                '0'
                              )}E${String(ep.episodeNumber).padStart(
                                2,
                                '0'
                              )} (${verifiedEpisodeSource.channelName})`}
                            >
                              <Play className="w-3 h-3 fill-current" />
                              <span>Play</span>
                            </button>
                          ) : (
                            <a
                              href={externalEpisodeSearchUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              onClick={(e) => e.stopPropagation()}
                              className="inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-white/5 hover:bg-white/10 text-slate-400 hover:text-amber-300 border border-white/10 text-[10px] font-medium transition-colors"
                              title={`Search official YouTube channels for S${String(
                                selectedSeason
                              ).padStart(2, '0')}E${String(ep.episodeNumber).padStart(
                                2,
                                '0'
                              )}`}
                            >
                              <span>YT</span>
                              <ExternalLink className="w-2.5 h-2.5" />
                            </a>
                          )}

                          <span
                            className={`text-[10px] font-semibold px-2 py-0.5 rounded shrink-0 ${
                              isWatched
                                ? 'text-emerald-300 bg-emerald-500/15'
                                : 'text-slate-500'
                            }`}
                          >
                            {isWatched ? 'Watched' : 'Mark'}
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* Similar Recommendations Section */}
          {similarItems.length > 0 && (
            <div className="pt-6 border-t border-white/5">
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-['Outfit'] text-base font-bold text-white tracking-tight">
                  You Might Also Enjoy
                </h3>
                <span className="text-xs text-slate-500">Based on genres and mood resonance</span>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                {similarItems.map((item) => (
                  <div
                    key={item.id}
                    onClick={() => onSelectSimilar(item)}
                    className="group cursor-pointer rounded-lg overflow-hidden bg-slate-900 border border-white/5 hover:border-amber-400/40 transition-all p-2"
                  >
                    <MediaPoster media={item} aspect="poster" />
                    <div className="mt-2 text-xs">
                      <div className="text-white font-semibold truncate group-hover:text-amber-400 transition-colors">
                        {item.title}
                      </div>
                      <div className="flex items-center justify-between text-[11px] text-slate-400 mt-0.5">
                        <span className="tabular-nums">{item.year}</span>
                        <span className="text-amber-400/90 font-mono tabular-nums">
                          ★ {item.rating.toFixed(1)}
                        </span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
