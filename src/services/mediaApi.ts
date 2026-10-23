import { MEDIA_ITEMS } from '../data/mediaData';
import { VERIFIED_TMDB_TRAILERS } from '../data/verifiedTrailers';
import {
  CastMember,
  EpisodeInfo,
  MediaItem,
  SeasonSummary,
  TrailerLookupResult,
  TrailerVideo,
} from '../types';

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

const API_BASE_URL = String((import.meta as any).env?.VITE_API_BASE_URL || '').replace(/\/$/, '');

// Tracks whether the current host is a static file server (e.g. GitHub Pages) without /api/* routes
let staticHostWithoutApi = false;

/**
 * Safely fetches an API route, verifying status and Content-Type: application/json.
 * Returns null if the endpoint is not reachable or returns non-JSON (e.g. 404 HTML on static hosts).
 */
async function fetchApiJson<T>(endpoint: string, init?: RequestInit): Promise<T | null> {
  if (staticHostWithoutApi && !API_BASE_URL) {
    return null;
  }
  try {
    const url = `${API_BASE_URL}${endpoint}`;
    const res = await fetch(url, init);
    const contentType = res.headers.get('content-type') || '';
    if (res.ok && contentType.includes('application/json')) {
      return (await res.json()) as T;
    }
    if (res.status === 404 && !API_BASE_URL) {
      staticHostWithoutApi = true;
    }
  } catch (err: any) {
    if (err?.name === 'AbortError') {
      throw err;
    }
    // Network or parse failure on static host; fall back to client engine
  }
  return null;
}

// ============================================================================
// Live Open Catalog & Ranking Engine (Mirrors server.ts for Static Hosts)
// ============================================================================

const MOOD_TO_GENRES: Record<string, string[]> = {
  'mind-bending': ['Sci-Fi', 'Mystery', 'Thriller'],
  'atmospheric-noir': ['Crime', 'Mystery', 'Thriller'],
  'epic-worldbuilding': ['Sci-Fi', 'Fantasy', 'Adventure', 'Action'],
  'dark-gripping': ['Thriller', 'Crime', 'Drama', 'Horror'],
  'cerebral-mystery': ['Mystery', 'Thriller', 'Crime', 'History'],
  'intimate-reflective': ['Drama', 'Romance', 'History'],
  'adrenaline-rush': ['Action', 'Adventure', 'Thriller', 'Sci-Fi'],
};

const PALETTES: Array<{
  themeColor: string;
  bgFrom: string;
  bgTo: string;
  accent: string;
  iconType: MediaItem['posterVisual']['iconType'];
}> = [
  { themeColor: '#e08a3c', bgFrom: '#1c120a', bgTo: '#3f210d', accent: '#e08a3c', iconType: 'desert' },
  { themeColor: '#0ea5e9', bgFrom: '#041829', bgTo: '#0b2b40', accent: '#38bdf8', iconType: 'mind' },
  { themeColor: '#f97316', bgFrom: '#1c0c04', bgTo: '#3b1606', accent: '#fb923c', iconType: 'darkness' },
  { themeColor: '#e11d48', bgFrom: '#20070c', bgTo: '#450a16', accent: '#f43f5e', iconType: 'retro' },
  { themeColor: '#06b6d4', bgFrom: '#061a24', bgTo: '#103947', accent: '#22d3ee', iconType: 'cyber' },
  { themeColor: '#6366f1', bgFrom: '#0a0d24', bgTo: '#171c47', accent: '#818cf8', iconType: 'space' },
  { themeColor: '#10b981', bgFrom: '#061f18', bgTo: '#0b3d30', accent: '#34d399', iconType: 'city' },
  { themeColor: '#ec4899', bgFrom: '#24081c', bgTo: '#451034', accent: '#f472b6', iconType: 'fantasy' },
];

function hashString(str: string): number {
  let h = 0;
  for (let i = 0; i < str.length; i++) {
    h = (h * 31 + str.charCodeAt(i)) >>> 0;
  }
  return h;
}

function stripHtml(html: string): string {
  return (html || '').replace(/<[^>]*>/g, '').trim();
}

function deriveMoodsFromGenres(genres: string[]): string[] {
  const matched = new Set<string>();
  for (const [moodId, gList] of Object.entries(MOOD_TO_GENRES)) {
    if (genres.some((g) => gList.includes(g))) {
      matched.add(moodId);
    }
  }
  if (matched.size === 0) matched.add('intimate-reflective');
  return Array.from(matched).slice(0, 3);
}

function normalizeGenreName(g: string): string {
  const lower = (g || '').toLowerCase();
  if (lower.includes('sci-fi') || lower.includes('science fiction')) return 'Sci-Fi';
  if (lower.includes('action') || lower.includes('adventure')) return 'Action';
  if (lower.includes('thriller') || lower.includes('suspense')) return 'Thriller';
  if (lower.includes('crime')) return 'Crime';
  if (lower.includes('mystery')) return 'Mystery';
  if (lower.includes('fantasy')) return 'Fantasy';
  if (lower.includes('animation') || lower.includes('anime')) return 'Animation';
  if (lower.includes('history') || lower.includes('historical') || lower.includes('war')) return 'History';
  if (lower.includes('comedy')) return 'Comedy';
  if (lower.includes('horror') || lower.includes('supernatural')) return 'Horror';
  if (lower.includes('romance')) return 'Romance';
  return 'Drama';
}

function normalizeForSearch(text: string): string {
  return (text || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/['’`]/g, '')
    .replace(/[-–—:/.,!?&()+"]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function getTitleMatchTier(
  normTitle: string,
  titleWords: string[],
  normQuery: string,
  queryWords: string[]
): number {
  if (!normTitle || !normQuery) return 0;
  if (normTitle === normQuery) return 4.0;
  if (normTitle.startsWith(normQuery + ' ')) return 3.0;
  if (normTitle.startsWith(normQuery)) return 2.8;
  if ((' ' + normTitle + ' ').includes(' ' + normQuery + ' ')) return 2.5;
  if (normTitle.includes(normQuery)) return 2.2;
  if (queryWords.length > 1 && queryWords.every((qw) => titleWords.includes(qw))) {
    return 2.0;
  }
  if (queryWords.length > 0) {
    const matched = queryWords.filter((qw) =>
      titleWords.some((tw) => tw === qw || (qw.length >= 3 && tw.startsWith(qw)))
    );
    if (matched.length > 0) {
      return 1.0 + (matched.length / queryWords.length) * 0.8;
    }
  }
  return 0.5;
}

let cachedLiveCatalog: MediaItem[] | null = null;
let lastCacheTimestamp = 0;
let catalogLoadPromise: Promise<MediaItem[]> | null = null;

async function getClientLiveExpandedCatalog(): Promise<MediaItem[]> {
  const now = Date.now();
  if (
    cachedLiveCatalog &&
    cachedLiveCatalog.length > 60 &&
    now - lastCacheTimestamp < 1000 * 60 * 30
  ) {
    return cachedLiveCatalog;
  }

  if (catalogLoadPromise) {
    return catalogLoadPromise;
  }

  catalogLoadPromise = (async () => {
    const byTitleKey = new Map<string, MediaItem>();

    // 1. Seed with the 20 rich TMDB-poster anchor titles
    for (const item of MEDIA_ITEMS) {
      byTitleKey.set(`${item.type}:${item.title.toLowerCase()}`, item);
    }

    // 2. Fetch live Movies from Apple iTunes Movie RSS genre feeds (CORS-enabled)
    const movieFeeds = [
      'https://itunes.apple.com/us/rss/topmovies/limit=100/json',
      'https://itunes.apple.com/us/rss/topmovies/limit=80/genre=4401/json',
      'https://itunes.apple.com/us/rss/topmovies/limit=80/genre=4406/json',
      'https://itunes.apple.com/us/rss/topmovies/limit=80/genre=4413/json',
      'https://itunes.apple.com/us/rss/topmovies/limit=80/genre=4416/json',
      'https://itunes.apple.com/us/rss/topmovies/limit=60/genre=4404/json',
    ];

    const feedResults = await Promise.allSettled(
      movieFeeds.map(async (feedUrl) => {
        const r = await fetch(feedUrl);
        if (!r.ok) return [];
        const data = await r.json();
        return data?.feed?.entry || [];
      })
    );

    let movieRankCounter = 21;
    for (const res of feedResults) {
      if (res.status !== 'fulfilled' || !Array.isArray(res.value)) continue;
      for (const entry of res.value) {
        const title = entry?.['im:name']?.label;
        if (!title) continue;
        const key = `movie:${title.toLowerCase()}`;
        if (byTitleKey.has(key)) continue;

        const rawId = entry?.id?.attributes?.['im:id'] || String(hashString(title));
        const id = `live-movie-${rawId}`;
        const images = entry?.['im:image'] || [];
        const rawImg = images[images.length - 1]?.label || '';
        const posterUrl = rawImg ? rawImg.replace(/\d+x\d+bb/, '600x900bb') : '';
        const backdropUrl = rawImg ? rawImg.replace(/\d+x\d+bb/, '1200x675bb') : posterUrl;

        const releaseLabel = entry?.['im:releaseDate']?.label || '';
        const year = releaseLabel ? parseInt(releaseLabel.slice(0, 4), 10) || 2024 : 2024;
        const rawGenre = entry?.category?.attributes?.label || 'Drama';
        const normalizedGenre = normalizeGenreName(rawGenre);
        const genres = Array.from(
          new Set([normalizedGenre, rawGenre !== normalizedGenre ? rawGenre : 'Drama'])
        ).slice(0, 2);

        const director = entry?.['im:artist']?.label || 'Visionary Director';
        const synopsis =
          entry?.summary?.label || `${title} is a feature film directed by ${director}.`;
        const durationMs = Number(entry?.link?.[1]?.['im:duration']?.label || 0);
        const totalMins = durationMs > 0 ? Math.round(durationMs / 60000) : 124;
        const runtime = `${Math.floor(totalMins / 60)}h ${totalMins % 60}m`;

        const h = hashString(id);
        const palette = PALETTES[h % PALETTES.length];
        const deterministicRating = Number((7.1 + (h % 21) / 10).toFixed(1));
        const voteCount = `${25 + (h % 450)}k`;

        byTitleKey.set(key, {
          id,
          title,
          type: 'movie',
          year,
          runtime,
          genres,
          rating: deterministicRating,
          voteCount,
          synopsis,
          tagline: `Directed by ${director}.`,
          director,
          cast: [],
          moods: deriveMoodsFromGenres(genres),
          contentRating:
            entry?.['im:contentType']?.attributes?.label === 'Movie' ? 'PG-13' : 'R',
          trendingRank: movieRankCounter,
          popularityRank: movieRankCounter,
          topRatedRank: movieRankCounter,
          streamOn: ['Apple TV', 'Prime Video'],
          themeColor: palette.themeColor,
          posterUrl,
          backdropUrl,
          posterVisual: {
            bgFrom: palette.bgFrom,
            bgTo: palette.bgTo,
            accent: palette.accent,
            iconType: palette.iconType,
          },
        });
        movieRankCounter++;
      }
    }

    // 3. Fetch live TV Shows from TVMaze API (Pages 0 and 1 -> CORS-enabled)
    const tvPages = await Promise.allSettled([
      fetch('https://api.tvmaze.com/shows?page=0').then((r) => (r.ok ? r.json() : [])),
      fetch('https://api.tvmaze.com/shows?page=1').then((r) => (r.ok ? r.json() : [])),
    ]);

    let tvRankCounter = 21;
    for (const res of tvPages) {
      if (res.status !== 'fulfilled' || !Array.isArray(res.value)) continue;
      const validShows = res.value
        .filter((s: any) => s?.name && s?.image?.original && (s?.rating?.average || 0) >= 7.2)
        .slice(0, 140);

      for (const show of validShows) {
        const title = show.name;
        const key = `tv:${title.toLowerCase()}`;
        if (byTitleKey.has(key)) continue;

        const id = `tvmaze-tv-${show.id}`;
        const posterUrl = show.image?.original || show.image?.medium || '';
        const backdropUrl = posterUrl;
        const year = show.premiered ? parseInt(show.premiered.slice(0, 4), 10) || 2022 : 2022;
        const rawGenres: string[] =
          Array.isArray(show.genres) && show.genres.length > 0 ? show.genres : ['Drama'];
        const genres = Array.from(new Set(rawGenres.map(normalizeGenreName))).slice(0, 3);
        const rating = Number((show.rating?.average || 7.8).toFixed(1));
        const synopsis =
          stripHtml(show.summary) || `${title} is an acclaimed television series.`;
        const networkName = show.network?.name || show.webChannel?.name || 'Max';

        const h = hashString(id);
        const palette = PALETTES[h % PALETTES.length];
        const seasons = Math.max(1, Math.min(8, Math.round((show.weight || 85) / 22)));

        byTitleKey.set(key, {
          id,
          title,
          type: 'tv',
          year,
          seasons,
          genres,
          rating,
          voteCount: `${40 + (h % 320)}k`,
          synopsis,
          tagline: `Original series on ${networkName}.`,
          director: `${networkName} Original Production`,
          cast: [],
          moods: deriveMoodsFromGenres(genres),
          contentRating: 'TV-MA',
          trendingRank: tvRankCounter,
          popularityRank: tvRankCounter,
          topRatedRank: tvRankCounter,
          streamOn: [networkName, 'Prime Video'],
          themeColor: palette.themeColor,
          posterUrl,
          backdropUrl,
          posterVisual: {
            bgFrom: palette.bgFrom,
            bgTo: palette.bgTo,
            accent: palette.accent,
            iconType: palette.iconType,
          },
        });
        tvRankCounter++;
      }
    }

    const result = Array.from(byTitleKey.values());
    if (result.length > 20) {
      cachedLiveCatalog = result;
      lastCacheTimestamp = Date.now();
    }
    catalogLoadPromise = null;
    return result;
  })();

  return catalogLoadPromise;
}

/**
 * Client-side catalogue resolution engine for static hosts (GitHub Pages).
 * Mirrors server.ts PATH B category, filtering, sorting, and live search behavior.
 */
async function resolveClientCatalogue(
  params: CatalogueQueryParams = {},
  signal?: AbortSignal
): Promise<CatalogueResponse> {
  const category = String(params.category || 'discover');
  const page = Math.max(1, Number(params.page) || 1);
  const rawType = (params.type || 'all') as 'all' | 'movie' | 'tv';
  const effectiveType: 'all' | 'movie' | 'tv' =
    rawType === 'movie' || rawType === 'tv'
      ? rawType
      : category.includes('movies')
      ? 'movie'
      : category.includes('_tv')
      ? 'tv'
      : 'all';
  const genre = String(params.genre || 'All').trim();
  const mood = String(params.mood || 'all').trim();
  const sortBy = (params.sortBy || 'popularity') as 'popularity' | 'rating' | 'year' | 'title';
  const minRating = Number(params.minRating) || 0;
  const query = String(params.query || '').trim();

  const catalog = await getClientLiveExpandedCatalog();
  let pool: MediaItem[] = [...catalog];

  // Live TVMaze search enrichment when user queries a specific show
  if (query.length >= 2 && effectiveType !== 'movie') {
    try {
      const liveTvRes = await fetch(
        `https://api.tvmaze.com/search/shows?q=${encodeURIComponent(query)}`,
        { signal }
      );
      if (liveTvRes.ok) {
        const liveTvData = await liveTvRes.json();
        const existingTitles = new Set(pool.map((p) => `${p.type}:${p.title.toLowerCase()}`));
        for (const entry of liveTvData) {
          const show = entry?.show;
          if (!show?.name) continue;
          const k = `tv:${show.name.toLowerCase()}`;
          if (existingTitles.has(k)) continue;
          existingTitles.add(k);

          const id = `tvmaze-tv-${show.id}`;
          const h = hashString(id);
          const palette = PALETTES[h % PALETTES.length];
          const rawGenres: string[] =
            Array.isArray(show.genres) && show.genres.length > 0 ? show.genres : ['Drama'];
          const genres = Array.from(new Set(rawGenres.map(normalizeGenreName))).slice(0, 3);
          const networkName = show.network?.name || show.webChannel?.name || 'Streaming';
          const posterUrl = show.image?.original || show.image?.medium || '';

          pool.push({
            id,
            title: show.name,
            type: 'tv',
            year: show.premiered ? parseInt(show.premiered.slice(0, 4), 10) || 0 : 0,
            seasons: 2,
            genres,
            rating: Number((show.rating?.average || 0).toFixed(1)),
            voteCount: `${15 + (h % 180)}k`,
            synopsis: stripHtml(show.summary) || `${show.name} is a television series.`,
            tagline: `Original series on ${networkName}.`,
            director: `${networkName} Production`,
            cast: [],
            moods: deriveMoodsFromGenres(genres),
            contentRating: 'TV-MA',
            streamOn: [networkName],
            themeColor: palette.themeColor,
            posterUrl,
            backdropUrl: posterUrl,
            posterVisual: {
              bgFrom: palette.bgFrom,
              bgTo: palette.bgTo,
              accent: palette.accent,
              iconType: palette.iconType,
            },
          });
        }
      }
    } catch (err: any) {
      if (err?.name === 'AbortError') throw err;
    }
  }

  // Filter by media type strictly
  if (effectiveType !== 'all') {
    pool = pool.filter((item) => item.type === effectiveType);
  }

  if (query) {
    const normQ = normalizeForSearch(query);
    const qWords = normQ.split(' ').filter(Boolean);

    const scoredPool = pool
      .map((item, idx) => {
        const normTitle = normalizeForSearch(item.title);
        const titleWords = normTitle ? normTitle.split(' ') : [];
        const titleTier = getTitleMatchTier(normTitle, titleWords, normQ, qWords);
        const metaMatch =
          normalizeForSearch(item.director).includes(normQ) ||
          item.cast.some((c) => normalizeForSearch(c.name).includes(normQ));

        return {
          item,
          idx,
          tier: titleTier >= 1.0 ? titleTier : metaMatch ? 0.8 : 0,
        };
      })
      .filter((entry) => entry.tier > 0);

    scoredPool.sort((a, b) => {
      if (Math.abs(b.tier - a.tier) > 0.001) return b.tier - a.tier;
      return a.idx - b.idx;
    });

    pool = scoredPool.map((entry) => entry.item);
  } else {
    // Non-search browse filters & category sorting (identical to server.ts lines 959-998)
    if (category === 'top_rated_movies' || category === 'top_rated_tv') {
      pool.sort((a, b) => b.rating - a.rating);
    } else if (category === 'upcoming_movies') {
      pool.sort((a, b) => b.year - a.year || b.rating - a.rating);
    }

    if (genre && genre !== 'All') {
      const selectedGenreList = genre
        .split(',')
        .map((g) => g.trim().toLowerCase())
        .filter((g) => g && g !== 'all');
      if (selectedGenreList.length > 0) {
        pool = pool.filter((item) =>
          selectedGenreList.every((reqG) =>
            item.genres.some((itemG) => itemG.toLowerCase() === reqG)
          )
        );
      }
    }

    if (mood && mood !== 'all' && mood !== 'All') {
      pool = pool.filter((item) =>
        item.moods.some((m) => m.toLowerCase() === mood.toLowerCase())
      );
    }

    if (minRating > 0) {
      pool = pool.filter((item) => item.rating >= minRating);
    }

    if (
      category !== 'top_rated_movies' &&
      category !== 'top_rated_tv' &&
      category !== 'upcoming_movies'
    ) {
      pool.sort((a, b) => {
        if (sortBy === 'rating') return b.rating - a.rating;
        if (sortBy === 'year') return b.year - a.year || b.rating - a.rating;
        if (sortBy === 'title') return a.title.localeCompare(b.title);
        return (a.popularityRank || 999) - (b.popularityRank || 999);
      });
    }
  }

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

  // 2. Client-side live expanded catalogue fallback for static hosts (GitHub Pages)
  return resolveClientCatalogue(params, signal);
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

  // Client-side fallback mirroring server.ts /api/title/:type/:id
  const catalog = await getClientLiveExpandedCatalog();
  const found =
    catalog.find((m) => m.id === media.id) ||
    MEDIA_ITEMS.find((m) => m.id === media.id) ||
    media;

  const enriched: MediaItem = { ...found };

  if (media.id.startsWith('tvmaze-tv-')) {
    const showId = media.id.replace('tvmaze-tv-', '');
    try {
      const [castRes, epRes] = await Promise.allSettled([
        enriched.cast.length === 0
          ? fetch(`https://api.tvmaze.com/shows/${showId}/cast`)
          : Promise.resolve(null),
        fetch(`https://api.tvmaze.com/shows/${showId}/episodes`),
      ]);

      if (castRes.status === 'fulfilled' && castRes.value && castRes.value.ok) {
        const castData = await castRes.value.json();
        enriched.cast = (castData || []).slice(0, 5).map(
          (c: any): CastMember => ({
            name: c.person?.name || 'Actor',
            role: c.character?.name || 'Series Regular',
          })
        );
      }

      if (epRes.status === 'fulfilled' && epRes.value && epRes.value.ok) {
        const epData = await epRes.value.json();
        if (Array.isArray(epData) && epData.length > 0) {
          const seasonMap = new Map<number, { count: number; airDate?: string }>();
          for (const ep of epData) {
            const sNum = Number(ep?.season || 0);
            if (sNum < 1) continue;
            const prev = seasonMap.get(sNum) || { count: 0, airDate: ep?.airdate };
            prev.count += 1;
            seasonMap.set(sNum, prev);
          }
          const sList: SeasonSummary[] = Array.from(seasonMap.entries())
            .sort((a, b) => a[0] - b[0])
            .map(([sNum, info]) => ({
              seasonNumber: sNum,
              name: `Season ${sNum}`,
              episodeCount: info.count,
              airDate: info.airDate,
            }));
          if (sList.length > 0) {
            enriched.seasonsList = sList;
            enriched.seasons = sList.length;
            enriched.totalEpisodes = sList.reduce((acc, s) => acc + s.episodeCount, 0);
          }
        }
      }
    } catch {
      // Ignore optional enrichment failure
    }
  }

  if (enriched.type === 'tv' && (!enriched.seasonsList || enriched.seasonsList.length === 0)) {
    const numSeasons = Math.max(1, enriched.seasons || 1);
    const fallbackSeasons: SeasonSummary[] = Array.from({ length: numSeasons }, (_, i) => ({
      seasonNumber: i + 1,
      name: `Season ${i + 1}`,
      episodeCount: 8,
    }));
    enriched.seasonsList = fallbackSeasons;
    enriched.totalEpisodes = fallbackSeasons.reduce((acc, s) => acc + s.episodeCount, 0);
  }

  const similar = catalog
    .filter(
      (m) =>
        m.id !== enriched.id &&
        (m.genres.some((g) => enriched.genres.includes(g)) ||
          m.moods.some((mood) => enriched.moods.includes(mood)))
    )
    .slice(0, 4);

  return { item: enriched, similar };
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

  // 2. Client-side TVMaze season episodes for tvmaze-tv-*
  if (mediaId.startsWith('tvmaze-tv-')) {
    const showId = mediaId.replace('tvmaze-tv-', '');
    try {
      const epRes = await fetch(`https://api.tvmaze.com/shows/${showId}/episodes`, { signal });
      if (epRes.ok) {
        const allEps = await epRes.json();
        if (Array.isArray(allEps)) {
          const seasonEps = allEps.filter((e: any) => Number(e?.season) === seasonNumber);
          if (seasonEps.length > 0) {
            const episodes: EpisodeInfo[] = seasonEps.map((ep: any, idx: number) => ({
              episodeNumber: Number(ep.number) || idx + 1,
              seasonNumber,
              name: ep.name || `Episode ${idx + 1}`,
              airDate: ep.airdate || undefined,
              runtime: typeof ep.runtime === 'number' && ep.runtime > 0 ? ep.runtime : 50,
              overview: stripHtml(ep.summary || ''),
              stillUrl: ep.image?.medium || ep.image?.original || undefined,
            }));
            return {
              seasonNumber,
              name: `Season ${seasonNumber}`,
              episodes,
            };
          }
        }
      }
    } catch (err: any) {
      if (err?.name === 'AbortError') throw err;
    }
  }

  // 3. Seed or Open Catalog Fallback
  const catalog = await getClientLiveExpandedCatalog();
  const found =
    catalog.find((m) => m.id === mediaId) || MEDIA_ITEMS.find((m) => m.id === mediaId);
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

// ============================================================================
// Official TMDB Trailer & Video Lookup (Server Proxy + Static Host Fallback)
// ============================================================================

export const SEED_TO_TMDB_ID: Record<string, { mediaType: 'movie' | 'tv'; tmdbId: number }> = {
  'dune-part-two': { mediaType: 'movie', tmdbId: 693134 },
  severance: { mediaType: 'tv', tmdbId: 95396 },
  oppenheimer: { mediaType: 'movie', tmdbId: 872585 },
  shogun: { mediaType: 'tv', tmdbId: 126308 },
  'blade-runner-2049': { mediaType: 'movie', tmdbId: 335984 },
  succession: { mediaType: 'tv', tmdbId: 76331 },
  interstellar: { mediaType: 'movie', tmdbId: 157336 },
  'the-bear': { mediaType: 'tv', tmdbId: 136315 },
  arcane: { mediaType: 'tv', tmdbId: 94605 },
  mindhunter: { mediaType: 'tv', tmdbId: 67744 },
  'past-lives': { mediaType: 'movie', tmdbId: 666277 },
  'poor-things': { mediaType: 'movie', tmdbId: 792307 },
  dark: { mediaType: 'tv', tmdbId: 70523 },
  'the-batman': { mediaType: 'movie', tmdbId: 414906 },
  chernobyl: { mediaType: 'tv', tmdbId: 87108 },
  arrival: { mediaType: 'movie', tmdbId: 329865 },
  'spirited-away': { mediaType: 'movie', tmdbId: 129 },
  fallout: { mediaType: 'tv', tmdbId: 106379 },
  'true-detective-s1': { mediaType: 'tv', tmdbId: 46648 },
  'everything-everywhere-all-at-once': { mediaType: 'movie', tmdbId: 545611 },
};

const clientTrailerCache = new Map<string, { timestamp: number; data: TrailerLookupResult }>();
const CLIENT_TRAILER_CACHE_TTL_MS = 1000 * 60 * 30; // 30 minutes

export function rankTmdbVideos(rawVideos: any[], mediaTitle = ''): TrailerVideo[] {
  if (!Array.isArray(rawVideos)) return [];
  const youtubeKeyRegex = /^[A-Za-z0-9_-]{11}$/;
  const normMediaTitle = normalizeForSearch(mediaTitle);

  const candidates = rawVideos.filter((v) => {
    if (!v || String(v.site || '').toLowerCase() !== 'youtube') return false;
    const key = String(v.key || '').trim();
    if (!youtubeKeyRegex.test(key)) return false;
    const vType = String(v.type || '');
    const lowerName = String(v.name || '').toLowerCase();
    if (vType === 'Trailer' || vType === 'Teaser') return true;
    return lowerName.includes('trailer') || lowerName.includes('teaser');
  });

  const scored = candidates.map((v, idx) => {
    const key = String(v.key).trim();
    const rawType = String(v.type || '');
    const name = String(v.name || rawType || 'Trailer').trim();
    const lowerName = name.toLowerCase();
    const vType: 'Trailer' | 'Teaser' =
      rawType === 'Trailer' || (rawType !== 'Teaser' && lowerName.includes('trailer'))
        ? 'Trailer'
        : 'Teaser';
    const official = Boolean(v.official);
    const isoLang = String(v.iso_639_1 || '').toLowerCase();
    const size = Number(v.size) || 0;
    const publishedMs = v.published_at ? Date.parse(String(v.published_at)) || 0 : 0;

    let score = 0;
    if (rawType === 'Trailer') score += 1000;
    else if (rawType === 'Teaser') score += 450;
    else score += 250;

    if (official) score += 500;
    if (!isoLang || isoLang === 'en') score += 200;

    if (lowerName.includes('official trailer')) score += 160;
    else if (lowerName.includes('main trailer') || lowerName.includes('final trailer')) score += 130;
    else if (lowerName.includes('official teaser')) score += 100;
    else if (lowerName.includes('trailer')) score += 80;

    if (normMediaTitle && normalizeForSearch(name).includes(normMediaTitle)) {
      score += 35;
    }

    if (
      lowerName.includes('dub') ||
      lowerName.includes('subtitled') ||
      lowerName.includes('recap') ||
      lowerName.includes('commentary') ||
      lowerName.includes('vertical')
    ) {
      score -= 220;
    }

    if (size >= 1080) score += 30;

    const video: TrailerVideo = {
      id: String(v.id || `${key}-${idx}`),
      key,
      name,
      site: 'YouTube',
      type: vType,
      official,
      publishedAt: v.published_at ? String(v.published_at) : undefined,
      iso639_1: v.iso_639_1 ? String(v.iso_639_1) : undefined,
      size: size > 0 ? size : undefined,
    };

    return { video, score, publishedMs, idx };
  });

  scored.sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    if (b.publishedMs !== a.publishedMs) return b.publishedMs - a.publishedMs;
    return a.idx - b.idx;
  });

  const seenKeys = new Set<string>();
  const deduped: TrailerVideo[] = [];
  for (const entry of scored) {
    if (seenKeys.has(entry.video.key)) continue;
    seenKeys.add(entry.video.key);
    deduped.push(entry.video);
  }

  return deduped;
}

export function extractDirectTmdbId(
  mediaId: string,
  mediaType: 'movie' | 'tv'
): { mediaType: 'movie' | 'tv'; tmdbId: number } | null {
  const cleanId = String(mediaId || '').trim();
  const seedMatch = SEED_TO_TMDB_ID[cleanId];
  if (seedMatch) {
    return seedMatch;
  }

  const prefixMatch = cleanId.match(/^tmdb-(movie|tv)-(\d+)$/i);
  if (prefixMatch) {
    const mType = prefixMatch[1].toLowerCase() === 'tv' ? 'tv' : 'movie';
    const numId = parseInt(prefixMatch[2], 10);
    if (Number.isFinite(numId) && numId > 0) {
      return { mediaType: mType, tmdbId: numId };
    }
  }

  if (/^\d+$/.test(cleanId)) {
    const numId = parseInt(cleanId, 10);
    if (Number.isFinite(numId) && numId > 0) {
      return { mediaType, tmdbId: numId };
    }
  }

  return null;
}

/**
 * Resolves verified TMDB trailers on static hosts (such as GitHub Pages)
 * where Express server routes (/api/trailer/*) are unavailable and secret API keys
 * must never be exposed in client-side bundles.
 */
export async function resolveStaticHostTrailers(
  media: MediaItem,
  signal?: AbortSignal
): Promise<TrailerLookupResult> {
  const youtubeSearchUrl = `https://www.youtube.com/results?search_query=${encodeURIComponent(
    `${media.title} ${media.year || ''} official trailer`.trim()
  )}`;

  const direct = extractDirectTmdbId(media.id, media.type);
  const candidateKeys = [
    `id:${media.id}`,
    direct ? `id:tmdb-${direct.mediaType}-${direct.tmdbId}` : '',
    `title:${media.type}:${media.title.toLowerCase().trim()}`,
  ].filter(Boolean);

  for (const k of candidateKeys) {
    const record = VERIFIED_TMDB_TRAILERS[k];
    if (record && Array.isArray(record.videos) && record.videos.length > 0) {
      return {
        status: 'ok',
        tmdbId: record.tmdbId,
        mediaType: record.mediaType,
        primaryVideo: record.videos[0],
        videos: record.videos,
        youtubeSearchUrl,
      };
    }
  }

  // Optional keyless public Wikidata lookup by IMDb ID for TVMaze shows not in pre-verified index
  if (media.id.startsWith('tvmaze-tv-')) {
    const showId = media.id.replace('tvmaze-tv-', '');
    if (/^\d+$/.test(showId)) {
      try {
        const tvMazeRes = await fetch(`https://api.tvmaze.com/shows/${showId}`, { signal });
        if (tvMazeRes.ok) {
          const showData = await tvMazeRes.json();
          const imdbId = showData?.externals?.imdb ? String(showData.externals.imdb).trim() : '';
          if (/^tt\d+$/.test(imdbId)) {
            const sparql = `SELECT ?video WHERE { ?item wdt:P345 "${imdbId}" . ?item wdt:P1651 ?video . } LIMIT 3`;
            const wdUrl = `https://query.wikidata.org/sparql?format=json&query=${encodeURIComponent(
              sparql
            )}`;
            const wdRes = await fetch(wdUrl, {
              headers: { Accept: 'application/sparql-results+json' },
              signal,
            });
            if (wdRes.ok) {
              const wdData = await wdRes.json();
              const bindings: any[] = wdData?.results?.bindings || [];
              const ytKeyRegex = /^[A-Za-z0-9_-]{11}$/;
              const videos: TrailerVideo[] = bindings
                .map((b, idx) => String(b?.video?.value || '').trim())
                .filter((key) => ytKeyRegex.test(key))
                .map((key, idx) => ({
                  id: `wd-${imdbId}-${idx}`,
                  key,
                  name: `${media.title} — Official Trailer`,
                  site: 'YouTube' as const,
                  type: 'Trailer' as const,
                  official: true,
                }));

              if (videos.length > 0) {
                return {
                  status: 'ok',
                  tmdbId: direct?.tmdbId || null,
                  mediaType: media.type,
                  primaryVideo: videos[0],
                  videos,
                  youtubeSearchUrl,
                };
              }
            }
          }
        }
      } catch (err: any) {
        if (err?.name === 'AbortError') throw err;
      }
    }
  }

  return {
    status: 'unavailable',
    tmdbId: direct?.tmdbId || null,
    mediaType: media.type,
    primaryVideo: null,
    videos: [],
    youtubeSearchUrl,
    reason: 'No official YouTube trailer is available for this title.',
  };
}

export async function fetchMediaTrailers(
  media: MediaItem,
  signal?: AbortSignal
): Promise<TrailerLookupResult> {
  const cacheKey = `${media.type}:${media.id}`;
  const cached = clientTrailerCache.get(cacheKey);
  if (cached && Date.now() - cached.timestamp < CLIENT_TRAILER_CACHE_TTL_MS) {
    return cached.data;
  }

  // 1. Try server proxy endpoint (/api/trailer/:type/:id) first
  const queryParams = new URLSearchParams({
    title: media.title,
    year: media.year ? String(media.year) : '',
  });
  const serverResult = await fetchApiJson<TrailerLookupResult>(
    `/api/trailer/${media.type}/${encodeURIComponent(media.id)}?${queryParams.toString()}`,
    { signal }
  );

  if (serverResult) {
    if (serverResult.status === 'ok' || serverResult.status === 'unavailable') {
      clientTrailerCache.set(cacheKey, { timestamp: Date.now(), data: serverResult });
    }
    return serverResult;
  }

  // 2. Static host (GitHub Pages) fallback when Express server route is unavailable
  const fallbackResult = await resolveStaticHostTrailers(media, signal);
  clientTrailerCache.set(cacheKey, { timestamp: Date.now(), data: fallbackResult });
  return fallbackResult;
}


