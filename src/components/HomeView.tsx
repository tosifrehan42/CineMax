import React, { useState, useEffect } from 'react';
import { MediaItem, WatchStatus } from '../types';
import { HeroSpotlight } from './HeroSpotlight';
import { MediaCard } from './MediaCard';
import { MOODS } from '../data/mediaData';
import { CatalogueCategory, fetchCatalogue } from '../services/mediaApi';
import {
  TrendingUp,
  Film,
  Tv,
  Trophy,
  Sparkles,
  ChevronRight,
  Calendar,
  Plus,
  Loader2,
  Info,
} from 'lucide-react';

interface HomeViewProps {
  initialItems: MediaItem[];
  isInWatchlist: (id: string) => boolean;
  getWatchlistStatus?: (id: string) => WatchStatus | undefined;
  onToggleWatchlist: (id: string, media?: MediaItem) => void;
  onUpdateStatus?: (id: string, status: WatchStatus, media?: MediaItem) => void;
  onRemoveFromWatchlist?: (id: string) => void;
  getWatchedEpisodesCount?: (id: string) => number;
  onSelectMedia: (media: MediaItem) => void;
  onPlayTrailer: (media: MediaItem) => void;
  onExploreMood: (moodId: string) => void;
  onExploreCategory: (category: CatalogueCategory) => void;
  onNavigateTab: (tab: 'discover' | 'watchlist') => void;
  onRegisterMedia?: (items: MediaItem[]) => void;
}

interface SectionState {
  items: MediaItem[];
  bufferedItems: MediaItem[];
  page: number;
  totalPages: number;
  loadingMore: boolean;
}

export const HomeView: React.FC<HomeViewProps> = ({
  initialItems,
  isInWatchlist,
  getWatchlistStatus,
  onToggleWatchlist,
  onUpdateStatus,
  onRemoveFromWatchlist,
  getWatchedEpisodesCount,
  onSelectMedia,
  onPlayTrailer,
  onExploreMood,
  onExploreCategory,
  onNavigateTab,
  onRegisterMedia,
}) => {
  const [tmdbConfigured, setTmdbConfigured] = useState<boolean | null>(null);
  const [isInitialLoading, setIsInitialLoading] = useState<boolean>(true);

  const [trending, setTrending] = useState<SectionState>({
    items: initialItems.slice(0, 8),
    bufferedItems: [],
    page: 1,
    totalPages: 5,
    loadingMore: false,
  });
  const [popularMovies, setPopularMovies] = useState<SectionState>({
    items: initialItems.filter((i) => i.type === 'movie').slice(0, 8),
    bufferedItems: [],
    page: 1,
    totalPages: 5,
    loadingMore: false,
  });
  const [upcomingMovies, setUpcomingMovies] = useState<SectionState>({
    items: initialItems.filter((i) => i.type === 'movie' && i.year >= 2023).slice(0, 8),
    bufferedItems: [],
    page: 1,
    totalPages: 5,
    loadingMore: false,
  });
  const [popularTV, setPopularTV] = useState<SectionState>({
    items: initialItems.filter((i) => i.type === 'tv').slice(0, 8),
    bufferedItems: [],
    page: 1,
    totalPages: 5,
    loadingMore: false,
  });
  const [topRated, setTopRated] = useState<SectionState>({
    items: [...initialItems].sort((a, b) => b.rating - a.rating).slice(0, 8),
    bufferedItems: [],
    page: 1,
    totalPages: 5,
    loadingMore: false,
  });

  useEffect(() => {
    let active = true;
    async function loadSections() {
      try {
        const [trendRes, popMovRes, upMovRes, popTvRes, topRes] = await Promise.all([
          fetchCatalogue({ category: 'trending', page: 1 }),
          fetchCatalogue({ category: 'popular_movies', page: 1 }),
          fetchCatalogue({ category: 'upcoming_movies', page: 1 }),
          fetchCatalogue({ category: 'popular_tv', page: 1 }),
          fetchCatalogue({ category: 'top_rated_movies', page: 1 }),
        ]);

        if (!active) return;

        setTmdbConfigured(trendRes.tmdbConfigured);

        if (onRegisterMedia) {
          onRegisterMedia([
            ...trendRes.items,
            ...popMovRes.items,
            ...upMovRes.items,
            ...popTvRes.items,
            ...topRes.items,
          ]);
        }

        if (trendRes.items.length > 0) {
          setTrending({
            items: trendRes.items.slice(0, 8),
            bufferedItems: trendRes.items.slice(8),
            page: trendRes.page || 1,
            totalPages: trendRes.totalPages,
            loadingMore: false,
          });
        }
        if (popMovRes.items.length > 0) {
          setPopularMovies({
            items: popMovRes.items.slice(0, 8),
            bufferedItems: popMovRes.items.slice(8),
            page: popMovRes.page || 1,
            totalPages: popMovRes.totalPages,
            loadingMore: false,
          });
        }
        if (upMovRes.items.length > 0) {
          setUpcomingMovies({
            items: upMovRes.items.slice(0, 8),
            bufferedItems: upMovRes.items.slice(8),
            page: upMovRes.page || 1,
            totalPages: upMovRes.totalPages,
            loadingMore: false,
          });
        }
        if (popTvRes.items.length > 0) {
          setPopularTV({
            items: popTvRes.items.slice(0, 8),
            bufferedItems: popTvRes.items.slice(8),
            page: popTvRes.page || 1,
            totalPages: popTvRes.totalPages,
            loadingMore: false,
          });
        }
        if (topRes.items.length > 0) {
          setTopRated({
            items: topRes.items.slice(0, 8),
            bufferedItems: topRes.items.slice(8),
            page: topRes.page || 1,
            totalPages: topRes.totalPages,
            loadingMore: false,
          });
        }
      } catch {
        // Keep initial curated items if network call fails
      } finally {
        if (active) setIsInitialLoading(false);
      }
    }

    loadSections();
    return () => {
      active = false;
    };
  }, [onRegisterMedia]);

  const handleLoadMoreSection = async (
    category: CatalogueCategory,
    state: SectionState,
    setter: React.Dispatch<React.SetStateAction<SectionState>>
  ) => {
    if (state.loadingMore) return;

    // If we still have buffered items from the current page, reveal them without re-requesting page 1
    if (state.bufferedItems.length > 0) {
      setter((prev) => {
        const seen = new Set(prev.items.map((i) => i.id));
        const uniqueBuffered = prev.bufferedItems.filter((i) => !seen.has(i.id));
        return {
          ...prev,
          items: [...prev.items, ...uniqueBuffered],
          bufferedItems: [],
        };
      });
      return;
    }

    if (state.page >= state.totalPages) return;

    const nextPage = state.page + 1;
    setter((prev) => ({ ...prev, loadingMore: true }));
    try {
      const res = await fetchCatalogue({ category, page: nextPage });
      if (onRegisterMedia && res.items.length > 0) {
        onRegisterMedia(res.items);
      }
      setter((prev) => {
        const seen = new Set(prev.items.map((i) => i.id));
        const newItems = res.items.filter((i) => !seen.has(i.id));
        return {
          items: [...prev.items, ...newItems],
          bufferedItems: [],
          page: res.page || nextPage,
          totalPages: res.totalPages,
          loadingMore: false,
        };
      });
    } catch {
      setter((prev) => ({ ...prev, loadingMore: false }));
    }
  };

  const featured = initialItems.filter((item) => item.featured);

  return (
    <div className="space-y-14 pb-16">
      {/* Honest TMDB API Configuration Status Banner if TMDB_API_KEY is not yet set */}
      {tmdbConfigured === false && (
        <div className="px-4 py-3 rounded-xl bg-amber-500/10 border border-amber-500/25 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs text-slate-300">
          <div className="flex items-start sm:items-center gap-2.5">
            <Info className="w-4 h-4 text-amber-400 shrink-0 mt-0.5 sm:mt-0" />
            <span>
              <strong className="text-white">Live Expanded Catalogue Active:</strong> Browsing hundreds of real movies & TV shows. To switch to direct <code className="text-amber-300 font-mono">api.themoviedb.org/3</code> endpoints, add <code className="text-amber-300 font-mono">TMDB_API_KEY</code> in the Secrets panel.
            </span>
          </div>
          <button
            onClick={() => onNavigateTab('discover')}
            className="text-amber-400 hover:text-amber-300 font-semibold whitespace-nowrap shrink-0 flex items-center gap-1"
          >
            <span>Browse Full Catalogue</span>
            <ChevronRight className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* 1. Cinematic Hero Spotlight */}
      <HeroSpotlight
        featuredItems={featured}
        isInWatchlist={isInWatchlist}
        onToggleWatchlist={(id) => {
          const item = featured.find((f) => f.id === id);
          onToggleWatchlist(id, item);
        }}
        onSelectMedia={onSelectMedia}
        onPlayTrailer={onPlayTrailer}
      />

      {/* Mood-Based Quick Exploration Strip */}
      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="font-['Outfit'] text-xl font-bold text-white tracking-tight flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-amber-400" />
              <span>Discover by Mood & Vibe</span>
            </h2>
            <p className="text-xs text-slate-400 mt-0.5">
              Tune into your psychological headspace tonight
            </p>
          </div>
          <button
            onClick={() => onNavigateTab('discover')}
            className="flex items-center gap-1 text-xs text-amber-400 hover:text-amber-300 font-semibold transition-colors"
          >
            <span>View All Moods</span>
            <ChevronRight className="w-3.5 h-3.5" />
          </button>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {MOODS.slice(1, 5).map((m) => (
            <div
              key={m.id}
              onClick={() => onExploreMood(m.id)}
              className="group p-4 rounded-xl bg-slate-900/60 hover:bg-slate-900 border border-white/5 hover:border-amber-400/30 transition-all cursor-pointer flex flex-col justify-between"
            >
              <div>
                <h3 className="text-sm font-semibold text-white group-hover:text-amber-400 transition-colors">
                  {m.label}
                </h3>
                <p className="text-xs text-slate-400 mt-1 line-clamp-2 leading-relaxed">
                  {m.description}
                </p>
              </div>
              <div className="mt-3 flex items-center gap-1 text-[11px] text-amber-400/80 font-medium">
                <span>Explore titles</span>
                <ChevronRight className="w-3 h-3 group-hover:translate-x-0.5 transition-transform" />
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* 2. Trending Now Section */}
      <section className="space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="p-1.5 rounded-lg bg-red-500/10 text-red-400 border border-red-500/20">
              <TrendingUp className="w-4 h-4" />
            </div>
            <div>
              <h2 className="font-['Outfit'] text-xl font-bold text-white tracking-tight">
                Trending This Week
              </h2>
              <p className="text-xs text-slate-400">
                Most streamed and debated titles worldwide
              </p>
            </div>
          </div>
          <button
            onClick={() => onExploreCategory('trending')}
            className="text-xs font-semibold text-amber-400 hover:text-amber-300 flex items-center gap-1 transition-colors"
          >
            <span>Browse All Trending</span>
            <ChevronRight className="w-3.5 h-3.5" />
          </button>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4 sm:gap-6">
          {trending.items.map((item, idx) => (
            <MediaCard
              key={item.id}
              media={item}
              rankBadge={idx + 1}
              isInWatchlist={isInWatchlist(item.id)}
              watchlistStatus={getWatchlistStatus?.(item.id)}
              onToggleWatchlist={(id) => onToggleWatchlist(id, item)}
              onUpdateStatus={
                onUpdateStatus ? (id, status) => onUpdateStatus(id, status, item) : undefined
              }
              onRemoveFromWatchlist={onRemoveFromWatchlist}
              watchedEpisodesCount={getWatchedEpisodesCount?.(item.id)}
              onClick={onSelectMedia}
            />
          ))}
        </div>

        <div className="pt-2 flex justify-center">
          <button
            onClick={() => handleLoadMoreSection('trending', trending, setTrending)}
            disabled={trending.loadingMore}
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-xs font-semibold text-slate-200 transition-colors"
          >
            {trending.loadingMore ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin text-amber-400" />
            ) : (
              <Plus className="w-3.5 h-3.5 text-amber-400" />
            )}
            <span>Load More Trending Titles</span>
          </button>
        </div>
      </section>

      {/* 3. Popular Movies Section */}
      <section className="space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="p-1.5 rounded-lg bg-amber-500/10 text-amber-400 border border-amber-500/20">
              <Film className="w-4 h-4" />
            </div>
            <div>
              <h2 className="font-['Outfit'] text-xl font-bold text-white tracking-tight">
                Popular Feature Films
              </h2>
              <p className="text-xs text-slate-400">
                Major theatrical releases and acclaimed cinema
              </p>
            </div>
          </div>
          <button
            onClick={() => onExploreCategory('popular_movies')}
            className="text-xs font-semibold text-amber-400 hover:text-amber-300 flex items-center gap-1 transition-colors"
          >
            <span>See All Movies</span>
            <ChevronRight className="w-3.5 h-3.5" />
          </button>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4 sm:gap-6">
          {popularMovies.items.map((item) => (
            <MediaCard
              key={item.id}
              media={item}
              isInWatchlist={isInWatchlist(item.id)}
              watchlistStatus={getWatchlistStatus?.(item.id)}
              onToggleWatchlist={(id) => onToggleWatchlist(id, item)}
              onUpdateStatus={
                onUpdateStatus ? (id, status) => onUpdateStatus(id, status, item) : undefined
              }
              onRemoveFromWatchlist={onRemoveFromWatchlist}
              watchedEpisodesCount={getWatchedEpisodesCount?.(item.id)}
              onClick={onSelectMedia}
            />
          ))}
        </div>

        <div className="pt-2 flex justify-center">
          <button
            onClick={() => handleLoadMoreSection('popular_movies', popularMovies, setPopularMovies)}
            disabled={popularMovies.loadingMore}
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-xs font-semibold text-slate-200 transition-colors"
          >
            {popularMovies.loadingMore ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin text-amber-400" />
            ) : (
              <Plus className="w-3.5 h-3.5 text-amber-400" />
            )}
            <span>Load More Popular Movies</span>
          </button>
        </div>
      </section>

      {/* 4. Upcoming & New Releases Section */}
      <section className="space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="p-1.5 rounded-lg bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
              <Calendar className="w-4 h-4" />
            </div>
            <div>
              <h2 className="font-['Outfit'] text-xl font-bold text-white tracking-tight">
                Upcoming & Recent Releases
              </h2>
              <p className="text-xs text-slate-400">
                Fresh premieres and anticipated theatrical arrivals
              </p>
            </div>
          </div>
          <button
            onClick={() => onExploreCategory('upcoming_movies')}
            className="text-xs font-semibold text-amber-400 hover:text-amber-300 flex items-center gap-1 transition-colors"
          >
            <span>Browse Upcoming</span>
            <ChevronRight className="w-3.5 h-3.5" />
          </button>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4 sm:gap-6">
          {upcomingMovies.items.map((item) => (
            <MediaCard
              key={item.id}
              media={item}
              isInWatchlist={isInWatchlist(item.id)}
              watchlistStatus={getWatchlistStatus?.(item.id)}
              onToggleWatchlist={(id) => onToggleWatchlist(id, item)}
              onUpdateStatus={
                onUpdateStatus ? (id, status) => onUpdateStatus(id, status, item) : undefined
              }
              onRemoveFromWatchlist={onRemoveFromWatchlist}
              watchedEpisodesCount={getWatchedEpisodesCount?.(item.id)}
              onClick={onSelectMedia}
            />
          ))}
        </div>

        <div className="pt-2 flex justify-center">
          <button
            onClick={() => handleLoadMoreSection('upcoming_movies', upcomingMovies, setUpcomingMovies)}
            disabled={upcomingMovies.loadingMore}
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-xs font-semibold text-slate-200 transition-colors"
          >
            {upcomingMovies.loadingMore ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin text-amber-400" />
            ) : (
              <Plus className="w-3.5 h-3.5 text-amber-400" />
            )}
            <span>Load More Releases</span>
          </button>
        </div>
      </section>

      {/* 5. Popular TV Shows Section */}
      <section className="space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="p-1.5 rounded-lg bg-sky-500/10 text-sky-400 border border-sky-500/20">
              <Tv className="w-4 h-4" />
            </div>
            <div>
              <h2 className="font-['Outfit'] text-xl font-bold text-white tracking-tight">
                Popular Television & Series
              </h2>
              <p className="text-xs text-slate-400">
                Immersive episodic epics and character dramas
              </p>
            </div>
          </div>
          <button
            onClick={() => onExploreCategory('popular_tv')}
            className="text-xs font-semibold text-amber-400 hover:text-amber-300 flex items-center gap-1 transition-colors"
          >
            <span>See All TV Shows</span>
            <ChevronRight className="w-3.5 h-3.5" />
          </button>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4 sm:gap-6">
          {popularTV.items.map((item) => (
            <MediaCard
              key={item.id}
              media={item}
              isInWatchlist={isInWatchlist(item.id)}
              watchlistStatus={getWatchlistStatus?.(item.id)}
              onToggleWatchlist={(id) => onToggleWatchlist(id, item)}
              onUpdateStatus={
                onUpdateStatus ? (id, status) => onUpdateStatus(id, status, item) : undefined
              }
              onRemoveFromWatchlist={onRemoveFromWatchlist}
              watchedEpisodesCount={getWatchedEpisodesCount?.(item.id)}
              onClick={onSelectMedia}
            />
          ))}
        </div>

        <div className="pt-2 flex justify-center">
          <button
            onClick={() => handleLoadMoreSection('popular_tv', popularTV, setPopularTV)}
            disabled={popularTV.loadingMore}
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-xs font-semibold text-slate-200 transition-colors"
          >
            {popularTV.loadingMore ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin text-amber-400" />
            ) : (
              <Plus className="w-3.5 h-3.5 text-amber-400" />
            )}
            <span>Load More TV Series</span>
          </button>
        </div>
      </section>

      {/* 6. Top Rated All Time (Hall of Fame) */}
      <section className="space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="p-1.5 rounded-lg bg-yellow-500/10 text-yellow-400 border border-yellow-500/20">
              <Trophy className="w-4 h-4" />
            </div>
            <div>
              <h2 className="font-['Outfit'] text-xl font-bold text-white tracking-tight">
                Top Rated Masterpieces
              </h2>
              <p className="text-xs text-slate-400">
                Highest-rated films and series across the catalogue
              </p>
            </div>
          </div>
          <button
            onClick={() => onExploreCategory('top_rated_movies')}
            className="text-xs font-semibold text-amber-400 hover:text-amber-300 flex items-center gap-1 transition-colors"
          >
            <span>See All Top Rated</span>
            <ChevronRight className="w-3.5 h-3.5" />
          </button>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4 sm:gap-6">
          {topRated.items.map((item, idx) => (
            <MediaCard
              key={item.id}
              media={item}
              rankBadge={idx + 1}
              isInWatchlist={isInWatchlist(item.id)}
              watchlistStatus={getWatchlistStatus?.(item.id)}
              onToggleWatchlist={(id) => onToggleWatchlist(id, item)}
              onUpdateStatus={
                onUpdateStatus ? (id, status) => onUpdateStatus(id, status, item) : undefined
              }
              onRemoveFromWatchlist={onRemoveFromWatchlist}
              watchedEpisodesCount={getWatchedEpisodesCount?.(item.id)}
              onClick={onSelectMedia}
            />
          ))}
        </div>

        <div className="pt-2 flex justify-center">
          <button
            onClick={() => handleLoadMoreSection('top_rated_movies', topRated, setTopRated)}
            disabled={topRated.loadingMore}
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-xs font-semibold text-slate-200 transition-colors"
          >
            {topRated.loadingMore ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin text-amber-400" />
            ) : (
              <Plus className="w-3.5 h-3.5 text-amber-400" />
            )}
            <span>Load More Top Rated</span>
          </button>
        </div>
      </section>
    </div>
  );
};
