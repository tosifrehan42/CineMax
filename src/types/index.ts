export type MediaType = 'movie' | 'tv';

export type WatchStatus = 'plan_to_watch' | 'watching' | 'completed';

export interface CastMember {
  name: string;
  role: string;
}

export interface MediaItem {
  id: string;
  title: string;
  type: MediaType;
  year: number;
  runtime?: string; // e.g. "2h 46m"
  seasons?: number; // for TV
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
  mediaId: string;
  status: WatchStatus;
  addedAt: string;
  personalRating?: number;
  personalNotes?: string;
  mediaSnapshot?: MediaItem;
}

export type TabView = 'home' | 'discover' | 'watchlist' | 'profile';

export interface FilterOptions {
  searchQuery: string;
  type: 'all' | 'movie' | 'tv';
  genre: string;
  mood: string;
  sortBy: 'popularity' | 'rating' | 'year' | 'title';
}
