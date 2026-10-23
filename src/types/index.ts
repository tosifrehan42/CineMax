export type MediaType = 'movie' | 'tv';

export type WatchStatus =
  | 'plan_to_watch'
  | 'watching'
  | 'completed'
  | 'on_hold'
  | 'dropped';

export const WATCH_STATUS_LABELS: Record<WatchStatus, string> = {
  plan_to_watch: 'Want to Watch',
  watching: 'Watching',
  completed: 'Completed',
  on_hold: 'On Hold',
  dropped: 'Dropped',
};

export const WATCH_STATUS_ORDER: WatchStatus[] = [
  'plan_to_watch',
  'watching',
  'completed',
  'on_hold',
  'dropped',
];

export interface CastMember {
  name: string;
  role: string;
}

export interface SeasonSummary {
  seasonNumber: number;
  name: string;
  episodeCount: number;
  airDate?: string;
}

export interface EpisodeInfo {
  episodeNumber: number;
  seasonNumber: number;
  name: string;
  airDate?: string;
  runtime?: number;
  overview?: string;
  stillUrl?: string;
}

export interface MediaItem {
  id: string;
  title: string;
  type: MediaType;
  year: number;
  runtime?: string; // e.g. "2h 46m"
  seasons?: number; // for TV
  totalEpisodes?: number; // for TV
  seasonsList?: SeasonSummary[]; // for TV
  genres: string[];
  rating: number; // e.g. 8.8
  voteCount: string; // e.g. "412k"
  synopsis: string;
  tagline: string;
  director: string;
  cast: CastMember[];
  moods: string[];
  contentRating: string; // "PG-13", "R", "TV-MA"
  featured?: boolean;
  trendingRank?: number;
  popularityRank?: number;
  topRatedRank?: number;
  streamOn: string[];
  themeColor: string; // Hex color for subtle ambient glow
  posterUrl: string;
  backdropUrl: string;
  posterVisual: {
    bgFrom: string;
    bgTo: string;
    accent: string;
    iconType: 'space' | 'city' | 'detective' | 'fantasy' | 'mind' | 'cyber' | 'desert' | 'retro' | 'nature' | 'darkness';
    silhouetteSvg?: string;
  };
}

export interface WatchlistEntry {
  id?: string;
  mediaId: string;
  tmdbId?: number;
  mediaType?: MediaType;
  status: WatchStatus;
  isFavourite?: boolean;
  addedAt: string;
  updatedAt?: string;
  personalRating?: number;
  personalNotes?: string;
  mediaSnapshot?: MediaItem;
}

export interface WatchedEpisodeEntry {
  id?: string;
  userId?: string;
  mediaId: string;
  seasonNumber: number;
  episodeNumber: number;
  watchedAt: string;
}

export interface WatchHistoryEntry {
  id: string;
  userId?: string;
  mediaId: string;
  tmdbId: number;
  mediaType: MediaType;
  watchedAt: string;
  personalRating?: number;
  reviewNotes?: string;
  runtimeMinutes: number;
  mediaSnapshot?: MediaItem;
  createdAt?: string;
  updatedAt?: string;
}

export interface UserProfile {
  id: string;
  email?: string;
  username: string | null;
  displayName: string;
  bio: string;
  avatarUrl: string | null;
  favoriteGenres: string[];
  createdAt: string;
  updatedAt: string;
}

export type TabView = 'home' | 'discover' | 'watchlist' | 'estimator' | 'profile';

export interface FilterOptions {
  searchQuery: string;
  type: 'all' | 'movie' | 'tv';
  genre: string;
  mood: string;
  sortBy: 'popularity' | 'rating' | 'year' | 'title';
}
