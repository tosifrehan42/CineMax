import {
  deleteWatchHistoryItem,
  deleteWatchlistItem,
  setSeasonEpisodesWatchedInDb,
  toggleWatchedEpisodeInDb,
  upsertWatchHistoryItem,
  upsertWatchlistItem,
} from './supabaseClient';
import { MediaItem, WatchlistEntry } from '../types';

const OFFLINE_QUEUE_STORAGE_KEY = 'cinemax_offline_mutation_queue_v1';

export type OfflineMutationAction =
  | {
      id: string;
      dedupeKey: string;
      userId: string;
      createdAt: number;
      type: 'UPSERT_WATCHLIST';
      entry: WatchlistEntry;
    }
  | {
      id: string;
      dedupeKey: string;
      userId: string;
      createdAt: number;
      type: 'DELETE_WATCHLIST';
      mediaId: string;
    }
  | {
      id: string;
      dedupeKey: string;
      userId: string;
      createdAt: number;
      type: 'TOGGLE_EPISODE';
      mediaId: string;
      seasonNumber: number;
      episodeNumber: number;
      watched: boolean;
    }
  | {
      id: string;
      dedupeKey: string;
      userId: string;
      createdAt: number;
      type: 'SET_SEASON_EPISODES';
      mediaId: string;
      seasonNumber: number;
      episodeNumbers: number[];
      watched: boolean;
    }
  | {
      id: string;
      dedupeKey: string;
      userId: string;
      createdAt: number;
      type: 'UPSERT_HISTORY';
      payload: {
        mediaId: string;
        media?: MediaItem;
        watchedAt?: string;
        personalRating?: number;
        reviewNotes?: string;
      };
    }
  | {
      id: string;
      dedupeKey: string;
      userId: string;
      createdAt: number;
      type: 'DELETE_HISTORY';
      mediaId: string;
    };

export interface SyncQueueStateEventDetail {
  pendingCount: number;
  isSyncing: boolean;
  lastSyncedAt: number | null;
  syncedCount?: number;
}

let isFlushingQueue = false;
let lastSyncedTimestamp: number | null = null;

function readQueue(): OfflineMutationAction[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(OFFLINE_QUEUE_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function writeQueue(queue: OfflineMutationAction[]): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(OFFLINE_QUEUE_STORAGE_KEY, JSON.stringify(queue));
  } catch {
    // Ignore storage error
  }
}

function emitQueueUpdate(userId?: string | null, syncedCount?: number): void {
  if (typeof window === 'undefined') return;
  const all = readQueue();
  const pendingCount = userId
    ? all.filter((item) => item.userId === userId).length
    : all.length;

  const detail: SyncQueueStateEventDetail = {
    pendingCount,
    isSyncing: isFlushingQueue,
    lastSyncedAt: lastSyncedTimestamp,
    syncedCount,
  };
  window.dispatchEvent(new CustomEvent('cinemax:sync-queue-updated', { detail }));
}

export function isNetworkOfflineError(errorMsg?: string | null): boolean {
  if (typeof navigator !== 'undefined' && !navigator.onLine) {
    return true;
  }
  if (!errorMsg) return false;
  const lower = errorMsg.toLowerCase();
  return (
    lower.includes('failed to fetch') ||
    lower.includes('networkerror') ||
    lower.includes('network request failed') ||
    lower.includes('load failed') ||
    lower.includes('offline') ||
    lower.includes('fetch error')
  );
}

export type OfflineMutationInput = OfflineMutationAction extends infer T
  ? T extends OfflineMutationAction
    ? Omit<T, 'id' | 'createdAt'>
    : never
  : never;

export function enqueueOfflineMutation(
  mutation: OfflineMutationInput
): void {
  const queue = readQueue();
  const filtered = queue.filter((existing) => existing.dedupeKey !== mutation.dedupeKey);
  const nextItem: OfflineMutationAction = {
    ...mutation,
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    createdAt: Date.now(),
  } as OfflineMutationAction;

  filtered.push(nextItem);
  writeQueue(filtered);
  emitQueueUpdate(mutation.userId);
}

export function getPendingOfflineMutationsCount(userId?: string | null): number {
  const all = readQueue();
  if (!userId) return all.length;
  return all.filter((m) => m.userId === userId).length;
}

export async function flushOfflineSyncQueue(
  userId: string
): Promise<{ syncedCount: number; remainingCount: number }> {
  if (!userId || isFlushingQueue) {
    return {
      syncedCount: 0,
      remainingCount: getPendingOfflineMutationsCount(userId),
    };
  }
  if (typeof navigator !== 'undefined' && !navigator.onLine) {
    return {
      syncedCount: 0,
      remainingCount: getPendingOfflineMutationsCount(userId),
    };
  }

  const all = readQueue();
  const userQueue = all.filter((m) => m.userId === userId);
  if (userQueue.length === 0) {
    return { syncedCount: 0, remainingCount: 0 };
  }

  isFlushingQueue = true;
  emitQueueUpdate(userId);

  let syncedCount = 0;
  const failedOrRemainingIds = new Set<string>();

  try {
    for (const action of userQueue) {
      if (typeof navigator !== 'undefined' && !navigator.onLine) {
        failedOrRemainingIds.add(action.id);
        continue;
      }

      try {
        let opError: string | null = null;

        if (action.type === 'UPSERT_WATCHLIST') {
          const res = await upsertWatchlistItem(action.userId, action.entry);
          opError = res.error;
        } else if (action.type === 'DELETE_WATCHLIST') {
          const res = await deleteWatchlistItem(action.userId, action.mediaId);
          opError = res.error;
        } else if (action.type === 'TOGGLE_EPISODE') {
          const res = await toggleWatchedEpisodeInDb(
            action.userId,
            action.mediaId,
            action.seasonNumber,
            action.episodeNumber,
            action.watched
          );
          opError = res.error;
        } else if (action.type === 'SET_SEASON_EPISODES') {
          const res = await setSeasonEpisodesWatchedInDb(
            action.userId,
            action.mediaId,
            action.seasonNumber,
            action.episodeNumbers,
            action.watched
          );
          opError = res.error;
        } else if (action.type === 'UPSERT_HISTORY') {
          const res = await upsertWatchHistoryItem(action.userId, action.payload);
          opError = res.error;
        } else if (action.type === 'DELETE_HISTORY') {
          const res = await deleteWatchHistoryItem(action.userId, action.mediaId);
          opError = res.error;
        }

        if (opError && isNetworkOfflineError(opError)) {
          failedOrRemainingIds.add(action.id);
        } else {
          syncedCount += 1;
        }
      } catch {
        failedOrRemainingIds.add(action.id);
      }
    }

    const latestQueue = readQueue();
    const processedUserIds = new Set(userQueue.map((u) => u.id));
    const updatedQueue = latestQueue.filter((item) => {
      if (!processedUserIds.has(item.id)) return true;
      return failedOrRemainingIds.has(item.id);
    });

    writeQueue(updatedQueue);
    if (syncedCount > 0) {
      lastSyncedTimestamp = Date.now();
    }
  } finally {
    isFlushingQueue = false;
    emitQueueUpdate(userId, syncedCount);
  }

  return {
    syncedCount,
    remainingCount: getPendingOfflineMutationsCount(userId),
  };
}
