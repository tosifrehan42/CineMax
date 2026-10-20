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

export const MediaPoster: React.FC<MediaPosterProps> = ({
  media,
  aspect = 'poster',
  className = '',
  priority = false,
}) => {
  const { bgFrom, bgTo, accent, iconType } = media.posterVisual;
  const targetUrl =
    aspect === 'backdrop' || aspect === 'banner'
      ? media.backdropUrl || media.posterUrl
      : media.posterUrl;

  const [isLoaded, setIsLoaded] = useState(false);
  const [hasError, setHasError] = useState(false);
  const imgRef = useRef<HTMLImageElement | null>(null);

  useEffect(() => {
    setHasError(false);
    if (imgRef.current && imgRef.current.complete && imgRef.current.naturalWidth > 0) {
      setIsLoaded(true);
    } else {
      setIsLoaded(false);
    }
  }, [targetUrl]);

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
    const backdropSrcSet = buildTmdbBackdropSrcSet(targetUrl);

    return (
      <div
        className={`relative overflow-hidden ${className}`}
        style={{
          background: `radial-gradient(ellipse at 80% 20%, ${accent}25 0%, transparent 60%), linear-gradient(135deg, ${bgFrom} 0%, ${bgTo} 60%, #08090d 100%)`,
        }}
      >
        {/* Loading Shimmer State */}
        {!isLoaded && !hasError && (
          <div className="absolute inset-0 bg-slate-900/60 animate-pulse pointer-events-none" />
        )}

        {/* Real Backdrop Image */}
        {targetUrl && !hasError ? (
          <img
            ref={imgRef}
            src={targetUrl}
            srcSet={backdropSrcSet}
            sizes="100vw"
            alt={`${media.title} (${media.year}) backdrop`}
            referrerPolicy="no-referrer"
            loading={priority ? 'eager' : 'lazy'}
            onLoad={() => setIsLoaded(true)}
            onError={() => setHasError(true)}
            className={`absolute inset-0 w-full h-full object-cover object-center transition-opacity duration-500 ${
              isLoaded ? 'opacity-65' : 'opacity-0'
            }`}
          />
        ) : (
          /* Fallback Ambient Motif if image fails */
          <div className="absolute right-12 bottom-8 opacity-25 scale-150 transform pointer-events-none">
            {renderVisualIcon()}
          </div>
        )}

        {/* Subtle cinematic texture & color tint */}
        <div
          className="absolute top-1/4 -right-20 w-[500px] h-32 blur-3xl opacity-20 pointer-events-none"
          style={{ backgroundColor: accent }}
        />

        {/* Deep bottom and left vignette for crisp text contrast */}
        <div className="absolute inset-0 bg-gradient-to-t from-[#090a0f] via-[#090a0f]/45 to-black/30 pointer-events-none" />
        <div className="absolute inset-0 bg-gradient-to-r from-[#090a0f] via-[#090a0f]/75 to-transparent pointer-events-none" />
      </div>
    );
  }

  // Standard 2:3 vertical movie/TV poster
  const posterSrcSet = buildTmdbPosterSrcSet(targetUrl);

  return (
    <div
      className={`relative overflow-hidden aspect-[2/3] w-full rounded-lg select-none shadow-xl border border-white/5 bg-slate-950 transition-all duration-300 ${className}`}
      style={{
        background: `radial-gradient(circle at 50% 20%, ${accent}30 0%, transparent 70%), linear-gradient(180deg, ${bgFrom} 0%, ${bgTo} 70%, #06070a 100%)`,
      }}
    >
      {/* Loading Skeleton Shimmer */}
      {!isLoaded && !hasError && (
        <div className="absolute inset-0 z-10 flex flex-col items-center justify-center bg-slate-900/80 animate-pulse p-3">
          <div className="w-8 h-8 rounded-full border-2 border-amber-400/30 border-t-amber-400 animate-spin mb-2" />
          <span className="text-[10px] font-medium text-slate-400 text-center line-clamp-1">
            {media.title}
          </span>
        </div>
      )}

      {/* Real Movie/TV Poster Image */}
      {targetUrl && !hasError ? (
        <img
          ref={imgRef}
          src={targetUrl}
          srcSet={posterSrcSet}
          sizes="(max-width: 640px) 45vw, (max-width: 1024px) 30vw, 260px"
          alt={`${media.title} (${media.year}) official poster`}
          referrerPolicy="no-referrer"
          loading={priority ? 'eager' : 'lazy'}
          onLoad={() => setIsLoaded(true)}
          onError={() => setHasError(true)}
          className={`w-full h-full object-cover object-center transition-all duration-500 group-hover:scale-105 ${
            isLoaded ? 'opacity-100' : 'opacity-0'
          }`}
        />
      ) : (
        /* Graceful Stylized Fallback Artwork when an image fails to load */
        <div className="relative z-10 w-full h-full flex flex-col justify-between p-4">
          <div className="flex items-center justify-between text-[11px] tracking-wider uppercase text-white/60 font-medium">
            <span className="flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: accent }} />
              {media.type === 'movie' ? 'Film' : `${media.seasons}S TV`}
            </span>
            <span className="text-white/40">{media.year}</span>
          </div>

          <div className="my-auto flex flex-col items-center justify-center text-center py-4">
            <div className="p-3.5 rounded-full bg-black/25 backdrop-blur-sm border border-white/10 mb-2">
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
              <span className="text-amber-400/90 font-medium font-mono">★ {media.rating.toFixed(1)}</span>
            </div>
          </div>
        </div>
      )}

      {/* Subtle bottom vignette & edge illumination */}
      <div className="absolute inset-0 bg-gradient-to-t from-black/50 via-transparent to-transparent opacity-60 pointer-events-none" />
      <div
        className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none border border-white/20 rounded-lg"
        style={{
          boxShadow: `inset 0 0 20px ${accent}25`,
        }}
      />
    </div>
  );
};
