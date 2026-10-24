import { MEDIA_ITEMS } from '../data/mediaData';
import { EXTRA_ANCHOR_ITEMS, INDIAN_TRENDING_ITEMS } from '../data/franchiseData';
import { VERIFIED_TMDB_TRAILERS } from '../data/verifiedTrailers';
import {
  dedupeMediaItems,
  extractCanonicalTmdbIdentity,
  SEED_TO_TMDB_ID,
} from '../utils/mediaIntegrity';
import {
  buildUnconfiguredWatchProviders,
  normalizeTmdbWatchProviders,
} from '../utils/watchProviders';
import {
  lookupOnlinePlaybackSources,
  registerDiscoveredOnlineSources,
} from '../data/onlinePlaybackSources';
import {
  CastMember,
  EpisodeInfo,
  MediaItem,
  OnlinePlaybackLookupResult,
  SeasonSummary,
  TrailerLookupResult,
  TrailerVideo,
} from '../types';

export type CatalogueCategory =
  | 'trending'
  | 'trending_movies'
  | 'trending_tv'
  | 'trending_india'
  | 'now_playing_movies'
  | 'recently_released'
  | 'top_10_movies'
  | 'top_10_tv'
  | 'popular_movies'
  | 'top_rated_movies'
  | 'upcoming_movies'
  | 'popular_tv'
  | 'top_rated_tv'
  | 'hindi_movies'
  | 'south_indian_cinema'
  | 'anime'
  | 'documentaries'
  | 'discover';

export interface CatalogueQueryParams {
  category?: CatalogueCategory;
  page?: number;
  type?: 'all' | 'movie' | 'tv';
  genre?: string;
  mood?: string;
  year?: string;
  language?: string;
  sortBy?: 'relevance' | 'popularity' | 'rating' | 'year' | 'title';
  minRating?: number;
  query?: string;
  refresh?: boolean;
}

export interface CatalogueResponse {
  items: MediaItem[];
  page: number;
  totalPages: number;
  totalResults: number;
  tmdbConfigured: boolean;
  provider: 'tmdb' | 'live_open_catalog';
  refreshedAt?: string;
}

const API_BASE_URL = String((import.meta as any).env?.VITE_API_BASE_URL || '').replace(/\/$/, '');
const RAW_CLIENT_TMDB_KEY = String((import.meta as any).env?.VITE_TMDB_API_KEY || '').trim();
// Never use or expose a v4 JWT bearer token or placeholder on the client; only allow a standard v3 API key
const CLIENT_TMDB_API_KEY =
  RAW_CLIENT_TMDB_KEY &&
  !RAW_CLIENT_TMDB_KEY.startsWith('eyJ') &&
  RAW_CLIENT_TMDB_KEY !== 'MY_TMDB_API_KEY' &&
  RAW_CLIENT_TMDB_KEY !== 'YOUR_TMDB_API_KEY' &&
  RAW_CLIENT_TMDB_KEY.length <= 45
    ? RAW_CLIENT_TMDB_KEY
    : '';
const TMDB_IMAGE_W500 = 'https://image.tmdb.org/t/p/w500';
const TMDB_IMAGE_W1280 = 'https://image.tmdb.org/t/p/w1280';

async function fetchClientTmdbJson<T>(
  path: string,
  params: Record<string, string | number | undefined> = {},
  signal?: AbortSignal
): Promise<T | null> {
  if (!CLIENT_TMDB_API_KEY) return null;
  const u = new URL(`https://api.themoviedb.org/3${path}`);
  u.searchParams.set('api_key', CLIENT_TMDB_API_KEY);
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined && v !== '') {
      u.searchParams.set(k, String(v));
    }
  }
  const res = await fetch(u.toString(), {
    headers: { Accept: 'application/json' },
    signal,
  });
  if (!res.ok) {
    throw new Error(`TMDB API Error (${res.status})`);
  }
  return (await res.json()) as T;
}

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
  if (lower.includes('documentary') || lower.includes('docuseries') || lower.includes('non-fiction')) return 'Documentary';
  if (lower.includes('sci-fi') || lower.includes('science fiction')) return 'Sci-Fi';
  if (lower.includes('adventure')) return 'Adventure';
  if (lower.includes('action')) return 'Action';
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

function matchesClientYearFilter(itemYear: number, yearFilter: string): boolean {
  if (!yearFilter || yearFilter === 'All' || yearFilter === 'all') return true;
  if (!itemYear || itemYear <= 0) return false;
  if (yearFilter === '2025-2026') return itemYear >= 2025 && itemYear <= 2026;
  if (yearFilter === '2024') return itemYear === 2024;
  if (yearFilter === '2020-2023') return itemYear >= 2020 && itemYear <= 2023;
  if (yearFilter === '2010-2019') return itemYear >= 2010 && itemYear <= 2019;
  if (yearFilter === '2000-2009') return itemYear >= 2000 && itemYear <= 2009;
  if (yearFilter === 'classic') return itemYear < 2000;
  const exactYear = parseInt(yearFilter, 10);
  if (Number.isFinite(exactYear) && exactYear > 1900) return itemYear === exactYear;
  return true;
}

let cachedLiveCatalog: MediaItem[] | null = null;
let lastCacheTimestamp = 0;
let catalogLoadPromise: Promise<MediaItem[]> | null = null;

async function getClientLiveExpandedCatalog(forceRefresh = false): Promise<MediaItem[]> {
  const now = Date.now();
  if (
    !forceRefresh &&
    cachedLiveCatalog &&
    cachedLiveCatalog.length > 60 &&
    now - lastCacheTimestamp < 1000 * 60 * 10
  ) {
    return cachedLiveCatalog;
  }

  if (!forceRefresh && catalogLoadPromise) {
    return catalogLoadPromise;
  }

  catalogLoadPromise = (async () => {
    const byTitleKey = new Map<string, MediaItem>();

    // 1. Seed with the rich TMDB-poster anchor titles + franchise/regional anchor items
    for (const item of [...MEDIA_ITEMS, ...EXTRA_ANCHOR_ITEMS]) {
      const k = `${item.type}:${item.title.toLowerCase()}`;
      if (!byTitleKey.has(k)) {
        byTitleKey.set(k, {
          ...item,
          language: item.language || 'en',
        });
      }
    }

    // 2. Fetch live Movies from Apple iTunes Movie RSS genre feeds (CORS-enabled)
    const movieFeeds = [
      'https://itunes.apple.com/us/rss/topmovies/limit=100/json',
      'https://itunes.apple.com/us/rss/topmovies/limit=80/genre=4401/json',
      'https://itunes.apple.com/us/rss/topmovies/limit=80/genre=4406/json',
      'https://itunes.apple.com/us/rss/topmovies/limit=80/genre=4413/json',
      'https://itunes.apple.com/us/rss/topmovies/limit=80/genre=4416/json',
      'https://itunes.apple.com/us/rss/topmovies/limit=60/genre=4404/json',
      'https://itunes.apple.com/us/rss/topmovies/limit=60/genre=4405/json',
      'https://itunes.apple.com/in/rss/topmovies/limit=80/json',
    ];

    const feedResults = await Promise.allSettled(
      movieFeeds.map(async (feedUrl) => {
        const r = await fetch(feedUrl);
        if (!r.ok) return [];
        const data = await r.json();
        return data?.feed?.entry || [];
      })
    );

    let movieRankCounter = 25;
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
        // Do not reuse a vertical 2:3 poster as a 16:9 backdrop; MediaPoster renders an ambient blurred poster backdrop
        const backdropUrl = '';

        const releaseLabel = entry?.['im:releaseDate']?.label || '';
        const parsedReleaseYear = releaseLabel ? parseInt(releaseLabel.slice(0, 4), 10) : 0;
        const year = Number.isFinite(parsedReleaseYear) && parsedReleaseYear > 1900 ? parsedReleaseYear : 0;
        const rawGenre = entry?.category?.attributes?.label || 'Drama';
        const normalizedGenre = normalizeGenreName(rawGenre);
        const genres = Array.from(
          new Set([normalizedGenre, rawGenre !== normalizedGenre ? normalizeGenreName(rawGenre) : 'Drama'])
        ).slice(0, 2);

        const director = entry?.['im:artist']?.label || 'Acclaimed Filmmaker';
        const synopsis =
          entry?.summary?.label || `${title} is a feature film directed by ${director}.`;
        const durationMs = Number(entry?.link?.[1]?.['im:duration']?.label || 0);
        const totalMins = durationMs > 0 ? Math.round(durationMs / 60000) : 0;
        const runtime =
          totalMins > 0 ? `${Math.floor(totalMins / 60)}h ${totalMins % 60}m` : undefined;

        const h = hashString(id);
        const palette = PALETTES[h % PALETTES.length];

        byTitleKey.set(key, {
          id,
          title,
          type: 'movie',
          year,
          runtime,
          language: 'en',
          genres,
          rating: 0,
          voteCount: '0',
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

    // 3. Fetch live TV Shows from TVMaze API (Pages 0 to 3 -> CORS-enabled)
    const tvPages = await Promise.allSettled([
      fetch('https://api.tvmaze.com/shows?page=0').then((r) => (r.ok ? r.json() : [])),
      fetch('https://api.tvmaze.com/shows?page=1').then((r) => (r.ok ? r.json() : [])),
      fetch('https://api.tvmaze.com/shows?page=2').then((r) => (r.ok ? r.json() : [])),
      fetch('https://api.tvmaze.com/shows?page=3').then((r) => (r.ok ? r.json() : [])),
    ]);

    let tvRankCounter = 25;
    for (const res of tvPages) {
      if (res.status !== 'fulfilled' || !Array.isArray(res.value)) continue;
      const validShows = res.value
        .filter((s: any) => s?.name && s?.image?.original && (s?.rating?.average || 0) >= 7.0)
        .slice(0, 160);

      for (const show of validShows) {
        const title = show.name;
        const key = `tv:${title.toLowerCase()}`;
        if (byTitleKey.has(key)) continue;

        const id = `tvmaze-tv-${show.id}`;
        const posterUrl = show.image?.original || show.image?.medium || '';
        const backdropUrl = '';
        const parsedPremiered = show.premiered ? parseInt(show.premiered.slice(0, 4), 10) : 0;
        const year = Number.isFinite(parsedPremiered) && parsedPremiered > 1900 ? parsedPremiered : 0;
        const rawGenres: string[] =
          Array.isArray(show.genres) && show.genres.length > 0 ? show.genres : ['Drama'];
        const showTypeStr = String(show.type || '').toLowerCase();
        const combinedRawGenres = showTypeStr.includes('documentary')
          ? ['Documentary', ...rawGenres]
          : showTypeStr.includes('animation')
          ? ['Animation', ...rawGenres]
          : rawGenres;
        const genres = Array.from(new Set(combinedRawGenres.map(normalizeGenreName))).slice(0, 3);
        const rating =
          typeof show.rating?.average === 'number' && show.rating.average > 0
            ? Number(show.rating.average.toFixed(1))
            : 0;
        const synopsis =
          stripHtml(show.summary) || `${title} is an acclaimed television series.`;
        const networkName = show.network?.name || show.webChannel?.name || 'Max';

        const h = hashString(id);
        const palette = PALETTES[h % PALETTES.length];
        const rawLang = String(show.language || 'English').toLowerCase();
        const langCode = rawLang.startsWith('ja')
          ? 'ja'
          : rawLang.startsWith('ko')
          ? 'ko'
          : rawLang.startsWith('es')
          ? 'es'
          : rawLang.startsWith('hi')
          ? 'hi'
          : rawLang.startsWith('fr')
          ? 'fr'
          : 'en';

        byTitleKey.set(key, {
          id,
          title,
          type: 'tv',
          year,
          seasons: undefined,
          language: langCode,
          genres,
          rating,
          voteCount: '0',
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

    const result = dedupeMediaItems(Array.from(byTitleKey.values()));
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
      : category === 'trending_movies' ||
        category === 'now_playing_movies' ||
        category === 'top_10_movies' ||
        category === 'popular_movies' ||
        category === 'top_rated_movies' ||
        category === 'upcoming_movies' ||
        category === 'south_indian_cinema'
      ? 'movie'
      : category.includes('_tv')
      ? 'tv'
      : 'all';
  const genre = String(params.genre || 'All').trim();
  const mood = String(params.mood || 'all').trim();
  const yearFilter = String(params.year || 'All').trim();
  const languageFilter = String(params.language || 'all').trim().toLowerCase();
  const sortBy = (params.sortBy || 'popularity') as
    | 'relevance'
    | 'popularity'
    | 'rating'
    | 'year'
    | 'title';
  const minRating = Number(params.minRating) || 0;
  const query = String(params.query || '').trim();

  const catalog = await getClientLiveExpandedCatalog(Boolean(params.refresh));
  let pool: MediaItem[] =
    category === 'trending_india' || category === 'hindi_movies' || category === 'south_indian_cinema'
      ? [...INDIAN_TRENDING_ITEMS, ...EXTRA_ANCHOR_ITEMS, ...catalog]
      : [...catalog];

  pool = dedupeMediaItems(pool);

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
            seasons: undefined,
            language: 'en',
            genres,
            rating:
              typeof show.rating?.average === 'number' && show.rating.average > 0
                ? Number(show.rating.average.toFixed(1))
                : 0,
            voteCount: '0',
            synopsis: stripHtml(show.summary) || `${show.name} is a television series.`,
            tagline: `Original series on ${networkName}.`,
            director: `${networkName} Production`,
            cast: [],
            moods: deriveMoodsFromGenres(genres),
            contentRating: 'TV-MA',
            streamOn: [networkName],
            themeColor: palette.themeColor,
            posterUrl,
            backdropUrl: '',
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

  pool = dedupeMediaItems(pool);

  // Filter by media type strictly
  if (effectiveType !== 'all') {
    pool = pool.filter((item) => item.type === effectiveType);
  }

  if (category === 'trending_india') {
    pool = pool.filter(
      (item) =>
        ['hi', 'te', 'ta', 'ml', 'kn'].includes((item.language || '').toLowerCase()) ||
        INDIAN_TRENDING_ITEMS.some((ind) => ind.id === item.id)
    );
  } else if (category === 'hindi_movies') {
    pool = pool.filter((item) => (item.language || '').toLowerCase() === 'hi');
  } else if (category === 'south_indian_cinema') {
    pool = pool.filter((item) =>
      ['te', 'ta', 'ml', 'kn'].includes((item.language || '').toLowerCase())
    );
  } else if (category === 'anime') {
    pool = pool.filter(
      (item) =>
        item.genres.some((g) => g.toLowerCase() === 'animation') ||
        (item.language || '').toLowerCase() === 'ja'
    );
  } else if (category === 'documentaries') {
    pool = pool.filter((item) =>
      item.genres.some((g) => g.toLowerCase() === 'documentary')
    );
  } else if (category === 'upcoming_movies') {
    pool = pool.filter((item) => item.type === 'movie' && item.year >= 2024);
  } else if (category === 'now_playing_movies' || category === 'recently_released') {
    pool = pool.filter((item) => item.year >= 2023);
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

  if (yearFilter && yearFilter !== 'All' && yearFilter !== 'all') {
    pool = pool.filter((item) => matchesClientYearFilter(item.year, yearFilter));
  }

  if (languageFilter && languageFilter !== 'all') {
    pool = pool.filter(
      (item) => (item.language || 'en').toLowerCase() === languageFilter
    );
  }

  if (minRating > 0) {
    pool = pool.filter((item) => item.rating >= minRating);
  }

  if (!query || sortBy !== 'relevance') {
    if (category === 'top_rated_movies' || category === 'top_rated_tv') {
      pool.sort((a, b) => b.rating - a.rating);
    } else if (
      category === 'upcoming_movies' ||
      category === 'now_playing_movies' ||
      category === 'recently_released'
    ) {
      pool.sort((a, b) => b.year - a.year || b.rating - a.rating);
    } else if (category !== 'trending_india') {
      pool.sort((a, b) => {
        if (sortBy === 'rating') return b.rating - a.rating;
        if (sortBy === 'year') return b.year - a.year || b.rating - a.rating;
        if (sortBy === 'title') return a.title.localeCompare(b.title);
        return (a.popularityRank || 999) - (b.popularityRank || 999);
      });
    }
  }

  if (category === 'top_10_movies' || category === 'top_10_tv') {
    const top10 = pool.slice(0, 10).map((it, idx) => ({ ...it, trendingRank: idx + 1 }));
    return {
      items: top10,
      page: 1,
      totalPages: 1,
      totalResults: top10.length,
      tmdbConfigured: false,
      provider: 'live_open_catalog',
      refreshedAt: new Date().toISOString(),
    };
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
    refreshedAt: new Date().toISOString(),
  };
}

const clientCatalogueCache = new Map<string, { timestamp: number; data: CatalogueResponse }>();
const inFlightCatalogueRequests = new Map<string, Promise<CatalogueResponse>>();
const CLIENT_CATALOGUE_CACHE_TTL_MS = 1000 * 60 * 5; // 5 minutes

const clientTitleDetailsCache = new Map<
  string,
  { timestamp: number; data: { item: MediaItem; similar: MediaItem[] } }
>();
const CLIENT_TITLE_DETAILS_CACHE_TTL_MS = 1000 * 60 * 10; // 10 minutes

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
  if (params.year && params.year !== 'All') searchParams.set('year', params.year);
  if (params.language && params.language !== 'all') {
    searchParams.set('language', params.language);
  }
  if (params.sortBy) searchParams.set('sortBy', params.sortBy);
  if (params.minRating && params.minRating > 0) {
    searchParams.set('minRating', String(params.minRating));
  }
  if (params.query && params.query.trim()) {
    searchParams.set('query', params.query.trim());
  }

  const cacheKey = searchParams.toString();
  const forceRefresh = Boolean(params.refresh);

  if (!forceRefresh) {
    const cached = clientCatalogueCache.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < CLIENT_CATALOGUE_CACHE_TTL_MS) {
      return cached.data;
    }

    if (!signal) {
      const existingInFlight = inFlightCatalogueRequests.get(cacheKey);
      if (existingInFlight) {
        return existingInFlight;
      }
    }
  } else {
    searchParams.set('refresh', 'true');
  }

  const executeRequest = async (): Promise<CatalogueResponse> => {
    // 1. Try remote API first (Node / Express or configured VITE_API_BASE_URL)
    const apiResult = await fetchApiJson<CatalogueResponse>(
      `/api/catalogue?${searchParams.toString()}`,
      { signal }
    );

    if (apiResult && Array.isArray(apiResult.items)) {
      clientCatalogueCache.set(cacheKey, { timestamp: Date.now(), data: apiResult });
      return apiResult;
    }

    // 2. Client-side live expanded catalogue fallback for static hosts (GitHub Pages)
    const clientResult = await resolveClientCatalogue(params, signal);
    clientCatalogueCache.set(cacheKey, { timestamp: Date.now(), data: clientResult });
    return clientResult;
  };

  if (signal || forceRefresh) {
    return executeRequest();
  }

  const requestPromise = executeRequest().finally(() => {
    inFlightCatalogueRequests.delete(cacheKey);
  });
  inFlightCatalogueRequests.set(cacheKey, requestPromise);
  return requestPromise;
}

export async function fetchTitleDetails(
  media: MediaItem
): Promise<{ item: MediaItem; similar: MediaItem[] }> {
  const cacheKey = `${media.type}:${media.id}`;
  const cached = clientTitleDetailsCache.get(cacheKey);
  if (cached && Date.now() - cached.timestamp < CLIENT_TITLE_DETAILS_CACHE_TTL_MS) {
    return cached.data;
  }

  // 1. Try server proxy or configured VITE_API_BASE_URL first
  const apiResult = await fetchApiJson<{ item: MediaItem; similar: MediaItem[] }>(
    `/api/title/${media.type}/${encodeURIComponent(media.id)}`
  );

  if (apiResult && apiResult.item) {
    clientTitleDetailsCache.set(cacheKey, { timestamp: Date.now(), data: apiResult });
    return apiResult;
  }

  const catalog = await getClientLiveExpandedCatalog();
  const found =
    catalog.find((m) => m.id === media.id) ||
    MEDIA_ITEMS.find((m) => m.id === media.id) ||
    EXTRA_ANCHOR_ITEMS.find((m) => m.id === media.id) ||
    media;

  const enriched: MediaItem = { ...found };
  const canonical = extractCanonicalTmdbIdentity(media.id, media.type);

  // 2. Static deployment (e.g. GitHub Pages) direct TMDB lookup via approved VITE_TMDB_API_KEY
  if (CLIENT_TMDB_API_KEY && canonical) {
    try {
      const detail = await fetchClientTmdbJson<any>(
        `/${canonical.mediaType}/${canonical.tmdbId}`,
        { append_to_response: 'credits,recommendations,watch/providers' }
      );
      if (detail && detail.id) {
        if (detail.poster_path) {
          enriched.posterUrl = `${TMDB_IMAGE_W500}${detail.poster_path}`;
        }
        if (detail.backdrop_path) {
          enriched.backdropUrl = `${TMDB_IMAGE_W1280}${detail.backdrop_path}`;
        }
        if (detail.overview) {
          enriched.synopsis = detail.overview;
        }
        if (detail.tagline) {
          enriched.tagline = detail.tagline;
        }
        if (typeof detail.vote_average === 'number' && detail.vote_average > 0) {
          enriched.rating = Number(detail.vote_average.toFixed(1));
        }
        if (canonical.mediaType === 'movie' && typeof detail.runtime === 'number' && detail.runtime > 0) {
          enriched.runtime = `${Math.floor(detail.runtime / 60)}h ${detail.runtime % 60}m`;
        }
        if (canonical.mediaType === 'tv' && Array.isArray(detail.seasons)) {
          const validSeasons: SeasonSummary[] = detail.seasons
            .filter(
              (s: any) =>
                typeof s.season_number === 'number' &&
                s.season_number >= 1 &&
                Number(s.episode_count || 0) > 0
            )
            .map((s: any) => ({
              seasonNumber: s.season_number,
              name: s.name || `Season ${s.season_number}`,
              episodeCount: Number(s.episode_count || 0),
              airDate: s.air_date || undefined,
            }));
          if (validSeasons.length > 0) {
            enriched.seasonsList = validSeasons;
            enriched.seasons =
              typeof detail.number_of_seasons === 'number' && detail.number_of_seasons > 0
                ? detail.number_of_seasons
                : validSeasons.length;
            enriched.totalEpisodes = validSeasons.reduce((acc, s) => acc + s.episodeCount, 0);
          }
        }

        const crew: any[] = detail?.credits?.crew || [];
        const directorObj =
          crew.find((c) => c.job === 'Director') ||
          (Array.isArray(detail?.created_by) && detail.created_by[0]);
        if (directorObj?.name) {
          enriched.director = directorObj.name;
        }

        const rawCast: any[] = detail?.credits?.cast || [];
        if (rawCast.length > 0) {
          enriched.cast = rawCast.slice(0, 6).map(
            (c: any): CastMember => ({
              name: c.name,
              role: c.character || 'Principal Role',
            })
          );
        }

        const watchProviders = normalizeTmdbWatchProviders(
          detail?.['watch/providers'],
          canonical.mediaType,
          canonical.tmdbId,
          'IN'
        );
        enriched.watchProviders = watchProviders;
        enriched.streamOn = Array.from(
          new Set(watchProviders.offers.map((o) => o.providerName))
        );
      }
    } catch {
      // Fall through to open catalog / TVMaze fallback if client TMDB request fails
    }
  }

  // 3. TVMaze metadata enrichment for tvmaze-tv-* records
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

  if (!enriched.watchProviders) {
    enriched.watchProviders = buildUnconfiguredWatchProviders('IN');
  }

  const similar = catalog
    .filter(
      (m) =>
        m.id !== enriched.id &&
        (m.genres.some((g) => enriched.genres.includes(g)) ||
          m.moods.some((mood) => enriched.moods.includes(mood)))
    )
    .slice(0, 4);

  const fallbackResult = { item: enriched, similar };
  clientTitleDetailsCache.set(cacheKey, { timestamp: Date.now(), data: fallbackResult });
  return fallbackResult;
}

export async function fetchTvSeasonEpisodes(
  mediaId: string,
  seasonNumber: number,
  signal?: AbortSignal
): Promise<{ seasonNumber: number; name: string; episodes: EpisodeInfo[] }> {
  // 1. Try remote API first (Express server or VITE_API_BASE_URL)
  const apiResult = await fetchApiJson<{
    seasonNumber: number;
    name: string;
    episodes: EpisodeInfo[];
    error?: string;
  }>(`/api/tv/${encodeURIComponent(mediaId)}/season/${seasonNumber}`, { signal });

  if (apiResult && Array.isArray(apiResult.episodes) && !apiResult.error) {
    return {
      seasonNumber: apiResult.seasonNumber || seasonNumber,
      name: apiResult.name || `Season ${seasonNumber}`,
      episodes: apiResult.episodes,
    };
  }

  // 2. Direct TMDB season lookup for static deployments (GitHub Pages) when VITE_TMDB_API_KEY is configured
  const canonical = extractCanonicalTmdbIdentity(mediaId, 'tv');
  if (CLIENT_TMDB_API_KEY && canonical && canonical.mediaType === 'tv') {
    const seasonData = await fetchClientTmdbJson<any>(
      `/tv/${canonical.tmdbId}/season/${seasonNumber}`,
      {},
      signal
    );
    if (seasonData && Array.isArray(seasonData.episodes)) {
      const episodes: EpisodeInfo[] = seasonData.episodes.map((ep: any, idx: number) => ({
        episodeNumber: Number(ep.episode_number) || idx + 1,
        seasonNumber,
        name: ep.name || `Episode ${idx + 1}`,
        airDate: ep.air_date || undefined,
        runtime: typeof ep.runtime === 'number' && ep.runtime > 0 ? ep.runtime : undefined,
        overview: ep.overview || undefined,
        stillUrl: ep.still_path ? `${TMDB_IMAGE_W500}${ep.still_path}` : undefined,
      }));
      return {
        seasonNumber,
        name: seasonData.name || `Season ${seasonNumber}`,
        episodes,
      };
    }
  }

  // 3. Client-side TVMaze season episodes for tvmaze-tv-*
  if (mediaId.startsWith('tvmaze-tv-')) {
    const showId = mediaId.replace('tvmaze-tv-', '');
    try {
      const epRes = await fetch(`https://api.tvmaze.com/shows/${showId}/episodes`, { signal });
      if (epRes.ok) {
        const allEps = await epRes.json();
        if (Array.isArray(allEps)) {
          const seasonEps = allEps.filter((e: any) => Number(e?.season) === seasonNumber);
          const episodes: EpisodeInfo[] = seasonEps.map((ep: any, idx: number) => ({
            episodeNumber: Number(ep.number) || idx + 1,
            seasonNumber,
            name: ep.name || `Episode ${idx + 1}`,
            airDate: ep.airdate || undefined,
            runtime: typeof ep.runtime === 'number' && ep.runtime > 0 ? ep.runtime : undefined,
            overview: stripHtml(ep.summary || '') || undefined,
            stillUrl: ep.image?.medium || ep.image?.original || undefined,
          }));
          return {
            seasonNumber,
            name: `Season ${seasonNumber}`,
            episodes,
          };
        }
      }
    } catch (err: any) {
      if (err?.name === 'AbortError') throw err;
      throw new Error(`Failed to load Season ${seasonNumber} episodes from TVMaze.`);
    }
  }

  // Never fabricate default 8-episode lists or synthetic release dates/runtimes
  throw new Error(
    CLIENT_TMDB_API_KEY || !staticHostWithoutApi
      ? `Unable to retrieve verified episode metadata for Season ${seasonNumber}.`
      : 'Episode metadata requires a configured backend (VITE_API_BASE_URL) or client TMDB key (VITE_TMDB_API_KEY).'
  );
}

/**
 * Queries server-side authorized online source discovery (/api/online-sources/:type/:id)
 * when available, merges any verified official-channel sources into the registry,
 * and returns the updated OnlinePlaybackLookupResult.
 */
export async function fetchOnlinePlaybackSources(
  media: MediaItem,
  signal?: AbortSignal
): Promise<OnlinePlaybackLookupResult> {
  const apiResult = await fetchApiJson<OnlinePlaybackLookupResult>(
    `/api/online-sources/${media.type}/${encodeURIComponent(media.id)}?title=${encodeURIComponent(
      media.title
    )}`,
    { signal }
  );

  if (apiResult && Array.isArray(apiResult.sources) && apiResult.sources.length > 0) {
    registerDiscoveredOnlineSources(apiResult.sources);
    return lookupOnlinePlaybackSources(media);
  }

  return lookupOnlinePlaybackSources(media);
}

// ============================================================================
// Official TMDB Trailer & Video Lookup (Server Proxy + Static Host Fallback)
// ============================================================================

export { SEED_TO_TMDB_ID };

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
    if (
      vType === 'Trailer' ||
      vType === 'Teaser' ||
      vType === 'Clip' ||
      vType === 'Featurette' ||
      vType === 'Opening Credits'
    ) {
      return true;
    }
    return (
      lowerName.includes('trailer') ||
      lowerName.includes('teaser') ||
      lowerName.includes('promo') ||
      lowerName.includes('preview')
    );
  });

  const scored = candidates.map((v, idx) => {
    const key = String(v.key).trim();
    const rawType = String(v.type || '');
    const name = String(v.name || rawType || 'Trailer').trim();
    const lowerName = name.toLowerCase();
    const vType: TrailerVideo['type'] =
      rawType === 'Trailer' || (rawType !== 'Teaser' && lowerName.includes('trailer'))
        ? 'Trailer'
        : rawType === 'Teaser' || lowerName.includes('teaser')
        ? 'Teaser'
        : rawType === 'Featurette'
        ? 'Featurette'
        : 'Clip';
    const official = Boolean(v.official);
    const isoLang = String(v.iso_639_1 || '').toLowerCase();
    const size = Number(v.size) || 0;
    const publishedMs = v.published_at ? Date.parse(String(v.published_at)) || 0 : 0;

    let score = 0;
    if (vType === 'Trailer') score += 1000;
    else if (vType === 'Teaser') score += 500;
    else if (vType === 'Clip') score += 200;
    else score += 150;

    if (official) score += 500;
    if (!isoLang || isoLang === 'en') score += 220;
    else if (['hi', 'te', 'ta', 'ml', 'kn'].includes(isoLang)) score += 190;
    else if (['ja', 'ko', 'es', 'fr'].includes(isoLang)) score += 160;

    if (lowerName.includes('official trailer')) score += 180;
    else if (lowerName.includes('main trailer') || lowerName.includes('final trailer')) score += 140;
    else if (lowerName.includes('official teaser')) score += 110;
    else if (lowerName.includes('trailer')) score += 90;

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
  return extractCanonicalTmdbIdentity(mediaId, mediaType);
}

/**
 * Resolves verified TMDB trailers on static hosts (such as GitHub Pages)
 * where Express server routes (/api/trailer/*) are unavailable.
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

  // If VITE_TMDB_API_KEY is configured for client-side static builds, query TMDB videos directly
  if (CLIENT_TMDB_API_KEY) {
    try {
      const headers: Record<string, string> = { Accept: 'application/json' };
      const buildTmdbUrl = (path: string, params: Record<string, string>) => {
        const u = new URL(`https://api.themoviedb.org/3${path}`);
        u.searchParams.set('api_key', CLIENT_TMDB_API_KEY);
        for (const [k, v] of Object.entries(params)) {
          if (v) u.searchParams.set(k, v);
        }
        return u.toString();
      };

      let resolved = direct;
      if (!resolved && media.title) {
        const searchPath = media.type === 'tv' ? '/search/tv' : '/search/movie';
        const sRes = await fetch(
          buildTmdbUrl(searchPath, { query: media.title, include_adult: 'false' }),
          { headers, signal }
        );
        if (sRes.ok) {
          const sData = await sRes.json();
          const first = sData?.results?.[0];
          if (first?.id) {
            resolved = { mediaType: media.type, tmdbId: Number(first.id) };
          }
        }
      }

      if (resolved) {
        const vRes = await fetch(
          buildTmdbUrl(`/${resolved.mediaType}/${resolved.tmdbId}/videos`, {
            language: 'en-US',
            include_video_language: 'en,hi,te,ta,ml,kn,ja,ko,es,fr,null',
          }),
          { headers, signal }
        );
        if (vRes.ok) {
          const vData = await vRes.json();
          const ranked = rankTmdbVideos(vData?.results || [], media.title);
          if (ranked.length > 0) {
            return {
              status: 'ok',
              tmdbId: resolved.tmdbId,
              mediaType: resolved.mediaType,
              primaryVideo: ranked[0],
              videos: ranked,
              youtubeSearchUrl,
            };
          }
        }
      }
    } catch (err: any) {
      if (err?.name === 'AbortError') throw err;
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
                .map((b) => String(b?.video?.value || '').trim())
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
  signal?: AbortSignal,
  options?: { refresh?: boolean }
): Promise<TrailerLookupResult> {
  const cacheKey = `${media.type}:${media.id}`;
  if (!options?.refresh) {
    const cached = clientTrailerCache.get(cacheKey);
    if (
      cached &&
      cached.data.status === 'ok' &&
      Date.now() - cached.timestamp < CLIENT_TRAILER_CACHE_TTL_MS
    ) {
      return cached.data;
    }
  }

  // 1. Try server proxy endpoint (/api/trailer/:type/:id) first
  const queryParams = new URLSearchParams({
    title: media.title,
    year: media.year ? String(media.year) : '',
  });
  if (options?.refresh) {
    queryParams.set('refresh', 'true');
  }
  const serverResult = await fetchApiJson<TrailerLookupResult>(
    `/api/trailer/${media.type}/${encodeURIComponent(media.id)}?${queryParams.toString()}`,
    { signal }
  );

  if (serverResult) {
    if (serverResult.status === 'ok') {
      clientTrailerCache.set(cacheKey, { timestamp: Date.now(), data: serverResult });
      return serverResult;
    }
    // If server returned unavailable, also check client static verified index before giving up
    const staticFallback = await resolveStaticHostTrailers(media, signal);
    if (staticFallback.status === 'ok') {
      clientTrailerCache.set(cacheKey, { timestamp: Date.now(), data: staticFallback });
      return staticFallback;
    }
    return serverResult;
  }

  // 2. Static host (GitHub Pages) fallback when Express server route is unavailable
  const fallbackResult = await resolveStaticHostTrailers(media, signal);
  if (fallbackResult.status === 'ok') {
    clientTrailerCache.set(cacheKey, { timestamp: Date.now(), data: fallbackResult });
  }
  return fallbackResult;
}


