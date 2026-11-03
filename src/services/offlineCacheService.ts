import {
  EpisodeInfo,
  MediaItem,
  UserProfile,
  WatchedEpisodeEntry,
  WatchHistoryEntry,
  WatchlistEntry,
} from '../types';
import type { CatalogueResponse } from './mediaApi';

const VIEWED_DETAILS_STORAGE_KEY = 'cinemax_offline_viewed_details_v1';
const VIEWED_SEASONS_STORAGE_KEY = 'cinemax_offline_viewed_seasons_v1';
const CATALOGUE_CACHE_STORAGE_KEY = 'cinemax_offline_catalogue_feeds_v1';
const CLOUD_USER_SNAPSHOT_PREFIX = 'cinemax_offline_cloud_snapshot_v1_';
const POSTER_CACHE_NAME = 'cinemax-media-posters-cache';

const MAX_VIEWED_DETAILS = 80;
const MAX_VIEWED_SEASONS = 100;
const MAX_CATALOGUE_FEEDS = 20;

interface StoredTitleDetailRecord {
  key: string;
  updatedAt: number;
  data: {
    item: MediaItem;
    similar: MediaItem[];
  };
}

interface StoredSeasonEpisodesRecord {
  key: string;
  updatedAt: number;
  data: {
    seasonNumber: number;
    name: string;
    episodes: EpisodeInfo[];
  };
}

interface StoredCatalogueFeedRecord {
  key: string;
  updatedAt: number;
  data: CatalogueResponse;
}

export interface CloudUserOfflineSnapshot {
  userId: string;
  updatedAt: number;
  profile: UserProfile | null;
  watchlist: WatchlistEntry[];
  watchHistory: WatchHistoryEntry[];
  watchedEpisodes: WatchedEpisodeEntry[];
}

function readJsonList<T>(storageKey: string): T[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(storageKey);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function writeJsonList<T>(storageKey: string, list: T[]): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(storageKey, JSON.stringify(list));
  } catch {
    // If quota is tight, trim oldest half and retry once
    try {
      const trimmed = list.slice(0, Math.max(1, Math.floor(list.length / 2)));
      localStorage.setItem(storageKey, JSON.stringify(trimmed));
    } catch {
      // Ignore storage error
    }
  }
}

function notifyOfflineCacheUpdated(): void {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new CustomEvent('cinemax:offline-cache-updated'));
}

// ============================================================================
// 1. Viewed Title Details Offline Persistence
// ============================================================================

export function saveOfflineTitleDetails(
  mediaType: 'movie' | 'tv',
  mediaId: string,
  payload: { item: MediaItem; similar: MediaItem[] }
): void {
  const key = `${mediaType}:${mediaId}`;
  const current = readJsonList<StoredTitleDetailRecord>(VIEWED_DETAILS_STORAGE_KEY);
  const filtered = current.filter((entry) => entry.key !== key);
  const next: StoredTitleDetailRecord[] = [
    {
      key,
      updatedAt: Date.now(),
      data: payload,
    },
    ...filtered,
  ].slice(0, MAX_VIEWED_DETAILS);

  writeJsonList(VIEWED_DETAILS_STORAGE_KEY, next);
  notifyOfflineCacheUpdated();

  // Proactively warm poster & backdrop in CacheStorage
  if (payload.item) {
    warmPosterUrlsInCacheStorage([payload.item.posterUrl, payload.item.backdropUrl]);
  }
}

export function getOfflineTitleDetails(
  mediaType: 'movie' | 'tv',
  mediaId: string
): { item: MediaItem; similar: MediaItem[] } | null {
  const key = `${mediaType}:${mediaId}`;
  const current = readJsonList<StoredTitleDetailRecord>(VIEWED_DETAILS_STORAGE_KEY);
  const found = current.find((entry) => entry.key === key);
  return found?.data || null;
}

export function getAllOfflineViewedMediaItems(): MediaItem[] {
  const current = readJsonList<StoredTitleDetailRecord>(VIEWED_DETAILS_STORAGE_KEY);
  return current.map((entry) => entry.data?.item).filter(Boolean);
}

// ============================================================================
// 2. Viewed TV Season Episodes Offline Persistence
// ============================================================================

export function saveOfflineSeasonEpisodes(
  mediaId: string,
  seasonNumber: number,
  payload: { seasonNumber: number; name: string; episodes: EpisodeInfo[] }
): void {
  const key = `${mediaId}:s${seasonNumber}`;
  const current = readJsonList<StoredSeasonEpisodesRecord>(VIEWED_SEASONS_STORAGE_KEY);
  const filtered = current.filter((entry) => entry.key !== key);
  const next: StoredSeasonEpisodesRecord[] = [
    {
      key,
      updatedAt: Date.now(),
      data: payload,
    },
    ...filtered,
  ].slice(0, MAX_VIEWED_SEASONS);

  writeJsonList(VIEWED_SEASONS_STORAGE_KEY, next);
}

export function getOfflineSeasonEpisodes(
  mediaId: string,
  seasonNumber: number
): { seasonNumber: number; name: string; episodes: EpisodeInfo[] } | null {
  const key = `${mediaId}:s${seasonNumber}`;
  const current = readJsonList<StoredSeasonEpisodesRecord>(VIEWED_SEASONS_STORAGE_KEY);
  const found = current.find((entry) => entry.key === key);
  return found?.data || null;
}

// ============================================================================
// 3. Catalogue & Discovery Feeds Offline Persistence
// ============================================================================

export function saveOfflineCatalogueFeed(
  cacheKey: string,
  response: CatalogueResponse
): void {
  if (!response || !Array.isArray(response.items) || response.items.length === 0) {
    return;
  }
  const normalizedKey = cacheKey || 'default';
  const current = readJsonList<StoredCatalogueFeedRecord>(CATALOGUE_CACHE_STORAGE_KEY);
  const filtered = current.filter((entry) => entry.key !== normalizedKey);
  const next: StoredCatalogueFeedRecord[] = [
    {
      key: normalizedKey,
      updatedAt: Date.now(),
      data: response,
    },
    ...filtered,
  ].slice(0, MAX_CATALOGUE_FEEDS);

  writeJsonList(CATALOGUE_CACHE_STORAGE_KEY, next);
}

export function getOfflineCatalogueFeed(cacheKey: string): CatalogueResponse | null {
  const normalizedKey = cacheKey || 'default';
  const current = readJsonList<StoredCatalogueFeedRecord>(CATALOGUE_CACHE_STORAGE_KEY);
  const found = current.find((entry) => entry.key === normalizedKey);
  return found?.data || null;
}

// ============================================================================
// 4. Signed-In User Cloud Snapshot Persistence (Offline Watchlist & Progress)
// ============================================================================

export function saveCloudUserOfflineSnapshot(
  userId: string,
  snapshot: Omit<CloudUserOfflineSnapshot, 'userId' | 'updatedAt'>
): void {
  if (typeof window === 'undefined' || !userId) return;
  try {
    const record: CloudUserOfflineSnapshot = {
      userId,
      updatedAt: Date.now(),
      ...snapshot,
    };
    localStorage.setItem(
      `${CLOUD_USER_SNAPSHOT_PREFIX}${userId}`,
      JSON.stringify(record)
    );
    notifyOfflineCacheUpdated();
  } catch {
    // Ignore storage error
  }
}

export function getCloudUserOfflineSnapshot(
  userId: string
): CloudUserOfflineSnapshot | null {
  if (typeof window === 'undefined' || !userId) return null;
  try {
    const raw = localStorage.getItem(`${CLOUD_USER_SNAPSHOT_PREFIX}${userId}`);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as CloudUserOfflineSnapshot;
    if (parsed && parsed.userId === userId) {
      return parsed;
    }
    return null;
  } catch {
    return null;
  }
}

// ============================================================================
// 5. Proactive Service Worker CacheStorage Warming for Watchlist & Viewed Media
// ============================================================================

const warmedUrlsInSession = new Set<string>();

export async function warmPosterUrlsInCacheStorage(
  urls: Array<string | undefined | null>
): Promise<void> {
  if (
    typeof window === 'undefined' ||
    !('caches' in window) ||
    (typeof navigator !== 'undefined' && !navigator.onLine)
  ) {
    return;
  }

  const validUrls = Array.from(
    new Set(
      urls
        .map((u) => (u || '').trim())
        .filter((u) => u.startsWith('https://') && !warmedUrlsInSession.has(u))
    )
  ).slice(0, 60);

  if (validUrls.length === 0) return;

  try {
    const cache = await window.caches.open(POSTER_CACHE_NAME);
    await Promise.allSettled(
      validUrls.map(async (url) => {
        warmedUrlsInSession.add(url);
        const existing = await cache.match(url);
        if (existing) return;
        const req = new Request(url, { mode: 'no-cors' });
        const res = await fetch(req);
        if (res && (res.status === 200 || res.type === 'opaque')) {
          await cache.put(url, res);
        }
      })
    );
  } catch {
    // Ignore background cache warming errors
  }
}

export function warmWatchlistAndHistoryMediaAssets(
  watchlist: WatchlistEntry[],
  watchHistory: WatchHistoryEntry[],
  knownMedia: MediaItem[]
): void {
  const mediaById = new Map<string, MediaItem>();
  for (const item of knownMedia) {
    mediaById.set(item.id, item);
  }

  const urlsToWarm: Array<string | undefined> = [];
  for (const entry of watchlist) {
    const media = entry.mediaSnapshot || mediaById.get(entry.mediaId);
    if (media) {
      urlsToWarm.push(media.posterUrl, media.backdropUrl);
    }
  }

  for (const entry of watchHistory.slice(0, 30)) {
    const media = entry.mediaSnapshot || mediaById.get(entry.mediaId);
    if (media) {
      urlsToWarm.push(media.posterUrl);
    }
  }

  void warmPosterUrlsInCacheStorage(urlsToWarm);
}

export function getOfflineCacheStats(activeWatchlistCount: number): {
  viewedTitlesCached: number;
  watchlistTitlesCached: number;
} {
  const viewed = readJsonList<StoredTitleDetailRecord>(VIEWED_DETAILS_STORAGE_KEY);
  return {
    viewedTitlesCached: viewed.length,
    watchlistTitlesCached: activeWatchlistCount,
  };
}
