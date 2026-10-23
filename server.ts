import 'dotenv/config';
import express from 'express';
import http from 'http';
import path from 'path';
import { fileURLToPath } from 'url';
import { createServer as createViteServer } from 'vite';
import { MEDIA_ITEMS } from './src/data/mediaData.ts';
import type { MediaItem, CastMember, SeasonSummary, EpisodeInfo } from './src/types/index.ts';
import { processAdminRequest } from './src/server/adminHandler.ts';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = 3000;
const TMDB_BASE_URL = 'https://api.themoviedb.org/3';
const TMDB_IMAGE_W500 = 'https://image.tmdb.org/t/p/w500';
const TMDB_IMAGE_W1280 = 'https://image.tmdb.org/t/p/w1280';

// Official TMDB Genre ID maps
const TMDB_MOVIE_GENRES: Record<number, string> = {
  28: 'Action',
  12: 'Adventure',
  16: 'Animation',
  35: 'Comedy',
  80: 'Crime',
  99: 'Documentary',
  18: 'Drama',
  10751: 'Family',
  14: 'Fantasy',
  36: 'History',
  27: 'Horror',
  10402: 'Music',
  9648: 'Mystery',
  10749: 'Romance',
  878: 'Sci-Fi',
  10770: 'TV Movie',
  53: 'Thriller',
  10752: 'War',
  37: 'Western',
};

const TMDB_TV_GENRES: Record<number, string> = {
  10759: 'Action',
  16: 'Animation',
  35: 'Comedy',
  80: 'Crime',
  99: 'Documentary',
  18: 'Drama',
  10751: 'Family',
  10762: 'Kids',
  9648: 'Mystery',
  10763: 'News',
  10764: 'Reality',
  10765: 'Sci-Fi',
  10766: 'Soap',
  10767: 'Talk',
  10768: 'War',
  37: 'Western',
};

const GENRE_NAME_TO_MOVIE_ID: Record<string, number> = {
  'Sci-Fi': 878,
  Drama: 18,
  Thriller: 53,
  Crime: 80,
  Mystery: 9648,
  Action: 28,
  Fantasy: 14,
  Animation: 16,
  History: 36,
  Comedy: 35,
  Horror: 27,
  Romance: 10749,
  Adventure: 12,
};

const GENRE_NAME_TO_TV_ID: Record<string, number> = {
  'Sci-Fi': 10765,
  Drama: 18,
  Thriller: 9648,
  Crime: 80,
  Mystery: 9648,
  Action: 10759,
  Fantasy: 10765,
  Animation: 16,
  History: 18,
  Comedy: 35,
  Horror: 9648,
  Romance: 18,
  Adventure: 10759,
};

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

function getTmdbKey(): string {
  const raw = (process.env.TMDB_API_KEY || process.env.TMDB_READ_ACCESS_TOKEN || '').trim();
  if (!raw || raw === 'MY_TMDB_API_KEY' || raw === 'YOUR_TMDB_API_KEY') return '';
  return raw;
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

function formatVoteCount(count: number): string {
  if (!count || count <= 0) return '0';
  if (count >= 1_000_000) return `${(count / 1_000_000).toFixed(1)}M`;
  if (count >= 1_000) return `${Math.round(count / 1_000)}k`;
  return String(count);
}

function hashString(str: string): number {
  let h = 0;
  for (let i = 0; i < str.length; i++) {
    h = (h * 31 + str.charCodeAt(i)) >>> 0;
  }
  return h;
}

export function normalizeForSearch(text: string): string {
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

function rankTmdbSearchResults(
  rawResults: any[],
  forcedType: 'movie' | 'tv' | undefined,
  query: string
): any[] {
  const normQuery = normalizeForSearch(query);
  if (!normQuery) return rawResults;
  const queryWords = normQuery.split(' ').filter(Boolean);

  const scored = rawResults.map((raw, tmdbIndex) => {
    const mediaType: 'movie' | 'tv' =
      forcedType ||
      (raw.media_type === 'tv' || raw.first_air_date !== undefined || raw.name !== undefined
        ? 'tv'
        : 'movie');

    const displayTitle =
      (mediaType === 'tv' ? raw.name || raw.original_name : raw.title || raw.original_title) || '';
    const originalTitle =
      (mediaType === 'tv' ? raw.original_name : raw.original_title) || '';

    const normDisplay = normalizeForSearch(displayTitle);
    const normOrig = normalizeForSearch(originalTitle);
    const displayWords = normDisplay ? normDisplay.split(' ') : [];
    const origWords = normOrig ? normOrig.split(' ') : [];

    const displayTier = getTitleMatchTier(normDisplay, displayWords, normQuery, queryWords);
    const origTier = getTitleMatchTier(normOrig, origWords, normQuery, queryWords);

    // Primary display title takes precedence; foreign/alternate original_title matches are capped below strong display matches
    const effectiveTier =
      normDisplay === normOrig ? displayTier : Math.max(displayTier, Math.min(origTier, 1.9));

    const voteCount = Number(raw.vote_count || 0);
    const isEstablished = voteCount >= 15;

    let bucket: number;
    if (effectiveTier >= 2.0) {
      bucket = (isEstablished ? 10 : 5) + effectiveTier;
    } else {
      bucket = (isEstablished ? 2 : 0) + effectiveTier;
    }

    return {
      raw,
      tmdbIndex,
      bucket,
      displayTier,
      voteCount,
    };
  });

  scored.sort((a, b) => {
    if (Math.abs(b.bucket - a.bucket) > 0.001) {
      return b.bucket - a.bucket;
    }
    // Within exact title matches, prefer the canonical release if one has >3x the votes of another
    if (a.displayTier === 4.0 && b.displayTier === 4.0) {
      if (a.voteCount > b.voteCount * 3 || b.voteCount > a.voteCount * 3) {
        return b.voteCount - a.voteCount;
      }
    }
    // Otherwise preserve TMDB's native relevance ranking
    return a.tmdbIndex - b.tmdbIndex;
  });

  return scored.map((s) => s.raw);
}

function mapTmdbItemToMediaItem(raw: any, forcedType?: 'movie' | 'tv', indexOffset = 0): MediaItem {
  const mediaType: 'movie' | 'tv' =
    forcedType ||
    (raw.media_type === 'tv' || raw.first_air_date !== undefined || raw.name !== undefined
      ? 'tv'
      : 'movie');
  const tmdbId = raw.id;
  const id = `tmdb-${mediaType}-${tmdbId}`;
  const title =
    (mediaType === 'tv' ? raw.name || raw.original_name : raw.title || raw.original_title) ||
    'Untitled';
  const dateStr = (mediaType === 'tv' ? raw.first_air_date : raw.release_date) || '';
  const parsedYear = dateStr ? parseInt(dateStr.slice(0, 4), 10) : 0;
  const year = Number.isFinite(parsedYear) && parsedYear > 0 ? parsedYear : 0;

  const genreMap = mediaType === 'tv' ? TMDB_TV_GENRES : TMDB_MOVIE_GENRES;
  let genres: string[] = [];
  if (Array.isArray(raw.genre_ids)) {
    genres = raw.genre_ids.map((gid: number) => genreMap[gid]).filter(Boolean);
  } else if (Array.isArray(raw.genres)) {
    genres = raw.genres.map((g: any) => g.name).filter(Boolean);
  }
  if (genres.length === 0) genres = ['Drama'];

  const rating =
    typeof raw.vote_average === 'number' && raw.vote_average > 0
      ? Number(raw.vote_average.toFixed(1))
      : 0;

  const palette = PALETTES[hashString(id) % PALETTES.length];
  const posterUrl = raw.poster_path
    ? `${TMDB_IMAGE_W500}${raw.poster_path}`
    : raw.backdrop_path
    ? `${TMDB_IMAGE_W500}${raw.backdrop_path}`
    : '';
  const backdropUrl = raw.backdrop_path
    ? `${TMDB_IMAGE_W1280}${raw.backdrop_path}`
    : posterUrl;

  const seasonsList: SeasonSummary[] | undefined =
    mediaType === 'tv' && Array.isArray(raw.seasons)
      ? raw.seasons
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
          }))
      : undefined;

  const computedTotalEpisodes =
    seasonsList && seasonsList.length > 0
      ? seasonsList.reduce((acc, s) => acc + s.episodeCount, 0)
      : typeof raw.number_of_episodes === 'number' && raw.number_of_episodes > 0
      ? raw.number_of_episodes
      : undefined;

  return {
    id,
    title,
    type: mediaType,
    year,
    runtime:
      mediaType === 'movie'
        ? raw.runtime
          ? `${Math.floor(raw.runtime / 60)}h ${raw.runtime % 60}m`
          : undefined
        : undefined,
    seasons:
      mediaType === 'tv' && typeof raw.number_of_seasons === 'number' && raw.number_of_seasons > 0
        ? raw.number_of_seasons
        : seasonsList && seasonsList.length > 0
        ? seasonsList.length
        : undefined,
    totalEpisodes: computedTotalEpisodes,
    seasonsList,
    genres,
    rating,
    voteCount: formatVoteCount(raw.vote_count || 0),
    synopsis:
      raw.overview ||
      'Synopsis not yet available for this title.',
    tagline: raw.tagline || `Experience ${title}.`,
    director: 'Acclaimed Filmmaker',
    cast: [],
    moods: deriveMoodsFromGenres(genres),
    contentRating: mediaType === 'tv' ? 'TV-MA' : raw.adult ? 'R' : 'PG-13',
    trendingRank: indexOffset > 0 ? indexOffset : undefined,
    streamOn: ['Max', 'Prime Video', 'Apple TV'],
    themeColor: palette.themeColor,
    posterUrl,
    backdropUrl,
    posterVisual: {
      bgFrom: palette.bgFrom,
      bgTo: palette.bgTo,
      accent: palette.accent,
      iconType: palette.iconType,
    },
  };
}

async function fetchFromTmdb(endpoint: string, params: Record<string, string | number | undefined> = {}) {
  const apiKey = getTmdbKey();
  if (!apiKey) throw new Error('TMDB_API_KEY is not configured');

  const url = new URL(`${TMDB_BASE_URL}${endpoint}`);
  const headers: Record<string, string> = {
    Accept: 'application/json',
  };

  // Support both v4 JWT Read Access Token and v3 32-char API key
  if (apiKey.startsWith('eyJ') || apiKey.length > 45) {
    headers.Authorization = `Bearer ${apiKey}`;
  } else {
    url.searchParams.set('api_key', apiKey);
  }

  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined && v !== '') {
      url.searchParams.set(k, String(v));
    }
  }

  const res = await fetch(url.toString(), { headers });
  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`TMDB API Error (${res.status}): ${errText.slice(0, 160)}`);
  }
  return res.json();
}

// ============================================================================
// Live Open Catalog Provider (Used when TMDB_API_KEY is not yet configured)
// ============================================================================
let cachedLiveCatalog: MediaItem[] | null = null;
let lastCacheTimestamp = 0;

function stripHtml(html: string): string {
  return (html || '').replace(/<[^>]*>/g, '').trim();
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

async function getLiveExpandedCatalog(): Promise<MediaItem[]> {
  const now = Date.now();
  if (cachedLiveCatalog && cachedLiveCatalog.length > 60 && now - lastCacheTimestamp < 1000 * 60 * 30) {
    return cachedLiveCatalog;
  }

  const byTitleKey = new Map<string, MediaItem>();

  // 1. Seed with the 20 rich TMDB-poster anchor titles
  for (const item of MEDIA_ITEMS) {
    byTitleKey.set(`${item.type}:${item.title.toLowerCase()}`, item);
  }

  // 2. Fetch live Movies from Apple iTunes Movie RSS genre feeds (All, Action, Drama, Sci-Fi, Thriller, Comedy, Horror)
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
      const genres = Array.from(new Set([normalizedGenre, rawGenre !== normalizedGenre ? rawGenre : 'Drama'])).slice(0, 2);

      const director = entry?.['im:artist']?.label || 'Visionary Director';
      const synopsis = entry?.summary?.label || `${title} is a feature film directed by ${director}.`;
      const durationMs = Number(entry?.link?.[1]?.['im:duration']?.label || 0);
      const totalMins = durationMs > 0 ? Math.round(durationMs / 60000) : 124;
      const runtime = `${Math.floor(totalMins / 60)}h ${totalMins % 60}m`;

      const h = hashString(id);
      const palette = PALETTES[h % PALETTES.length];
      const deterministicRating = Number((7.1 + ((h % 21) / 10)).toFixed(1));
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
        contentRating: entry?.['im:contentType']?.attributes?.label === 'Movie' ? 'PG-13' : 'R',
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

  // 3. Fetch live TV Shows from TVMaze API (Pages 0 and 1 -> up to 480 real shows)
  const tvPages = await Promise.allSettled([
    fetch('https://api.tvmaze.com/shows?page=0').then((r) => (r.ok ? r.json() : [])),
    fetch('https://api.tvmaze.com/shows?page=1').then((r) => (r.ok ? r.json() : [])),
  ]);

  let tvRankCounter = 21;
  for (const res of tvPages) {
    if (res.status !== 'fulfilled' || !Array.isArray(res.value)) continue;
    // Take top rated / popular shows with valid images
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
      const rawGenres: string[] = Array.isArray(show.genres) && show.genres.length > 0 ? show.genres : ['Drama'];
      const genres = Array.from(new Set(rawGenres.map(normalizeGenreName))).slice(0, 3);
      const rating = Number((show.rating?.average || 7.8).toFixed(1));
      const synopsis = stripHtml(show.summary) || `${title} is an acclaimed television series.`;
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

  cachedLiveCatalog = Array.from(byTitleKey.values());
  lastCacheTimestamp = now;
  return cachedLiveCatalog;
}

async function startServer() {
  const app = express();
  const httpServer = http.createServer(app);
  app.use(express.json());

  // 1. Health, TMDB & Public Supabase Configuration Status Endpoint
  app.get('/api/status', (_req, res) => {
    const tmdbConfigured = Boolean(getTmdbKey());
    const rawSupabaseUrl = (
      process.env.VITE_SUPABASE_URL ||
      process.env.SUPABASE_URL ||
      ''
    ).trim();
    const rawSupabaseAnonKey = (
      process.env.VITE_SUPABASE_ANON_KEY ||
      process.env.SUPABASE_ANON_KEY ||
      ''
    ).trim();

    // Security guard: ensure a secret or service_role key is NEVER returned as an anon key
    let isServiceRole = rawSupabaseAnonKey.startsWith('sb_secret_');
    if (!isServiceRole && rawSupabaseAnonKey.split('.').length === 3) {
      try {
        const payloadJson = Buffer.from(rawSupabaseAnonKey.split('.')[1], 'base64').toString('utf8');
        const payload = JSON.parse(payloadJson);
        if (payload?.role === 'service_role') {
          isServiceRole = true;
        }
      } catch {
        // Ignore malformed JWT segment
      }
    }

    let validSupabaseUrl = '';
    if (rawSupabaseUrl.startsWith('https://') || rawSupabaseUrl.startsWith('http://')) {
      try {
        validSupabaseUrl = new URL(rawSupabaseUrl).origin;
      } catch {
        validSupabaseUrl = rawSupabaseUrl
          .replace(/\/(rest|auth|realtime|storage)\/v1\/?.*$/i, '')
          .replace(/\/+$/, '');
      }
    }
    const validSupabaseAnonKey =
      !isServiceRole && rawSupabaseAnonKey.length > 20 ? rawSupabaseAnonKey : '';

    res.json({
      tmdbConfigured,
      provider: tmdbConfigured ? 'tmdb' : 'live_open_catalog',
      supabaseConfigured: Boolean(validSupabaseUrl && validSupabaseAnonKey),
      supabaseSecurityWarning: isServiceRole
        ? 'A secret/service_role key was detected in SUPABASE_ANON_KEY. Refusing to expose it to the client.'
        : undefined,
      supabaseUrl: validSupabaseUrl || undefined,
      supabaseAnonKey: validSupabaseAnonKey || undefined,
    });
  });

  // 2. Paginated Catalogue & Search Endpoint
  app.get('/api/catalogue', async (req, res) => {
    const category = String(req.query.category || 'discover');
    const page = Math.max(1, parseInt(String(req.query.page || '1'), 10) || 1);
    const rawType = String(req.query.type || 'all') as 'all' | 'movie' | 'tv';
    const effectiveType: 'all' | 'movie' | 'tv' =
      rawType === 'movie' || rawType === 'tv'
        ? rawType
        : category.includes('movies')
        ? 'movie'
        : category.includes('_tv')
        ? 'tv'
        : 'all';
    const genre = String(req.query.genre || 'All');
    const mood = String(req.query.mood || 'all');
    const sortBy = String(req.query.sortBy || 'popularity') as 'popularity' | 'rating' | 'year' | 'title';
    const minRating = parseFloat(String(req.query.minRating || '0')) || 0;
    const query = String(req.query.query || '').trim();

    const tmdbKey = getTmdbKey();

    // ========================================================================
    // PATH A: Official TMDB v3 API Integration (When TMDB_API_KEY is present)
    // ========================================================================
    if (tmdbKey) {
      try {
        let data: any;
        let forcedType: 'movie' | 'tv' | undefined;

        if (query) {
          const searchEndpoint =
            effectiveType === 'movie'
              ? '/search/movie'
              : effectiveType === 'tv'
              ? '/search/tv'
              : '/search/multi';
          if (effectiveType === 'movie') forcedType = 'movie';
          if (effectiveType === 'tv') forcedType = 'tv';
          data = await fetchFromTmdb(searchEndpoint, {
            query,
            page,
            include_adult: 'false',
          });
        } else if (category === 'trending') {
          data = await fetchFromTmdb('/trending/all/week', { page });
        } else if (category === 'popular_movies') {
          forcedType = 'movie';
          data = await fetchFromTmdb('/movie/popular', { page });
        } else if (category === 'top_rated_movies') {
          forcedType = 'movie';
          data = await fetchFromTmdb('/movie/top_rated', { page });
        } else if (category === 'upcoming_movies') {
          forcedType = 'movie';
          data = await fetchFromTmdb('/movie/upcoming', { page });
        } else if (category === 'popular_tv') {
          forcedType = 'tv';
          data = await fetchFromTmdb('/tv/popular', { page });
        } else if (category === 'top_rated_tv') {
          forcedType = 'tv';
          data = await fetchFromTmdb('/tv/top_rated', { page });
        } else {
          // Helper to build TMDB /discover/{movie|tv} parameters with proper genre intersection (AND via ',')
          const buildDiscoverParams = (targetType: 'movie' | 'tv') => {
            const sortMap: Record<string, string> = {
              popularity: 'popularity.desc',
              rating: 'vote_average.desc',
              year: targetType === 'tv' ? 'first_air_date.desc' : 'primary_release_date.desc',
              title: targetType === 'tv' ? 'name.asc' : 'original_title.asc',
            };

            const genreLookup = targetType === 'tv' ? GENRE_NAME_TO_TV_ID : GENRE_NAME_TO_MOVIE_ID;
            const selectedGenreNames = genre
              .split(',')
              .map((g) => g.trim())
              .filter((g) => g && g !== 'All');

            const genreIds: number[] = [];
            for (const gName of selectedGenreNames) {
              const gId = genreLookup[gName];
              if (gId && !genreIds.includes(gId)) {
                genreIds.push(gId);
              }
            }

            if (mood !== 'all' && MOOD_TO_GENRES[mood]) {
              const moodGenres = MOOD_TO_GENRES[mood];
              const alreadyMatchesMood = selectedGenreNames.some((gName) =>
                moodGenres.includes(gName)
              );
              if (!alreadyMatchesMood) {
                const moodGenreName = moodGenres.find((mg) => Boolean(genreLookup[mg]));
                if (moodGenreName && !genreIds.includes(genreLookup[moodGenreName])) {
                  genreIds.push(genreLookup[moodGenreName]);
                }
              }
            }

            return {
              page,
              sort_by: sortMap[sortBy] || 'popularity.desc',
              with_genres: genreIds.length > 0 ? genreIds.join(',') : undefined,
              'vote_average.gte': minRating > 0 ? minRating : undefined,
              'vote_count.gte': sortBy === 'rating' ? 300 : 50,
            };
          };

          if (effectiveType === 'all') {
            const [movieData, tvData] = await Promise.all([
              fetchFromTmdb('/discover/movie', buildDiscoverParams('movie')),
              fetchFromTmdb('/discover/tv', buildDiscoverParams('tv')),
            ]);

            const movieResults: any[] = (Array.isArray(movieData?.results) ? movieData.results : [])
              .filter((r: any) => r.poster_path || r.backdrop_path)
              .slice(0, 10);
            const tvResults: any[] = (Array.isArray(tvData?.results) ? tvData.results : [])
              .filter((r: any) => r.poster_path || r.backdrop_path)
              .slice(0, 10);

            const combinedRaw: Array<{ raw: any; mediaType: 'movie' | 'tv' }> = [
              ...movieResults.map((raw) => ({ raw, mediaType: 'movie' as const })),
              ...tvResults.map((raw) => ({ raw, mediaType: 'tv' as const })),
            ];

            combinedRaw.sort((a, b) => {
              if (sortBy === 'rating') {
                return (b.raw.vote_average || 0) - (a.raw.vote_average || 0);
              }
              if (sortBy === 'year') {
                const yearA = parseInt(
                  String(a.raw.release_date || a.raw.first_air_date || '0').slice(0, 4),
                  10
                );
                const yearB = parseInt(
                  String(b.raw.release_date || b.raw.first_air_date || '0').slice(0, 4),
                  10
                );
                return yearB - yearA || (b.raw.popularity || 0) - (a.raw.popularity || 0);
              }
              if (sortBy === 'title') {
                const titleA = String(a.raw.title || a.raw.name || '');
                const titleB = String(b.raw.title || b.raw.name || '');
                return titleA.localeCompare(titleB);
              }
              return (b.raw.popularity || 0) - (a.raw.popularity || 0);
            });

            const items = combinedRaw.map((entry, idx) =>
              mapTmdbItemToMediaItem(entry.raw, entry.mediaType, (page - 1) * 20 + idx + 1)
            );

            const totalPages = Math.min(
              Math.max(movieData?.total_pages || 1, tvData?.total_pages || 1),
              500
            );
            const totalResults = (movieData?.total_results || 0) + (tvData?.total_results || 0);

            return res.json({
              items,
              page,
              totalPages,
              totalResults,
              tmdbConfigured: true,
              provider: 'tmdb',
            });
          } else {
            const targetType: 'movie' | 'tv' = effectiveType === 'tv' ? 'tv' : 'movie';
            forcedType = targetType;
            data = await fetchFromTmdb(`/discover/${targetType}`, buildDiscoverParams(targetType));
          }
        }

        const rawResults: any[] = Array.isArray(data?.results) ? data.results : [];

        let filteredRaw: any[];
        if (query) {
          filteredRaw = rawResults.filter((r) => {
            if (effectiveType === 'movie') {
              return !r.media_type || r.media_type === 'movie';
            }
            if (effectiveType === 'tv') {
              return !r.media_type || r.media_type === 'tv';
            }
            return r.media_type === 'movie' || r.media_type === 'tv';
          });
          filteredRaw = rankTmdbSearchResults(filteredRaw, forcedType, query);
        } else {
          filteredRaw = rawResults.filter(
            (r) => r.media_type !== 'person' && (r.poster_path || r.backdrop_path)
          );
        }

        const items = filteredRaw.map((r, idx) =>
          mapTmdbItemToMediaItem(r, forcedType, (page - 1) * 20 + idx + 1)
        );

        return res.json({
          items,
          page: data?.page || page,
          totalPages: Math.min(data?.total_pages || 1, 500),
          totalResults: data?.total_results || items.length,
          tmdbConfigured: true,
          provider: 'tmdb',
        });
      } catch (err: any) {
        return res.status(502).json({
          error: err.message || 'Failed to fetch from TMDB API',
          tmdbConfigured: true,
          provider: 'tmdb',
        });
      }
    }

    // ========================================================================
    // PATH B: Live Multi-Page Open Catalog (When TMDB_API_KEY is not yet set)
    // ========================================================================
    try {
      const catalog = await getLiveExpandedCatalog();
      let pool = [...catalog];

      // If user searches a specific query, also query live TVMaze search endpoint to find any show on earth
      if (query.length >= 2 && effectiveType !== 'movie') {
        try {
          const liveTvRes = await fetch(
            `https://api.tvmaze.com/search/shows?q=${encodeURIComponent(query)}`
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
        } catch {
          // Ignore transient search enrichment error
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
        // Non-search browse filters
        if (category === 'top_rated_movies' || category === 'top_rated_tv') {
          pool.sort((a, b) => b.rating - a.rating);
        } else if (category === 'upcoming_movies') {
          pool.sort((a, b) => b.year - a.year || b.rating - a.rating);
        }

        if (genre !== 'All') {
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

        if (mood !== 'all') {
          pool = pool.filter((item) => item.moods.includes(mood));
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

      return res.json({
        items: pagedItems,
        page,
        totalPages,
        totalResults,
        tmdbConfigured: false,
        provider: 'live_open_catalog',
      });
    } catch (err: any) {
      return res.status(500).json({
        error: err.message || 'Failed to load catalogue',
        tmdbConfigured: false,
        provider: 'live_open_catalog',
      });
    }
  });

  // 3. Detailed Title Endpoint (Enriches cast, director, runtime, similar titles)
  const SEED_TO_TMDB_ID: Record<string, { mediaType: 'movie' | 'tv'; tmdbId: string }> = {
    'dune-part-two': { mediaType: 'movie', tmdbId: '693134' },
    severance: { mediaType: 'tv', tmdbId: '95396' },
    oppenheimer: { mediaType: 'movie', tmdbId: '872585' },
    shogun: { mediaType: 'tv', tmdbId: '126308' },
    'blade-runner-2049': { mediaType: 'movie', tmdbId: '335984' },
    succession: { mediaType: 'tv', tmdbId: '76331' },
    interstellar: { mediaType: 'movie', tmdbId: '157336' },
    'the-bear': { mediaType: 'tv', tmdbId: '136315' },
    arcane: { mediaType: 'tv', tmdbId: '94605' },
    mindhunter: { mediaType: 'tv', tmdbId: '67744' },
    'past-lives': { mediaType: 'movie', tmdbId: '666277' },
    'poor-things': { mediaType: 'movie', tmdbId: '792307' },
    dark: { mediaType: 'tv', tmdbId: '70523' },
    'the-batman': { mediaType: 'movie', tmdbId: '414906' },
    chernobyl: { mediaType: 'tv', tmdbId: '87108' },
    arrival: { mediaType: 'movie', tmdbId: '329865' },
    'spirited-away': { mediaType: 'movie', tmdbId: '129' },
    fallout: { mediaType: 'tv', tmdbId: '106379' },
    'true-detective-s1': { mediaType: 'tv', tmdbId: '46648' },
    'everything-everywhere-all-at-once': { mediaType: 'movie', tmdbId: '545611' },
  };

  app.get('/api/title/:type/:id', async (req, res) => {
    const { id } = req.params;
    const tmdbKey = getTmdbKey();

    // If TMDB_API_KEY is configured and ID is either tmdb-* or one of the 20 seed titles
    const seedMatch = SEED_TO_TMDB_ID[id];
    if (tmdbKey && (id.startsWith('tmdb-') || seedMatch)) {
      try {
        let mediaType: 'movie' | 'tv';
        let rawTmdbId: string;

        if (seedMatch) {
          mediaType = seedMatch.mediaType;
          rawTmdbId = seedMatch.tmdbId;
        } else {
          const parts = id.split('-');
          mediaType = (parts[1] === 'tv' ? 'tv' : 'movie') as 'movie' | 'tv';
          rawTmdbId = parts[2];
        }

        const detail = await fetchFromTmdb(`/${mediaType}/${rawTmdbId}`, {
          append_to_response: 'credits,recommendations,watch/providers',
        });

        const baseItem = mapTmdbItemToMediaItem(detail, mediaType);
        // Preserve original seed ID so watchlist state stays linked
        if (seedMatch) {
          baseItem.id = id;
        }

        const crew: any[] = detail?.credits?.crew || [];
        const directorObj =
          crew.find((c) => c.job === 'Director') ||
          (Array.isArray(detail?.created_by) && detail.created_by[0]);
        if (directorObj?.name) {
          baseItem.director = directorObj.name;
        }

        const rawCast: any[] = detail?.credits?.cast || [];
        baseItem.cast = rawCast.slice(0, 6).map((c): CastMember => ({
          name: c.name,
          role: c.character || 'Principal Role',
        }));

        const usProviders = detail?.['watch/providers']?.results?.US;
        const flatrate: any[] = usProviders?.flatrate || usProviders?.buy || [];
        if (flatrate.length > 0) {
          baseItem.streamOn = flatrate.slice(0, 4).map((p) => p.provider_name);
        }

        const similarRaw: any[] = detail?.recommendations?.results || [];
        const similar = similarRaw
          .filter((r) => r.poster_path)
          .slice(0, 4)
          .map((r) => mapTmdbItemToMediaItem(r, mediaType));

        return res.json({ item: baseItem, similar });
      } catch (err: any) {
        return res.status(502).json({ error: err.message || 'Failed to load TMDB title details' });
      }
    }

    // Enrich TVMaze show cast if it's a tvmaze-tv-* item
    const catalog = await getLiveExpandedCatalog();
    const found = catalog.find((m) => m.id === id) || MEDIA_ITEMS.find((m) => m.id === id);
    if (!found) {
      return res.status(404).json({ error: 'Title not found' });
    }

    const enriched = { ...found };
    if (id.startsWith('tvmaze-tv-')) {
      const showId = id.replace('tvmaze-tv-', '');
      try {
        const [castRes, epRes] = await Promise.allSettled([
          enriched.cast.length === 0
            ? fetch(`https://api.tvmaze.com/shows/${showId}/cast`)
            : Promise.resolve(null),
          fetch(`https://api.tvmaze.com/shows/${showId}/episodes`),
        ]);

        if (castRes.status === 'fulfilled' && castRes.value && castRes.value.ok) {
          const castData = await castRes.value.json();
          enriched.cast = (castData || []).slice(0, 5).map((c: any) => ({
            name: c.person?.name || 'Actor',
            role: c.character?.name || 'Series Regular',
          }));
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

    return res.json({ item: enriched, similar });
  });

  // 4. TV Series Season Episodes Endpoint (/api/tv/:id/season/:seasonNumber)
  app.get('/api/tv/:id/season/:seasonNumber', async (req, res) => {
    const { id } = req.params;
    const seasonNumber = Math.max(1, parseInt(String(req.params.seasonNumber || '1'), 10) || 1);
    const tmdbKey = getTmdbKey();
    const seedMatch = SEED_TO_TMDB_ID[id];

    // Path A: Official TMDB /tv/{id}/season/{season_number}
    if (tmdbKey && (id.startsWith('tmdb-tv-') || (seedMatch && seedMatch.mediaType === 'tv'))) {
      try {
        const rawTmdbId = seedMatch ? seedMatch.tmdbId : id.replace('tmdb-tv-', '');
        const seasonData = await fetchFromTmdb(`/tv/${rawTmdbId}/season/${seasonNumber}`);
        const rawEpisodes: any[] = Array.isArray(seasonData?.episodes) ? seasonData.episodes : [];

        const episodes: EpisodeInfo[] = rawEpisodes.map((ep: any, idx: number) => ({
          episodeNumber: Number(ep.episode_number) || idx + 1,
          seasonNumber,
          name: ep.name || `Episode ${idx + 1}`,
          airDate: ep.air_date || undefined,
          runtime: typeof ep.runtime === 'number' && ep.runtime > 0 ? ep.runtime : undefined,
          overview: ep.overview || undefined,
          stillUrl: ep.still_path ? `${TMDB_IMAGE_W500}${ep.still_path}` : undefined,
        }));

        return res.json({
          seasonNumber,
          name: seasonData?.name || `Season ${seasonNumber}`,
          episodes,
        });
      } catch {
        // Fall through to open catalog / seed fallback if season call fails
      }
    }

    // Path B: TVMaze Season Episodes for tvmaze-tv-*
    if (id.startsWith('tvmaze-tv-')) {
      const showId = id.replace('tvmaze-tv-', '');
      try {
        const epRes = await fetch(`https://api.tvmaze.com/shows/${showId}/episodes`);
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
              return res.json({
                seasonNumber,
                name: `Season ${seasonNumber}`,
                episodes,
              });
            }
          }
        }
      } catch {
        // Fall through to deterministic fallback
      }
    }

    // Path C: Seed or Open Catalog Fallback
    const catalog = await getLiveExpandedCatalog();
    const found = catalog.find((m) => m.id === id) || MEDIA_ITEMS.find((m) => m.id === id);
    const matchingSeason = found?.seasonsList?.find((s) => s.seasonNumber === seasonNumber);
    const epCount = matchingSeason?.episodeCount || 8;
    const baseYear = found?.year || 2024;

    const episodes: EpisodeInfo[] = Array.from({ length: epCount }, (_, idx) => ({
      episodeNumber: idx + 1,
      seasonNumber,
      name: `Chapter ${idx + 1}`,
      airDate: matchingSeason?.airDate || `${baseYear}-01-${String((idx % 28) + 1).padStart(2, '0')}`,
      runtime: 52,
    }));

    return res.json({
      seasonNumber,
      name: matchingSeason?.name || `Season ${seasonNumber}`,
      episodes,
    });
  });

  // 5. Server-Side Admin API Route (Mirrors `supabase/functions/admin-users`)
  app.post('/api/admin/users', express.json(), async (req, res) => {
    const rawSupabaseUrl = (
      process.env.VITE_SUPABASE_URL ||
      process.env.SUPABASE_URL ||
      ''
    ).trim();
    const rawSupabaseAnonKey = (
      process.env.VITE_SUPABASE_ANON_KEY ||
      process.env.SUPABASE_ANON_KEY ||
      ''
    ).trim();
    const serviceRoleKey = (process.env.SUPABASE_SERVICE_ROLE_KEY || '').trim();
    const adminUserIdsRaw = (process.env.CINEMAX_ADMIN_USER_ID || '').trim();

    let cleanOrigin = '';
    if (
      rawSupabaseUrl.startsWith('https://') ||
      rawSupabaseUrl.startsWith('http://')
    ) {
      try {
        cleanOrigin = new URL(rawSupabaseUrl).origin;
      } catch {
        cleanOrigin = rawSupabaseUrl
          .replace(/\/(rest|auth|realtime|storage)\/v1\/?.*$/i, '')
          .replace(/\/+$/, '');
      }
    }

    const result = await processAdminRequest({
      authHeader: req.headers.authorization || '',
      body: req.body || {},
      env: {
        supabaseUrl: cleanOrigin,
        supabaseAnonKey: rawSupabaseAnonKey,
        serviceRoleKey,
        adminUserIdsRaw,
      },
    });

    return res.status(result.status).json(result.body);
  });

  // Mount Vite dev server middleware or static production build
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: {
        middlewareMode: true,
        ws: { server: httpServer },
      },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(__dirname, 'dist');
    app.use('/CineMax', express.static(distPath));
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      // If requesting subpath /CineMax or any subroute, send index.html
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  httpServer.listen(PORT, '0.0.0.0', () => {
    console.log(`CineMax server running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
