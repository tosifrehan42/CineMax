import React, { useState, useEffect, useCallback } from 'react';
import { MediaItem, WatchStatus } from '../types';
import { MOODS, GENRES } from '../data/mediaData';
import { MediaCard } from './MediaCard';
import { CatalogueCategory, fetchCatalogue } from '../services/mediaApi';
import { dedupeMediaItems } from '../utils/mediaIntegrity';
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
  HardDrive,
  X,
  SlidersHorizontal,
} from 'lucide-react';

interface DiscoverViewProps {
  isInWatchlist: (id: string) => boolean;
  getWatchlistStatus?: (id: string) => WatchStatus | undefined;
  onToggleWatchlist: (id: string, media?: MediaItem) => void;
  onUpdateStatus?: (id: string, status: WatchStatus, media?: MediaItem) => void;
  onRemoveFromWatchlist?: (id: string) => void;
  getWatchedEpisodesCount?: (id: string) => number;
  onSelectMedia: (media: MediaItem) => void;
  onPlayTrailer?: (media: MediaItem) => void;
  onOpenEstimator?: () => void;
  initialMood?: string;
  initialCategory?: CatalogueCategory;
  initialGenre?: string;
  onRegisterMedia?: (items: MediaItem[]) => void;
}

const CATEGORY_TABS: Array<{ id: CatalogueCategory; label: string }> = [
  { id: 'discover', label: 'All Catalogue' },
  { id: 'trending', label: 'Trending Global' },
  { id: 'trending_india', label: 'Trending in India' },
  { id: 'now_playing_movies', label: 'Now Playing' },
  { id: 'recently_released', label: 'Recently Released' },
  { id: 'popular_movies', label: 'Popular Movies' },
  { id: 'popular_tv', label: 'Popular Series' },
  { id: 'top_rated_movies', label: 'Top Rated Movies' },
  { id: 'top_rated_tv', label: 'Top Rated Series' },
  { id: 'upcoming_movies', label: 'New & Upcoming' },
  { id: 'hindi_movies', label: 'Hindi Cinema' },
  { id: 'south_indian_cinema', label: 'South Indian Cinema' },
  { id: 'anime', label: 'Anime & Animation' },
  { id: 'documentaries', label: 'Documentaries' },
];

const RELEASE_YEAR_OPTIONS: Array<{ value: string; label: string }> = [
  { value: 'All', label: 'All Years' },
  { value: '2025-2026', label: '2025 – 2026' },
  { value: '2024', label: '2024' },
  { value: '2020-2023', label: '2020 – 2023' },
  { value: '2010-2019', label: '2010 – 2019' },
  { value: '2000-2009', label: '2000 – 2009' },
  { value: 'classic', label: 'Classic (< 2000)' },
];

const LANGUAGE_OPTIONS: Array<{ value: string; label: string }> = [
  { value: 'all', label: 'All Languages' },
  { value: 'en', label: 'English' },
  { value: 'hi', label: 'Hindi' },
  { value: 'te', label: 'Telugu' },
  { value: 'ta', label: 'Tamil' },
  { value: 'ml', label: 'Malayalam' },
  { value: 'kn', label: 'Kannada' },
  { value: 'ko', label: 'Korean' },
  { value: 'ja', label: 'Japanese' },
  { value: 'es', label: 'Spanish' },
  { value: 'fr', label: 'French' },
];

const RATING_OPTIONS: Array<{ value: number; label: string }> = [
  { value: 0, label: 'Any Rating' },
  { value: 7.0, label: '7.0+ ★' },
  { value: 7.5, label: '7.5+ ★' },
  { value: 8.0, label: '8.0+ ★' },
  { value: 8.5, label: '8.5+ ★' },
];

const DiscoverViewComponent: React.FC<DiscoverViewProps> = ({
  isInWatchlist,
  getWatchlistStatus,
  onToggleWatchlist,
  onUpdateStatus,
  onRemoveFromWatchlist,
  getWatchedEpisodesCount,
  onSelectMedia,
  onPlayTrailer,
  onOpenEstimator,
  initialMood = 'all',
  initialCategory = 'discover',
  initialGenre = 'All',
  onRegisterMedia,
}) => {
  const [searchInput, setSearchInput] = useState('');
  const [debouncedQuery, setDebouncedQuery] = useState('');
  const [category, setCategory] = useState<CatalogueCategory>(initialCategory);
  const [selectedMood, setSelectedMood] = useState(initialMood);
  const [selectedGenre, setSelectedGenre] = useState(initialGenre);
  const [selectedYear, setSelectedYear] = useState('All');
  const [selectedLanguage, setSelectedLanguage] = useState('all');
  const [selectedType, setSelectedType] = useState<'all' | 'movie' | 'tv'>(() => {
    if (initialCategory.includes('movies')) return 'movie';
    if (initialCategory.includes('_tv')) return 'tv';
    return 'all';
  });
  const [sortBy, setSortBy] = useState<
    'relevance' | 'popularity' | 'rating' | 'year' | 'title'
  >('popularity');
  const [minRating, setMinRating] = useState<number>(0);

  const [items, setItems] = useState<MediaItem[]>([]);
  const [page, setPage] = useState<number>(1);
  const [totalPages, setTotalPages] = useState<number>(1);
  const [totalResults, setTotalResults] = useState<number>(0);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isLoadingMore, setIsLoadingMore] = useState<boolean>(false);
  const [isRefreshing, setIsRefreshing] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const requestIdRef = React.useRef(0);

  // Sync external initial props
  useEffect(() => {
    setSelectedMood(initialMood);
  }, [initialMood]);

  useEffect(() => {
    if (initialGenre) {
      setSelectedGenre(initialGenre);
    }
  }, [initialGenre]);

  useEffect(() => {
    setCategory(initialCategory);
    if (initialCategory.includes('movies')) {
      setSelectedType('movie');
    } else if (initialCategory.includes('_tv')) {
      setSelectedType('tv');
    } else {
      setSelectedType('all');
    }
  }, [initialCategory]);

  // Debounce search input (250ms) and auto-switch sort to relevance when typing a query
  useEffect(() => {
    const timer = setTimeout(() => {
      const trimmed = searchInput.trim();
      setDebouncedQuery((prev) => {
        if (!prev && trimmed) {
          setSortBy('relevance');
        } else if (prev && !trimmed && sortBy === 'relevance') {
          setSortBy('popularity');
        }
        return trimmed;
      });
    }, 250);
    return () => clearTimeout(timer);
  }, [searchInput, sortBy]);

  const loadCataloguePage = useCallback(
    async (
      targetPage: number,
      mode: 'replace' | 'append',
      signal?: AbortSignal,
      forceRefresh = false
    ) => {
      const currentReqId = ++requestIdRef.current;
      try {
        if (forceRefresh) {
          setIsRefreshing(true);
        }
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
            year: selectedYear,
            language: selectedLanguage,
            sortBy,
            minRating,
            query: debouncedQuery,
            refresh: forceRefresh,
          },
          signal
        );

        if (signal?.aborted || currentReqId !== requestIdRef.current) return;

        if (onRegisterMedia && response.items.length > 0) {
          onRegisterMedia(response.items);
        }

        const uniqueResponseItems = dedupeMediaItems(response.items);

        if (mode === 'append') {
          setItems((prev) => dedupeMediaItems([...prev, ...uniqueResponseItems]));
        } else {
          setItems(uniqueResponseItems);
        }

        setPage(response.page);
        setTotalPages(response.totalPages);
        setTotalResults(response.totalResults);
      } catch (err: any) {
        if (
          err?.name === 'AbortError' ||
          signal?.aborted ||
          currentReqId !== requestIdRef.current
        ) {
          return;
        }
        setError(err.message || 'Unable to load catalogue results.');
      } finally {
        if (!signal?.aborted && currentReqId === requestIdRef.current) {
          setIsLoading(false);
          setIsLoadingMore(false);
          setIsRefreshing(false);
        }
      }
    },
    [
      category,
      selectedType,
      selectedGenre,
      selectedMood,
      selectedYear,
      selectedLanguage,
      sortBy,
      minRating,
      debouncedQuery,
      onRegisterMedia,
    ]
  );

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
      window.scrollTo({ top: 160, behavior: 'smooth' });
    }
  };

  const resetFilters = () => {
    setSearchInput('');
    setDebouncedQuery('');
    setCategory('discover');
    setSelectedMood('all');
    setSelectedGenre('All');
    setSelectedYear('All');
    setSelectedLanguage('all');
    setSelectedType('all');
    setSortBy('popularity');
    setMinRating(0);
  };

  // Build active filter chips for quick dismissal
  const activeChips: Array<{ key: string; label: string; onClear: () => void }> = [];
  if (debouncedQuery) {
    activeChips.push({
      key: 'query',
      label: `Search: "${debouncedQuery}"`,
      onClear: () => {
        setSearchInput('');
        setDebouncedQuery('');
      },
    });
  }
  if (category !== 'discover') {
    const catLabel = CATEGORY_TABS.find((c) => c.id === category)?.label || category;
    activeChips.push({
      key: 'category',
      label: `Collection: ${catLabel}`,
      onClear: () => setCategory('discover'),
    });
  }
  if (selectedType !== 'all') {
    activeChips.push({
      key: 'type',
      label: `Format: ${selectedType === 'movie' ? 'Movies' : 'Series'}`,
      onClear: () => setSelectedType('all'),
    });
  }
  if (selectedGenre !== 'All') {
    activeChips.push({
      key: 'genre',
      label: `Genre: ${selectedGenre}`,
      onClear: () => setSelectedGenre('All'),
    });
  }
  if (selectedYear !== 'All') {
    const yLabel =
      RELEASE_YEAR_OPTIONS.find((y) => y.value === selectedYear)?.label || selectedYear;
    activeChips.push({
      key: 'year',
      label: `Year: ${yLabel}`,
      onClear: () => setSelectedYear('All'),
    });
  }
  if (selectedLanguage !== 'all') {
    const lLabel =
      LANGUAGE_OPTIONS.find((l) => l.value === selectedLanguage)?.label ||
      selectedLanguage.toUpperCase();
    activeChips.push({
      key: 'language',
      label: `Language: ${lLabel}`,
      onClear: () => setSelectedLanguage('all'),
    });
  }
  if (minRating > 0) {
    activeChips.push({
      key: 'rating',
      label: `Rating: ${minRating}+ ★`,
      onClear: () => setMinRating(0),
    });
  }
  if (selectedMood !== 'all') {
    const mLabel = MOODS.find((m) => m.id === selectedMood)?.label || selectedMood;
    activeChips.push({
      key: 'mood',
      label: `Mood: ${mLabel}`,
      onClear: () => setSelectedMood('all'),
    });
  }

  return (
    <div className="space-y-6 pb-16">
      {/* Top Header + Quality & File Size Estimator Shortcut */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div>
          <h1 className="font-['Plus_Jakarta_Sans'] text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
            Discover & Explore Catalogue
          </h1>
          <p className="text-xs sm:text-sm text-slate-400 mt-1">
            Filter movies and series by format, genre, release era, language, and consensus rating
          </p>
        </div>

        {/* Prominent Quality & File Size Estimator Shortcut */}
        {onOpenEstimator && (
          <button
            type="button"
            onClick={onOpenEstimator}
            className="flex items-center justify-between sm:justify-start gap-3 px-4 py-2.5 rounded-xl bg-gradient-to-r from-amber-500/15 via-amber-500/10 to-transparent hover:from-amber-500/25 border border-amber-500/30 text-left transition-all group shrink-0"
          >
            <div className="w-8 h-8 rounded-lg bg-amber-500/20 border border-amber-400/40 flex items-center justify-center text-amber-400 shrink-0">
              <HardDrive className="w-4 h-4" />
            </div>
            <div>
              <div className="text-xs font-bold text-white group-hover:text-amber-300 flex items-center gap-1">
                <span>Quality &amp; File Size Estimator</span>
                <ChevronRight className="w-3.5 h-3.5 text-amber-400 group-hover:translate-x-0.5 transition-transform" />
              </div>
              <div className="text-[11px] text-slate-400">
                Compare 4K UHD, 1080p &amp; HDR data usage for any title
              </div>
            </div>
          </button>
        )}
      </div>

      {/* Debounced Search Bar */}
      <div className="relative">
        <Search className="w-5 h-5 text-amber-400 absolute left-4 top-1/2 -translate-y-1/2" />
        <input
          type="text"
          value={searchInput}
          onChange={(e) => setSearchInput(e.target.value)}
          placeholder="Search movies and series by title, director, cast, or keyword..."
          className="w-full pl-12 pr-20 py-3.5 bg-[#121721] border border-white/10 rounded-xl text-white placeholder:text-slate-500 text-sm focus:outline-none focus:border-amber-400/60 shadow-inner"
        />
        {searchInput && (
          <button
            type="button"
            onClick={() => {
              setSearchInput('');
              setDebouncedQuery('');
            }}
            className="absolute right-3.5 top-1/2 -translate-y-1/2 text-xs text-slate-300 hover:text-white px-2.5 py-1 rounded-lg bg-white/10"
          >
            Clear
          </button>
        )}
      </div>

      {/* Category Preset Strip */}
      <div className="flex items-center gap-2 overflow-x-auto pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {CATEGORY_TABS.map((tab) => {
          const isActive = category === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => {
                setCategory(tab.id);
                if (tab.id.includes('movies')) setSelectedType('movie');
                else if (tab.id.includes('_tv')) setSelectedType('tv');
                else setSelectedType('all');
              }}
              className={`px-3.5 py-2 text-xs font-semibold rounded-xl transition-all whitespace-nowrap shrink-0 ${
                isActive
                  ? 'bg-amber-500 text-slate-950 shadow-sm shadow-amber-500/20'
                  : 'bg-[#121721] text-slate-400 hover:text-white border border-white/[0.07]'
              }`}
            >
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* Compact Inline Filter Bar: Format, Genre, Release Year, Language, Rating, Sort */}
      <div className="p-4 rounded-2xl bg-[#121721]/90 border border-white/[0.08] space-y-3.5">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-3">
          {/* 1. Format Segmented Toggle */}
          <div className="flex flex-col gap-1">
            <label className="text-[11px] font-medium text-slate-400 flex items-center gap-1">
              <SlidersHorizontal className="w-3 h-3 text-amber-400" />
              <span>Format</span>
            </label>
            <div className="grid grid-cols-3 p-0.5 bg-black/50 rounded-lg border border-white/10">
              {(
                [
                  { id: 'all', label: 'All' },
                  { id: 'movie', label: 'Movies' },
                  { id: 'tv', label: 'Series' },
                ] as const
              ).map((fmt) => (
                <button
                  key={fmt.id}
                  type="button"
                  onClick={() => {
                    setSelectedType(fmt.id);
                    if (
                      (fmt.id === 'movie' && category.includes('_tv')) ||
                      (fmt.id === 'tv' && category.includes('movies'))
                    ) {
                      setCategory('discover');
                    }
                  }}
                  className={`py-1.5 text-xs font-semibold rounded-md transition-colors ${
                    selectedType === fmt.id
                      ? 'bg-amber-500 text-slate-950'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  {fmt.label}
                </button>
              ))}
            </div>
          </div>

          {/* 2. Genre Dropdown */}
          <div className="flex flex-col gap-1">
            <label htmlFor="discover-genre" className="text-[11px] font-medium text-slate-400">
              Genre
            </label>
            <select
              id="discover-genre"
              value={selectedGenre}
              onChange={(e) => setSelectedGenre(e.target.value)}
              className="bg-black/50 border border-white/10 text-slate-100 rounded-lg px-3 py-2 text-xs focus:outline-none focus:border-amber-400"
            >
              {GENRES.map((g) => (
                <option key={g} value={g} className="bg-[#0E131C]">
                  {g === 'All' ? 'All Genres' : g}
                </option>
              ))}
            </select>
          </div>

          {/* 3. Release Year Dropdown */}
          <div className="flex flex-col gap-1">
            <label htmlFor="discover-year" className="text-[11px] font-medium text-slate-400">
              Release Year
            </label>
            <select
              id="discover-year"
              value={selectedYear}
              onChange={(e) => setSelectedYear(e.target.value)}
              className="bg-black/50 border border-white/10 text-slate-100 rounded-lg px-3 py-2 text-xs focus:outline-none focus:border-amber-400"
            >
              {RELEASE_YEAR_OPTIONS.map((yr) => (
                <option key={yr.value} value={yr.value} className="bg-[#0E131C]">
                  {yr.label}
                </option>
              ))}
            </select>
          </div>

          {/* 4. Language Dropdown */}
          <div className="flex flex-col gap-1">
            <label htmlFor="discover-language" className="text-[11px] font-medium text-slate-400">
              Language
            </label>
            <select
              id="discover-language"
              value={selectedLanguage}
              onChange={(e) => setSelectedLanguage(e.target.value)}
              className="bg-black/50 border border-white/10 text-slate-100 rounded-lg px-3 py-2 text-xs focus:outline-none focus:border-amber-400"
            >
              {LANGUAGE_OPTIONS.map((lang) => (
                <option key={lang.value} value={lang.value} className="bg-[#0E131C]">
                  {lang.label}
                </option>
              ))}
            </select>
          </div>

          {/* 5. Minimum Rating Dropdown */}
          <div className="flex flex-col gap-1">
            <label htmlFor="discover-rating" className="text-[11px] font-medium text-slate-400">
              Minimum Rating
            </label>
            <select
              id="discover-rating"
              value={minRating}
              onChange={(e) => setMinRating(Number(e.target.value))}
              className="bg-black/50 border border-white/10 text-slate-100 rounded-lg px-3 py-2 text-xs focus:outline-none focus:border-amber-400"
            >
              {RATING_OPTIONS.map((rt) => (
                <option key={rt.value} value={rt.value} className="bg-[#0E131C]">
                  {rt.label}
                </option>
              ))}
            </select>
          </div>

          {/* 6. Sort By Dropdown */}
          <div className="flex flex-col gap-1">
            <label htmlFor="discover-sort" className="text-[11px] font-medium text-slate-400">
              Sort Results By
            </label>
            <select
              id="discover-sort"
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as any)}
              className="bg-black/50 border border-white/10 text-slate-100 rounded-lg px-3 py-2 text-xs focus:outline-none focus:border-amber-400"
            >
              {debouncedQuery && (
                <option value="relevance" className="bg-[#0E131C]">
                  Search Relevance
                </option>
              )}
              <option value="popularity" className="bg-[#0E131C]">
                Popularity
              </option>
              <option value="rating" className="bg-[#0E131C]">
                Highest Rated
              </option>
              <option value="year" className="bg-[#0E131C]">
                Release Date (Newest)
              </option>
              <option value="title" className="bg-[#0E131C]">
                Title (A – Z)
              </option>
            </select>
          </div>
        </div>

        {/* Mood Quick Filter Pills */}
        <div className="pt-2 border-t border-white/[0.06] flex items-center gap-2 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          <span className="text-[11px] text-slate-400 font-semibold flex items-center gap-1 shrink-0">
            <Sparkles className="w-3 h-3 text-amber-400" />
            <span>Mood:</span>
          </span>
          {MOODS.map((m) => {
            const isSelected = selectedMood === m.id;
            return (
              <button
                key={m.id}
                type="button"
                onClick={() => setSelectedMood(m.id)}
                className={`px-2.5 py-1 text-xs font-medium rounded-lg transition-colors whitespace-nowrap shrink-0 ${
                  isSelected
                    ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40 font-semibold'
                    : 'bg-black/30 text-slate-400 hover:text-white border border-white/[0.05]'
                }`}
              >
                {m.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Active Filter Chips Bar */}
      {activeChips.length > 0 && (
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs text-slate-400 mr-1">Active Filters:</span>
          {activeChips.map((chip) => (
            <span
              key={chip.key}
              className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-amber-500/15 border border-amber-500/30 text-xs font-medium text-amber-200"
            >
              <span>{chip.label}</span>
              <button
                type="button"
                onClick={chip.onClear}
                aria-label={`Remove ${chip.label} filter`}
                className="text-amber-300 hover:text-white"
              >
                <X className="w-3 h-3" />
              </button>
            </span>
          ))}
          <button
            type="button"
            onClick={resetFilters}
            className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-white/5 hover:bg-white/10 text-xs font-semibold text-slate-300 hover:text-white border border-white/10 transition-colors"
          >
            <RotateCcw className="w-3 h-3 text-amber-400" />
            <span>Clear All</span>
          </button>
        </div>
      )}

      {/* Results Summary & Top Pagination */}
      <div className="flex flex-wrap items-center justify-between gap-3 text-xs text-slate-400">
        <div className="flex flex-wrap items-center gap-2">
          <span>
            Showing <strong className="text-white font-mono tabular-nums">{items.length}</strong> of{' '}
            <strong className="text-white font-mono tabular-nums">{totalResults}</strong> matching
            titles
          </span>
          <span className="text-slate-600">·</span>
          <span>
            Page <strong className="text-white font-mono tabular-nums">{page}</strong> of{' '}
            <strong className="text-white font-mono tabular-nums">{totalPages}</strong>
          </span>
          <button
            type="button"
            onClick={() => loadCataloguePage(page, 'replace', undefined, true)}
            disabled={isLoading || isRefreshing}
            className="ml-1 inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-[#121721] hover:bg-[#19202E] border border-white/10 text-slate-300 hover:text-white transition-colors disabled:opacity-40"
            title="Refresh live catalogue results"
          >
            <RotateCcw className={`w-3 h-3 text-amber-400 ${isRefreshing ? 'animate-spin' : ''}`} />
            <span>{isRefreshing ? 'Refreshing…' : 'Refresh'}</span>
          </button>
        </div>

        {totalPages > 1 && (
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => handleJumpToPage(page - 1)}
              disabled={page <= 1 || isLoading}
              className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-[#121721] border border-white/10 text-slate-300 hover:text-white disabled:opacity-40 disabled:pointer-events-none transition-colors"
            >
              <ChevronLeft className="w-3.5 h-3.5" />
              <span>Prev</span>
            </button>
            <span className="font-mono text-slate-300 px-1 tabular-nums">
              {page} / {totalPages}
            </span>
            <button
              type="button"
              onClick={() => handleJumpToPage(page + 1)}
              disabled={page >= totalPages || isLoading}
              className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-[#121721] border border-white/10 text-slate-300 hover:text-white disabled:opacity-40 disabled:pointer-events-none transition-colors"
            >
              <span>Next</span>
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>
        )}
      </div>

      {/* Error Banner */}
      {error && (
        <div className="p-4 rounded-xl bg-red-500/10 border border-red-500/30 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3 text-xs text-red-200">
            <AlertCircle className="w-5 h-5 text-red-400 shrink-0" />
            <span>{error}</span>
          </div>
          <button
            type="button"
            onClick={() => loadCataloguePage(page, 'replace')}
            className="px-3 py-1.5 rounded-lg bg-red-500/20 hover:bg-red-500/30 text-red-200 text-xs font-semibold shrink-0"
          >
            Retry
          </button>
        </div>
      )}

      {/* Loading Skeleton Grid */}
      {isLoading ? (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4 sm:gap-5">
          {Array.from({ length: 12 }).map((_, idx) => (
            <div key={idx} className="space-y-2 animate-pulse">
              <div className="aspect-[2/3] w-full rounded-xl bg-[#121721] border border-white/5" />
              <div className="h-3.5 w-3/4 bg-slate-800 rounded" />
              <div className="h-3 w-1/2 bg-slate-800/70 rounded" />
            </div>
          ))}
        </div>
      ) : items.length === 0 ? (
        /* Empty State */
        <div className="py-16 px-4 text-center rounded-2xl border border-white/[0.07] bg-[#121721]/50">
          <Film className="w-12 h-12 mx-auto stroke-1 text-slate-500 mb-3" />
          <h3 className="font-['Plus_Jakarta_Sans'] text-lg font-bold text-white">
            No matching titles found
          </h3>
          <p className="text-xs text-slate-400 max-w-md mx-auto mt-1">
            No movies or series matched your current combination of filters. Try clearing one of the
            active filter chips or resetting all filters.
          </p>
          <button
            type="button"
            onClick={resetFilters}
            className="mt-4 px-4 py-2 rounded-xl bg-amber-500 text-slate-950 font-bold text-xs hover:bg-amber-400 transition-colors"
          >
            Clear All Filters
          </button>
        </div>
      ) : (
        <>
          {/* Responsive OTT Poster Grid (2 cols mobile -> 6 cols desktop) */}
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4 sm:gap-5">
            {items.map((item) => (
              <MediaCard
                key={item.id}
                media={item}
                compact={true}
                isInWatchlist={isInWatchlist(item.id)}
                watchlistStatus={getWatchlistStatus?.(item.id)}
                onToggleWatchlist={onToggleWatchlist}
                onUpdateStatus={onUpdateStatus}
                onRemoveFromWatchlist={onRemoveFromWatchlist}
                watchedEpisodesCount={getWatchedEpisodesCount?.(item.id)}
                onClick={onSelectMedia}
                onPlayTrailer={onPlayTrailer}
              />
            ))}
          </div>

          {/* Bottom Load More & Pagination */}
          {totalPages > 1 && (
            <div className="pt-8 border-t border-white/[0.07] flex flex-col sm:flex-row items-center justify-between gap-4">
              <div className="text-xs text-slate-400">
                Loaded <strong className="text-white font-mono">{items.length}</strong> of{' '}
                <strong className="text-white font-mono">{totalResults}</strong> titles (Page {page}{' '}
                of {totalPages})
              </div>

              <div className="flex flex-wrap items-center gap-3">
                {page < totalPages && (
                  <button
                    type="button"
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

                <div className="flex items-center gap-1.5 bg-[#121721] p-1 rounded-xl border border-white/10">
                  <button
                    type="button"
                    onClick={() => handleJumpToPage(page - 1)}
                    disabled={page <= 1 || isLoading}
                    className="px-3 py-1.5 rounded-lg text-xs font-medium text-slate-300 hover:text-white hover:bg-white/10 disabled:opacity-40 disabled:pointer-events-none transition-colors"
                  >
                    Previous
                  </button>
                  <span className="px-2 text-xs font-mono text-amber-400 font-semibold tabular-nums">
                    {page} / {totalPages}
                  </span>
                  <button
                    type="button"
                    onClick={() => handleJumpToPage(page + 1)}
                    disabled={page >= totalPages || isLoading}
                    className="px-3 py-1.5 rounded-lg text-xs font-medium text-slate-300 hover:text-white hover:bg-white/10 disabled:opacity-40 disabled:pointer-events-none transition-colors"
                  >
                    Next
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

export const DiscoverView = React.memo(DiscoverViewComponent);
