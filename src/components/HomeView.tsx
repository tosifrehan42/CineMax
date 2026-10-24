import React, { useState, useEffect, useMemo, useCallback, useRef, startTransition } from 'react';
import {
  FranchiseCollection,
  HomeHubMode,
  MediaItem,
  UserProfile,
  WatchedEpisodeEntry,
  WatchHistoryEntry,
  WatchlistEntry,
  WatchStatus,
} from '../types';
import { HeroSpotlight } from './HeroSpotlight';
import { MediaCarouselRow } from './MediaCarouselRow';
import { FranchiseModal } from './FranchiseModal';
import { GENRES } from '../data/mediaData';
import {
  EXTRA_ANCHOR_ITEMS,
  FRANCHISE_COLLECTIONS,
  INDIAN_TRENDING_ITEMS,
} from '../data/franchiseData';
import { CatalogueCategory, fetchCatalogue } from '../services/mediaApi';
import { dedupeMediaItems, getCanonicalMediaKey } from '../utils/mediaIntegrity';
import {
  Flame,
  Film,
  Tv,
  Trophy,
  Sparkles,
  ChevronRight,
  Calendar,
  PlayCircle,
  Compass,
  Layers,
  Check,
  Play,
  RefreshCw,
  Globe,
} from 'lucide-react';

interface HomeViewProps {
  initialItems: MediaItem[];
  allMedia?: MediaItem[];
  hubMode?: HomeHubMode;
  watchlist?: WatchlistEntry[];
  watchedEpisodes?: WatchedEpisodeEntry[];
  watchHistory?: WatchHistoryEntry[];
  userProfile?: UserProfile | null;
  isInWatchlist: (id: string) => boolean;
  getWatchlistStatus?: (id: string) => WatchStatus | undefined;
  onToggleWatchlist: (id: string, media?: MediaItem) => void;
  onUpdateStatus?: (id: string, status: WatchStatus, media?: MediaItem) => void;
  onRemoveFromWatchlist?: (id: string) => void;
  getWatchedEpisodesCount?: (id: string) => number;
  onSelectMedia: (media: MediaItem) => void;
  onPlayTrailer: (media: MediaItem) => void;
  onExploreMood: (moodId: string) => void;
  onExploreCategory: (category: CatalogueCategory) => void;
  onExploreGenre?: (genre: string) => void;
  onNavigateTab: (tab: 'discover' | 'watchlist' | 'estimator') => void;
  onRegisterMedia?: (items: MediaItem[]) => void;
}

const ROW_BATCH_SIZE = 4;

const dedupeById = (list: MediaItem[]): MediaItem[] => dedupeMediaItems(list);

interface OttRowsState {
  trendingIndia: MediaItem[];
  nowPlayingMovies: MediaItem[];
  top10Movies: MediaItem[];
  top10Series: MediaItem[];
  popularMovies: MediaItem[];
  popularSeries: MediaItem[];
  topRatedMovies: MediaItem[];
  topRatedSeries: MediaItem[];
  upcomingItems: MediaItem[];
  hindiMovies: MediaItem[];
  southIndianCinema: MediaItem[];
  animeItems: MediaItem[];
  documentaryItems: MediaItem[];
}

interface HomeRowDescriptor {
  key: string;
  title: string;
  subtitle?: string;
  badgeText?: string;
  icon: React.ReactNode;
  items: MediaItem[];
  isTop10?: boolean;
  onExploreAll?: () => void;
  exploreLabel?: string;
}

const HomeViewComponent: React.FC<HomeViewProps> = ({
  initialItems,
  allMedia = initialItems,
  hubMode = 'all',
  watchlist = [],
  watchedEpisodes = [],
  watchHistory = [],
  userProfile,
  isInWatchlist,
  getWatchlistStatus,
  onToggleWatchlist,
  onUpdateStatus,
  onRemoveFromWatchlist,
  getWatchedEpisodesCount,
  onSelectMedia,
  onPlayTrailer,
  onExploreCategory,
  onExploreGenre,
  onNavigateTab,
  onRegisterMedia,
}) => {
  const [ottRows, setOttRows] = useState<OttRowsState>(() => ({
    trendingIndia: dedupeById(INDIAN_TRENDING_ITEMS),
    nowPlayingMovies: dedupeById(
      initialItems.filter((i) => i.type === 'movie' && i.year >= 2023)
    ),
    top10Movies: dedupeById(initialItems.filter((i) => i.type === 'movie')).slice(0, 10),
    top10Series: dedupeById(initialItems.filter((i) => i.type === 'tv')).slice(0, 10),
    popularMovies: dedupeById(initialItems.filter((i) => i.type === 'movie')),
    popularSeries: dedupeById(initialItems.filter((i) => i.type === 'tv')),
    topRatedMovies: dedupeById(
      [...initialItems].filter((i) => i.type === 'movie').sort((a, b) => b.rating - a.rating)
    ),
    topRatedSeries: dedupeById(
      [...initialItems].filter((i) => i.type === 'tv').sort((a, b) => b.rating - a.rating)
    ),
    upcomingItems: dedupeById(
      [...initialItems, ...EXTRA_ANCHOR_ITEMS]
        .filter((i) => i.type === 'movie' && i.year >= 2024)
        .sort((a, b) => b.year - a.year || b.rating - a.rating)
    ),
    hindiMovies: dedupeById(
      [...INDIAN_TRENDING_ITEMS, ...EXTRA_ANCHOR_ITEMS].filter(
        (i) => (i.language || '').toLowerCase() === 'hi'
      )
    ),
    southIndianCinema: dedupeById(
      [...INDIAN_TRENDING_ITEMS, ...EXTRA_ANCHOR_ITEMS].filter((i) =>
        ['te', 'ta', 'ml', 'kn'].includes((i.language || '').toLowerCase())
      )
    ),
    animeItems: dedupeById(
      [...initialItems, ...EXTRA_ANCHOR_ITEMS].filter(
        (i) =>
          i.genres.some((g) => g.toLowerCase() === 'animation') ||
          (i.language || '').toLowerCase() === 'ja'
      )
    ),
    documentaryItems: dedupeById(
      [...initialItems, ...EXTRA_ANCHOR_ITEMS].filter((i) =>
        i.genres.some((g) => g.toLowerCase() === 'documentary')
      )
    ),
  }));

  const {
    trendingIndia,
    nowPlayingMovies,
    top10Movies,
    top10Series,
    popularMovies,
    popularSeries,
    topRatedMovies,
    topRatedSeries,
    upcomingItems,
    hindiMovies,
    southIndianCinema,
    animeItems,
    documentaryItems,
  } = ottRows;

  const [selectedBrowseGenre, setSelectedBrowseGenre] = useState<string>('Sci-Fi');
  const [activeFranchise, setActiveFranchise] = useState<FranchiseCollection | null>(null);
  const [refreshSeed, setRefreshSeed] = useState(0);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [visibleRowCount, setVisibleRowCount] = useState<number>(ROW_BATCH_SIZE);
  const rowBatchSentinelRef = useRef<HTMLDivElement | null>(null);

  // Reset visible row batch to initial 4 rows when switching between All / Movies / Series
  useEffect(() => {
    setVisibleRowCount(ROW_BATCH_SIZE);
  }, [hubMode]);

  useEffect(() => {
    let active = true;
    let deferredTimer: ReturnType<typeof setTimeout> | null = null;
    const forceRefresh = refreshSeed > 0;
    if (forceRefresh) {
      setIsRefreshing(true);
    }

    async function loadPriorityRows() {
      try {
        // Phase 1: Load priority above-the-fold rows first so initial interaction is fast
        const [indiaRes, topMovRes, topTvRes, nowPlayRes] = await Promise.all([
          fetchCatalogue({ category: 'trending_india', page: 1, refresh: forceRefresh }),
          fetchCatalogue({ category: 'top_10_movies', page: 1, refresh: forceRefresh }),
          fetchCatalogue({ category: 'top_10_tv', page: 1, refresh: forceRefresh }),
          fetchCatalogue({ category: 'now_playing_movies', page: 1, refresh: forceRefresh }),
        ]);

        if (!active) return;

        const priorityFetched = dedupeById([
          ...indiaRes.items,
          ...topMovRes.items,
          ...topTvRes.items,
          ...nowPlayRes.items,
        ]);

        startTransition(() => {
          if (onRegisterMedia && priorityFetched.length > 0) {
            onRegisterMedia(priorityFetched);
          }

          setOttRows((prev) => ({
            ...prev,
            trendingIndia:
              indiaRes.items.length > 0 ? dedupeById(indiaRes.items) : prev.trendingIndia,
            top10Movies:
              topMovRes.items.length > 0
                ? dedupeById(topMovRes.items).slice(0, 10)
                : prev.top10Movies,
            top10Series:
              topTvRes.items.length > 0
                ? dedupeById(topTvRes.items).slice(0, 10)
                : prev.top10Series,
            nowPlayingMovies:
              nowPlayRes.items.length > 0
                ? dedupeById(nowPlayRes.items)
                : prev.nowPlayingMovies,
          }));
        });

        // Phase 2: Defer below-the-fold rows and commit inside startTransition so active touch scrolling never stalls
        deferredTimer = setTimeout(async () => {
          if (!active) return;
          try {
            const [
              popMovRes,
              popTvRes,
              ratedMovRes,
              ratedTvRes,
              upMovRes,
              hindiRes,
              southRes,
              animeRes,
              docRes,
            ] = await Promise.all([
              fetchCatalogue({ category: 'popular_movies', page: 1, refresh: forceRefresh }),
              fetchCatalogue({ category: 'popular_tv', page: 1, refresh: forceRefresh }),
              fetchCatalogue({ category: 'top_rated_movies', page: 1, refresh: forceRefresh }),
              fetchCatalogue({ category: 'top_rated_tv', page: 1, refresh: forceRefresh }),
              fetchCatalogue({ category: 'upcoming_movies', page: 1, refresh: forceRefresh }),
              fetchCatalogue({ category: 'hindi_movies', page: 1, refresh: forceRefresh }),
              fetchCatalogue({ category: 'south_indian_cinema', page: 1, refresh: forceRefresh }),
              fetchCatalogue({ category: 'anime', page: 1, refresh: forceRefresh }),
              fetchCatalogue({ category: 'documentaries', page: 1, refresh: forceRefresh }),
            ]);

            if (!active) return;

            const secondaryFetched = dedupeById([
              ...popMovRes.items,
              ...popTvRes.items,
              ...ratedMovRes.items,
              ...ratedTvRes.items,
              ...upMovRes.items,
              ...hindiRes.items,
              ...southRes.items,
              ...animeRes.items,
              ...docRes.items,
            ]);

            startTransition(() => {
              if (onRegisterMedia && secondaryFetched.length > 0) {
                onRegisterMedia(secondaryFetched);
              }

              setOttRows((prev) => ({
                ...prev,
                popularMovies:
                  popMovRes.items.length > 0 ? dedupeById(popMovRes.items) : prev.popularMovies,
                popularSeries:
                  popTvRes.items.length > 0 ? dedupeById(popTvRes.items) : prev.popularSeries,
                topRatedMovies:
                  ratedMovRes.items.length > 0
                    ? dedupeById(ratedMovRes.items)
                    : prev.topRatedMovies,
                topRatedSeries:
                  ratedTvRes.items.length > 0
                    ? dedupeById(ratedTvRes.items)
                    : prev.topRatedSeries,
                upcomingItems:
                  upMovRes.items.length > 0 ? dedupeById(upMovRes.items) : prev.upcomingItems,
                hindiMovies:
                  hindiRes.items.length > 0 ? dedupeById(hindiRes.items) : prev.hindiMovies,
                southIndianCinema:
                  southRes.items.length > 0
                    ? dedupeById(southRes.items)
                    : prev.southIndianCinema,
                animeItems:
                  animeRes.items.length > 0 ? dedupeById(animeRes.items) : prev.animeItems,
                documentaryItems:
                  docRes.items.length > 0 ? dedupeById(docRes.items) : prev.documentaryItems,
              }));
            });
          } catch {
            // Keep seeded initial state if secondary network request fails
          } finally {
            if (active) {
              setIsRefreshing(false);
            }
          }
        }, 120);
      } catch {
        if (active) {
          setIsRefreshing(false);
        }
      }
    }

    loadPriorityRows();
    return () => {
      active = false;
      if (deferredTimer) clearTimeout(deferredTimer);
    };
  }, [onRegisterMedia, refreshSeed]);

  // Filter helper for hubMode ('all' | 'movies' | 'series')
  const filterByHub = useMemo(() => {
    return (list: MediaItem[]) => {
      if (hubMode === 'movies') return list.filter((i) => i.type === 'movie');
      if (hubMode === 'series') return list.filter((i) => i.type === 'tv');
      return list;
    };
  }, [hubMode]);

  // 1. Featured Hero Items
  const featuredHeroItems = useMemo(() => {
    const baseFeatured = initialItems.filter((item) => item.featured);
    const filtered = filterByHub(baseFeatured);
    if (filtered.length > 0) return filtered;
    return filterByHub(initialItems).slice(0, 5);
  }, [initialItems, filterByHub]);

  const handleHeroToggleWatchlist = useCallback(
    (id: string) => {
      const item = featuredHeroItems.find((f) => f.id === id);
      onToggleWatchlist(id, item);
    },
    [featuredHeroItems, onToggleWatchlist]
  );

  // 2. Continue Watching (ONLY when genuine progress exists: status === 'watching' or watchedEpisodes > 0 & not completed)
  const continueWatchingItems = useMemo(() => {
    const mediaMap = new Map<string, MediaItem>();
    for (const m of allMedia) mediaMap.set(m.id, m);
    for (const w of watchlist) {
      if (w.mediaSnapshot && !mediaMap.has(w.mediaId)) {
        mediaMap.set(w.mediaId, w.mediaSnapshot);
      }
    }

    const activeIds = new Set<string>();
    for (const w of watchlist) {
      if (w.status === 'watching') {
        activeIds.add(w.mediaId);
      }
    }
    for (const ep of watchedEpisodes) {
      const st = getWatchlistStatus?.(ep.mediaId);
      if (st !== 'completed' && st !== 'dropped') {
        activeIds.add(ep.mediaId);
      }
    }

    const result: MediaItem[] = [];
    for (const id of activeIds) {
      const found = mediaMap.get(id);
      if (found) result.push(found);
    }

    return filterByHub(result);
  }, [allMedia, watchlist, watchedEpisodes, getWatchlistStatus, filterByHub]);

  // 3. Recommended For You (Personalized based on favoriteGenres, watchlist, or high-rated history; clearly labeled)
  const recommendationData = useMemo(() => {
    const completedOrWatchlistIds = new Set<string>([
      ...watchlist.filter((w) => w.status === 'completed').map((w) => w.mediaId),
      ...watchHistory.map((h) => h.mediaId),
    ]);

    const affinityGenres = new Map<string, number>();
    if (userProfile?.favoriteGenres?.length) {
      for (const g of userProfile.favoriteGenres) {
        affinityGenres.set(g, (affinityGenres.get(g) || 0) + 3);
      }
    }

    const mediaMap = new Map(allMedia.map((m) => [m.id, m]));
    for (const w of watchlist) {
      if (
        w.isFavourite ||
        (w.personalRating && w.personalRating >= 8) ||
        w.status === 'watching' ||
        w.status === 'completed'
      ) {
        const item = w.mediaSnapshot || mediaMap.get(w.mediaId);
        if (item) {
          for (const g of item.genres) {
            affinityGenres.set(g, (affinityGenres.get(g) || 0) + 2);
          }
        }
      }
    }

    const sortedTopGenres = Array.from(affinityGenres.entries())
      .sort((a, b) => b[1] - a[1])
      .map(([g]) => g)
      .slice(0, 3);

    const isPersonalized = sortedTopGenres.length > 0;
    const candidatePool = filterByHub(allMedia).filter(
      (m) => !completedOrWatchlistIds.has(m.id)
    );

    const scored = candidatePool.map((item) => {
      let score = item.rating * 2;
      for (const g of item.genres) {
        score += (affinityGenres.get(g) || 0) * 4;
      }
      return { item, score };
    });

    scored.sort((a, b) => b.score - a.score);
    const uniqueItems: MediaItem[] = [];
    const seen = new Set<string>();
    for (const entry of scored) {
      if (seen.has(entry.item.id)) continue;
      seen.add(entry.item.id);
      uniqueItems.push(entry.item);
      if (uniqueItems.length >= 14) break;
    }

    return {
      items: uniqueItems,
      isPersonalized,
      subtitle: isPersonalized
        ? `Personalized for your taste in ${sortedTopGenres.join(', ')}`
        : 'Critically acclaimed selections curated for your session',
      badgeText: isPersonalized ? 'Personalized' : 'Editorial Picks',
    };
  }, [allMedia, watchlist, watchHistory, userProfile, filterByHub]);

  // Cross-row deduplication helper so the same exact cards don't dominate every standard row
  const deduplicatedStandardRows = useMemo(() => {
    const usedKeys = new Set<string>(
      featuredHeroItems.slice(0, 2).map((i) => getCanonicalMediaKey(i))
    );

    const takeDistinct = (source: MediaItem[], minKeep = 6, maxKeep = 14): MediaItem[] => {
      const filtered = dedupeMediaItems(filterByHub(source));
      const fresh = filtered.filter((i) => !usedKeys.has(getCanonicalMediaKey(i)));
      const chosen = (fresh.length >= minKeep ? fresh : filtered).slice(0, maxKeep);
      chosen.slice(0, 5).forEach((i) => usedKeys.add(getCanonicalMediaKey(i)));
      return chosen;
    };

    return {
      india: filterByHub(trendingIndia).slice(0, 14),
      nowPlaying: takeDistinct(nowPlayingMovies, 6, 14),
      popMovies: takeDistinct(popularMovies, 8, 14),
      popSeries: takeDistinct(popularSeries, 8, 14),
      topMovies: takeDistinct(topRatedMovies, 8, 14),
      topSeries: takeDistinct(topRatedSeries, 8, 14),
      upcoming: takeDistinct(upcomingItems, 8, 14),
      hindi: filterByHub(hindiMovies).slice(0, 14),
      southIndian: filterByHub(southIndianCinema).slice(0, 14),
      anime: filterByHub(animeItems).slice(0, 14),
      documentaries: filterByHub(documentaryItems).slice(0, 14),
    };
  }, [
    featuredHeroItems,
    trendingIndia,
    nowPlayingMovies,
    popularMovies,
    popularSeries,
    topRatedMovies,
    topRatedSeries,
    upcomingItems,
    hindiMovies,
    southIndianCinema,
    animeItems,
    documentaryItems,
    filterByHub,
  ]);

  // Browse by Genre items
  const genreRowItems = useMemo(() => {
    const pool = filterByHub(allMedia);
    if (!selectedBrowseGenre || selectedBrowseGenre === 'All') {
      return pool.slice(0, 14);
    }
    return pool
      .filter((item) =>
        item.genres.some((g) => g.toLowerCase() === selectedBrowseGenre.toLowerCase())
      )
      .slice(0, 14);
  }, [allMedia, selectedBrowseGenre, filterByHub]);

  // Build ordered list of active catalogue rows for progressive 4-row IntersectionObserver batching
  const allCatalogueRows = useMemo<HomeRowDescriptor[]>(() => {
    const rows: HomeRowDescriptor[] = [];

    if (continueWatchingItems.length > 0) {
      rows.push({
        key: 'continue-watching',
        title: 'Continue Watching',
        subtitle: 'Pick up right where you left off in your active shows & films',
        badgeText: `${continueWatchingItems.length} Active`,
        icon: <PlayCircle className="w-5 h-5" />,
        items: continueWatchingItems,
        onExploreAll: () => onNavigateTab('watchlist'),
        exploreLabel: 'Open Watchlist',
      });
    }

    rows.push({
      key: 'recommended',
      title: 'Recommended For You',
      subtitle: recommendationData.subtitle,
      badgeText: recommendationData.badgeText,
      icon: <Sparkles className="w-5 h-5" />,
      items: recommendationData.items,
      onExploreAll: () => onNavigateTab('discover'),
      exploreLabel: 'Explore More',
    });

    rows.push({
      key: 'trending-india',
      title: 'Trending in India',
      subtitle: 'Most streamed blockbusters and acclaimed originals across India',
      badgeText: 'India Top Picks',
      icon: <Flame className="w-5 h-5" />,
      items: deduplicatedStandardRows.india,
      onExploreAll: () => onExploreCategory('trending_india'),
      exploreLabel: 'All India Trending',
    });

    if (hubMode !== 'series') {
      rows.push({
        key: 'top10-movies',
        title: 'Top 10 Movies Today',
        subtitle: 'Daily ranked theatrical & streaming motion pictures',
        badgeText: 'Top 10',
        icon: <Trophy className="w-5 h-5" />,
        items: top10Movies,
        isTop10: true,
        onExploreAll: () => onExploreCategory('popular_movies'),
        exploreLabel: 'Browse Movies',
      });
    }

    if (hubMode !== 'movies') {
      rows.push({
        key: 'top10-series',
        title: 'Top 10 Series Today',
        subtitle: 'Most watched television dramas, thrillers, and limited series',
        badgeText: 'Top 10',
        icon: <Tv className="w-5 h-5" />,
        items: top10Series,
        isTop10: true,
        onExploreAll: () => onExploreCategory('popular_tv'),
        exploreLabel: 'Browse Series',
      });
    }

    if (hubMode !== 'series' && deduplicatedStandardRows.nowPlaying.length > 0) {
      rows.push({
        key: 'now-playing',
        title: 'Now Playing & Recent Premieres',
        subtitle: 'Fresh theatrical releases and current box-office standouts',
        badgeText: 'Fresh',
        icon: <Film className="w-5 h-5" />,
        items: deduplicatedStandardRows.nowPlaying,
        onExploreAll: () => onExploreCategory('now_playing_movies'),
        exploreLabel: 'All Now Playing',
      });
    }

    if (hubMode !== 'series') {
      rows.push({
        key: 'popular-movies',
        title: 'Popular Movies',
        subtitle: 'High-momentum feature films audiences are streaming right now',
        icon: <Film className="w-5 h-5" />,
        items: deduplicatedStandardRows.popMovies,
        onExploreAll: () => onExploreCategory('popular_movies'),
        exploreLabel: 'See All Movies',
      });
    }

    if (hubMode !== 'movies') {
      rows.push({
        key: 'popular-series',
        title: 'Popular Series',
        subtitle: 'Binge-worthy multi-season television and prestige originals',
        icon: <Tv className="w-5 h-5" />,
        items: deduplicatedStandardRows.popSeries,
        onExploreAll: () => onExploreCategory('popular_tv'),
        exploreLabel: 'See All Series',
      });
    }

    if (hubMode !== 'series') {
      rows.push({
        key: 'top-rated-movies',
        title: 'Top Rated Movies',
        subtitle: 'All-time highest rated cinema masterpieces by consensus score',
        icon: <Trophy className="w-5 h-5" />,
        items: deduplicatedStandardRows.topMovies,
        onExploreAll: () => onExploreCategory('top_rated_movies'),
        exploreLabel: 'All Top Rated Movies',
      });
    }

    if (hubMode !== 'movies') {
      rows.push({
        key: 'top-rated-series',
        title: 'Top Rated Series',
        subtitle: 'Critically revered television series with 8.0+ consensus ratings',
        icon: <Trophy className="w-5 h-5" />,
        items: deduplicatedStandardRows.topSeries,
        onExploreAll: () => onExploreCategory('top_rated_tv'),
        exploreLabel: 'All Top Rated Series',
      });
    }

    if (deduplicatedStandardRows.hindi.length > 0) {
      rows.push({
        key: 'hindi-cinema',
        title: 'Hindi Cinema & Originals',
        subtitle: 'Blockbuster Bollywood features and critically acclaimed Hindi series',
        badgeText: 'Hindi',
        icon: <Globe className="w-5 h-5" />,
        items: deduplicatedStandardRows.hindi,
        onExploreAll: () => onExploreCategory('hindi_movies'),
        exploreLabel: 'Explore Hindi Catalogue',
      });
    }

    if (deduplicatedStandardRows.southIndian.length > 0) {
      rows.push({
        key: 'south-indian',
        title: 'South Indian Blockbusters',
        subtitle: 'Essential Telugu, Tamil, Malayalam, and Kannada cinema',
        badgeText: 'Regional',
        icon: <Flame className="w-5 h-5" />,
        items: deduplicatedStandardRows.southIndian,
        onExploreAll: () => onExploreCategory('south_indian_cinema'),
        exploreLabel: 'Explore South Indian',
      });
    }

    if (deduplicatedStandardRows.anime.length > 0) {
      rows.push({
        key: 'anime',
        title: 'Anime & Global Animation',
        subtitle: 'Iconic Japanese anime series, Studio Ghibli classics, and animated epics',
        badgeText: 'Anime',
        icon: <Sparkles className="w-5 h-5" />,
        items: deduplicatedStandardRows.anime,
        onExploreAll: () => onExploreCategory('anime'),
        exploreLabel: 'All Anime & Animation',
      });
    }

    if (deduplicatedStandardRows.documentaries.length > 0) {
      rows.push({
        key: 'documentaries',
        title: 'Acclaimed Documentaries & Docuseries',
        subtitle: 'Landmark natural history, sports chronicles, and non-fiction storytelling',
        badgeText: 'Non-Fiction',
        icon: <Compass className="w-5 h-5" />,
        items: deduplicatedStandardRows.documentaries,
        onExploreAll: () => onExploreCategory('documentaries'),
        exploreLabel: 'All Documentaries',
      });
    }

    rows.push({
      key: 'upcoming',
      title: 'New & Upcoming Releases',
      subtitle: 'Recent theatrical premieres and anticipated arrivals',
      icon: <Calendar className="w-5 h-5" />,
      items: deduplicatedStandardRows.upcoming,
      onExploreAll: () => onExploreCategory('upcoming_movies'),
      exploreLabel: 'Browse Upcoming',
    });

    return rows;
  }, [
    continueWatchingItems,
    recommendationData,
    deduplicatedStandardRows,
    hubMode,
    top10Movies,
    top10Series,
    onNavigateTab,
    onExploreCategory,
  ]);

  const totalRowCount = allCatalogueRows.length;
  const hasMoreRows = visibleRowCount < totalRowCount;

  // Progressive IntersectionObserver batching (mounts 4 rows at a time ahead of scroll)
  useEffect(() => {
    if (!hasMoreRows) return;
    const sentinel = rowBatchSentinelRef.current;
    if (!sentinel || typeof IntersectionObserver === 'undefined') {
      setVisibleRowCount(totalRowCount);
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        const entry = entries[0];
        if (entry && entry.isIntersecting) {
          startTransition(() => {
            setVisibleRowCount((prev) => Math.min(prev + ROW_BATCH_SIZE, totalRowCount));
          });
        }
      },
      { rootMargin: '600px 0px' }
    );

    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [hasMoreRows, totalRowCount, visibleRowCount]);

  const visibleCatalogueRows = useMemo(
    () => allCatalogueRows.slice(0, visibleRowCount),
    [allCatalogueRows, visibleRowCount]
  );

  return (
    <div className="space-y-10 sm:space-y-12 pb-12">
      {/* 1. Featured Cinematic Hero */}
      <HeroSpotlight
        featuredItems={featuredHeroItems}
        hubMode={hubMode}
        isInWatchlist={isInWatchlist}
        onToggleWatchlist={handleHeroToggleWatchlist}
        onSelectMedia={onSelectMedia}
        onPlayTrailer={onPlayTrailer}
      />

      {/* Subtle Catalogue Freshness Bar */}
      <div className="flex flex-wrap items-center justify-between gap-2 px-1 -my-4 text-xs text-slate-400">
        <div className="flex items-center gap-2">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
          <span>
            Live OTT Discovery Feed · {allMedia.length}+ Curated &amp; TMDB Indexed Titles
          </span>
        </div>
        <button
          type="button"
          onClick={() => setRefreshSeed((s) => s + 1)}
          disabled={isRefreshing}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#121721] hover:bg-[#19202E] border border-white/10 text-slate-300 hover:text-white font-medium transition-colors disabled:opacity-50"
        >
          <RefreshCw className={`w-3.5 h-3.5 text-amber-400 ${isRefreshing ? 'animate-spin' : ''}`} />
          <span>{isRefreshing ? 'Refreshing Feeds…' : 'Refresh Catalogue'}</span>
        </button>
      </div>

      {/* Progressively Mounted Catalogue Carousels (4 rows per batch) */}
      {visibleCatalogueRows.map((row) => (
        <MediaCarouselRow
          key={row.key}
          title={row.title}
          subtitle={row.subtitle}
          badgeText={row.badgeText}
          icon={row.icon}
          items={row.items}
          isTop10={row.isTop10}
          isInWatchlist={isInWatchlist}
          getWatchlistStatus={getWatchlistStatus}
          onToggleWatchlist={onToggleWatchlist}
          onUpdateStatus={onUpdateStatus}
          onRemoveFromWatchlist={onRemoveFromWatchlist}
          getWatchedEpisodesCount={getWatchedEpisodesCount}
          onSelectMedia={onSelectMedia}
          onPlayTrailer={onPlayTrailer}
          onExploreAll={row.onExploreAll}
          exploreLabel={row.exploreLabel}
        />
      ))}

      {/* Sentinel for mounting the next batch of 4 rows ahead of viewport */}
      {hasMoreRows && (
        <div ref={rowBatchSentinelRef} aria-hidden="true" className="h-4 w-full" />
      )}

      {/* 11. Browse by Genre */}
      <section className="space-y-4 pt-2">
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <Compass className="w-5 h-5 text-amber-400" />
              <h2 className="font-['Plus_Jakarta_Sans'] text-lg sm:text-xl font-bold text-white tracking-tight">
                Browse by Genre
              </h2>
            </div>
            <p className="text-xs text-slate-400 mt-0.5">
              Filter instant genre spotlights or open the full multi-filter Discover workspace
            </p>
          </div>

          <button
            type="button"
            onClick={() => {
              if (onExploreGenre) {
                onExploreGenre(selectedBrowseGenre);
              } else {
                onNavigateTab('discover');
              }
            }}
            className="text-xs font-semibold text-amber-400 hover:text-amber-300 flex items-center gap-1 self-start sm:self-auto"
          >
            <span>Open {selectedBrowseGenre} in Discover</span>
            <ChevronRight className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Genre Selector Bar */}
        <div className="flex items-center gap-2 overflow-x-auto pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {GENRES.filter((g) => g !== 'All').map((genre) => {
            const active = selectedBrowseGenre === genre;
            return (
              <button
                key={genre}
                type="button"
                onClick={() => setSelectedBrowseGenre(genre)}
                className={`px-3.5 py-1.5 rounded-xl text-xs font-semibold transition-all whitespace-nowrap shrink-0 ${
                  active
                    ? 'bg-amber-500 text-slate-950 shadow-sm shadow-amber-500/20'
                    : 'bg-[#121721] hover:bg-[#19202E] text-slate-300 hover:text-white border border-white/[0.07]'
                }`}
              >
                {genre}
              </button>
            );
          })}
        </div>

        <MediaCarouselRow
          title={`${selectedBrowseGenre} Spotlight`}
          items={genreRowItems}
          isInWatchlist={isInWatchlist}
          getWatchlistStatus={getWatchlistStatus}
          onToggleWatchlist={onToggleWatchlist}
          onUpdateStatus={onUpdateStatus}
          onRemoveFromWatchlist={onRemoveFromWatchlist}
          getWatchedEpisodesCount={getWatchedEpisodesCount}
          onSelectMedia={onSelectMedia}
          onPlayTrailer={onPlayTrailer}
        />
      </section>

      {/* 12. Franchise Collections / Watch Order */}
      <section className="space-y-4 pt-2">
        <div className="flex items-end justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <Layers className="w-5 h-5 text-amber-400" />
              <h2 className="font-['Plus_Jakarta_Sans'] text-lg sm:text-xl font-bold text-white tracking-tight">
                Franchise Collections & Watch Orders
              </h2>
            </div>
            <p className="text-xs text-slate-400 mt-0.5">
              Curated chronological and release-order guides with saga completion tracking
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-5">
          {FRANCHISE_COLLECTIONS.map((franchise) => {
            const totalCount = franchise.items.length;
            const completedCount = franchise.items.filter(
              (item) => getWatchlistStatus?.(item.id) === 'completed'
            ).length;

            return (
              <div
                key={franchise.id}
                onClick={() => setActiveFranchise(franchise)}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    setActiveFranchise(franchise);
                  }
                }}
                className="group relative overflow-hidden rounded-2xl border border-white/10 bg-[#121721] hover:border-amber-400/50 transition-all cursor-pointer flex flex-col justify-between p-5 min-h-[210px] shadow-lg"
              >
                {/* Subtle Backdrop Image */}
                <img
                  src={franchise.backdropUrl}
                  alt={franchise.title}
                  loading="lazy"
                  className="absolute inset-0 w-full h-full object-cover opacity-25 group-hover:opacity-35 group-hover:scale-105 transition-all duration-500"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-[#0A0D12] via-[#0A0D12]/80 to-[#0A0D12]/40" />

                <div className="relative z-10 flex items-center justify-between gap-2">
                  <span className="text-[10px] font-mono font-bold uppercase tracking-wider px-2.5 py-0.5 rounded bg-amber-500/20 text-amber-300 border border-amber-500/30">
                    {totalCount} Installments
                  </span>
                  {completedCount > 0 && (
                    <span className="flex items-center gap-1 text-[11px] font-mono text-emerald-400 bg-emerald-500/15 px-2 py-0.5 rounded border border-emerald-500/30">
                      <Check className="w-3 h-3" />
                      {completedCount}/{totalCount} Watched
                    </span>
                  )}
                </div>

                <div className="relative z-10 my-3">
                  <h3 className="font-['Plus_Jakarta_Sans'] text-base sm:text-lg font-bold text-white group-hover:text-amber-400 transition-colors">
                    {franchise.title}
                  </h3>
                  <p className="text-xs text-slate-300 mt-1 line-clamp-2">
                    {franchise.description}
                  </p>
                </div>

                <div className="relative z-10 pt-2 border-t border-white/10 flex items-center justify-between gap-2 text-xs">
                  <div className="flex items-center -space-x-2 overflow-hidden">
                    {franchise.items.slice(0, 4).map((it, idx) => (
                      <span
                        key={it.id}
                        className="inline-flex items-center justify-center px-2 py-0.5 rounded bg-black/70 border border-white/15 text-[10px] font-mono text-slate-300 truncate max-w-[95px]"
                      >
                        #{idx + 1} {it.title.split(':')[0]}
                      </span>
                    ))}
                  </div>

                  <span className="flex items-center gap-1 text-amber-400 font-semibold shrink-0 group-hover:translate-x-0.5 transition-transform">
                    <Play className="w-3 h-3 fill-amber-400" />
                    <span>Watch Order</span>
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* Franchise Watch-Order Modal */}
      <FranchiseModal
        collection={activeFranchise}
        onClose={() => setActiveFranchise(null)}
        isInWatchlist={isInWatchlist}
        getWatchlistStatus={getWatchlistStatus}
        onToggleWatchlist={onToggleWatchlist}
        onUpdateStatus={onUpdateStatus}
        onSelectMedia={onSelectMedia}
        onPlayTrailer={onPlayTrailer}
      />
    </div>
  );
};

export const HomeView = React.memo(HomeViewComponent);
