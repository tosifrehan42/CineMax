import React, { useState, useEffect, useRef, useCallback } from 'react';
import { MediaItem } from '../types';
import { MediaPoster } from './MediaPoster';
import { fetchCatalogue } from '../services/mediaApi';
import { Search, X, Star, Film, ArrowRight, Loader2, Plus, AlertCircle } from 'lucide-react';

interface SearchOverlayProps {
  isOpen: boolean;
  onClose: () => void;
  items: MediaItem[];
  onSelectMedia: (media: MediaItem) => void;
  onRegisterMedia?: (items: MediaItem[]) => void;
}

export const SearchOverlay: React.FC<SearchOverlayProps> = ({
  isOpen,
  onClose,
  items,
  onSelectMedia,
  onRegisterMedia,
}) => {
  const [query, setQuery] = useState('');
  const [debouncedQuery, setDebouncedQuery] = useState('');
  const [typeFilter, setTypeFilter] = useState<'all' | 'movie' | 'tv'>('all');
  const [results, setResults] = useState<MediaItem[]>(items);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalResults, setTotalResults] = useState(items.length);
  const [isLoading, setIsLoading] = useState(false);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const inputRef = useRef<HTMLInputElement>(null);
  const requestIdRef = useRef(0);

  useEffect(() => {
    if (isOpen) {
      setTimeout(() => inputRef.current?.focus(), 50);
    } else {
      setQuery('');
      setDebouncedQuery('');
      setError(null);
    }
  }, [isOpen]);

  // Debounce search query (300ms)
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedQuery(query.trim());
    }, 300);
    return () => clearTimeout(timer);
  }, [query]);

  const executeSearch = useCallback(
    async (signal?: AbortSignal) => {
      const currentReqId = ++requestIdRef.current;
      setIsLoading(true);
      setError(null);
      try {
        const res = await fetchCatalogue(
          {
            category: 'discover',
            query: debouncedQuery,
            type: typeFilter,
            page: 1,
          },
          signal
        );
        if (signal?.aborted || currentReqId !== requestIdRef.current) return;

        if (onRegisterMedia && res.items.length > 0) {
          onRegisterMedia(res.items);
        }
        setResults(res.items);
        setPage(res.page);
        setTotalPages(res.totalPages);
        setTotalResults(res.totalResults);
      } catch (err: any) {
        if (err?.name === 'AbortError' || signal?.aborted || currentReqId !== requestIdRef.current) {
          return;
        }
        setError(err?.message || 'Unable to fetch search results from server.');
      } finally {
        if (!signal?.aborted && currentReqId === requestIdRef.current) {
          setIsLoading(false);
        }
      }
    },
    [debouncedQuery, typeFilter, onRegisterMedia]
  );

  // Fetch live search results when debouncedQuery or typeFilter changes
  useEffect(() => {
    if (!isOpen) return;
    const controller = new AbortController();
    executeSearch(controller.signal);
    return () => controller.abort();
  }, [isOpen, executeSearch]);

  const handleLoadMore = async () => {
    if (page >= totalPages || isLoadingMore || isLoading) return;
    const activeReqId = requestIdRef.current;
    setIsLoadingMore(true);
    setError(null);
    try {
      const nextPage = page + 1;
      const res = await fetchCatalogue({
        category: 'discover',
        query: debouncedQuery,
        type: typeFilter,
        page: nextPage,
      });
      if (activeReqId !== requestIdRef.current) return;
      if (onRegisterMedia && res.items.length > 0) {
        onRegisterMedia(res.items);
      }
      setResults((prev) => {
        const seen = new Set(prev.map((i) => i.id));
        return [...prev, ...res.items.filter((i) => !seen.has(i.id))];
      });
      setPage(res.page || nextPage);
      setTotalPages(res.totalPages);
    } catch (err: any) {
      if (activeReqId === requestIdRef.current) {
        setError(err?.message || 'Failed to load additional results.');
      }
    } finally {
      if (activeReqId === requestIdRef.current) {
        setIsLoadingMore(false);
      }
    }
  };

  const [activeIndex, setActiveIndex] = useState<number>(-1);

  useEffect(() => {
    setActiveIndex(-1);
  }, [results]);

  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      } else if (e.key === 'ArrowDown') {
        e.preventDefault();
        setActiveIndex((prev) => (results.length > 0 ? (prev + 1) % results.length : -1));
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setActiveIndex((prev) =>
          results.length > 0 ? (prev <= 0 ? results.length - 1 : prev - 1) : -1
        );
      } else if (e.key === 'Enter' && activeIndex >= 0 && results[activeIndex]) {
        e.preventDefault();
        onClose();
        onSelectMedia(results[activeIndex]);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose, results, activeIndex, onSelectMedia]);

  if (!isOpen) return null;

  const isPendingDebounce = query.trim() !== debouncedQuery;
  const showBusy = isLoading || isPendingDebounce;

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-black/85 backdrop-blur-md flex items-start justify-center pt-16 sm:pt-24 px-4 animate-in fade-in duration-150">
      <div className="fixed inset-0" onClick={onClose} />

      <div className="relative z-10 w-full max-w-2xl bg-[#0f1118] border border-white/10 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[80vh]">
        {/* Search Bar Input */}
        <div className="flex items-center gap-3 px-5 py-4 border-b border-white/10 bg-slate-900/60">
          {showBusy ? (
            <Loader2 className="w-5 h-5 text-amber-400 animate-spin shrink-0" />
          ) : (
            <Search className="w-5 h-5 text-amber-400 shrink-0" />
          )}
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search movies and TV series across the catalogue..."
            className="w-full bg-transparent text-white placeholder:text-slate-500 text-sm focus:outline-none"
          />
          {query && (
            <button
              onClick={() => {
                setQuery('');
                setDebouncedQuery('');
              }}
              className="p-1 text-slate-400 hover:text-white rounded"
            >
              <X className="w-4 h-4" />
            </button>
          )}
          <kbd className="hidden sm:inline-block px-2 py-0.5 text-[10px] font-mono text-slate-400 bg-white/5 border border-white/10 rounded">
            ESC
          </kbd>
        </div>

        {/* Filter Tabs */}
        <div className="flex items-center justify-between px-5 py-2.5 bg-black/30 border-b border-white/5 text-xs">
          <div className="flex items-center gap-2">
            <span className="text-slate-500 font-medium mr-1">Filter:</span>
            <button
              onClick={() => setTypeFilter('all')}
              className={`px-2.5 py-1 rounded transition-colors whitespace-nowrap ${
                typeFilter === 'all'
                  ? 'bg-amber-500 text-black font-semibold'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              All Formats
            </button>
            <button
              onClick={() => setTypeFilter('movie')}
              className={`px-2.5 py-1 rounded transition-colors whitespace-nowrap ${
                typeFilter === 'movie'
                  ? 'bg-amber-500 text-black font-semibold'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              Movies
            </button>
            <button
              onClick={() => setTypeFilter('tv')}
              className={`px-2.5 py-1 rounded transition-colors whitespace-nowrap ${
                typeFilter === 'tv'
                  ? 'bg-amber-500 text-black font-semibold'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              TV Series
            </button>
          </div>
          <span className="text-slate-500 font-mono text-[11px] tabular-nums">
            {totalResults} matches
          </span>
        </div>

        {/* API Error Banner */}
        {error && (
          <div className="mx-3 mt-3 p-3 rounded-xl bg-red-500/10 border border-red-500/30 flex items-center justify-between gap-3">
            <div className="flex items-center gap-2 text-xs text-red-200">
              <AlertCircle className="w-4 h-4 text-red-400 shrink-0" />
              <span>{error}</span>
            </div>
            <button
              onClick={() => executeSearch()}
              className="px-2.5 py-1 rounded-lg bg-red-500/20 hover:bg-red-500/30 text-red-200 text-xs font-semibold shrink-0"
            >
              Retry
            </button>
          </div>
        )}

        {/* Results List */}
        <div className="overflow-y-auto divide-y divide-white/5 p-2">
          {results.length === 0 && !showBusy ? (
            <div className="py-12 text-center text-slate-500">
              <Film className="w-10 h-10 mx-auto stroke-1 opacity-40 mb-2" />
              <p className="text-sm font-medium text-slate-400">No matching titles found</p>
              <p className="text-xs text-slate-500 mt-1">Try another keyword, actor, or genre</p>
            </div>
          ) : (
            <>
              {results.map((item, idx) => (
                <div
                  key={item.id}
                  onMouseEnter={() => setActiveIndex(idx)}
                  onClick={() => {
                    onClose();
                    onSelectMedia(item);
                  }}
                  className={`group flex items-center justify-between p-3 rounded-xl cursor-pointer transition-colors ${
                    activeIndex === idx ? 'bg-white/10' : 'hover:bg-white/5'
                  }`}
                >
                  <div className="flex items-center gap-3.5 min-w-0">
                    <div className="w-12 h-16 rounded overflow-hidden shrink-0 border border-white/10">
                      <MediaPoster media={item} aspect="poster" />
                    </div>
                    <div className="min-w-0">
                      <h4
                        className={`text-sm font-semibold transition-colors truncate ${
                          activeIndex === idx ? 'text-amber-400' : 'text-white group-hover:text-amber-400'
                        }`}
                      >
                        {item.title}
                      </h4>
                      <div className="flex items-center gap-1.5 text-xs text-slate-400 mt-0.5">
                        <span>{item.year > 0 ? item.year : 'TBA'}</span>
                        <span aria-hidden="true" className="text-slate-600">·</span>
                        <span>{item.type === 'movie' ? 'Movie' : 'TV Series'}</span>
                        <span aria-hidden="true" className="text-slate-600">·</span>
                        <span className="truncate">{item.genres.slice(0, 2).join(', ')}</span>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-3 shrink-0 ml-4">
                    <div className="flex items-center gap-1 text-amber-400 font-mono text-xs">
                      <Star className="w-3.5 h-3.5 fill-amber-400" />
                      <span>{item.rating > 0 ? item.rating.toFixed(1) : 'NR'}</span>
                    </div>
                    <ArrowRight
                      className={`w-4 h-4 transition-colors ${
                        activeIndex === idx ? 'text-white' : 'text-slate-600 group-hover:text-white'
                      }`}
                    />
                  </div>
                </div>
              ))}

              {page < totalPages && (
                <div className="p-3 text-center">
                  <button
                    onClick={handleLoadMore}
                    disabled={isLoadingMore}
                    className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-white/5 hover:bg-white/10 text-xs font-semibold text-amber-400 border border-white/10 transition-colors"
                  >
                    {isLoadingMore ? (
                      <>
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        <span>Loading More...</span>
                      </>
                    ) : (
                      <>
                        <Plus className="w-3.5 h-3.5" />
                        <span>Load More Results (Page {page + 1} of {totalPages})</span>
                      </>
                    )}
                  </button>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
};
