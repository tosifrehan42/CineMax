import React, { useState, useEffect, useCallback } from 'react';
import { MediaItem } from '../types';
import { MOODS, GENRES } from '../data/mediaData';
import { MediaCard } from './MediaCard';
import { CatalogueCategory, fetchCatalogue } from '../services/mediaApi';
import {
  Search,
  RotateCcw,
  Sparkles,
  Film,
  ChevronLeft,
  ChevronRight,
  Loader2,
  AlertCircle,
  Plus,
} from 'lucide-react';

interface DiscoverViewProps {
  isInWatchlist: (id: string) => boolean;
  onToggleWatchlist: (id: string, media?: MediaItem) => void;
  onSelectMedia: (media: MediaItem) => void;
  initialMood?: string;
  initialCategory?: CatalogueCategory;
  onRegisterMedia?: (items: MediaItem[]) => void;
}

const CATEGORY_TABS: Array<{ id: CatalogueCategory; label: string }> = [
  { id: 'discover', label: 'All Catalogue' },
  { id: 'trending', label: 'Trending Now' },
  { id: 'popular_movies', label: 'Popular Movies' },
  { id: 'upcoming_movies', label: 'Upcoming Movies' },
  { id: 'top_rated_movies', label: 'Top Rated Movies' },
  { id: 'popular_tv', label: 'Popular TV Shows' },
  { id: 'top_rated_tv', label: 'Top Rated TV' },
];

export const DiscoverView: React.FC<DiscoverViewProps> = ({
  isInWatchlist,
  onToggleWatchlist,
  onSelectMedia,
  initialMood = 'all',
  initialCategory = 'discover',
  onRegisterMedia,
}) => {
  const [searchInput, setSearchInput] = useState('');
  const [debouncedQuery, setDebouncedQuery] = useState('');
  const [category, setCategory] = useState<CatalogueCategory>(initialCategory);
  const [selectedMood, setSelectedMood] = useState(initialMood);
  const [selectedGenre, setSelectedGenre] = useState('All');
  const [selectedType, setSelectedType] = useState<'all' | 'movie' | 'tv'>('all');
  const [sortBy, setSortBy] = useState<'popularity' | 'rating' | 'year' | 'title'>('popularity');
  const [minRating, setMinRating] = useState<number>(0);

  const [items, setItems] = useState<MediaItem[]>([]);
  const [page, setPage] = useState<number>(1);
  const [totalPages, setTotalPages] = useState<number>(1);
  const [totalResults, setTotalResults] = useState<number>(0);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isLoadingMore, setIsLoadingMore] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  // Sync external initialMood / initialCategory changes
  useEffect(() => {
    setSelectedMood(initialMood);
  }, [initialMood]);

  useEffect(() => {
    setCategory(initialCategory);
  }, [initialCategory]);

  // Debounce search input (350ms)
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedQuery(searchInput.trim());
    }, 350);
    return () => clearTimeout(timer);
  }, [searchInput]);

  const loadCataloguePage = useCallback(
    async (targetPage: number, mode: 'replace' | 'append', signal?: AbortSignal) => {
      try {
        if (mode === 'replace') {
          setIsLoading(true);
        } else {
          setIsLoadingMore(true);
        }
        setError(null);

        const response = await fetchCatalogue(
          {
            category,
            page: targetPage,
            type: selectedType,
            genre: selectedGenre,
            mood: selectedMood,
            sortBy,
            minRating,
            query: debouncedQuery,
          },
          signal
        );

        if (onRegisterMedia && response.items.length > 0) {
          onRegisterMedia(response.items);
        }

        if (mode === 'append') {
          setItems((prev) => {
            const seen = new Set(prev.map((i) => i.id));
            const uniqueNew = response.items.filter((i) => !seen.has(i.id));
            return [...prev, ...uniqueNew];
          });
        } else {
          setItems(response.items);
        }

        setPage(response.page);
        setTotalPages(response.totalPages);
        setTotalResults(response.totalResults);
      } catch (err: any) {
        if (err?.name === 'AbortError') return;
        setError(err.message || 'Unable to load catalogue results.');
      } finally {
        setIsLoading(false);
        setIsLoadingMore(false);
      }
    },
    [category, selectedType, selectedGenre, selectedMood, sortBy, minRating, debouncedQuery, onRegisterMedia]
  );

  // Reload page 1 whenever filters or debounced search query change
  useEffect(() => {
    const controller = new AbortController();
    loadCataloguePage(1, 'replace', controller.signal);
    return () => controller.abort();
  }, [loadCataloguePage]);

  const handleLoadMore = () => {
    if (page < totalPages && !isLoadingMore) {
      loadCataloguePage(page + 1, 'append');
    }
  };

  const handleJumpToPage = (nextPage: number) => {
    if (nextPage >= 1 && nextPage <= totalPages && !isLoading) {
      loadCataloguePage(nextPage, 'replace');
      window.scrollTo({ top: 180, behavior: 'smooth' });
    }
  };

  const resetFilters = () => {
    setSearchInput('');
    setDebouncedQuery('');
    setCategory('discover');
    setSelectedMood('all');
    setSelectedGenre('All');
    setSelectedType('all');
    setSortBy('popularity');
    setMinRating(0);
  };

  const activeFilterCount =
    (debouncedQuery ? 1 : 0) +
    (category !== 'discover' ? 1 : 0) +
    (selectedMood !== 'all' ? 1 : 0) +
    (selectedGenre !== 'All' ? 1 : 0) +
    (selectedType !== 'all' ? 1 : 0) +
    (minRating > 0 ? 1 : 0);

  const currentMoodObj = MOODS.find((m) => m.id === selectedMood);

  return (
    <div className="space-y-7 pb-16">
      {/* Page Title & Debounced Search Header */}
      <div className="space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-3">
          <div>
            <h1 className="font-['Outfit'] text-3xl font-extrabold text-white tracking-tight">
              Discover & Explore Catalogue
            </h1>
            <p className="text-sm text-slate-400 mt-1">
              Browse hundreds of movies and television series across genres, moods, and eras
            </p>
          </div>
        </div>

        {/* In-page Debounced Search Bar */}
        <div className="relative max-w-2xl">
          <Search className="w-5 h-5 text-amber-400 absolute left-4 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            placeholder="Search movies and TV shows by title, director, actor, or keyword..."
            className="w-full pl-12 pr-20 py-3 bg-slate-900/90 border border-white/10 rounded-xl text-white placeholder:text-slate-500 text-sm focus:outline-none focus:border-amber-400/60 shadow-inner"
          />
          {searchInput && (
            <button
              onClick={() => {
                setSearchInput('');
                setDebouncedQuery('');
              }}
              className="absolute right-3.5 top-1/2 -translate-y-1/2 text-xs text-slate-400 hover:text-white px-2 py-1 rounded bg-white/5"
            >
              Clear
            </button>
          )}
        </div>
      </div>

      {/* Category Preset Strip (Trending, Popular Movies, Upcoming, Popular TV, Top Rated) */}
      <div className="flex items-center gap-2 overflow-x-auto pb-1 max-w-full">
        {CATEGORY_TABS.map((tab) => {
          const isActive = category === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => {
                setCategory(tab.id);
                if (tab.id.includes('movies')) setSelectedType('movie');
                else if (tab.id.includes('_tv')) setSelectedType('tv');
                else setSelectedType('all');
              }}
              className={`px-3.5 py-2 text-xs font-semibold rounded-xl transition-all whitespace-nowrap shrink-0 ${
                isActive
                  ? 'bg-white text-slate-950 shadow-sm'
                  : 'bg-slate-900/80 text-slate-400 hover:text-white border border-white/5'
              }`}
            >
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* Mood Exploration Strip */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <span className="text-xs uppercase tracking-wider text-slate-400 font-semibold flex items-center gap-1.5">
            <Sparkles className="w-3.5 h-3.5 text-amber-400" />
            <span>Curated Moods</span>
          </span>
          {currentMoodObj && selectedMood !== 'all' && (
            <span className="text-xs text-amber-300/80 italic hidden sm:inline-block">
              "{currentMoodObj.description}"
            </span>
          )}
        </div>
        <div className="flex items-center gap-2 overflow-x-auto pb-1 max-w-full">
          {MOODS.map((m) => {
            const isSelected = selectedMood === m.id;
            return (
              <button
                key={m.id}
                onClick={() => setSelectedMood(m.id)}
                className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors whitespace-nowrap shrink-0 ${
                  isSelected
                    ? 'bg-amber-500 text-slate-950 font-semibold shadow-sm shadow-amber-500/20'
                    : 'bg-slate-900/80 text-slate-400 hover:text-white border border-white/5'
                }`}
              >
                {m.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Filter Control Ribbon: Type, Genre, Rating & Sort */}
      <div className="p-4 rounded-xl bg-slate-900/70 border border-white/5 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-4">
          {/* Format Type Segmented Control */}
          <div className="flex items-center gap-1 p-1 bg-black/40 rounded-lg border border-white/5">
            <button
              onClick={() => {
                setSelectedType('all');
                if (category !== 'discover' && category !== 'trending') setCategory('discover');
              }}
              className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap ${
                selectedType === 'all'
                  ? 'bg-white/20 text-white shadow-sm'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              All Formats
            </button>
            <button
              onClick={() => {
                setSelectedType('movie');
                if (category.includes('_tv')) setCategory('discover');
              }}
              className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap ${
                selectedType === 'movie'
                  ? 'bg-white/20 text-white shadow-sm'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              Movies Only
            </button>
            <button
              onClick={() => {
                setSelectedType('tv');
                if (category.includes('movies')) setCategory('discover');
              }}
              className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap ${
                selectedType === 'tv'
                  ? 'bg-white/20 text-white shadow-sm'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              TV Series
            </button>
          </div>

          {/* Min Rating Selector */}
          <div className="flex items-center gap-2 text-xs">
            <span className="text-slate-400">Min Rating:</span>
            <div className="flex items-center gap-1 bg-black/40 p-1 rounded-lg border border-white/5">
              {[0, 7.5, 8.0, 8.5].map((val) => (
                <button
                  key={val}
                  onClick={() => setMinRating(val)}
                  className={`px-2 py-1 rounded text-xs font-mono transition-colors ${
                    minRating === val
                      ? 'bg-amber-500/20 text-amber-300 font-bold border border-amber-500/30'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  {val === 0 ? 'Any' : `${val}+ ★`}
                </button>
              ))}
            </div>
          </div>

          {/* Sort By Dropdown */}
          <div className="flex items-center gap-2 text-xs">
            <span className="text-slate-400">Sort by:</span>
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as any)}
              className="bg-black/60 border border-white/10 text-slate-200 rounded-lg px-2.5 py-1.5 text-xs focus:outline-none focus:border-amber-400"
            >
              <option value="popularity">Popularity / Trending</option>
              <option value="rating">Consensus Rating</option>
              <option value="year">Release Year (Newest)</option>
              <option value="title">Alphabetical (A-Z)</option>
            </select>
          </div>

          {/* Reset Filters Action */}
          {activeFilterCount > 0 && (
            <button
              onClick={resetFilters}
              className="flex items-center gap-1 text-xs text-slate-400 hover:text-amber-400 transition-colors"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Reset Filters</span>
            </button>
          )}
        </div>

        {/* Genre Filter Tabs */}
        <div className="flex items-center gap-1.5 overflow-x-auto pt-1 max-w-full">
          <span className="text-xs text-slate-500 font-medium mr-1 shrink-0">Genre:</span>
          {GENRES.map((g) => {
            const isSelected = selectedGenre === g;
            return (
              <button
                key={g}
                onClick={() => setSelectedGenre(g)}
                className={`px-2.5 py-1 text-xs rounded transition-colors whitespace-nowrap shrink-0 ${
                  isSelected
                    ? 'bg-white text-slate-950 font-semibold'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-white/5'
                }`}
              >
                {g}
              </button>
            );
          })}
        </div>
      </div>

      {/* Results Summary & Top Page Switcher */}
      <div className="flex flex-wrap items-center justify-between gap-3 text-xs text-slate-400">
        <div>
          Showing <strong className="text-white font-mono tabular-nums">{items.length}</strong> of{' '}
          <strong className="text-white font-mono tabular-nums">{totalResults}</strong> matching titles
          <span className="mx-2 text-slate-600">·</span>
          <span>
            Page <strong className="text-white font-mono tabular-nums">{page}</strong> of{' '}
            <strong className="text-white font-mono tabular-nums">{totalPages}</strong>
          </span>
        </div>

        {totalPages > 1 && (
          <div className="flex items-center gap-2">
            <button
              onClick={() => handleJumpToPage(page - 1)}
              disabled={page <= 1 || isLoading}
              className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-slate-900 border border-white/10 text-slate-300 hover:text-white disabled:opacity-40 disabled:pointer-events-none transition-colors"
            >
              <ChevronLeft className="w-3.5 h-3.5" />
              <span>Prev</span>
            </button>
            <span className="font-mono text-slate-300 px-1 tabular-nums">
              {page} / {totalPages}
            </span>
            <button
              onClick={() => handleJumpToPage(page + 1)}
              disabled={page >= totalPages || isLoading}
              className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-slate-900 border border-white/10 text-slate-300 hover:text-white disabled:opacity-40 disabled:pointer-events-none transition-colors"
            >
              <span>Next</span>
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>
        )}
      </div>

      {/* Error State */}
      {error && (
        <div className="p-5 rounded-xl bg-red-500/10 border border-red-500/30 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3 text-xs text-red-200">
            <AlertCircle className="w-5 h-5 text-red-400 shrink-0" />
            <span>{error}</span>
          </div>
          <button
            onClick={() => loadCataloguePage(page, 'replace')}
            className="px-3 py-1.5 rounded-lg bg-red-500/20 hover:bg-red-500/30 text-red-200 text-xs font-semibold shrink-0"
          >
            Retry
          </button>
        </div>
      )}

      {/* Loading Skeleton Grid */}
      {isLoading ? (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4 sm:gap-6">
          {Array.from({ length: 8 }).map((_, idx) => (
            <div key={idx} className="space-y-2.5 animate-pulse">
              <div className="aspect-[2/3] w-full rounded-xl bg-slate-900 border border-white/5" />
              <div className="h-3 w-2/3 bg-slate-800 rounded" />
              <div className="h-4 w-4/5 bg-slate-800 rounded" />
            </div>
          ))}
        </div>
      ) : items.length === 0 ? (
        /* Empty State */
        <div className="py-20 text-center rounded-2xl border border-white/5 bg-slate-900/40">
          <Film className="w-12 h-12 mx-auto stroke-1 text-slate-600 mb-3" />
          <h3 className="font-['Outfit'] text-lg font-bold text-white">No matching titles found</h3>
          <p className="text-xs text-slate-400 max-w-sm mx-auto mt-1">
            Try adjusting your search keywords, loosening the minimum rating, or resetting active filters.
          </p>
          <button
            onClick={resetFilters}
            className="mt-4 px-4 py-2 rounded-lg bg-amber-500 text-black font-semibold text-xs hover:bg-amber-400"
          >
            Clear All Filters
          </button>
        </div>
      ) : (
        <>
          {/* Results Grid */}
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4 sm:gap-6">
            {items.map((item) => (
              <MediaCard
                key={item.id}
                media={item}
                isInWatchlist={isInWatchlist(item.id)}
                onToggleWatchlist={(id) => onToggleWatchlist(id, item)}
                onClick={onSelectMedia}
              />
            ))}
          </div>

          {/* Pagination & Load More Controls */}
          {totalPages > 1 && (
            <div className="pt-8 border-t border-white/5 flex flex-col sm:flex-row items-center justify-between gap-4">
              <div className="text-xs text-slate-400">
                Loaded <strong className="text-white font-mono">{items.length}</strong> of{' '}
                <strong className="text-white font-mono">{totalResults}</strong> titles (Page {page} of {totalPages})
              </div>

              <div className="flex flex-wrap items-center gap-3">
                {page < totalPages && (
                  <button
                    onClick={handleLoadMore}
                    disabled={isLoadingMore}
                    className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-gradient-to-r from-amber-400 to-amber-500 hover:from-amber-300 hover:to-amber-400 text-slate-950 font-bold text-xs shadow-lg shadow-amber-500/20 transition-all hover:scale-[1.02] disabled:opacity-50"
                  >
                    {isLoadingMore ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        <span>Loading Next Page...</span>
                      </>
                    ) : (
                      <>
                        <Plus className="w-4 h-4 stroke-[2.5]" />
                        <span>Load More Titles (Page {page + 1})</span>
                      </>
                    )}
                  </button>
                )}

                <div className="flex items-center gap-1.5 bg-slate-900/90 p-1 rounded-xl border border-white/10">
                  <button
                    onClick={() => handleJumpToPage(page - 1)}
                    disabled={page <= 1 || isLoading}
                    className="px-3 py-1.5 rounded-lg text-xs font-medium text-slate-300 hover:text-white hover:bg-white/10 disabled:opacity-40 disabled:pointer-events-none transition-colors"
                  >
                    Previous Page
                  </button>
                  <span className="px-2 text-xs font-mono text-amber-400 font-semibold tabular-nums">
                    Page {page} / {totalPages}
                  </span>
                  <button
                    onClick={() => handleJumpToPage(page + 1)}
                    disabled={page >= totalPages || isLoading}
                    className="px-3 py-1.5 rounded-lg text-xs font-medium text-slate-300 hover:text-white hover:bg-white/10 disabled:opacity-40 disabled:pointer-events-none transition-colors"
                  >
                    Next Page
                  </button>
                </div>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
};
