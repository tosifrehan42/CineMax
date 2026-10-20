import { MediaItem } from '../types';

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

  const res = await fetch(`/api/catalogue?${searchParams.toString()}`, { signal });
  if (!res.ok) {
    const errData = await res.json().catch(() => ({}));
    throw new Error(errData.error || `Request failed with status ${res.status}`);
  }
  return res.json();
}

export async function fetchTitleDetails(
  media: MediaItem
): Promise<{ item: MediaItem; similar: MediaItem[] }> {
  const res = await fetch(`/api/title/${media.type}/${encodeURIComponent(media.id)}`);
  if (!res.ok) {
    return { item: media, similar: [] };
  }
  return res.json();
}
