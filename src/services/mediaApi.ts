import { MEDIA_ITEMS } from '../data/mediaData';
import { EpisodeInfo, MediaItem } from '../types';

export type CatalogueCategory =
  | 'trending'
  | 'popular_movies'
  | 'top_rated_movies'
  | 'upcoming_movies'
  | 'popular_tv'
  | 'top_rated_tv'
  | 'discover';

export interface CatalogueQueryParams {
  category?: CatalogueCategory;
  page?: number;
  type?: 'all' | 'movie' | 'tv';
  genre?: string;
  mood?: string;
  sortBy?: 'popularity' | 'rating' | 'year' | 'title';
  minRating?: number;
  query?: string;
}

export interface CatalogueResponse {
  items: MediaItem[];
  page: number;
  totalPages: number;
  totalResults: number;
  tmdbConfigured: boolean;
  provider: 'tmdb' | 'live_open_catalog';
}

const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL || '').replace(/\/$/, '');

/**
 * Safely fetches an API route, verifying status and Content-Type: application/json.
 * Returns null if the endpoint is not reachable or returns non-JSON (e.g. 404 HTML on static hosts).
 */
async function fetchApiJson<T>(endpoint: string, init?: RequestInit): Promise<T | null> {
  try {
    const url = `${API_BASE_URL}${endpoint}`;
    const res = await fetch(url, init);
    const contentType = res.headers.get('content-type') || '';
    if (res.ok && contentType.includes('application/json')) {
      return (await res.json()) as T;
    }
  } catch {
    // Network or parse failure on static host; fall back to client engine
  }
  return null;
}

/**
 * Client-side catalogue resolution engine for static hosts (GitHub Pages)
 */
function resolveClientCatalogue(params: CatalogueQueryParams = {}): CatalogueResponse {
  const page = Math.max(1, Number(params.page) || 1);
  const type = params.type || 'all';
  const genre = params.genre?.trim();
  const mood = params.mood?.trim();
  const sortBy = params.sortBy || 'popularity';
  const minRating = Number(params.minRating) || 0;
  const query = params.query?.trim().toLowerCase();

  let pool: MediaItem[] = [...MEDIA_ITEMS];

  if (type !== 'all') {
    pool = pool.filter((item) => item.type === type);
  }

  if (genre && genre !== 'All') {
    pool = pool.filter((item) =>
      item.genres.some((g) => g.toLowerCase() === genre.toLowerCase())
    );
  }

  if (mood && mood !== 'All') {
    pool = pool.filter((item) =>
      item.moods.some((m) => m.toLowerCase() === mood.toLowerCase())
    );
  }

  if (minRating > 0) {
    pool = pool.filter((item) => item.rating >= minRating);
  }

  if (query) {
    pool = pool.filter((item) => {
      const inTitle = item.title.toLowerCase().includes(query);
      const inSynopsis = (item.synopsis || '').toLowerCase().includes(query);
      const inDirector = (item.director || '').toLowerCase().includes(query);
      const inCast = item.cast.some((c) => c.name.toLowerCase().includes(query));
      const inGenres = item.genres.some((g) => g.toLowerCase().includes(query));
      return inTitle || inSynopsis || inDirector || inCast || inGenres;
    });
  }

  // Sorting
  pool.sort((a, b) => {
    if (sortBy === 'rating') return b.rating - a.rating;
    if (sortBy === 'year') return b.year - a.year || b.rating - a.rating;
    if (sortBy === 'title') return a.title.localeCompare(b.title);
    return (a.popularityRank || 999) - (b.popularityRank || 999);
  });

  const PAGE_SIZE = 20;
  const totalResults = pool.length;
  const totalPages = Math.max(1, Math.ceil(totalResults / PAGE_SIZE));
  const startIdx = (page - 1) * PAGE_SIZE;
  const pagedItems = pool.slice(startIdx, startIdx + PAGE_SIZE);

  return {
    items: pagedItems,
    page,
    totalPages,
    totalResults,
    tmdbConfigured: false,
    provider: 'live_open_catalog',
  };
}

export async function fetchCatalogue(
  params: CatalogueQueryParams = {},
  signal?: AbortSignal
): Promise<CatalogueResponse> {
  const searchParams = new URLSearchParams();
  if (params.category) searchParams.set('category', params.category);
  if (params.page) searchParams.set('page', String(params.page));
  if (params.type) searchParams.set('type', params.type);
  if (params.genre) searchParams.set('genre', params.genre);
  if (params.mood) searchParams.set('mood', params.mood);
  if (params.sortBy) searchParams.set('sortBy', params.sortBy);
  if (params.minRating && params.minRating > 0) {
    searchParams.set('minRating', String(params.minRating));
  }
  if (params.query && params.query.trim()) {
    searchParams.set('query', params.query.trim());
  }

  // 1. Try remote API first (Node / Express or configured VITE_API_BASE_URL)
  const apiResult = await fetchApiJson<CatalogueResponse>(
    `/api/catalogue?${searchParams.toString()}`,
    { signal }
  );

  if (apiResult && Array.isArray(apiResult.items)) {
    return apiResult;
  }

  // 2. Client-side fallback for static hosts (GitHub Pages)
  return resolveClientCatalogue(params);
}

export async function fetchTitleDetails(
  media: MediaItem
): Promise<{ item: MediaItem; similar: MediaItem[] }> {
  const apiResult = await fetchApiJson<{ item: MediaItem; similar: MediaItem[] }>(
    `/api/title/${media.type}/${encodeURIComponent(media.id)}`
  );

  if (apiResult && apiResult.item) {
    return apiResult;
  }

  // Client-side fallback
  const found = MEDIA_ITEMS.find((m) => m.id === media.id) || media;
  const similar = MEDIA_ITEMS.filter(
    (m) =>
      m.id !== media.id &&
      (m.type === media.type || m.genres.some((g) => media.genres.includes(g)))
  ).slice(0, 4);

  return { item: found, similar };
}

export async function fetchTvSeasonEpisodes(
  mediaId: string,
  seasonNumber: number,
  signal?: AbortSignal
): Promise<{ seasonNumber: number; name: string; episodes: EpisodeInfo[] }> {
  // 1. Try remote API first
  const apiResult = await fetchApiJson<{
    seasonNumber: number;
    name: string;
    episodes: EpisodeInfo[];
  }>(`/api/tv/${encodeURIComponent(mediaId)}/season/${seasonNumber}`, { signal });

  if (apiResult && Array.isArray(apiResult.episodes) && apiResult.episodes.length > 0) {
    return apiResult;
  }

  // 2. Client-side fallback for static hosts
  const found = MEDIA_ITEMS.find((m) => m.id === mediaId);
  const matchingSeason = found?.seasonsList?.find((s) => s.seasonNumber === seasonNumber);
  const epCount = matchingSeason?.episodeCount || 8;
  const baseYear = found?.year || 2024;

  const episodes: EpisodeInfo[] = Array.from({ length: epCount }, (_, idx) => ({
    episodeNumber: idx + 1,
    seasonNumber,
    name: `Chapter ${idx + 1}`,
    airDate:
      matchingSeason?.airDate ||
      `${baseYear}-01-${String((idx % 28) + 1).padStart(2, '0')}`,
    runtime: 52,
  }));

  return {
    seasonNumber,
    name: matchingSeason?.name || `Season ${seasonNumber}`,
    episodes,
  };
}
