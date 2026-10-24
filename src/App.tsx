import React, { useState, useEffect, useCallback, useMemo, useRef, Suspense } from 'react';
import type { User } from '@supabase/supabase-js';
import {
  TabView,
  HomeHubMode,
  MediaItem,
  WatchlistEntry,
  WatchStatus,
  WatchHistoryEntry,
  WatchedEpisodeEntry,
  UserProfile,
} from './types';
import { MEDIA_ITEMS } from './data/mediaData';
import { EXTRA_ANCHOR_ITEMS } from './data/franchiseData';
import { CatalogueCategory } from './services/mediaApi';
import {
  dedupeMediaItems,
  getCanonicalMediaKey,
  mergeMediaItemMetadata,
} from './utils/mediaIntegrity';
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
import {
  AdminAccessState,
  checkAdminAccess,
  clearCachedVerifiedAdminUid,
  deriveAdminStateFromCheckResult,
  getCachedVerifiedAdminUid,
  isUserCachedAsVerifiedAdmin,
  setCachedVerifiedAdminUid,
  shouldShowAdminTab,
} from './services/adminApi';
import { Film, Loader2 } from 'lucide-react';

// Lazy-loaded secondary views and modals to keep the initial Home bundle fast
const DiscoverView = React.lazy(() =>
  import('./components/DiscoverView').then((m) => ({ default: m.DiscoverView }))
);
const WatchlistView = React.lazy(() =>
  import('./components/WatchlistView').then((m) => ({ default: m.WatchlistView }))
);
const ProfileView = React.lazy(() =>
  import('./components/ProfileView').then((m) => ({ default: m.ProfileView }))
);
const QualityFileSizeEstimator = React.lazy(() =>
  import('./components/QualityFileSizeEstimator').then((m) => ({
    default: m.QualityFileSizeEstimator,
  }))
);
const AdminDashboardView = React.lazy(() =>
  import('./components/AdminDashboardView').then((m) => ({ default: m.AdminDashboardView }))
);
const DetailModal = React.lazy(() =>
  import('./components/DetailModal').then((m) => ({ default: m.DetailModal }))
);
const TrailerModal = React.lazy(() =>
  import('./components/TrailerModal').then((m) => ({ default: m.TrailerModal }))
);
const OnlinePlayerModal = React.lazy(() =>
  import('./components/OnlinePlayerModal').then((m) => ({
    default: m.OnlinePlayerModal,
  }))
);
const SurpriseMeModal = React.lazy(() =>
  import('./components/SurpriseMeModal').then((m) => ({ default: m.SurpriseMeModal }))
);
const SearchOverlay = React.lazy(() =>
  import('./components/SearchOverlay').then((m) => ({ default: m.SearchOverlay }))
);
const AuthModal = React.lazy(() =>
  import('./components/AuthModal').then((m) => ({ default: m.AuthModal }))
);

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
  const [homeHubMode, setHomeHubMode] = useState<HomeHubMode>('all');
  const [isAuthInitializing, setIsAuthInitializing] = useState<boolean>(true);
  const [adminAccessState, setAdminAccessState] =
    useState<AdminAccessState>('loading');
  const [verifiedAdminUserId, setVerifiedAdminUserId] = useState<string | null>(
    () => getCachedVerifiedAdminUid()
  );
  const [adminCheckError, setAdminCheckError] = useState<string | null>(null);
  const hasVerifiedInMemoryForUserRef = useRef<string | null>(null);
  const lastLoadedCloudUserIdRef = useRef<string | null>(null);
  const activeAuthUserIdRef = useRef<string | null>(null);

  const navigateToTab = useCallback((tab: TabView, hubMode?: HomeHubMode) => {
    setCurrentTab(tab);
    if (hubMode) {
      setHomeHubMode(hubMode);
    }
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
  const [onlinePlaybackTarget, setOnlinePlaybackTarget] = useState<{
    media: MediaItem;
    seasonNumber?: number;
    episodeNumber?: number;
  } | null>(null);
  const [isSurpriseOpen, setIsSurpriseOpen] = useState(false);
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
  const [authModalMode, setAuthModalMode] = useState<'signin' | 'signup'>('signin');
  const [discoverInitialMood, setDiscoverInitialMood] = useState('all');
  const [discoverInitialGenre, setDiscoverInitialGenre] = useState('All');
  const [discoverInitialCategory, setDiscoverInitialCategory] =
    useState<CatalogueCategory>('discover');
  const [estimatorInitialMedia, setEstimatorInitialMedia] = useState<MediaItem | null>(
    null
  );
  const [estimatorInitialSeason, setEstimatorInitialSeason] = useState<
    number | undefined
  >(undefined);

  // Dynamic registry of all loaded media items across pages so Watchlist, Profile & Roulette have full access
  const [knownMedia, setKnownMedia] = useState<MediaItem[]>(() =>
    dedupeMediaItems([...MEDIA_ITEMS, ...EXTRA_ANCHOR_ITEMS])
  );

  const handleRegisterMedia = useCallback((newItems: MediaItem[]) => {
    setKnownMedia((prev) => {
      const canonicalMap = new Map<string, MediaItem>();
      for (const m of prev) {
        canonicalMap.set(getCanonicalMediaKey(m), m);
      }
      let changed = false;
      for (const item of newItems) {
        if (!item || !item.id) continue;
        const cKey = getCanonicalMediaKey(item);
        const existing = canonicalMap.get(cKey);
        if (!existing) {
          canonicalMap.set(cKey, item);
          changed = true;
        } else if (
          (!existing.posterUrl && item.posterUrl) ||
          (!existing.backdropUrl && item.backdropUrl) ||
          (!existing.seasonsList && item.seasonsList) ||
          (!existing.totalEpisodes && item.totalEpisodes) ||
          (!existing.runtime && item.runtime)
        ) {
          canonicalMap.set(cKey, mergeMediaItemMetadata(existing, item));
          changed = true;
        }
      }
      if (!changed) return prev;
      return dedupeMediaItems(Array.from(canonicalMap.values()));
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

    ensureSupabaseClient()
      .then(async ({ client, configured, securityWarning: secWarn }) => {
        if (!active) return;
        setSupabaseConfigured(configured);
        setSecurityWarning(secWarn);

        if (!client) {
          setIsAuthInitializing(false);
          return;
        }

        try {
          const { data } = await client.auth.getSession();
          if (!active) return;
          const initialUser = data.session?.user ?? null;
          activeAuthUserIdRef.current = initialUser?.id ?? null;
          setAuthUser(initialUser);
          if (initialUser) {
            lastLoadedCloudUserIdRef.current = initialUser.id;
            loadCloudUserData(initialUser);
          }
        } finally {
          if (active) {
            setIsAuthInitializing(false);
          }
        }

        const { data: sub } = client.auth.onAuthStateChange((event, session) => {
          if (!active) return;
          const nextUser = session?.user ?? null;
          const nextUserId = nextUser?.id ?? null;
          const prevUserId = activeAuthUserIdRef.current;
          activeAuthUserIdRef.current = nextUserId;

          setAuthUser(nextUser);

          if (nextUser) {
            // Avoid redundant full cloud data reloads when only the JWT token refreshed for the same user ID
            if (prevUserId !== nextUserId || event === 'USER_UPDATED') {
              lastLoadedCloudUserIdRef.current = nextUser.id;
              loadCloudUserData(nextUser);
            }
          } else {
            lastLoadedCloudUserIdRef.current = null;
            hasVerifiedInMemoryForUserRef.current = null;
            clearCachedVerifiedAdminUid();
            setVerifiedAdminUserId(null);
            setAdminAccessState('denied');
            setAdminCheckError(null);
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
      })
      .catch(() => {
        if (active) {
          setIsAuthInitializing(false);
        }
      });

    return () => {
      active = false;
      unsubscribe?.();
    };
  }, [loadCloudUserData]);

  const authUserId = authUser?.id ?? null;

  const verifyCurrentUserAdminAccess = useCallback(
    async (targetUserId: string, forceCheck = false) => {
      if (!targetUserId) return;

      // Avoid unnecessary network checks on token refresh when the same user ID was already verified in memory
      if (
        !forceCheck &&
        hasVerifiedInMemoryForUserRef.current === targetUserId
      ) {
        return;
      }

      const cachedForThisUser = isUserCachedAsVerifiedAdmin(targetUserId);
      if (cachedForThisUser) {
        setVerifiedAdminUserId(targetUserId);
        setAdminAccessState('allowed');
      } else {
        setAdminAccessState('loading');
      }

      try {
        const res = await checkAdminAccess();
        // Ensure the user did not sign out or switch accounts while the request was in flight
        if (activeAuthUserIdRef.current !== targetUserId) {
          return;
        }

        const previouslyVerified =
          isUserCachedAsVerifiedAdmin(targetUserId) ||
          hasVerifiedInMemoryForUserRef.current === targetUserId;

        const { nextState, keepVerifiedForUser } =
          deriveAdminStateFromCheckResult({
            userId: targetUserId,
            checkResult: res,
            previouslyVerifiedForUser: previouslyVerified,
          });

        if (nextState === 'allowed') {
          hasVerifiedInMemoryForUserRef.current = targetUserId;
          setCachedVerifiedAdminUid(targetUserId);
          setVerifiedAdminUserId(targetUserId);
          setAdminAccessState('allowed');
          setAdminCheckError(null);
        } else if (nextState === 'denied') {
          hasVerifiedInMemoryForUserRef.current = targetUserId;
          clearCachedVerifiedAdminUid();
          setVerifiedAdminUserId(null);
          setAdminAccessState('denied');
          setAdminCheckError(res.error);
        } else {
          // Transient error ('error'): keep verifiedAdminUserId if previously verified for this user ID
          setAdminAccessState('error');
          setAdminCheckError(
            res.error || 'Temporary error verifying administrator access.'
          );
          if (keepVerifiedForUser) {
            setVerifiedAdminUserId(targetUserId);
          }
        }
      } catch (err: any) {
        if (activeAuthUserIdRef.current !== targetUserId) {
          return;
        }
        setAdminAccessState('error');
        setAdminCheckError(
          err?.message || 'Temporary network error verifying administrator access.'
        );
      }
    },
    []
  );

  // Key admin verification strictly on session restoration completion and authUserId (not object identity)
  useEffect(() => {
    if (isAuthInitializing) {
      return;
    }

    if (!authUserId) {
      hasVerifiedInMemoryForUserRef.current = null;
      clearCachedVerifiedAdminUid();
      setVerifiedAdminUserId(null);
      setAdminAccessState('denied');
      setAdminCheckError(null);
      return;
    }

    // If a different user signed in than the cached admin UUID, clear stale state immediately
    const cachedUid = getCachedVerifiedAdminUid();
    if (cachedUid && cachedUid.toLowerCase() !== authUserId.toLowerCase()) {
      hasVerifiedInMemoryForUserRef.current = null;
      clearCachedVerifiedAdminUid();
      setVerifiedAdminUserId(null);
    }

    verifyCurrentUserAdminAccess(authUserId, false);
  }, [isAuthInitializing, authUserId, verifyCurrentUserAdminAccess]);

  const handleAdminVerifiedFromDashboard = useCallback(
    (confirmedAdminUid: string) => {
      const uid = confirmedAdminUid || authUserId;
      if (!uid || activeAuthUserIdRef.current !== uid) return;
      hasVerifiedInMemoryForUserRef.current = uid;
      setCachedVerifiedAdminUid(uid);
      setVerifiedAdminUserId(uid);
      setAdminAccessState('allowed');
      setAdminCheckError(null);
    },
    [authUserId]
  );

  const handleAdminExplicitlyDeniedFromDashboard = useCallback(() => {
    if (authUserId) {
      hasVerifiedInMemoryForUserRef.current = authUserId;
    }
    clearCachedVerifiedAdminUid();
    setVerifiedAdminUserId(null);
    setAdminAccessState('denied');
  }, [authUserId]);

  const showAdminTab = shouldShowAdminTab({
    isAuthenticated,
    userId: authUserId,
    adminAccessState,
    verifiedAdminUserId,
  });

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

  // Precompute O(1) lookup Maps for watchlist status and episode counts across 150+ cards
  const watchlistStatusMap = useMemo(() => {
    const map = new Map<string, WatchStatus>();
    for (const item of activeWatchlist) {
      map.set(item.mediaId, item.status);
    }
    return map;
  }, [activeWatchlist]);

  const watchedEpisodesCountMap = useMemo(() => {
    const map = new Map<string, number>();
    for (const ep of activeWatchedEpisodes) {
      map.set(ep.mediaId, (map.get(ep.mediaId) || 0) + 1);
    }
    return map;
  }, [activeWatchedEpisodes]);

  const isInWatchlist = useCallback(
    (id: string) => watchlistStatusMap.has(id),
    [watchlistStatusMap]
  );

  const getWatchlistStatus = useCallback(
    (id: string): WatchStatus | undefined => watchlistStatusMap.get(id),
    [watchlistStatusMap]
  );

  const getWatchedEpisodesCount = useCallback(
    (mediaId: string): number => watchedEpisodesCountMap.get(mediaId) || 0,
    [watchedEpisodesCountMap]
  );

  const handleOpenAuthModal = useCallback((mode: 'signin' | 'signup' = 'signin') => {
    setAuthModalMode(mode);
    setIsAuthModalOpen(true);
  }, []);

  const handleSignOut = async () => {
    activeAuthUserIdRef.current = null;
    lastLoadedCloudUserIdRef.current = null;
    hasVerifiedInMemoryForUserRef.current = null;
    clearCachedVerifiedAdminUid();
    setVerifiedAdminUserId(null);
    setAdminAccessState('denied');
    setAdminCheckError(null);
    await signOutUser();
    setAuthUser(null);
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

  const handleExploreMood = useCallback((moodId: string) => {
    setDiscoverInitialMood(moodId);
    setDiscoverInitialGenre('All');
    setDiscoverInitialCategory('discover');
    setCurrentTab('discover');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, []);

  const handleExploreCategory = useCallback((category: CatalogueCategory) => {
    setDiscoverInitialCategory(category);
    setDiscoverInitialMood('all');
    setDiscoverInitialGenre('All');
    setCurrentTab('discover');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, []);

  const handleExploreGenre = useCallback((genre: string) => {
    setDiscoverInitialGenre(genre);
    setDiscoverInitialCategory('discover');
    setDiscoverInitialMood('all');
    setCurrentTab('discover');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, []);

  const handleSelectMedia = useCallback((media: MediaItem) => {
    setSelectedMedia(media);
  }, []);

  const handlePlayTrailer = useCallback((media: MediaItem) => {
    setTrailerMedia(media);
  }, []);

  const handlePlayOnline = useCallback(
    (media: MediaItem, seasonNumber?: number, episodeNumber?: number) => {
      setOnlinePlaybackTarget({ media, seasonNumber, episodeNumber });
    },
    []
  );

  const handleNavbarTabChange = useCallback(
    (tab: TabView, hubMode?: HomeHubMode) => {
      navigateToTab(tab, hubMode);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    },
    [navigateToTab]
  );

  const handleOpenSurprise = useCallback(() => {
    setIsSurpriseOpen(true);
  }, []);

  const handleQuickSearchClick = useCallback(() => {
    setIsSearchOpen(true);
  }, []);

  const handleOpenEstimatorFromDiscover = useCallback(() => {
    navigateToTab('estimator');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, [navigateToTab]);

  const selectedWatchlistEntry = selectedMedia
    ? activeWatchlist.find((item) => item.mediaId === selectedMedia.id)
    : undefined;

  const selectedHistoryEntry = selectedMedia
    ? watchHistory.find((h) => h.mediaId === selectedMedia.id)
    : undefined;

  // Build local fallback watchHistory when signed out so ProfileView shows local completed items with runtime
  const effectiveWatchHistory: WatchHistoryEntry[] = useMemo(
    () =>
      isAuthenticated
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
            }),
    [isAuthenticated, watchHistory, localWatchlist, knownMedia]
  );

  const viewFallback = (
    <div className="py-24 flex flex-col items-center justify-center gap-3 text-slate-400">
      <Loader2 className="w-6 h-6 text-amber-400 animate-spin" />
      <span className="text-xs font-medium">Loading view…</span>
    </div>
  );

  return (
    <div className="min-h-screen bg-[#0A0D12] text-slate-100 flex flex-col font-['Plus_Jakarta_Sans'] pb-16 md:pb-0">
      {/* Responsive OTT Navigation */}
      <Navbar
        currentTab={currentTab}
        homeHubMode={homeHubMode}
        onTabChange={handleNavbarTabChange}
        watchlistCount={activeWatchlist.length}
        onOpenSurprise={handleOpenSurprise}
        onQuickSearchClick={handleQuickSearchClick}
        isAuthenticated={isAuthenticated}
        isAdmin={showAdminTab}
        userProfile={userProfile}
        userEmail={authUser?.email}
        onOpenAuthModal={handleOpenAuthModal}
        onSignOut={handleSignOut}
      />

      {/* Main View Area (1440px Fluid OTT Container) */}
      <main className="flex-1 max-w-[1440px] w-full mx-auto px-4 sm:px-6 lg:px-8 pt-4 sm:pt-6">
        {currentTab === 'home' && (
          <HomeView
            initialItems={MEDIA_ITEMS}
            allMedia={knownMedia}
            hubMode={homeHubMode}
            watchlist={activeWatchlist}
            watchedEpisodes={activeWatchedEpisodes}
            watchHistory={effectiveWatchHistory}
            userProfile={userProfile}
            isInWatchlist={isInWatchlist}
            getWatchlistStatus={getWatchlistStatus}
            onToggleWatchlist={handleToggleWatchlist}
            onUpdateStatus={handleUpdateStatus}
            onRemoveFromWatchlist={handleRemoveFromWatchlist}
            getWatchedEpisodesCount={getWatchedEpisodesCount}
            onSelectMedia={handleSelectMedia}
            onPlayTrailer={handlePlayTrailer}
            onExploreMood={handleExploreMood}
            onExploreCategory={handleExploreCategory}
            onExploreGenre={handleExploreGenre}
            onNavigateTab={navigateToTab}
            onRegisterMedia={handleRegisterMedia}
          />
        )}

        <Suspense fallback={viewFallback}>
          {currentTab === 'discover' && (
            <DiscoverView
              isInWatchlist={isInWatchlist}
              getWatchlistStatus={getWatchlistStatus}
              onToggleWatchlist={handleToggleWatchlist}
              onUpdateStatus={handleUpdateStatus}
              onRemoveFromWatchlist={handleRemoveFromWatchlist}
              getWatchedEpisodesCount={getWatchedEpisodesCount}
              onSelectMedia={handleSelectMedia}
              onPlayTrailer={handlePlayTrailer}
              onOpenEstimator={handleOpenEstimatorFromDiscover}
              initialMood={discoverInitialMood}
              initialCategory={discoverInitialCategory}
              initialGenre={discoverInitialGenre}
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
              onSelectMedia={handleSelectMedia}
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
              onSelectMediaDetail={handleSelectMedia}
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
              onSelectMedia={handleSelectMedia}
              onNavigateTab={navigateToTab}
            />
          )}

          {currentTab === 'admin' && (
            <AdminDashboardView
              isAuthenticated={isAuthenticated}
              isAuthInitializing={isAuthInitializing}
              adminAccessState={adminAccessState}
              adminCheckError={adminCheckError}
              currentUserId={authUserId}
              currentUserEmail={authUser?.email || null}
              onOpenAuthModal={handleOpenAuthModal}
              onExitAdmin={() => navigateToTab('home')}
              onRetryAdminAccess={() =>
                authUserId
                  ? verifyCurrentUserAdminAccess(authUserId, true)
                  : undefined
              }
              onAdminVerified={handleAdminVerifiedFromDashboard}
              onAdminExplicitlyDenied={handleAdminExplicitlyDeniedFromDashboard}
            />
          )}
        </Suspense>
      </main>

      {/* Global Modals & Overlays (Lazy Mounted when active) */}
      <Suspense fallback={null}>
        {selectedMedia && (
          <DetailModal
            media={selectedMedia}
            onClose={() => setSelectedMedia(null)}
            isInWatchlist={isInWatchlist(selectedMedia.id)}
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
            onPlayTrailer={handlePlayTrailer}
            onPlayOnline={handlePlayOnline}
            allMedia={knownMedia}
            onSelectSimilar={handleSelectMedia}
            onRegisterMedia={handleRegisterMedia}
            onOpenEstimator={(media, seasonNum) => {
              setSelectedMedia(null);
              setEstimatorInitialMedia(media);
              setEstimatorInitialSeason(seasonNum);
              setCurrentTab('estimator');
              window.scrollTo({ top: 0, behavior: 'smooth' });
            }}
          />
        )}

        {trailerMedia && (
          <TrailerModal
            media={trailerMedia}
            onClose={() => setTrailerMedia(null)}
          />
        )}

        {onlinePlaybackTarget && (
          <OnlinePlayerModal
            media={onlinePlaybackTarget.media}
            initialSeasonNumber={onlinePlaybackTarget.seasonNumber}
            initialEpisodeNumber={onlinePlaybackTarget.episodeNumber}
            watchedEpisodes={activeWatchedEpisodes}
            onToggleEpisodeWatched={handleToggleEpisodeWatched}
            onClose={() => setOnlinePlaybackTarget(null)}
          />
        )}

        {isSurpriseOpen && (
          <SurpriseMeModal
            isOpen={isSurpriseOpen}
            onClose={() => setIsSurpriseOpen(false)}
            items={knownMedia}
            onSelectMedia={handleSelectMedia}
          />
        )}

        {isSearchOpen && (
          <SearchOverlay
            isOpen={isSearchOpen}
            onClose={() => setIsSearchOpen(false)}
            items={knownMedia}
            onSelectMedia={handleSelectMedia}
            onRegisterMedia={handleRegisterMedia}
          />
        )}

        {isAuthModalOpen && (
          <AuthModal
            isOpen={isAuthModalOpen}
            onClose={() => setIsAuthModalOpen(false)}
            supabaseConfigured={supabaseConfigured}
            securityWarning={securityWarning}
            initialMode={authModalMode}
          />
        )}
      </Suspense>

      {/* Clean OTT Footer */}
      <footer className="border-t border-white/[0.06] bg-[#07090E] mt-auto">
        <div className="max-w-[1440px] mx-auto px-4 sm:px-6 lg:px-8 py-8 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-slate-500">
          <div className="flex items-center gap-2">
            <div className="w-5 h-5 rounded bg-amber-500/20 text-amber-400 flex items-center justify-center">
              <Film className="w-3 h-3 stroke-[2.5]" />
            </div>
            <span className="font-['Plus_Jakarta_Sans'] font-bold text-slate-300">CineMax</span>
            <span>· Cinema &amp; Television Discovery</span>
          </div>

          <div className="flex flex-wrap items-center justify-center gap-5 sm:gap-6">
            <button
              onClick={() => {
                navigateToTab('home', 'all');
                window.scrollTo({ top: 0, behavior: 'smooth' });
              }}
              className="hover:text-slate-300 transition-colors"
            >
              Home
            </button>
            <button
              onClick={() => {
                navigateToTab('home', 'movies');
                window.scrollTo({ top: 0, behavior: 'smooth' });
              }}
              className="hover:text-slate-300 transition-colors"
            >
              Movies
            </button>
            <button
              onClick={() => {
                navigateToTab('home', 'series');
                window.scrollTo({ top: 0, behavior: 'smooth' });
              }}
              className="hover:text-slate-300 transition-colors"
            >
              Series
            </button>
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
              Quality &amp; File Size
            </button>
            <button
              onClick={() => setIsSurpriseOpen(true)}
              className="text-amber-400 hover:text-amber-300 transition-colors"
            >
              Surprise Me
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
