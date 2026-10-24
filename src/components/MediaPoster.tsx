import React, { useState, useEffect, useRef } from 'react';
import { MediaItem } from '../types';
import { Sparkles, Compass, Eye, Film, Flame, Moon, Orbit, Building2 } from 'lucide-react';

interface MediaPosterProps {
  media: MediaItem;
  aspect?: 'poster' | 'backdrop' | 'banner';
  className?: string;
  showOverlayTitle?: boolean;
  priority?: boolean;
}

// Session-level cache of failed image URLs to prevent repeated network requests on card remount
const failedImageUrls = new Set<string>();

function normalizeTmdbPosterSrc(url: string): string {
  if (!url) return '';
  if (!url.includes('image.tmdb.org/t/p/')) return url;
  return url.replace(/\/t\/p\/[^/]+\//, '/t/p/w342/');
}

function normalizeTmdbBackdropSrc(url: string): string {
  if (!url) return '';
  if (!url.includes('image.tmdb.org/t/p/')) return url;
  return url.replace(/\/t\/p\/[^/]+\//, '/t/p/w780/');
}

function buildTmdbPosterSrcSet(url: string): string | undefined {
  if (!url || !url.includes('image.tmdb.org/t/p/')) return undefined;
  const fileMatch = url.match(/\/t\/p\/[^/]+\/(.+)$/);
  if (!fileMatch) return undefined;
  const filename = fileMatch[1];
  return [
    `https://image.tmdb.org/t/p/w342/${filename} 342w`,
    `https://image.tmdb.org/t/p/w500/${filename} 500w`,
    `https://image.tmdb.org/t/p/w780/${filename} 780w`,
  ].join(', ');
}

function buildTmdbBackdropSrcSet(url: string): string | undefined {
  if (!url || !url.includes('image.tmdb.org/t/p/')) return undefined;
  const fileMatch = url.match(/\/t\/p\/[^/]+\/(.+)$/);
  if (!fileMatch) return undefined;
  const filename = fileMatch[1];
  return [
    `https://image.tmdb.org/t/p/w780/${filename} 780w`,
    `https://image.tmdb.org/t/p/w1280/${filename} 1280w`,
  ].join(', ');
}

const MediaPosterComponent: React.FC<MediaPosterProps> = ({
  media,
  aspect = 'poster',
  className = '',
  priority = false,
}) => {
  const { bgFrom, bgTo, accent, iconType } = media.posterVisual;

  const rawBackdropUrl = (media.backdropUrl || '').trim();
  const rawPosterUrl = (media.posterUrl || '').trim();
  const cleanBackdropUrl = normalizeTmdbBackdropSrc(rawBackdropUrl);
  const cleanPosterUrl = normalizeTmdbPosterSrc(rawPosterUrl);

  // A backdrop is considered a distinct wide backdrop only when it is non-empty and not identical to a portrait-only poster URL
  const hasDistinctBackdrop = Boolean(
    rawBackdropUrl && rawBackdropUrl !== rawPosterUrl
  );

  const [isBackdropLoaded, setIsBackdropLoaded] = useState(false);
  const [hasBackdropError, setHasBackdropError] = useState(() =>
    cleanBackdropUrl ? failedImageUrls.has(cleanBackdropUrl) : false
  );
  const [isPosterLoaded, setIsPosterLoaded] = useState(false);
  const [hasPosterError, setHasPosterError] = useState(() =>
    cleanPosterUrl ? failedImageUrls.has(cleanPosterUrl) : false
  );

  const backdropImgRef = useRef<HTMLImageElement | null>(null);
  const posterImgRef = useRef<HTMLImageElement | null>(null);

  useEffect(() => {
    if (!cleanBackdropUrl) {
      setHasBackdropError(false);
      setIsBackdropLoaded(false);
      return;
    }
    if (failedImageUrls.has(cleanBackdropUrl)) {
      setHasBackdropError(true);
      setIsBackdropLoaded(false);
      return;
    }
    setHasBackdropError(false);
    if (
      backdropImgRef.current &&
      backdropImgRef.current.complete &&
      backdropImgRef.current.naturalWidth > 0
    ) {
      setIsBackdropLoaded(true);
    } else {
      setIsBackdropLoaded(false);
    }
  }, [cleanBackdropUrl]);

  useEffect(() => {
    if (!cleanPosterUrl) {
      setHasPosterError(false);
      setIsPosterLoaded(false);
      return;
    }
    if (failedImageUrls.has(cleanPosterUrl)) {
      setHasPosterError(true);
      setIsPosterLoaded(false);
      return;
    }
    setHasPosterError(false);
    if (
      posterImgRef.current &&
      posterImgRef.current.complete &&
      posterImgRef.current.naturalWidth > 0
    ) {
      setIsPosterLoaded(true);
    } else {
      setIsPosterLoaded(false);
    }
  }, [cleanPosterUrl]);

  const renderVisualIcon = () => {
    switch (iconType) {
      case 'space':
        return <Orbit className="w-12 h-12 opacity-40 stroke-[1.2]" style={{ color: accent }} />;
      case 'desert':
        return <Flame className="w-12 h-12 opacity-40 stroke-[1.2]" style={{ color: accent }} />;
      case 'mind':
        return <Eye className="w-12 h-12 opacity-40 stroke-[1.2]" style={{ color: accent }} />;
      case 'city':
        return <Building2 className="w-12 h-12 opacity-40 stroke-[1.2]" style={{ color: accent }} />;
      case 'detective':
        return <Moon className="w-12 h-12 opacity-40 stroke-[1.2]" style={{ color: accent }} />;
      case 'cyber':
        return <Sparkles className="w-12 h-12 opacity-40 stroke-[1.2]" style={{ color: accent }} />;
      case 'fantasy':
        return <Compass className="w-12 h-12 opacity-40 stroke-[1.2]" style={{ color: accent }} />;
      default:
        return <Film className="w-12 h-12 opacity-40 stroke-[1.2]" style={{ color: accent }} />;
    }
  };

  if (aspect === 'backdrop' || aspect === 'banner') {
    const showRealWideBackdrop = hasDistinctBackdrop && !hasBackdropError;
    const showPosterAmbientFallback =
      !showRealWideBackdrop && Boolean(cleanPosterUrl) && !hasPosterError;
    const backdropSrcSet = showRealWideBackdrop
      ? buildTmdbBackdropSrcSet(rawBackdropUrl)
      : undefined;

    return (
      <div
        className={`relative overflow-hidden ${className}`}
        style={{
          background: `radial-gradient(ellipse at 80% 20%, ${accent}25 0%, transparent 60%), linear-gradient(135deg, ${bgFrom} 0%, ${bgTo} 60%, #08090d 100%)`,
        }}
      >
        {/* Lightweight Loading Placeholder */}
        {showRealWideBackdrop && !isBackdropLoaded && (
          <div className="absolute inset-0 bg-slate-900/60 pointer-events-none" />
        )}

        {/* 1. Real 16:9 Wide Backdrop Image when available */}
        {showRealWideBackdrop ? (
          <img
            ref={backdropImgRef}
            src={cleanBackdropUrl}
            srcSet={backdropSrcSet}
            sizes="(max-width: 768px) 100vw, 1280px"
            width={1280}
            height={720}
            alt={`${media.title} (${media.year || 'TBA'}) backdrop`}
            referrerPolicy="no-referrer"
            loading={priority ? 'eager' : 'lazy'}
            decoding={priority ? 'sync' : 'async'}
            fetchPriority={priority ? 'high' : 'auto'}
            onLoad={() => setIsBackdropLoaded(true)}
            onError={() => {
              if (cleanBackdropUrl) failedImageUrls.add(cleanBackdropUrl);
              setHasBackdropError(true);
            }}
            className={`absolute inset-0 w-full h-full object-cover object-center transition-opacity duration-300 ${
              isBackdropLoaded ? 'opacity-65' : 'opacity-0'
            }`}
          />
        ) : showPosterAmbientFallback ? (
          /* 2. Blurred Ambient Background + Sharp Portrait Poster Accent when wide backdrop is missing */
          <>
            <img
              src={cleanPosterUrl}
              width={342}
              height={513}
              alt=""
              aria-hidden="true"
              referrerPolicy="no-referrer"
              loading={priority ? 'eager' : 'lazy'}
              decoding="async"
              onError={() => {
                if (cleanPosterUrl) failedImageUrls.add(cleanPosterUrl);
                setHasPosterError(true);
              }}
              className="absolute inset-0 w-full h-full object-cover object-center scale-110 blur-xl opacity-45 pointer-events-none"
            />
            <div className="hidden sm:flex absolute right-8 md:right-14 lg:right-20 top-1/2 -translate-y-1/2 h-[76%] aspect-[2/3] rounded-xl overflow-hidden shadow-2xl border border-white/15 z-[1] pointer-events-none">
              <img
                src={cleanPosterUrl}
                width={342}
                height={513}
                alt={`${media.title} poster accent`}
                referrerPolicy="no-referrer"
                loading={priority ? 'eager' : 'lazy'}
                decoding="async"
                className="w-full h-full object-cover object-center opacity-90"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/40 via-transparent to-transparent" />
            </div>
          </>
        ) : (
          /* 3. Fallback Ambient Motif if neither backdrop nor poster is available */
          <div className="absolute right-12 bottom-8 opacity-25 scale-150 transform pointer-events-none">
            {renderVisualIcon()}
          </div>
        )}

        {/* Subtle cinematic texture & color tint */}
        <div
          className="hidden sm:block absolute top-1/4 -right-20 w-[500px] h-32 blur-3xl opacity-20 pointer-events-none"
          style={{ backgroundColor: accent }}
        />

        {/* Deep bottom and left vignette for crisp text contrast */}
        <div className="absolute inset-0 bg-gradient-to-t from-[#090a0f] via-[#090a0f]/45 to-black/30 pointer-events-none" />
        <div className="absolute inset-0 bg-gradient-to-r from-[#090a0f] via-[#090a0f]/75 to-transparent pointer-events-none" />
      </div>
    );
  }

  // Standard 2:3 vertical movie/TV poster
  const posterSrcSet = buildTmdbPosterSrcSet(rawPosterUrl);

  return (
    <div
      className={`relative overflow-hidden aspect-[2/3] w-full rounded-lg select-none border border-white/5 bg-slate-950 ${className}`}
      style={{
        background: `radial-gradient(circle at 50% 20%, ${accent}25 0%, transparent 70%), linear-gradient(180deg, ${bgFrom} 0%, ${bgTo} 70%, #06070a 100%)`,
      }}
    >
      {/* Lightweight Static Loading Placeholder (avoids 100+ simultaneous spinning animations on mobile) */}
      {Boolean(cleanPosterUrl) && !isPosterLoaded && !hasPosterError && (
        <div className="absolute inset-0 z-10 flex flex-col items-center justify-end bg-slate-900/70 p-3 pointer-events-none">
          <span className="text-[10px] font-medium text-slate-400/80 text-center line-clamp-1">
            {media.title}
          </span>
        </div>
      )}

      {/* Real Movie/TV Poster Image */}
      {cleanPosterUrl && !hasPosterError ? (
        <img
          ref={posterImgRef}
          src={cleanPosterUrl}
          srcSet={posterSrcSet}
          sizes="(max-width: 640px) 42vw, (max-width: 1024px) 24vw, 200px"
          width={342}
          height={513}
          alt={`${media.title} (${media.year || 'TBA'}) official poster`}
          referrerPolicy="no-referrer"
          loading={priority ? 'eager' : 'lazy'}
          decoding={priority ? 'sync' : 'async'}
          fetchPriority={priority ? 'high' : 'auto'}
          onLoad={() => setIsPosterLoaded(true)}
          onError={() => {
            if (cleanPosterUrl) failedImageUrls.add(cleanPosterUrl);
            setHasPosterError(true);
          }}
          className={`w-full h-full object-cover object-center transition-opacity duration-300 md:group-hover:scale-105 md:transition-transform ${
            isPosterLoaded ? 'opacity-100' : 'opacity-0'
          }`}
        />
      ) : (
        /* Graceful Stylized Fallback Artwork when an image fails to load */
        <div className="relative z-10 w-full h-full flex flex-col justify-between p-4">
          <div className="flex items-center justify-between text-[11px] tracking-wider uppercase text-white/60 font-medium">
            <span className="flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: accent }} />
              {media.type === 'movie' ? 'Film' : 'TV Series'}
            </span>
            <span className="text-white/40">{media.year > 0 ? media.year : 'TBA'}</span>
          </div>

          <div className="my-auto flex flex-col items-center justify-center text-center py-4">
            <div className="p-3.5 rounded-full bg-black/35 border border-white/10 mb-2">
              {renderVisualIcon()}
            </div>
            <div
              className="text-[10px] tracking-widest uppercase font-semibold text-white/50 px-2 py-0.5 rounded"
              style={{ letterSpacing: '0.18em' }}
            >
              {media.genres[0]}
            </div>
          </div>

          <div className="pt-2 border-t border-white/10">
            <h4 className="text-sm font-bold text-white tracking-tight line-clamp-1">
              {media.title}
            </h4>
            <div className="flex items-center justify-between mt-1 text-[11px] text-white/50">
              <span className="truncate max-w-[100px]">{media.director.split('&')[0]}</span>
              <span className="text-amber-400/90 font-medium font-mono">
                ★ {media.rating > 0 ? media.rating.toFixed(1) : 'NR'}
              </span>
            </div>
          </div>
        </div>
      )}

      {/* Subtle bottom vignette */}
      <div className="absolute inset-0 bg-gradient-to-t from-black/50 via-transparent to-transparent opacity-60 pointer-events-none" />
    </div>
  );
};

export const MediaPoster = React.memo(
  MediaPosterComponent,
  (prev, next) =>
    prev.media.id === next.media.id &&
    prev.media.posterUrl === next.media.posterUrl &&
    prev.media.backdropUrl === next.media.backdropUrl &&
    prev.aspect === next.aspect &&
    prev.priority === next.priority &&
    prev.className === next.className
);
