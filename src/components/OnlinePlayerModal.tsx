import React, { useEffect, useState, useRef, useCallback, useMemo } from 'react';
import {
  AuthorizedOnlineSource,
  MediaItem,
  WatchedEpisodeEntry,
} from '../types';
import {
  buildAuthorizedYouTubeEmbedUrl,
  lookupOnlinePlaybackSources,
} from '../data/onlinePlaybackSources';
import {
  X,
  Play,
  ExternalLink,
  AlertCircle,
  Film,
  Tv,
  Loader2,
  ArrowLeft,
  ShieldCheck,
  Check,
  ChevronLeft,
  ChevronRight,
  Globe,
  Clock,
} from 'lucide-react';

interface OnlinePlayerModalProps {
  media: MediaItem | null;
  initialSeasonNumber?: number;
  initialEpisodeNumber?: number;
  watchedEpisodes?: WatchedEpisodeEntry[];
  onToggleEpisodeWatched?: (
    media: MediaItem,
    seasonNumber: number,
    episodeNumber: number,
    watched: boolean,
    totalKnownEpisodes: number
  ) => void;
  onClose: () => void;
}

function formatDurationLabel(minutes: number): string {
  if (!Number.isFinite(minutes) || minutes <= 0) return '';
  if (minutes < 60) return `${minutes}m`;
  const hrs = Math.floor(minutes / 60);
  const mins = minutes % 60;
  return mins > 0 ? `${hrs}h ${mins}m` : `${hrs}h`;
}

function getYoutubeErrorDescription(code: number | null): string {
  switch (code) {
    case 2:
      return 'The video parameter is invalid or no longer recognized by YouTube.';
    case 5:
      return 'The HTML5 video player encountered a playback error in this browser.';
    case 100:
      return 'This video has been removed or marked private by the channel owner.';
    case 101:
    case 150:
      return 'The rights holder has disabled third-party iframe embedding or restricted playback in your region.';
    default:
      return 'This video cannot be embedded in your current browser or region.';
  }
}

export const OnlinePlayerModal: React.FC<OnlinePlayerModalProps> = ({
  media,
  initialSeasonNumber,
  initialEpisodeNumber,
  watchedEpisodes = [],
  onToggleEpisodeWatched,
  onClose,
}) => {
  const lookup = useMemo(
    () => (media ? lookupOnlinePlaybackSources(media) : null),
    [media]
  );

  const [selectedSeason, setSelectedSeason] = useState<number>(1);
  const [activeSource, setActiveSource] = useState<AuthorizedOnlineSource | null>(null);
  const [hasStartedPlayback, setHasStartedPlayback] = useState<boolean>(false);
  const [iframeLoaded, setIframeLoaded] = useState<boolean>(false);
  const [embedBlocked, setEmbedBlocked] = useState<boolean>(false);
  const [embedErrorReason, setEmbedErrorReason] = useState<string | null>(null);
  const [thumbFallback, setThumbFallback] = useState<boolean>(false);

  const iframeRef = useRef<HTMLIFrameElement | null>(null);

  const stopActiveVideo = useCallback(() => {
    const iframe = iframeRef.current;
    if (!iframe) return;
    try {
      iframe.contentWindow?.postMessage(
        JSON.stringify({ event: 'command', func: 'stopVideo', args: [] }),
        '*'
      );
      iframe.src = 'about:blank';
    } catch {
      // Ignore cross-origin teardown errors
    }
  }, []);

  const handleClosePlayer = useCallback(() => {
    stopActiveVideo();
    onClose();
  }, [stopActiveVideo, onClose]);

  // Initialize selected season & source when modal opens or initial target changes
  useEffect(() => {
    if (!media || !lookup || !lookup.available) {
      setActiveSource(null);
      setHasStartedPlayback(false);
      setIframeLoaded(false);
      setEmbedBlocked(false);
      setEmbedErrorReason(null);
      return;
    }

    let targetSource: AuthorizedOnlineSource | null = null;
    if (
      media.type === 'tv' &&
      typeof initialSeasonNumber === 'number' &&
      typeof initialEpisodeNumber === 'number'
    ) {
      targetSource =
        lookup.sources.find(
          (s) =>
            s.seasonNumber === initialSeasonNumber &&
            s.episodeNumber === initialEpisodeNumber
        ) || null;
    } else if (media.type === 'tv' && typeof initialSeasonNumber === 'number') {
      targetSource =
        lookup.sources.find((s) => s.seasonNumber === initialSeasonNumber) || null;
    }

    const resolved = targetSource || lookup.defaultSource || lookup.sources[0] || null;
    setActiveSource(resolved);
    setSelectedSeason(resolved?.seasonNumber || lookup.seasons[0] || 1);
    setHasStartedPlayback(false);
    setIframeLoaded(false);
    setEmbedBlocked(false);
    setEmbedErrorReason(null);
    setThumbFallback(false);
  }, [media, lookup, initialSeasonNumber, initialEpisodeNumber]);

  // Listen to YouTube IFrame API postMessage events for playback readiness and restrictions
  useEffect(() => {
    if (!activeSource?.youtubeVideoId || !hasStartedPlayback) return;

    const handleMessage = (event: MessageEvent) => {
      if (
        !event.origin.includes('youtube.com') &&
        !event.origin.includes('youtube-nocookie.com')
      ) {
        return;
      }
      if (typeof event.data !== 'string') return;
      try {
        const data = JSON.parse(event.data);
        if (data?.event === 'onError') {
          const code = typeof data.info === 'number' ? data.info : null;
          setEmbedBlocked(true);
          setEmbedErrorReason(getYoutubeErrorDescription(code));
          setIframeLoaded(true);
        } else if (data?.event === 'onReady' || data?.event === 'onStateChange') {
          setIframeLoaded(true);
        }
      } catch {
        // Ignore non-JSON postMessage frames
      }
    };

    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, [activeSource?.youtubeVideoId, hasStartedPlayback]);

  // Offline check & timeout safeguard while loading iframe
  useEffect(() => {
    if (!activeSource?.youtubeVideoId || !hasStartedPlayback || iframeLoaded || embedBlocked) {
      return;
    }

    if (typeof navigator !== 'undefined' && navigator.onLine === false) {
      setEmbedBlocked(true);
      setEmbedErrorReason(
        'You appear to be offline. Connect to the internet to stream this title.'
      );
      setIframeLoaded(true);
      return;
    }

    const timer = window.setTimeout(() => {
      setIframeLoaded(true);
    }, 5000);
    return () => window.clearTimeout(timer);
  }, [activeSource?.youtubeVideoId, hasStartedPlayback, iframeLoaded, embedBlocked]);

  // Close on Escape key & lock body scroll
  useEffect(() => {
    if (!media) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        handleClosePlayer();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = prevOverflow;
      stopActiveVideo();
    };
  }, [media, handleClosePlayer, stopActiveVideo]);

  const seasonSources = useMemo(() => {
    if (!media || !lookup?.available) return [];
    if (media.type !== 'tv') return lookup.sources;
    return lookup.sources.filter((s) => (s.seasonNumber || 1) === selectedSeason);
  }, [media, lookup, selectedSeason]);

  const currentSourceIndex = useMemo(() => {
    if (!lookup?.available || !activeSource) return -1;
    return lookup.sources.findIndex((s) => s.id === activeSource.id);
  }, [lookup, activeSource]);

  if (!media) return null;


  const prevSource =
    lookup?.available && currentSourceIndex > 0
      ? lookup.sources[currentSourceIndex - 1]
      : null;
  const nextSource =
    lookup?.available &&
    currentSourceIndex >= 0 &&
    currentSourceIndex < lookup.sources.length - 1
      ? lookup.sources[currentSourceIndex + 1]
      : null;

  const handleSelectSource = (source: AuthorizedOnlineSource, autoStart = true) => {
    if (source.id === activeSource?.id && hasStartedPlayback) return;
    stopActiveVideo();
    if (source.seasonNumber && source.seasonNumber !== selectedSeason) {
      setSelectedSeason(source.seasonNumber);
    }
    setActiveSource(source);
    setIframeLoaded(false);
    setEmbedBlocked(false);
    setEmbedErrorReason(null);
    setThumbFallback(false);
    setHasStartedPlayback(autoStart);
  };

  const handleStartPlayback = () => {
    if (!activeSource) return;
    if (typeof navigator !== 'undefined' && navigator.onLine === false) {
      setEmbedBlocked(true);
      setEmbedErrorReason(
        'You appear to be offline. Connect to the internet to stream this title.'
      );
      setIframeLoaded(true);
      return;
    }
    setIframeLoaded(false);
    setEmbedBlocked(false);
    setEmbedErrorReason(null);
    setHasStartedPlayback(true);
  };

  const embedUrl = activeSource
    ? buildAuthorizedYouTubeEmbedUrl(activeSource.youtubeVideoId, { autoplay: true })
    : '';

  const previewThumbnailUrl = activeSource
    ? thumbFallback
      ? `https://i.ytimg.com/vi/${activeSource.youtubeVideoId}/hqdefault.jpg`
      : `https://i.ytimg.com/vi/${activeSource.youtubeVideoId}/maxresdefault.jpg`
    : media.backdropUrl || media.posterUrl || '';

  const watchedSet = new Set(
    watchedEpisodes
      .filter((ep) => ep.mediaId === media.id)
      .map((ep) => `${ep.seasonNumber}:${ep.episodeNumber}`)
  );

  const isCurrentEpisodeWatched =
    media.type === 'tv' &&
    activeSource?.seasonNumber &&
    activeSource?.episodeNumber
      ? watchedSet.has(`${activeSource.seasonNumber}:${activeSource.episodeNumber}`)
      : false;

  const totalKnownEpisodes =
    media.totalEpisodes ||
    media.seasonsList?.reduce((acc, s) => acc + s.episodeCount, 0) ||
    lookup?.sources.length ||
    1;

  return (
    <div
      className="fixed inset-0 z-[75] flex items-center justify-center p-2 sm:p-4 md:p-6 bg-black/90 backdrop-blur-md animate-fadeIn overflow-y-auto"
      onClick={handleClosePlayer}
      role="dialog"
      aria-modal="true"
      aria-label={`${media.title} Online Player`}
    >
      <div
        className="relative w-full max-w-5xl rounded-2xl bg-[#0B0F17] border border-white/10 shadow-2xl overflow-hidden flex flex-col max-h-[94vh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Top Cinema Bar */}
        <div className="flex items-center justify-between gap-3 px-4 sm:px-6 py-3.5 border-b border-white/10 bg-[#070A0F] shrink-0">
          <div className="flex items-center gap-3 min-w-0">
            <button
              type="button"
              onClick={handleClosePlayer}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-slate-200 hover:text-white border border-white/10 text-xs font-semibold transition-colors shrink-0"
              title="Return to details"
            >
              <ArrowLeft className="w-3.5 h-3.5 text-amber-400" />
              <span>Back to Details</span>
            </button>

            <div className="min-w-0">
              <div className="flex items-center gap-2 text-[11px] text-amber-400 font-medium">
                {media.type === 'tv' ? (
                  <Tv className="w-3.5 h-3.5 shrink-0" />
                ) : (
                  <Film className="w-3.5 h-3.5 shrink-0" />
                )}
                <span className="truncate">
                  {activeSource?.contentKind === 'full_episode' &&
                  activeSource.seasonNumber &&
                  activeSource.episodeNumber
                    ? `Full Episode · S${String(activeSource.seasonNumber).padStart(
                        2,
                        '0'
                      )}E${String(activeSource.episodeNumber).padStart(2, '0')}`
                    : 'Full-Length Feature Film'}
                </span>
                {activeSource?.resolutionLabel && (
                  <>
                    <span aria-hidden="true" className="text-slate-600">
                      ·
                    </span>
                    <span className="font-mono text-slate-300">
                      {activeSource.resolutionLabel}
                    </span>
                  </>
                )}
              </div>
              <h3 className="font-['Outfit'] text-base sm:text-lg font-bold text-white truncate">
                {media.title}
                {activeSource?.episodeTitle ? ` — ${activeSource.episodeTitle}` : ''}
              </h3>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            {activeSource?.officialWatchUrl && (
              <a
                href={activeSource.officialWatchUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="hidden sm:inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-slate-300 hover:text-white border border-white/10 text-xs font-medium transition-colors"
                title="Open on official YouTube channel"
              >
                <span>YouTube</span>
                <ExternalLink className="w-3.5 h-3.5" />
              </a>
            )}
            <button
              type="button"
              onClick={handleClosePlayer}
              aria-label="Close online player"
              className="w-9 h-9 rounded-full bg-white/5 hover:bg-white/15 text-slate-300 hover:text-white flex items-center justify-center border border-white/10 transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Scrollable Player & Episode Selector Body */}
        <div className="overflow-y-auto flex-1">
          {/* 16:9 Video Stage */}
          <div className="relative w-full aspect-video bg-black flex items-center justify-center overflow-hidden">
            {!lookup?.available || !activeSource ? (
              /* No Authorized Source State */
              <div className="px-6 py-10 text-center max-w-md space-y-4">
                <div className="w-12 h-12 rounded-2xl bg-slate-800/90 border border-white/10 flex items-center justify-center mx-auto text-slate-400">
                  <AlertCircle className="w-6 h-6 text-amber-400" />
                </div>
                <div className="space-y-1.5">
                  <h4 className="font-['Outfit'] text-lg font-bold text-white">
                    No Authorized Online Playback Source Available
                  </h4>
                  <p className="text-xs sm:text-sm text-slate-400 leading-relaxed">
                    {lookup?.unavailableReason ||
                      `CineMax only streams full-length movies and episodes from verified official rights-holder channels or public-domain archives.`}
                  </p>
                </div>
                <div className="pt-1">
                  <button
                    type="button"
                    onClick={handleClosePlayer}
                    className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-white/10 hover:bg-white/15 text-white font-semibold text-xs sm:text-sm border border-white/10 transition-all"
                  >
                    <ArrowLeft className="w-4 h-4 text-amber-400" />
                    <span>Return to Title Details</span>
                  </button>
                </div>
              </div>
            ) : embedBlocked ? (
              /* Restricted / Unavailable Video Fallback State */
              <div className="px-6 py-10 text-center max-w-lg space-y-4">
                <div className="w-12 h-12 rounded-2xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center mx-auto text-amber-400">
                  <AlertCircle className="w-6 h-6" />
                </div>
                <div className="space-y-1.5">
                  <h4 className="font-['Outfit'] text-lg font-bold text-white">
                    Embedded Playback Restricted or Unavailable
                  </h4>
                  <p className="text-xs sm:text-sm text-slate-300 leading-relaxed">
                    {embedErrorReason ||
                      'The official channel has restricted third-party iframe playback or regional availability for this video.'}
                  </p>
                </div>
                <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
                  <a
                    href={activeSource.officialWatchUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-amber-400 hover:bg-amber-300 text-slate-950 font-bold text-xs sm:text-sm shadow-lg shadow-amber-500/20 transition-all"
                  >
                    <Play className="w-4 h-4 fill-slate-950" />
                    <span>Watch on Official YouTube Channel</span>
                    <ExternalLink className="w-3.5 h-3.5" />
                  </a>
                  <button
                    type="button"
                    onClick={() => {
                      setEmbedBlocked(false);
                      setEmbedErrorReason(null);
                      setHasStartedPlayback(false);
                    }}
                    className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-white/5 hover:bg-white/10 text-slate-200 border border-white/10 text-xs sm:text-sm font-medium transition-colors"
                  >
                    <span>Reset Player</span>
                  </button>
                </div>
              </div>
            ) : !hasStartedPlayback ? (
              /* User-Initiated Preview Stage (No Unprompted Autoplay With Sound) */
              <div className="relative w-full h-full flex items-center justify-center group">
                {previewThumbnailUrl && (
                  <img
                    src={previewThumbnailUrl}
                    alt={`${media.title} playback preview`}
                    onError={() => {
                      if (!thumbFallback) setThumbFallback(true);
                    }}
                    className="absolute inset-0 w-full h-full object-cover opacity-55 group-hover:scale-[1.01] transition-transform duration-500"
                  />
                )}
                <div className="absolute inset-0 bg-gradient-to-t from-[#070A0F] via-black/55 to-black/40" />

                <div className="relative z-10 flex flex-col items-center text-center px-6 max-w-xl space-y-4">
                  <button
                    type="button"
                    onClick={handleStartPlayback}
                    aria-label={`Start playing ${media.title}`}
                    className="w-16 h-16 sm:w-20 sm:h-20 rounded-full bg-amber-400 hover:bg-amber-300 text-slate-950 flex items-center justify-center shadow-2xl shadow-amber-500/40 transition-all transform hover:scale-105 focus:outline-none focus:ring-2 focus:ring-amber-300"
                  >
                    <Play className="w-7 h-7 sm:w-8 sm:h-8 fill-slate-950 ml-1" />
                  </button>

                  <div className="space-y-1.5">
                    <div className="flex flex-wrap items-center justify-center gap-2 text-xs text-amber-300 font-medium">
                      <span>
                        {activeSource.contentKind === 'full_episode'
                          ? `Season ${activeSource.seasonNumber} · Episode ${activeSource.episodeNumber}`
                          : `Full Movie (${media.year})`}
                      </span>
                      <span aria-hidden="true">·</span>
                      <span className="font-mono">
                        {formatDurationLabel(activeSource.durationMinutes)}
                      </span>
                      <span aria-hidden="true">·</span>
                      <span>{activeSource.channelName}</span>
                    </div>

                    <h4 className="font-['Outfit'] text-lg sm:text-2xl font-extrabold text-white tracking-tight">
                      {activeSource.episodeTitle
                        ? `${media.title}: ${activeSource.episodeTitle}`
                        : media.title}
                    </h4>

                    {activeSource.synopsis && (
                      <p className="text-xs sm:text-sm text-slate-300 line-clamp-2 max-w-lg mx-auto">
                        {activeSource.synopsis}
                      </p>
                    )}
                  </div>

                  <div className="flex flex-wrap items-center justify-center gap-3 pt-1">
                    <button
                      type="button"
                      onClick={handleStartPlayback}
                      className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-amber-400 hover:bg-amber-300 text-slate-950 font-bold text-xs sm:text-sm shadow-lg shadow-amber-500/20 transition-all"
                    >
                      <Play className="w-4 h-4 fill-slate-950" />
                      <span>
                        {activeSource.contentKind === 'full_episode'
                          ? 'Play Full Episode'
                          : 'Play Full Movie'}
                      </span>
                    </button>

                    <a
                      href={activeSource.officialWatchUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-black/60 hover:bg-black/80 text-slate-200 hover:text-white border border-white/15 text-xs sm:text-sm font-medium transition-colors"
                    >
                      <span>Watch on YouTube</span>
                      <ExternalLink className="w-3.5 h-3.5" />
                    </a>
                  </div>
                </div>
              </div>
            ) : (
              /* Active Official YouTube Privacy-Enhanced IFrame Player */
              <>
                {!iframeLoaded && (
                  <div className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-3 bg-[#070A0F]">
                    <Loader2 className="w-8 h-8 text-amber-400 animate-spin" />
                    <p className="text-xs text-slate-400 font-medium">
                      Connecting to official YouTube stream…
                    </p>
                  </div>
                )}
                <iframe
                  ref={iframeRef}
                  key={activeSource.id}
                  src={embedUrl}
                  title={
                    activeSource.episodeTitle
                      ? `${media.title} - ${activeSource.episodeTitle}`
                      : `${media.title} (${media.year})`
                  }
                  className="w-full h-full border-0"
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                  allowFullScreen
                  referrerPolicy="strict-origin-when-cross-origin"
                  onLoad={() => {
                    setIframeLoaded(true);
                    try {
                      iframeRef.current?.contentWindow?.postMessage(
                        JSON.stringify({
                          event: 'listening',
                          id: activeSource.youtubeVideoId,
                        }),
                        '*'
                      );
                    } catch {
                      // Ignore postMessage handshake errors
                    }
                  }}
                  onError={() => {
                    setEmbedBlocked(true);
                    setEmbedErrorReason(
                      'Failed to load the embedded YouTube player in your browser.'
                    );
                    setIframeLoaded(true);
                  }}
                />
              </>
            )}
          </div>

          {/* Source Metadata & Episode Controls Strip */}
          {activeSource && (
            <div className="px-4 sm:px-6 py-4 bg-[#080B11] border-t border-white/10 space-y-5">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                {/* Unboxed Source Attribution Metadata */}
                <div className="space-y-1">
                  <div className="flex flex-wrap items-center gap-2 text-xs text-slate-300">
                    <span className="inline-flex items-center gap-1.5 text-emerald-400 font-semibold">
                      <ShieldCheck className="w-4 h-4 shrink-0" />
                      <span>{activeSource.licenseStatus}</span>
                    </span>
                    <span aria-hidden="true" className="text-slate-600">
                      ·
                    </span>
                    <span>
                      Channel:{' '}
                      <strong className="text-white font-semibold">
                        {activeSource.channelName}
                      </strong>
                    </span>
                    <span aria-hidden="true" className="text-slate-600">
                      ·
                    </span>
                    <span className="inline-flex items-center gap-1 text-slate-300">
                      <Globe className="w-3.5 h-3.5 text-amber-400" />
                      <span>{activeSource.languageLabel}</span>
                    </span>
                    <span aria-hidden="true" className="text-slate-600">
                      ·
                    </span>
                    <span className="inline-flex items-center gap-1 font-mono text-slate-300 tabular-nums">
                      <Clock className="w-3.5 h-3.5 text-amber-400" />
                      <span>{formatDurationLabel(activeSource.durationMinutes)}</span>
                    </span>
                  </div>

                  {activeSource.synopsis && (
                    <p className="text-xs text-slate-400 leading-relaxed max-w-3xl">
                      {activeSource.synopsis}
                    </p>
                  )}
                </div>

                {/* Episode Quick Actions (Prev / Next / Mark Watched) */}
                {media.type === 'tv' && (
                  <div className="flex flex-wrap items-center gap-2 shrink-0">
                    {prevSource && (
                      <button
                        type="button"
                        onClick={() => handleSelectSource(prevSource, true)}
                        className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-slate-200 border border-white/10 text-xs font-medium transition-colors"
                      >
                        <ChevronLeft className="w-3.5 h-3.5" />
                        <span>
                          Prev (S{String(prevSource.seasonNumber).padStart(2, '0')}E
                          {String(prevSource.episodeNumber).padStart(2, '0')})
                        </span>
                      </button>
                    )}

                    {nextSource && (
                      <button
                        type="button"
                        onClick={() => handleSelectSource(nextSource, true)}
                        className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-amber-500/15 hover:bg-amber-500/25 text-amber-300 border border-amber-500/30 text-xs font-semibold transition-colors"
                      >
                        <span>
                          Next (S{String(nextSource.seasonNumber).padStart(2, '0')}E
                          {String(nextSource.episodeNumber).padStart(2, '0')})
                        </span>
                        <ChevronRight className="w-3.5 h-3.5" />
                      </button>
                    )}

                    {onToggleEpisodeWatched &&
                      activeSource.seasonNumber &&
                      activeSource.episodeNumber && (
                        <button
                          type="button"
                          onClick={() =>
                            onToggleEpisodeWatched(
                              media,
                              activeSource.seasonNumber!,
                              activeSource.episodeNumber!,
                              !isCurrentEpisodeWatched,
                              totalKnownEpisodes
                            )
                          }
                          className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-semibold transition-colors ${
                            isCurrentEpisodeWatched
                              ? 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30 hover:bg-emerald-500/25'
                              : 'bg-white/5 text-slate-300 border-white/10 hover:bg-white/10 hover:text-white'
                          }`}
                        >
                          <Check className="w-3.5 h-3.5" />
                          <span>
                            {isCurrentEpisodeWatched ? 'Watched' : 'Mark Episode Watched'}
                          </span>
                        </button>
                      )}
                  </div>
                )}
              </div>

              {/* TV / Anime Verified Season & Episode Selector */}
              {media.type === 'tv' && lookup && lookup.sources.length > 0 && (
                <div className="pt-4 border-t border-white/10 space-y-3">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <Tv className="w-4 h-4 text-amber-400" />
                      <h4 className="font-['Outfit'] text-sm font-bold text-white">
                        Verified Playable Episodes ({lookup.sources.length})
                      </h4>
                    </div>

                    {/* Season Tabs (Only seasons with verified playable episodes) */}
                    {lookup.seasons.length > 1 && (
                      <div className="flex items-center gap-1.5 overflow-x-auto">
                        {lookup.seasons.map((seasonNum) => {
                          const countInSeason = lookup.sources.filter(
                            (s) => s.seasonNumber === seasonNum
                          ).length;
                          const isSelected = selectedSeason === seasonNum;
                          return (
                            <button
                              key={seasonNum}
                              type="button"
                              onClick={() => {
                                setSelectedSeason(seasonNum);
                                const firstInSeason = lookup.sources.find(
                                  (s) => s.seasonNumber === seasonNum
                                );
                                if (firstInSeason) {
                                  handleSelectSource(firstInSeason, hasStartedPlayback);
                                }
                              }}
                              className={`px-3 py-1 rounded-lg text-xs font-semibold transition-colors whitespace-nowrap ${
                                isSelected
                                  ? 'bg-amber-400 text-slate-950'
                                  : 'bg-white/5 text-slate-300 hover:bg-white/10 border border-white/10'
                              }`}
                            >
                              Season {seasonNum} ({countInSeason})
                            </button>
                          );
                        })}
                      </div>
                    )}
                  </div>

                  {/* Episode Selection Grid */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5 max-h-56 overflow-y-auto pr-1">
                    {seasonSources.map((epSource) => {
                      const isCurrent = activeSource.id === epSource.id;
                      const epWatched =
                        epSource.seasonNumber && epSource.episodeNumber
                          ? watchedSet.has(
                              `${epSource.seasonNumber}:${epSource.episodeNumber}`
                            )
                          : false;

                      return (
                        <button
                          key={epSource.id}
                          type="button"
                          onClick={() => handleSelectSource(epSource, true)}
                          className={`flex items-center justify-between gap-3 p-2.5 rounded-xl border text-left transition-all ${
                            isCurrent
                              ? 'bg-amber-500/15 border-amber-400/50 text-white shadow-sm'
                              : 'bg-slate-900/60 border-white/5 text-slate-300 hover:border-white/15 hover:bg-slate-900'
                          }`}
                        >
                          <div className="flex items-center gap-2.5 min-w-0">
                            <div
                              className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 ${
                                isCurrent
                                  ? 'bg-amber-400 text-slate-950'
                                  : 'bg-white/5 text-amber-400'
                              }`}
                            >
                              <Play className="w-3.5 h-3.5 fill-current ml-0.5" />
                            </div>
                            <div className="min-w-0">
                              <div className="flex items-center gap-1.5 text-xs">
                                <span className="font-mono font-bold text-amber-400 tabular-nums shrink-0">
                                  S{String(epSource.seasonNumber || 1).padStart(2, '0')}E
                                  {String(epSource.episodeNumber || 1).padStart(2, '0')}
                                </span>
                                <span className="font-semibold text-white truncate">
                                  {epSource.episodeTitle || `Episode ${epSource.episodeNumber}`}
                                </span>
                              </div>
                              <div className="flex items-center gap-1.5 text-[11px] text-slate-400 font-mono tabular-nums mt-0.5">
                                <span>{formatDurationLabel(epSource.durationMinutes)}</span>
                                <span>·</span>
                                <span className="truncate font-sans">
                                  {epSource.channelName}
                                </span>
                              </div>
                            </div>
                          </div>

                          {epWatched && (
                            <span className="text-[10px] font-semibold text-emerald-400 shrink-0">
                              Watched
                            </span>
                          )}
                        </button>
                      );
                    })}
                  </div>

                  {totalKnownEpisodes > lookup.sources.length && (
                    <p className="text-[11px] text-slate-400">
                      Showing the {lookup.sources.length} verified episode
                      {lookup.sources.length === 1 ? '' : 's'} officially released for free
                      streaming by {activeSource.channelName} on YouTube. Remaining episodes
                      require a platform subscription listed under Where to Watch.
                    </p>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
