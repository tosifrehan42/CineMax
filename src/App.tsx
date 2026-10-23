import React, { useState, useEffect, useCallback, useRef } from 'react';
import type { User } from '@supabase/supabase-js';
import {
  TabView,
  MediaItem,
  WatchlistEntry,
  WatchStatus,
  WatchHistoryEntry,
  WatchedEpisodeEntry,
  UserProfile,
} from './types';
import { MEDIA_ITEMS } from './data/mediaData';
import { CatalogueCategory } from './services/mediaApi';
import {
  ensureSupabaseClient,
  fetchUserProfile,
  updateUserProfile,
  uploadUserAvatar,
  removeUserAvatar,
  fetchUserWatchlist,
  upsertWatchlistItem,
  deleteWatchlistItem,
  batchImportLocalWatchlist,
  fetchUserWatchHistory,
  upsertWatchHistoryItem,
  deleteWatchHistoryItem,
  fetchUserWatchedEpisodes,
  toggleWatchedEpisodeInDb,
  setSeasonEpisodesWatchedInDb,
  batchImportLocalWatchedEpisodes,
  signOutUser,
  parseRuntimeMinutes,
} from './services/supabaseClient';
import { Navbar } from './components/Navbar';
import { HomeView } from './components/HomeView';
import { DiscoverView } from './components/DiscoverView';
import { WatchlistView } from './components/WatchlistView';
import { ProfileView } from './components/ProfileView';
import { DetailModal } from './components/DetailModal';
import { TrailerModal } from './components/TrailerModal';
import { SurpriseMeModal } from './components/SurpriseMeModal';
import { SearchOverlay } from './components/SearchOverlay';
import { AuthModal } from './components/AuthModal';
import { QualityFileSizeEstimator } from './components/QualityFileSizeEstimator';
import { AdminDashboardView } from './components/AdminDashboardView';
import { checkAdminAccess } from './services/adminApi';
import { Film } from 'lucide-react';

function isUrlAdminRoute(): boolean {
  if (typeof window === 'undefined') return false;
  const pathname = window.location.pathname.replace(/\/+$/, '');
  const hash = window.location.hash.replace(/^#/, '').replace(/\/+$/, '');
  const searchParams = new URLSearchParams(window.location.search);
  return (
    pathname.endsWith('/admin') ||
    hash === '/admin' ||
    hash === 'admin' ||
    searchParams.get('tab') === 'admin'
  );
}

// Starter default local watchlist for guest browser sessions
const INITIAL_WATCHLIST: WatchlistEntry[] = [
  {
    mediaId: 'dune-part-two',
    status: 'completed',
    isFavourite: true,
    addedAt: '2024-03-05',
    personalRating: 10,
    personalNotes:
      'Unprecedented cinematic scale. Greig Fraser’s cinematography and Zimmer’s score are monumental.',
  },
  {
    mediaId: 'severance',
    status: 'watching',
    isFavourite: true,
    addedAt: '2024-03-10',
    personalRating: 9,
    personalNotes:
      'Brilliant corporate existential thriller. Can’t stop analyzing the MDR floor.',
  },
  {
    mediaId: 'oppenheimer',
    status: 'completed',
    isFavourite: false,
    addedAt: '2024-01-15',
    personalRating: 9,
    personalNotes:
      'Cillian Murphy gives a career-defining performance. The Trinity test sequence was breathtaking.',
  },
  {
    mediaId: 'arcane',
    status: 'completed',
    isFavourite: true,
    addedAt: '2024-02-20',
    personalRating: 10,
    personalNotes:
      'Every frame is an oil painting. Emotional storytelling at the absolute highest level.',
  },
  {
    mediaId: 'blade-runner-2049',
    status: 'plan_to_watch',
    isFavourite: false,
    addedAt: '2024-03-12',
    personalRating: 0,
  },
];

// Starter default watched episodes for guest browser sessions (Severance S1 Ep 1-5 watched; Arcane all 18 episodes watched)
const INITIAL_WATCHED_EPISODES: WatchedEpisodeEntry[] = [
  ...Array.from({ length: 5 }, (_, i) => ({
    mediaId: 'severance',
    seasonNumber: 1,
    episodeNumber: i + 1,
    watchedAt: '2024-03-10T20:00:00Z',
  })),
  ...Array.from({ length: 9 }, (_, i) => ({
    mediaId: 'arcane',
    seasonNumber: 1,
    episodeNumber: i + 1,
    watchedAt: '2024-02-15T20:00:00Z',
  })),
  ...Array.from({ length: 9 }, (_, i) => ({
    mediaId: 'arcane',
    seasonNumber: 2,
    episodeNumber: i + 1,
    watchedAt: '2024-02-20T20:00:00Z',
  })),
];

export default function App() {
  const [currentTab, setCurrentTab] = useState<TabView>(() =>
    isUrlAdminRoute() ? 'admin' : 'home'
  );
  const [isAdmin, setIsAdmin] = useState(false);

  const navigateToTab = useCallback((tab: TabView) => {
    setCurrentTab(tab);
    if (typeof window !== 'undefined') {
      const base = (import.meta.env.BASE_URL || '/').replace(/\/+$/, '');
      const currentPath = window.location.pathname.replace(/\/+$/, '');
      if (tab === 'admin') {
        const targetPath = `${base}/admin` || '/admin';
        if (currentPath !== targetPath) {
          window.history.pushState({ tab: 'admin' }, '', targetPath);
        }
      } else if (currentPath.endsWith('/admin') || window.location.hash.includes('admin')) {
        const homePath = base ? `${base}/` : '/';
        window.history.pushState({ tab }, '', homePath);
      }
    }
  }, []);

  useEffect(() => {
    const handlePopState = () => {
      if (isUrlAdminRoute()) {
        setCurrentTab('admin');
      } else {
        setCurrentTab((prev) => (prev === 'admin' ? 'home' : prev));
      }
    };
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);
  const [selectedMedia, setSelectedMedia] = useState<MediaItem | null>(null);
  const [trailerMedia, setTrailerMedia] = useState<MediaItem | null>(null);
  const [isSurpriseOpen, setIsSurpriseOpen] = useState(false);
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
  const [authModalMode, setAuthModalMode] = useState<'signin' | 'signup'>('signin');
  const [discoverInitialMood, setDiscoverInitialMood] = useState('all');
  const [discoverInitialCategory, setDiscoverInitialCategory] =
    useState<CatalogueCategory>('discover');
  const [estimatorInitialMedia, setEstimatorInitialMedia] = useState<MediaItem | null>(
    null
  );
  const [estimatorInitialSeason, setEstimatorInitialSeason] = useState<
    number | undefined
  >(undefined);

  // Dynamic registry of all loaded media items across pages so Watchlist, Profile & Roulette have full access
  const [knownMedia, setKnownMedia] = useState<MediaItem[]>(MEDIA_ITEMS);

  const handleRegisterMedia = useCallback((newItems: MediaItem[]) => {
    setKnownMedia((prev) => {
      const existingMap = new Map(prev.map((m) => [m.id, m]));
      let changed = false;
      for (const item of newItems) {
        if (!item || !item.id) continue;
        const existing = existingMap.get(item.id);
        if (!existing) {
          existingMap.set(item.id, item);
          changed = true;
        } else if (
          (!existing.seasonsList && item.seasonsList) ||
          (!existing.totalEpisodes && item.totalEpisodes)
        ) {
          existingMap.set(item.id, { ...existing, ...item });
          changed = true;
        }
      }
      if (!changed) return prev;
      return Array.from(existingMap.values());
    });
  }, []);

  // Local browser watchlist (used when signed out)
  const [localWatchlist, setLocalWatchlist] = useState<WatchlistEntry[]>(() => {
    try {
      const saved = localStorage.getItem('reelmind_watchlist');
      if (saved) return JSON.parse(saved);
    } catch {
      // Fallback
    }
    return INITIAL_WATCHLIST;
  });

  useEffect(() => {
    try {
      localStorage.setItem('reelmind_watchlist', JSON.stringify(localWatchlist));
    } catch (e) {
      console.warn('Could not persist watchlist to localStorage', e);
    }
  }, [localWatchlist]);

  // Local browser watched episodes (used when signed out or as fallback before migration)
  const [localWatchedEpisodes, setLocalWatchedEpisodes] = useState<WatchedEpisodeEntry[]>(() => {
    try {
      const saved = localStorage.getItem('cinemax_watched_episodes');
      if (saved) return JSON.parse(saved);
    } catch {
      // Fallback
    }
    return INITIAL_WATCHED_EPISODES;
  });

  useEffect(() => {
    try {
      localStorage.setItem('cinemax_watched_episodes', JSON.stringify(localWatchedEpisodes));
    } catch (e) {
      console.warn('Could not persist watched episodes to localStorage', e);
    }
  }, [localWatchedEpisodes]);

  // Supabase Auth & Persistent Cloud State
  const [supabaseConfigured, setSupabaseConfigured] = useState(false);
  const [securityWarning, setSecurityWarning] = useState<string | null>(null);
  const [authUser, setAuthUser] = useState<User | null>(null);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [cloudWatchlist, setCloudWatchlist] = useState<WatchlistEntry[]>([]);
  const [watchHistory, setWatchHistory] = useState<WatchHistoryEntry[]>([]);
  const [cloudWatchedEpisodes, setCloudWatchedEpisodes] = useState<WatchedEpisodeEntry[]>([]);
  const [episodesTableReady, setEpisodesTableReady] = useState(true);
  const [isCloudLoading, setIsCloudLoading] = useState(false);
  const [cloudError, setCloudError] = useState<string | null>(null);
  const [schemaMissing, setSchemaMissing] = useState(false);
  const [migrationNeeded, setMigrationNeeded] = useState(false);

  const inFlightChecklistOps = useRef<Set<string>>(new Set());

  const isAuthenticated = Boolean(authUser);
  const activeWatchlist = isAuthenticated ? cloudWatchlist : localWatchlist;
  // When signed in, if public.watched_episodes is ready use cloudWatchedEpisodes; if migration hasn't been run yet, merge with localWatchedEpisodes so UI still works
  const activeWatchedEpisodes = isAuthenticated
    ? episodesTableReady
      ? cloudWatchedEpisodes
      : localWatchedEpisodes
    : localWatchedEpisodes;

  // Load user's profile, watchlist, watch history, and watched episodes from Supabase
  const loadCloudUserData = useCallback(
    async (user: User) => {
      setIsCloudLoading(true);
      setCloudError(null);
      setSchemaMissing(false);
      try {
        const [profileRes, watchlistRes, historyRes, episodesRes] = await Promise.all([
          fetchUserProfile(user),
          fetchUserWatchlist(user.id),
          fetchUserWatchHistory(user.id),
          fetchUserWatchedEpisodes(user.id),
        ]);

        if (profileRes.schemaMissing || watchlistRes.schemaMissing || historyRes.schemaMissing) {
          setSchemaMissing(true);
        }

        if (episodesRes.migrationNeeded) {
          setEpisodesTableReady(false);
          setMigrationNeeded(true);
        } else {
          setEpisodesTableReady(true);
          setCloudWatchedEpisodes(episodesRes.episodes);
        }

        const firstError =
          profileRes.error ||
          watchlistRes.error ||
          historyRes.error ||
          episodesRes.error ||
          null;
        if (firstError) {
          setCloudError(firstError);
        }

        if (profileRes.profile) {
          setUserProfile(profileRes.profile);
        }

        setCloudWatchlist(watchlistRes.items);
        setWatchHistory(historyRes.history);

        // Register any media snapshots stored in cloud records
        const snapshots: MediaItem[] = [];
        watchlistRes.items.forEach((w) => {
          if (w.mediaSnapshot) snapshots.push(w.mediaSnapshot);
        });
        historyRes.history.forEach((h) => {
          if (h.mediaSnapshot) snapshots.push(h.mediaSnapshot);
        });
        if (snapshots.length > 0) {
          handleRegisterMedia(snapshots);
        }
      } catch (err: any) {
        setCloudError(err?.message || 'Failed to load user data from Supabase.');
      } finally {
        setIsCloudLoading(false);
      }
    },
    [handleRegisterMedia]
  );

  // Initialize Supabase client & auth listener
  useEffect(() => {
    let active = true;
    let unsubscribe: (() => void) | null = null;

    ensureSupabaseClient().then(async ({ client, configured, securityWarning: secWarn }) => {
      if (!active) return;
      setSupabaseConfigured(configured);
      setSecurityWarning(secWarn);

      if (!client) return;

      const { data } = await client.auth.getSession();
      if (!active) return;
      const initialUser = data.session?.user ?? null;
      setAuthUser(initialUser);
      if (initialUser) {
        loadCloudUserData(initialUser);
      }

      const { data: sub } = client.auth.onAuthStateChange((_event, session) => {
        if (!active) return;
        const nextUser = session?.user ?? null;
        setAuthUser(nextUser);
        if (nextUser) {
          loadCloudUserData(nextUser);
        } else {
          setUserProfile(null);
          setCloudWatchlist([]);
          setWatchHistory([]);
          setCloudWatchedEpisodes([]);
          setCloudError(null);
          setSchemaMissing(false);
          setMigrationNeeded(false);
        }
      });

      unsubscribe = () => sub.subscription.unsubscribe();
    });

    return () => {
      active = false;
      unsubscribe?.();
    };
  }, [loadCloudUserData]);

  // Verify admin access against server-side allowlist whenever authUser changes
  useEffect(() => {
    let active = true;
    if (!authUser) {
      setIsAdmin(false);
      return;
    }
    checkAdminAccess()
      .then((res) => {
        if (!active) return;
        setIsAdmin(res.status === 200 && Boolean(res.isAdmin));
      })
      .catch(() => {
        if (!active) return;
        setIsAdmin(false);
      });
    return () => {
      active = false;
    };
  }, [authUser]);

  // Global keyboard shortcut for search (Ctrl+K or Cmd+K)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setIsSearchOpen((prev) => !prev);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const isInWatchlist = useCallback(
    (id: string) => activeWatchlist.some((item) => item.mediaId === id),
    [activeWatchlist]
  );

  const getWatchlistStatus = useCallback(
    (id: string): WatchStatus | undefined =>
      activeWatchlist.find((item) => item.mediaId === id)?.status,
    [activeWatchlist]
  );

  const getWatchedEpisodesCount = useCallback(
    (mediaId: string): number =>
      activeWatchedEpisodes.filter((ep) => ep.mediaId === mediaId).length,
    [activeWatchedEpisodes]
  );

  const handleOpenAuthModal = (mode: 'signin' | 'signup' = 'signin') => {
    setAuthModalMode(mode);
    setIsAuthModalOpen(true);
  };

  const handleSignOut = async () => {
    await signOutUser();
    setAuthUser(null);
    setIsAdmin(false);
    setUserProfile(null);
    setCloudWatchlist([]);
    setWatchHistory([]);
    setCloudWatchedEpisodes([]);
  };

  const handleToggleWatchlist = async (mediaId: string, mediaObj?: MediaItem) => {
    const opKey = `toggle-${mediaId}`;
    if (inFlightChecklistOps.current.has(opKey)) return;
    inFlightChecklistOps.current.add(opKey);

    try {
      const snapshot = mediaObj || knownMedia.find((m) => m.id === mediaId);

      if (!isAuthenticated || !authUser) {
        setLocalWatchlist((prev) => {
          const exists = prev.some((item) => item.mediaId === mediaId);
          if (exists) {
            return prev.filter((item) => item.mediaId !== mediaId);
          } else {
            const newEntry: WatchlistEntry = {
              mediaId,
              status: 'plan_to_watch',
              isFavourite: false,
              addedAt: new Date().toISOString().split('T')[0],
              personalRating: 0,
              mediaSnapshot: snapshot,
            };
            return [newEntry, ...prev];
          }
        });
        return;
      }

      const exists = cloudWatchlist.some((item) => item.mediaId === mediaId);
      if (exists) {
        const previous = [...cloudWatchlist];
        setCloudWatchlist((prev) => prev.filter((item) => item.mediaId !== mediaId));
        const { error } = await deleteWatchlistItem(authUser.id, mediaId);
        if (error) {
          setCloudError(error);
          setCloudWatchlist(previous);
        }
      } else {
        const optimisticEntry: WatchlistEntry = {
          mediaId,
          status: 'plan_to_watch',
          isFavourite: false,
          addedAt: new Date().toISOString().split('T')[0],
          personalRating: 0,
          mediaSnapshot: snapshot,
        };
        setCloudWatchlist((prev) => [optimisticEntry, ...prev]);
        const { item, error, migrationNeeded: mig } = await upsertWatchlistItem(
          authUser.id,
          optimisticEntry
        );
        if (mig) setMigrationNeeded(true);
        if (error) {
          setCloudError(error);
          setCloudWatchlist((prev) => prev.filter((i) => i.mediaId !== mediaId));
        } else if (item) {
          setCloudWatchlist((prev) =>
            prev.map((i) => (i.mediaId === mediaId ? item : i))
          );
        }
      }
    } finally {
      inFlightChecklistOps.current.delete(opKey);
    }
  };

  const handleToggleFavourite = async (mediaId: string, mediaObj?: MediaItem) => {
    const snapshot = mediaObj || knownMedia.find((m) => m.id === mediaId);

    if (!isAuthenticated || !authUser) {
      setLocalWatchlist((prev) => {
        const existing = prev.find((item) => item.mediaId === mediaId);
        if (existing) {
          return prev.map((item) =>
            item.mediaId === mediaId
              ? {
                  ...item,
                  isFavourite: !item.isFavourite,
                  mediaSnapshot: snapshot || item.mediaSnapshot,
                }
              : item
          );
        }
        return [
          {
            mediaId,
            status: 'plan_to_watch',
            isFavourite: true,
            addedAt: new Date().toISOString().split('T')[0],
            personalRating: 0,
            mediaSnapshot: snapshot,
          },
          ...prev,
        ];
      });
      return;
    }

    const existing = cloudWatchlist.find((item) => item.mediaId === mediaId);
    const updatedEntry: WatchlistEntry = existing
      ? {
          ...existing,
          isFavourite: !existing.isFavourite,
          mediaSnapshot: snapshot || existing.mediaSnapshot,
        }
      : {
          mediaId,
          status: 'plan_to_watch',
          isFavourite: true,
          addedAt: new Date().toISOString().split('T')[0],
          personalRating: 0,
          mediaSnapshot: snapshot,
        };

    setCloudWatchlist((prev) => {
      if (existing) {
        return prev.map((i) => (i.mediaId === mediaId ? updatedEntry : i));
      }
      return [updatedEntry, ...prev];
    });

    const { item, error, migrationNeeded: mig } = await upsertWatchlistItem(
      authUser.id,
      updatedEntry
    );
    if (mig) setMigrationNeeded(true);
    if (error) {
      setCloudError(error);
    } else if (item) {
      setCloudWatchlist((prev) =>
        prev.map((i) => (i.mediaId === mediaId ? item : i))
      );
    }
  };

  const handleUpdateWatchlistDetails = async (
    mediaId: string,
    status: WatchStatus,
    rating?: number,
    notes?: string,
    mediaObj?: MediaItem,
    watchedAt?: string
  ) => {
    const snapshot = mediaObj || knownMedia.find((m) => m.id === mediaId);

    if (!isAuthenticated || !authUser) {
      setLocalWatchlist((prev) => {
        const exists = prev.some((item) => item.mediaId === mediaId);
        if (exists) {
          return prev.map((item) => {
            if (item.mediaId === mediaId) {
              return {
                ...item,
                status,
                updatedAt: watchedAt || new Date().toISOString().split('T')[0],
                personalRating: rating !== undefined ? rating : item.personalRating,
                personalNotes: notes !== undefined ? notes : item.personalNotes,
                mediaSnapshot: snapshot || item.mediaSnapshot,
              };
            }
            return item;
          });
        } else {
          return [
            {
              mediaId,
              status,
              isFavourite: false,
              addedAt: new Date().toISOString().split('T')[0],
              updatedAt: watchedAt || new Date().toISOString().split('T')[0],
              personalRating: rating || 0,
              personalNotes: notes || '',
              mediaSnapshot: snapshot,
            },
            ...prev,
          ];
        }
      });
      return;
    }

    const previousList = [...cloudWatchlist];
    const existing = cloudWatchlist.find((item) => item.mediaId === mediaId);
    const nextEntry: WatchlistEntry = {
      mediaId,
      status,
      isFavourite: existing?.isFavourite ?? false,
      addedAt: existing?.addedAt || new Date().toISOString().split('T')[0],
      personalRating: rating !== undefined ? rating : existing?.personalRating || 0,
      personalNotes: notes !== undefined ? notes : existing?.personalNotes || '',
      mediaSnapshot: snapshot || existing?.mediaSnapshot,
    };

    setCloudWatchlist((prev) => {
      if (existing) {
        return prev.map((i) => (i.mediaId === mediaId ? nextEntry : i));
      }
      return [nextEntry, ...prev];
    });

    const { item, error, migrationNeeded: mig } = await upsertWatchlistItem(
      authUser.id,
      nextEntry
    );
    if (mig) setMigrationNeeded(true);
    if (error) {
      setCloudError(error);
      // Roll back optimistic status change if database constraint rejected it
      setCloudWatchlist(previousList);
      return;
    } else if (item) {
      setCloudWatchlist((prev) =>
        prev.map((i) => (i.mediaId === mediaId ? item : i))
      );
    }

    // If marked as completed, also record/update watched history with date & personal rating
    if (status === 'completed') {
      const existingHistory = watchHistory.find((h) => h.mediaId === mediaId);
      const { entry: historyEntry, error: historyError } = await upsertWatchHistoryItem(
        authUser.id,
        {
          mediaId,
          media: snapshot || existing?.mediaSnapshot,
          watchedAt: watchedAt || existingHistory?.watchedAt || new Date().toISOString(),
          personalRating: nextEntry.personalRating,
          reviewNotes: nextEntry.personalNotes,
        }
      );
      if (historyError) {
        setCloudError(historyError);
      } else if (historyEntry) {
        setWatchHistory((prev) => {
          const filtered = prev.filter((h) => h.mediaId !== mediaId);
          return [historyEntry, ...filtered].sort(
            (a, b) => new Date(b.watchedAt).getTime() - new Date(a.watchedAt).getTime()
          );
        });
      }
    }
  };

  const handleRemoveFromWatchlist = async (mediaId: string) => {
    if (!isAuthenticated || !authUser) {
      setLocalWatchlist((prev) => prev.filter((item) => item.mediaId !== mediaId));
      return;
    }

    const previous = [...cloudWatchlist];
    setCloudWatchlist((prev) => prev.filter((item) => item.mediaId !== mediaId));
    const { error } = await deleteWatchlistItem(authUser.id, mediaId);
    if (error) {
      setCloudError(error);
      setCloudWatchlist(previous);
    }
  };

  const handleUpdateStatus = async (
    mediaId: string,
    status: WatchStatus,
    mediaObj?: MediaItem
  ) => {
    const existing = activeWatchlist.find((item) => item.mediaId === mediaId);
    const snapshot =
      mediaObj || existing?.mediaSnapshot || knownMedia.find((m) => m.id === mediaId);
    await handleUpdateWatchlistDetails(
      mediaId,
      status,
      existing?.personalRating,
      existing?.personalNotes,
      snapshot
    );
  };

  // Auto-calculate TV show status based on watched episode count vs total known episodes
  const syncTvStatusAfterEpisodeChange = async (
    media: MediaItem,
    newWatchedCount: number,
    totalKnownEpisodes: number
  ) => {
    const currentEntry = activeWatchlist.find((w) => w.mediaId === media.id);
    const currentStatus = currentEntry?.status;

    if (totalKnownEpisodes > 0 && newWatchedCount >= totalKnownEpisodes) {
      if (currentStatus !== 'completed') {
        await handleUpdateStatus(media.id, 'completed', media);
      }
    } else if (newWatchedCount > 0) {
      // Auto-switch to Watching when at least 1 episode is watched (and not all episodes are watched)
      if (!currentStatus || currentStatus === 'plan_to_watch' || currentStatus === 'completed') {
        await handleUpdateStatus(media.id, 'watching', media);
      }
    }
  };

  // Toggle a single TV episode watched/unwatched
  const handleToggleEpisodeWatched = async (
    media: MediaItem,
    seasonNumber: number,
    episodeNumber: number,
    watched: boolean,
    totalKnownEpisodes: number
  ) => {
    const opKey = `ep-${media.id}-s${seasonNumber}-e${episodeNumber}`;
    if (inFlightChecklistOps.current.has(opKey)) return;
    inFlightChecklistOps.current.add(opKey);

    try {
      const updateList = (prev: WatchedEpisodeEntry[]) => {
        const filtered = prev.filter(
          (e) =>
            !(
              e.mediaId === media.id &&
              e.seasonNumber === seasonNumber &&
              e.episodeNumber === episodeNumber
            )
        );
        if (watched) {
          return [
            ...filtered,
            {
              mediaId: media.id,
              seasonNumber,
              episodeNumber,
              watchedAt: new Date().toISOString(),
            },
          ];
        }
        return filtered;
      };

      const nextEpisodes = updateList(activeWatchedEpisodes);
      const newCountForShow = nextEpisodes.filter((e) => e.mediaId === media.id).length;

      // Always keep local storage in sync as a resilient fallback
      setLocalWatchedEpisodes((prev) => updateList(prev));

      if (isAuthenticated && authUser) {
        const previousCloud = [...cloudWatchedEpisodes];
        setCloudWatchedEpisodes((prev) => updateList(prev));
        const { error, migrationNeeded: mig } = await toggleWatchedEpisodeInDb(
          authUser.id,
          media.id,
          seasonNumber,
          episodeNumber,
          watched
        );
        if (mig) {
          setEpisodesTableReady(false);
          setMigrationNeeded(true);
        } else if (error) {
          setCloudError(error);
          setCloudWatchedEpisodes(previousCloud);
          return;
        }
      }

      await syncTvStatusAfterEpisodeChange(media, newCountForShow, totalKnownEpisodes);
    } finally {
      inFlightChecklistOps.current.delete(opKey);
    }
  };

  // Batch toggle an entire TV season watched/unwatched
  const handleToggleSeasonWatched = async (
    media: MediaItem,
    seasonNumber: number,
    episodeNumbers: number[],
    watched: boolean,
    totalKnownEpisodes: number
  ) => {
    const opKey = `season-${media.id}-s${seasonNumber}`;
    if (inFlightChecklistOps.current.has(opKey)) return;
    inFlightChecklistOps.current.add(opKey);

    try {
      const epSet = new Set(episodeNumbers);
      const updateList = (prev: WatchedEpisodeEntry[]) => {
        const filtered = prev.filter(
          (e) =>
            !(
              e.mediaId === media.id &&
              e.seasonNumber === seasonNumber &&
              epSet.has(e.episodeNumber)
            )
        );
        if (watched) {
          const now = new Date().toISOString();
          const added: WatchedEpisodeEntry[] = episodeNumbers.map((epNum) => ({
            mediaId: media.id,
            seasonNumber,
            episodeNumber: epNum,
            watchedAt: now,
          }));
          return [...filtered, ...added];
        }
        return filtered;
      };

      const nextEpisodes = updateList(activeWatchedEpisodes);
      const newCountForShow = nextEpisodes.filter((e) => e.mediaId === media.id).length;

      setLocalWatchedEpisodes((prev) => updateList(prev));

      if (isAuthenticated && authUser) {
        const previousCloud = [...cloudWatchedEpisodes];
        setCloudWatchedEpisodes((prev) => updateList(prev));
        const { error, migrationNeeded: mig } = await setSeasonEpisodesWatchedInDb(
          authUser.id,
          media.id,
          seasonNumber,
          episodeNumbers,
          watched
        );
        if (mig) {
          setEpisodesTableReady(false);
          setMigrationNeeded(true);
        } else if (error) {
          setCloudError(error);
          setCloudWatchedEpisodes(previousCloud);
          return;
        }
      }

      await syncTvStatusAfterEpisodeChange(media, newCountForShow, totalKnownEpisodes);
    } finally {
      inFlightChecklistOps.current.delete(opKey);
    }
  };

  const handleDeleteHistoryEntry = async (mediaId: string) => {
    if (!isAuthenticated || !authUser) {
      setLocalWatchlist((prev) =>
        prev.map((item) =>
          item.mediaId === mediaId ? { ...item, status: 'plan_to_watch' } : item
        )
      );
      return;
    }

    const prevHistory = [...watchHistory];
    setWatchHistory((prev) => prev.filter((h) => h.mediaId !== mediaId));
    const { error } = await deleteWatchHistoryItem(authUser.id, mediaId);
    if (error) {
      setCloudError(error);
      setWatchHistory(prevHistory);
    }
  };

  const handleUpdateProfile = async (updates: {
    displayName: string;
    username?: string | null;
    bio?: string;
    favoriteGenres?: string[];
  }): Promise<{ error: string | null }> => {
    if (!authUser) {
      return { error: 'You must be signed in to update your profile.' };
    }
    const { profile, error } = await updateUserProfile(authUser.id, updates);
    if (profile) {
      setUserProfile({
        ...profile,
        email: authUser.email,
      });
    }
    return { error };
  };

  const handleUploadAvatar = async (
    fileBlob: Blob,
    mimeType: string
  ): Promise<{ error: string | null; bucketSetupNeeded?: boolean }> => {
    if (!authUser || !isAuthenticated) {
      return { error: 'You must be signed in to upload a profile picture.' };
    }
    const { profile, error, bucketSetupNeeded } = await uploadUserAvatar({
      fileBlob,
      mimeType,
      previousAvatarUrl: userProfile?.avatarUrl || null,
    });
    if (error || !profile) {
      return {
        error: error || 'Failed to upload profile picture.',
        bucketSetupNeeded,
      };
    }
    setUserProfile({
      ...profile,
      email: authUser.email,
    });
    return { error: null };
  };

  const handleRemoveAvatar = async (): Promise<{ error: string | null }> => {
    if (!authUser || !isAuthenticated) {
      return { error: 'You must be signed in to remove your profile picture.' };
    }
    const { profile, error } = await removeUserAvatar(
      userProfile?.avatarUrl || null
    );
    if (error) {
      return { error };
    }
    if (profile) {
      setUserProfile({
        ...profile,
        email: authUser.email,
        avatarUrl: null,
      });
    } else {
      setUserProfile((prev) => (prev ? { ...prev, avatarUrl: null } : null));
    }
    return { error: null };
  };

  // Local watchlist items not yet in cloud watchlist
  const pendingLocalItems = isAuthenticated
    ? localWatchlist
        .filter((localItem) => !cloudWatchlist.some((c) => c.mediaId === localItem.mediaId))
        .map((localItem) => ({
          ...localItem,
          mediaSnapshot:
            localItem.mediaSnapshot || knownMedia.find((m) => m.id === localItem.mediaId),
        }))
    : [];

  const handleImportLocalWatchlist = async () => {
    if (!authUser || pendingLocalItems.length === 0) return;
    setIsCloudLoading(true);
    setCloudError(null);
    const { items, error } = await batchImportLocalWatchlist(authUser.id, pendingLocalItems);
    if (error) {
      setCloudError(error);
    } else if (items.length > 0) {
      // Also import any completed local items into watch_history
      const completedLocal = pendingLocalItems.filter((i) => i.status === 'completed');
      for (const comp of completedLocal) {
        await upsertWatchHistoryItem(authUser.id, {
          mediaId: comp.mediaId,
          media: comp.mediaSnapshot,
          watchedAt: comp.addedAt,
          personalRating: comp.personalRating,
          reviewNotes: comp.personalNotes,
        });
      }
      // Also import any local watched episodes
      if (localWatchedEpisodes.length > 0) {
        await batchImportLocalWatchedEpisodes(authUser.id, localWatchedEpisodes);
      }
      await loadCloudUserData(authUser);
    }
    setIsCloudLoading(false);
  };

  const handleExploreMood = (moodId: string) => {
    setDiscoverInitialMood(moodId);
    setDiscoverInitialCategory('discover');
    setCurrentTab('discover');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleExploreCategory = (category: CatalogueCategory) => {
    setDiscoverInitialCategory(category);
    setDiscoverInitialMood('all');
    setCurrentTab('discover');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const selectedWatchlistEntry = selectedMedia
    ? activeWatchlist.find((item) => item.mediaId === selectedMedia.id)
    : undefined;

  const selectedHistoryEntry = selectedMedia
    ? watchHistory.find((h) => h.mediaId === selectedMedia.id)
    : undefined;

  // Build local fallback watchHistory when signed out so ProfileView shows local completed items with runtime
  const effectiveWatchHistory: WatchHistoryEntry[] = isAuthenticated
    ? watchHistory
    : localWatchlist
        .filter((w) => w.status === 'completed')
        .map((w) => {
          const media = knownMedia.find((m) => m.id === w.mediaId) || w.mediaSnapshot;
          return {
            id: `local-${w.mediaId}`,
            mediaId: w.mediaId,
            tmdbId: 0,
            mediaType: media?.type || 'movie',
            watchedAt: w.updatedAt || w.addedAt,
            personalRating: w.personalRating,
            reviewNotes: w.personalNotes,
            runtimeMinutes: parseRuntimeMinutes(media),
            mediaSnapshot: media,
          };
        });

  return (
    <div className="min-h-screen bg-[#090a0f] text-slate-100 flex flex-col font-['Plus_Jakarta_Sans']">
      {/* 3-Zone Navigation Top Bar */}
      <Navbar
        currentTab={currentTab}
        onTabChange={(tab) => {
          navigateToTab(tab);
          window.scrollTo({ top: 0, behavior: 'smooth' });
        }}
        watchlistCount={activeWatchlist.length}
        onOpenSurprise={() => setIsSurpriseOpen(true)}
        onQuickSearchClick={() => setIsSearchOpen(true)}
        isAuthenticated={isAuthenticated}
        isAdmin={isAdmin}
        userProfile={userProfile}
        userEmail={authUser?.email}
        onOpenAuthModal={handleOpenAuthModal}
        onSignOut={handleSignOut}
      />

      {/* Main View Area */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 pt-6 sm:pt-8">
        {currentTab === 'home' && (
          <HomeView
            initialItems={MEDIA_ITEMS}
            isInWatchlist={isInWatchlist}
            getWatchlistStatus={getWatchlistStatus}
            onToggleWatchlist={handleToggleWatchlist}
            onUpdateStatus={handleUpdateStatus}
            onRemoveFromWatchlist={handleRemoveFromWatchlist}
            getWatchedEpisodesCount={getWatchedEpisodesCount}
            onSelectMedia={(media) => setSelectedMedia(media)}
            onPlayTrailer={(media) => setTrailerMedia(media)}
            onExploreMood={handleExploreMood}
            onExploreCategory={handleExploreCategory}
            onNavigateTab={(tab) => setCurrentTab(tab)}
            onRegisterMedia={handleRegisterMedia}
          />
        )}

        {currentTab === 'discover' && (
          <DiscoverView
            isInWatchlist={isInWatchlist}
            getWatchlistStatus={getWatchlistStatus}
            onToggleWatchlist={handleToggleWatchlist}
            onUpdateStatus={handleUpdateStatus}
            onRemoveFromWatchlist={handleRemoveFromWatchlist}
            getWatchedEpisodesCount={getWatchedEpisodesCount}
            onSelectMedia={(media) => setSelectedMedia(media)}
            initialMood={discoverInitialMood}
            initialCategory={discoverInitialCategory}
            onRegisterMedia={handleRegisterMedia}
          />
        )}

        {currentTab === 'watchlist' && (
          <WatchlistView
            watchlist={activeWatchlist}
            allMedia={knownMedia}
            watchedEpisodes={activeWatchedEpisodes}
            onRemoveFromWatchlist={handleRemoveFromWatchlist}
            onUpdateStatus={(mediaId, status) => handleUpdateStatus(mediaId, status)}
            onToggleFavourite={handleToggleFavourite}
            onSelectMedia={(media) => setSelectedMedia(media)}
            onNavigateHome={() => setCurrentTab('discover')}
            isAuthenticated={isAuthenticated}
            isLoading={isCloudLoading}
            error={cloudError}
            schemaMissing={schemaMissing}
            migrationNeeded={migrationNeeded}
            onRetry={authUser ? () => loadCloudUserData(authUser) : undefined}
            onOpenAuthModal={handleOpenAuthModal}
            pendingLocalCount={pendingLocalItems.length}
            onImportLocalWatchlist={handleImportLocalWatchlist}
          />
        )}

        {currentTab === 'estimator' && (
          <QualityFileSizeEstimator
            allMedia={knownMedia}
            initialMedia={estimatorInitialMedia}
            initialSeasonNumber={estimatorInitialSeason}
            onClearInitialMedia={() => {
              setEstimatorInitialMedia(null);
              setEstimatorInitialSeason(undefined);
            }}
            onSelectMediaDetail={(media) => setSelectedMedia(media)}
            onRegisterMedia={handleRegisterMedia}
          />
        )}

        {currentTab === 'profile' && (
          <ProfileView
            watchlist={activeWatchlist}
            watchHistory={effectiveWatchHistory}
            userProfile={userProfile}
            userEmail={authUser?.email}
            isAuthenticated={isAuthenticated}
            isLoading={isCloudLoading}
            error={cloudError}
            schemaMissing={schemaMissing}
            onRetry={authUser ? () => loadCloudUserData(authUser) : undefined}
            onOpenAuthModal={handleOpenAuthModal}
            onSignOut={handleSignOut}
            onUpdateProfile={handleUpdateProfile}
            onUploadAvatar={handleUploadAvatar}
            onRemoveAvatar={handleRemoveAvatar}
            onDeleteHistoryEntry={handleDeleteHistoryEntry}
            allMedia={knownMedia}
            onSelectMedia={(media) => setSelectedMedia(media)}
            onNavigateTab={(tab) => navigateToTab(tab)}
          />
        )}

        {currentTab === 'admin' && (
          <AdminDashboardView
            isAuthenticated={isAuthenticated}
            currentUserId={authUser?.id || null}
            currentUserEmail={authUser?.email || null}
            onOpenAuthModal={handleOpenAuthModal}
            onExitAdmin={() => navigateToTab('home')}
          />
        )}
      </main>

      {/* Global Modals & Overlays */}
      <DetailModal
        media={selectedMedia}
        onClose={() => setSelectedMedia(null)}
        isInWatchlist={selectedMedia ? isInWatchlist(selectedMedia.id) : false}
        isFavourite={Boolean(selectedWatchlistEntry?.isFavourite)}
        watchlistStatus={selectedWatchlistEntry?.status}
        personalRating={
          selectedWatchlistEntry?.personalRating || selectedHistoryEntry?.personalRating
        }
        personalNotes={
          selectedWatchlistEntry?.personalNotes || selectedHistoryEntry?.reviewNotes
        }
        watchedAtDate={selectedHistoryEntry?.watchedAt || selectedWatchlistEntry?.updatedAt}
        onToggleWatchlist={handleToggleWatchlist}
        onRemoveFromWatchlist={handleRemoveFromWatchlist}
        onToggleFavourite={handleToggleFavourite}
        onUpdateWatchlistDetails={handleUpdateWatchlistDetails}
        watchedEpisodes={activeWatchedEpisodes}
        onToggleEpisodeWatched={handleToggleEpisodeWatched}
        onToggleSeasonWatched={handleToggleSeasonWatched}
        onPlayTrailer={(media) => setTrailerMedia(media)}
        allMedia={knownMedia}
        onSelectSimilar={(media) => setSelectedMedia(media)}
        onRegisterMedia={handleRegisterMedia}
        onOpenEstimator={(media, seasonNum) => {
          setSelectedMedia(null);
          setEstimatorInitialMedia(media);
          setEstimatorInitialSeason(seasonNum);
          setCurrentTab('estimator');
          window.scrollTo({ top: 0, behavior: 'smooth' });
        }}
      />

      <TrailerModal
        media={trailerMedia}
        onClose={() => setTrailerMedia(null)}
      />

      <SurpriseMeModal
        isOpen={isSurpriseOpen}
        onClose={() => setIsSurpriseOpen(false)}
        items={knownMedia}
        onSelectMedia={(media) => setSelectedMedia(media)}
      />

      <SearchOverlay
        isOpen={isSearchOpen}
        onClose={() => setIsSearchOpen(false)}
        items={knownMedia}
        onSelectMedia={(media) => setSelectedMedia(media)}
        onRegisterMedia={handleRegisterMedia}
      />

      <AuthModal
        isOpen={isAuthModalOpen}
        onClose={() => setIsAuthModalOpen(false)}
        supabaseConfigured={supabaseConfigured}
        securityWarning={securityWarning}
        initialMode={authModalMode}
      />

      {/* Clean, Tasteful Footer adhering to anti-slop rules */}
      <footer className="border-t border-white/5 bg-[#07080c] mt-auto">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-slate-500">
          <div className="flex items-center gap-2">
            <div className="w-5 h-5 rounded bg-amber-500/20 text-amber-400 flex items-center justify-center">
              <Film className="w-3 h-3 stroke-[2.5]" />
            </div>
            <span className="font-['Outfit'] font-semibold text-slate-300">CineMax</span>
            <span>· Cinema & Television Discovery</span>
          </div>

          <div className="flex items-center gap-6">
            <button
              onClick={() => {
                navigateToTab('discover');
                window.scrollTo({ top: 0, behavior: 'smooth' });
              }}
              className="hover:text-slate-300 transition-colors"
            >
              Discover
            </button>
            <button
              onClick={() => {
                navigateToTab('watchlist');
                window.scrollTo({ top: 0, behavior: 'smooth' });
              }}
              className="hover:text-slate-300 transition-colors"
            >
              Watchlist
            </button>
            <button
              onClick={() => {
                navigateToTab('estimator');
                window.scrollTo({ top: 0, behavior: 'smooth' });
              }}
              className="hover:text-slate-300 transition-colors"
            >
              Quality &amp; Size
            </button>
            <button
              onClick={() => {
                navigateToTab('profile');
                window.scrollTo({ top: 0, behavior: 'smooth' });
              }}
              className="hover:text-slate-300 transition-colors"
            >
              Cinephile Profile
            </button>
            <button
              onClick={() => setIsSurpriseOpen(true)}
              className="text-amber-400 hover:text-amber-300 transition-colors"
            >
              ReelRoulette
            </button>
          </div>

          <div className="text-slate-600 font-mono text-[11px]">
            © {new Date().getFullYear()} CineMax. All rights reserved.
          </div>
        </div>
      </footer>
    </div>
  );
}
