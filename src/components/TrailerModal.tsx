import React, { useState, useEffect, useRef, useCallback } from 'react';
import { MediaItem, TrailerLookupResult, TrailerVideo } from '../types';
import { fetchMediaTrailers } from '../services/mediaApi';
import {
  X,
  Play,
  Film,
  ExternalLink,
  AlertCircle,
  RefreshCw,
  Search,
  CheckCircle2,
  Loader2,
} from 'lucide-react';

interface TrailerModalProps {
  media: MediaItem | null;
  onClose: () => void;
}

function getYoutubeWatchUrl(videoKey: string): string {
  return `https://www.youtube.com/watch?v=${encodeURIComponent(videoKey)}`;
}

function getYoutubeEmbedUrl(videoKey: string): string {
  const params = new URLSearchParams({
    autoplay: '1',
    playsinline: '1',
    rel: '0',
    modestbranding: '1',
    enablejsapi: '1',
  });
  if (typeof window !== 'undefined' && window.location?.origin) {
    params.set('origin', window.location.origin);
  }
  return `https://www.youtube.com/embed/${encodeURIComponent(videoKey)}?${params.toString()}`;
}

export const TrailerModal: React.FC<TrailerModalProps> = ({ media, onClose }) => {
  const [isLoading, setIsLoading] = useState(false);
  const [lookupResult, setLookupResult] = useState<TrailerLookupResult | null>(null);
  const [activeVideo, setActiveVideo] = useState<TrailerVideo | null>(null);
  const [isPlayerActive, setIsPlayerActive] = useState(false);
  const [thumbnailHighResFailed, setThumbnailHighResFailed] = useState(false);
  const [embedErrorCode, setEmbedErrorCode] = useState<number | null>(null);
  const [reloadCounter, setReloadCounter] = useState(0);

  const iframeRef = useRef<HTMLIFrameElement | null>(null);

  const handleClose = useCallback(() => {
    // Explicitly stop and release player before closing so audio never continues in background
    if (iframeRef.current) {
      try {
        iframeRef.current.contentWindow?.postMessage(
          JSON.stringify({ event: 'command', func: 'stopVideo', args: [] }),
          '*'
        );
      } catch {
        // Ignore cross-origin frame teardown errors
      }
      iframeRef.current.src = 'about:blank';
    }
    setIsPlayerActive(false);
    setEmbedErrorCode(null);
    onClose();
  }, [onClose]);

  // Keyboard Escape handler
  useEffect(() => {
    if (!media) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        handleClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [media, handleClose]);

  // Fetch real trailer metadata from TMDB when media changes
  useEffect(() => {
    if (!media) {
      setLookupResult(null);
      setActiveVideo(null);
      setIsPlayerActive(false);
      setEmbedErrorCode(null);
      setThumbnailHighResFailed(false);
      return;
    }

    const controller = new AbortController();
    setIsLoading(true);
    setLookupResult(null);
    setActiveVideo(null);
    setIsPlayerActive(false);
    setEmbedErrorCode(null);
    setThumbnailHighResFailed(false);

    fetchMediaTrailers(media, controller.signal, { refresh: reloadCounter > 0 })
      .then((res) => {
        if (controller.signal.aborted) return;
        setLookupResult(res);
        const initialVideo = res.primaryVideo || res.videos[0] || null;
        setActiveVideo(initialVideo);
        // Display the real YouTube trailer thumbnail first; open the embedded YouTube player when the user clicks Play
        setIsPlayerActive(false);
      })
      .catch((err: any) => {
        if (controller.signal.aborted || err?.name === 'AbortError') return;
        const fallbackSearchUrl = `https://www.youtube.com/results?search_query=${encodeURIComponent(
          `${media.title} ${media.year || ''} official trailer`.trim()
        )}`;
        setLookupResult({
          status: 'error',
          tmdbId: null,
          mediaType: media.type,
          primaryVideo: null,
          videos: [],
          youtubeSearchUrl: fallbackSearchUrl,
          reason: 'Unable to load trailer metadata right now. Please try again.',
        });
      })
      .finally(() => {
        if (!controller.signal.aborted) {
          setIsLoading(false);
        }
      });

    return () => {
      controller.abort();
    };
  }, [media, reloadCounter]);

  // Listen for YouTube IFrame Player API postMessage error events (codes 2, 5, 100, 101, 150)
  useEffect(() => {
    if (!isPlayerActive || !activeVideo) return;

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
        if (data?.event === 'onError' && typeof data?.info === 'number') {
          setEmbedErrorCode(data.info);
        }
      } catch {
        // Ignore non-JSON postMessages
      }
    };

    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, [isPlayerActive, activeVideo]);

  const handleIframeLoad = () => {
    if (!iframeRef.current?.contentWindow) return;
    try {
      // Subscribe to YouTube IFrame API events so onError notifications are delivered
      iframeRef.current.contentWindow.postMessage(
        JSON.stringify({ event: 'listening', id: 1, channel: 'widget' }),
        '*'
      );
    } catch {
      // Ignore postMessage handshake errors
    }
  };

  const handleSelectVideo = (video: TrailerVideo) => {
    setActiveVideo(video);
    setThumbnailHighResFailed(false);
    setEmbedErrorCode(null);
    setIsPlayerActive(true);
  };

  if (!media) return null;

  const fallbackSearchUrl =
    lookupResult?.youtubeSearchUrl ||
    `https://www.youtube.com/results?search_query=${encodeURIComponent(
      `${media.title} ${media.year || ''} official trailer`.trim()
    )}`;

  const thumbnailUrl = activeVideo
    ? thumbnailHighResFailed
      ? `https://i.ytimg.com/vi/${activeVideo.key}/hqdefault.jpg`
      : `https://i.ytimg.com/vi/${activeVideo.key}/maxresdefault.jpg`
    : media.backdropUrl || media.posterUrl;

  const publishedYear = activeVideo?.publishedAt
    ? new Date(activeVideo.publishedAt).getFullYear()
    : null;

  return (
    <div
      className="fixed inset-0 z-50 overflow-y-auto cm-glass-backdrop flex items-center justify-center p-3 sm:p-6 md:p-8 animate-in fade-in duration-200"
      role="dialog"
      aria-modal="true"
      aria-label={`${media.title} Trailer`}
    >
      <div className="fixed inset-0" onClick={handleClose} />

      <div className="relative z-10 w-full max-w-5xl cm-glass-panel rounded-2xl overflow-hidden flex flex-col">
        {/* Top Header Bar */}
        <div className="flex items-center justify-between px-4 sm:px-6 py-3.5 cm-glass-subbar border-b border-white/10 gap-3">
          <div className="flex items-center gap-2.5 min-w-0">
            <span className="w-2 h-2 rounded-full bg-amber-400 shrink-0" />
            <span className="text-xs uppercase tracking-wider font-semibold text-amber-400 shrink-0">
              {activeVideo
                ? `${activeVideo.official ? 'Official ' : ''}${activeVideo.type}`
                : 'Trailer Lookup'}
            </span>
            <span className="text-slate-600 shrink-0">·</span>
            <span className="text-sm font-semibold text-white truncate">
              {media.title}
              {media.year ? ` (${media.year})` : ''}
            </span>
            {activeVideo && (
              <>
                <span className="hidden md:inline text-slate-600 shrink-0">·</span>
                <span className="hidden md:inline text-xs text-slate-400 truncate">
                  {activeVideo.name}
                </span>
              </>
            )}
          </div>

          <button
            onClick={handleClose}
            aria-label="Close trailer"
            className="p-1.5 rounded-lg text-slate-400 hover:text-white cm-glass-control shrink-0"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Main 16:9 Video Area */}
        <div className="relative w-full aspect-video bg-black flex items-center justify-center overflow-hidden">
          {isLoading ? (
            /* 1. Loading State */
            <div className="flex flex-col items-center justify-center text-center px-6 py-12">
              <Loader2 className="w-10 h-10 text-amber-400 animate-spin mb-4" />
              <p className="text-sm font-semibold text-white mb-1">
                Fetching official trailer metadata…
              </p>
              <p className="text-xs text-slate-400">
                Checking TMDB video catalog for {media.title}
              </p>
            </div>
          ) : lookupResult?.status === 'ok' && activeVideo ? (
            embedErrorCode !== null ? (
              /* 2a. YouTube Embedding Restriction / Unavailable Video Error State */
              <div className="relative w-full h-full flex flex-col items-center justify-center text-center px-6 py-8 bg-slate-950">
                <div className="w-12 h-12 rounded-2xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400 mb-4">
                  <AlertCircle className="w-6 h-6" />
                </div>
                <h3 className="font-['Outfit'] text-xl sm:text-2xl font-bold text-white mb-2">
                  Playback Restricted on External Sites
                </h3>
                <p className="text-xs sm:text-sm text-slate-400 max-w-md mb-6 leading-relaxed">
                  {embedErrorCode === 101 || embedErrorCode === 150
                    ? 'The rights holder for this trailer has disabled embedded playback outside of YouTube. You can watch the official trailer directly on YouTube.'
                    : 'This YouTube video could not be played in the embedded player. You can open it directly on YouTube below.'}
                </p>
                <div className="flex flex-wrap items-center justify-center gap-3">
                  <a
                    href={getYoutubeWatchUrl(activeVideo.key)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-semibold text-sm transition-colors shadow-lg shadow-amber-500/20"
                  >
                    <Play className="w-4 h-4 fill-current" />
                    <span>Watch Official {activeVideo.type} on YouTube</span>
                    <ExternalLink className="w-3.5 h-3.5" />
                  </a>
                  <button
                    onClick={() => {
                      setEmbedErrorCode(null);
                      setIsPlayerActive(false);
                    }}
                    className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-slate-300 text-sm font-medium transition-colors"
                  >
                    Back to Preview
                  </button>
                </div>
              </div>
            ) : isPlayerActive ? (
              /* 2b. Real Embedded YouTube Player with real thumbnail backdrop while iframe initializes */
              <div className="relative w-full h-full bg-black">
                {thumbnailUrl && (
                  <img
                    src={thumbnailUrl}
                    alt={`${media.title} - ${activeVideo.name}`}
                    onError={() => {
                      if (!thumbnailHighResFailed) {
                        setThumbnailHighResFailed(true);
                      }
                    }}
                    referrerPolicy="no-referrer"
                    className="absolute inset-0 w-full h-full object-cover object-center opacity-30 pointer-events-none"
                  />
                )}
                <iframe
                  ref={iframeRef}
                  key={activeVideo.key}
                  src={getYoutubeEmbedUrl(activeVideo.key)}
                  title={`${media.title} - ${activeVideo.name}`}
                  onLoad={handleIframeLoad}
                  className="relative z-10 w-full h-full border-0"
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                  allowFullScreen
                />
              </div>
            ) : (
              /* 2c. Real YouTube Thumbnail Preview Before Playback */
              <div className="relative w-full h-full group">
                {thumbnailUrl && (
                  <img
                    src={thumbnailUrl}
                    alt={`${media.title} - ${activeVideo.name}`}
                    onError={() => {
                      if (!thumbnailHighResFailed) {
                        setThumbnailHighResFailed(true);
                      }
                    }}
                    referrerPolicy="no-referrer"
                    className="w-full h-full object-cover object-center transition-transform duration-700 group-hover:scale-[1.02]"
                  />
                )}
                <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/40 to-black/30" />

                {/* Center Play Trigger */}
                <button
                  type="button"
                  onClick={() => setIsPlayerActive(true)}
                  aria-label={`Play ${activeVideo.name} for ${media.title}`}
                  className="absolute inset-0 w-full h-full flex flex-col items-center justify-center px-6 text-center cursor-pointer focus:outline-none"
                >
                  <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-full bg-amber-500/95 group-hover:bg-amber-400 text-slate-950 flex items-center justify-center shadow-2xl shadow-amber-500/30 group-hover:scale-110 transition-all duration-300 mb-4">
                    <Play className="w-8 h-8 sm:w-9 sm:h-9 fill-current ml-1" />
                  </div>
                  <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-md bg-black/70 border border-white/15 text-[11px] font-semibold uppercase tracking-wider text-amber-300 mb-2">
                    {activeVideo.official && <CheckCircle2 className="w-3.5 h-3.5 text-amber-400" />}
                    <span>
                      {activeVideo.official ? `Official ${activeVideo.type}` : activeVideo.type}
                    </span>
                    {publishedYear && Number.isFinite(publishedYear) ? (
                      <span>· {publishedYear}</span>
                    ) : null}
                  </span>
                  <h2 className="font-['Outfit'] text-xl sm:text-3xl font-bold text-white max-w-2xl line-clamp-2 drop-shadow-md">
                    {activeVideo.name}
                  </h2>
                  <p className="mt-1.5 text-xs sm:text-sm text-slate-300">
                    Click to play trailer with full audio &amp; controls
                  </p>
                </button>
              </div>
            )
          ) : lookupResult?.status === 'error' ? (
            /* 3. Network / Lookup Failure State */
            <div className="relative w-full h-full flex flex-col items-center justify-center text-center px-6 py-8 bg-slate-950">
              <div className="w-12 h-12 rounded-2xl bg-red-500/10 border border-red-500/30 flex items-center justify-center text-red-400 mb-4">
                <AlertCircle className="w-6 h-6" />
              </div>
              <h3 className="font-['Outfit'] text-xl sm:text-2xl font-bold text-white mb-2">
                Unable to Load Trailer
              </h3>
              <p className="text-xs sm:text-sm text-slate-400 max-w-md mb-6 leading-relaxed">
                {lookupResult.reason ||
                  'A network error occurred while fetching trailer information from TMDB.'}
              </p>
              <div className="flex flex-wrap items-center justify-center gap-3">
                <button
                  type="button"
                  onClick={() => setReloadCounter((c) => c + 1)}
                  className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-semibold text-sm transition-colors"
                >
                  <RefreshCw className="w-4 h-4" />
                  <span>Try Again</span>
                </button>
                <a
                  href={fallbackSearchUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-slate-200 text-sm font-medium transition-colors"
                >
                  <Search className="w-4 h-4 text-amber-400" />
                  <span>Search on YouTube</span>
                  <ExternalLink className="w-3.5 h-3.5 text-slate-400" />
                </a>
              </div>
            </div>
          ) : (
            /* 4. Trailer Unavailable State (Honest Fallback — No Fake Player) */
            <div className="relative w-full h-full flex flex-col items-center justify-center text-center px-6 py-8 bg-slate-950">
              {(media.backdropUrl || media.posterUrl) && (
                <img
                  src={media.backdropUrl || media.posterUrl}
                  alt={media.title}
                  referrerPolicy="no-referrer"
                  className="absolute inset-0 w-full h-full object-cover object-center opacity-15 pointer-events-none"
                />
              )}
              <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-slate-950/85 to-slate-950/75 pointer-events-none" />

              <div className="relative z-10 flex flex-col items-center max-w-md">
                <div className="w-12 h-12 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center text-slate-400 mb-4">
                  <Film className="w-6 h-6" />
                </div>
                <h3 className="font-['Outfit'] text-xl sm:text-2xl font-bold text-white mb-2">
                  Trailer unavailable
                </h3>
                <p className="text-xs sm:text-sm text-slate-400 mb-6 leading-relaxed">
                  {lookupResult?.reason ||
                    `No official YouTube trailer or teaser is currently listed in TMDB for "${media.title}".`}
                </p>
                <div className="flex flex-wrap items-center justify-center gap-3">
                  <a
                    href={fallbackSearchUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-semibold text-sm transition-colors shadow-lg shadow-amber-500/20"
                  >
                    <Search className="w-4 h-4" />
                    <span>Search on YouTube</span>
                    <ExternalLink className="w-3.5 h-3.5" />
                  </a>
                  <button
                    type="button"
                    onClick={() => setReloadCounter((c) => c + 1)}
                    className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-slate-300 hover:text-white text-sm font-medium transition-colors"
                  >
                    <RefreshCw className="w-4 h-4 text-amber-400" />
                    <span>Retry Lookup</span>
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Bottom Info & Multi-Trailer Switcher Bar */}
        <div className="px-4 sm:px-6 py-3.5 cm-glass-subbar border-t border-white/10 flex flex-col gap-3">
          {/* Alternate Trailers / Teasers Switcher when multiple videos exist */}
          {lookupResult && lookupResult.videos.length > 1 && (
            <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-thin">
              <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-400 shrink-0 mr-1">
                Videos ({lookupResult.videos.length}):
              </span>
              {lookupResult.videos.slice(0, 6).map((video) => {
                const isSelected = activeVideo?.key === video.key;
                return (
                  <button
                    key={video.id}
                    type="button"
                    onClick={() => handleSelectVideo(video)}
                    className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium transition-all shrink-0 ${
                      isSelected
                        ? 'bg-amber-500/15 border border-amber-500/50 text-amber-300'
                        : 'cm-glass-control text-slate-300 hover:text-white'
                    }`}
                  >
                    <Play
                      className={`w-3 h-3 shrink-0 ${
                        isSelected ? 'text-amber-400 fill-amber-400' : 'text-slate-400'
                      }`}
                    />
                    <span className="truncate max-w-[180px]">{video.name}</span>
                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-black/45 text-slate-400">
                      {video.type}
                    </span>
                  </button>
                );
              })}
            </div>
          )}

          {/* Footer Metadata & Direct YouTube Link */}
          <div className="flex flex-wrap items-center justify-between gap-3 text-xs text-slate-400">
            <div className="flex items-center gap-2 min-w-0">
              {activeVideo ? (
                <>
                  <span className="text-slate-300 font-medium truncate">
                    {activeVideo.name}
                  </span>
                  <span>·</span>
                  <span className="text-slate-500 shrink-0">
                    YouTube ({activeVideo.type})
                  </span>
                </>
              ) : (
                <span className="text-slate-500">
                  {media.title} {media.year ? `(${media.year})` : ''}
                </span>
              )}
            </div>

            <div className="flex items-center gap-4 shrink-0">
              {activeVideo ? (
                <a
                  href={getYoutubeWatchUrl(activeVideo.key)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 text-amber-400 hover:text-amber-300 font-medium transition-colors"
                >
                  <span>Watch on YouTube</span>
                  <ExternalLink className="w-3.5 h-3.5" />
                </a>
              ) : (
                <a
                  href={fallbackSearchUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 text-amber-400 hover:text-amber-300 font-medium transition-colors"
                >
                  <span>Search on YouTube</span>
                  <ExternalLink className="w-3.5 h-3.5" />
                </a>
              )}
              <span className="hidden sm:inline text-slate-600">ESC to close</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
