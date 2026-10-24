import { MediaItem } from '../types';

export const SEED_TO_TMDB_ID: Record<string, { mediaType: 'movie' | 'tv'; tmdbId: number }> = {
  'dune-part-two': { mediaType: 'movie', tmdbId: 693134 },
  'dune-part-one': { mediaType: 'movie', tmdbId: 438631 },
  severance: { mediaType: 'tv', tmdbId: 95396 },
  oppenheimer: { mediaType: 'movie', tmdbId: 872585 },
  shogun: { mediaType: 'tv', tmdbId: 126308 },
  'blade-runner-2049': { mediaType: 'movie', tmdbId: 335984 },
  'blade-runner-1982': { mediaType: 'movie', tmdbId: 78 },
  succession: { mediaType: 'tv', tmdbId: 76331 },
  interstellar: { mediaType: 'movie', tmdbId: 157336 },
  'the-bear': { mediaType: 'tv', tmdbId: 136315 },
  arcane: { mediaType: 'tv', tmdbId: 94605 },
  mindhunter: { mediaType: 'tv', tmdbId: 67744 },
  'past-lives': { mediaType: 'movie', tmdbId: 666277 },
  'poor-things': { mediaType: 'movie', tmdbId: 792307 },
  dark: { mediaType: 'tv', tmdbId: 70523 },
  'the-batman': { mediaType: 'movie', tmdbId: 414906 },
  'the-dark-knight': { mediaType: 'movie', tmdbId: 155 },
  'joker-2019': { mediaType: 'movie', tmdbId: 475557 },
  chernobyl: { mediaType: 'tv', tmdbId: 87108 },
  arrival: { mediaType: 'movie', tmdbId: 329865 },
  'spirited-away': { mediaType: 'movie', tmdbId: 129 },
  fallout: { mediaType: 'tv', tmdbId: 106379 },
  'true-detective-s1': { mediaType: 'tv', tmdbId: 46648 },
  'everything-everywhere-all-at-once': { mediaType: 'movie', tmdbId: 545611 },
};

export function normalizeMediaTitle(title: string): string {
  return (title || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

export function extractCanonicalTmdbIdentity(
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
 * Returns a canonical identity key for a MediaItem so that a seed slug
 * (e.g. 'dune-part-two') and its live TMDB record ('tmdb-movie-693134')
 * resolve to the same canonical key ('tmdb:movie:693134').
 */
export function getCanonicalMediaKey(item: Pick<MediaItem, 'id' | 'type' | 'title' | 'year'>): string {
  const tmdbIdentity = extractCanonicalTmdbIdentity(item.id, item.type);
  if (tmdbIdentity) {
    return `tmdb:${tmdbIdentity.mediaType}:${tmdbIdentity.tmdbId}`;
  }
  const normTitle = normalizeMediaTitle(item.title);
  if (normTitle) {
    return `title:${item.type}:${normTitle}`;
  }
  return `id:${item.id}`;
}

function normalizeArtworkFilename(url?: string): string {
  const raw = String(url || '').trim();
  if (!raw) return '';
  const tmdbMatch = raw.match(/\/t\/p\/[^/]+\/([^/?#]+)/i);
  if (tmdbMatch) {
    return `tmdb:${tmdbMatch[1].toLowerCase()}`;
  }
  return raw.toLowerCase();
}

/**
 * Merges incoming live metadata into an existing MediaItem while preserving
 * the original item's ID (for watchlist continuity) and filling in missing
 * poster/backdrop/episode details.
 */
export function mergeMediaItemMetadata(existing: MediaItem, incoming: MediaItem): MediaItem {
  return {
    ...existing,
    posterUrl: existing.posterUrl || incoming.posterUrl || '',
    backdropUrl: existing.backdropUrl || incoming.backdropUrl || '',
    runtime: existing.runtime || incoming.runtime,
    seasons: existing.seasons || incoming.seasons,
    totalEpisodes: existing.totalEpisodes || incoming.totalEpisodes,
    seasonsList:
      existing.seasonsList && existing.seasonsList.length > 0
        ? existing.seasonsList
        : incoming.seasonsList,
    watchProviders: existing.watchProviders || incoming.watchProviders,
    rating: existing.rating > 0 ? existing.rating : incoming.rating,
    voteCount:
      existing.voteCount && existing.voteCount !== '0'
        ? existing.voteCount
        : incoming.voteCount,
  };
}

/**
 * Deduplicates a list of MediaItems by:
 * 1. Exact ID
 * 2. Canonical TMDB identity (e.g. 'dune-part-two' === 'tmdb-movie-693134')
 * 3. Normalized (mediaType + title)
 *
 * Also enforces strict 1:1 poster and backdrop uniqueness across distinct items:
 * if a subsequent distinct title attempts to reuse a posterUrl or backdropUrl
 * already claimed by an earlier title, the duplicate artwork URL is cleared to ''
 * so MediaPoster renders its bespoke title-specific stylized card instead of
 * another movie's artwork.
 */
export function dedupeMediaItems(items: MediaItem[]): MediaItem[] {
  if (!Array.isArray(items) || items.length === 0) return [];

  const byCanonicalKey = new Map<string, MediaItem>();
  const titleKeyToCanonical = new Map<string, string>();
  const idToCanonical = new Map<string, string>();

  for (const rawItem of items) {
    if (!rawItem || !rawItem.id || !rawItem.title) continue;

    const canonicalKey = getCanonicalMediaKey(rawItem);
    const titleKey = `${rawItem.type}:${normalizeMediaTitle(rawItem.title)}`;
    const existingCanonical =
      byCanonicalKey.has(canonicalKey)
        ? canonicalKey
        : idToCanonical.get(rawItem.id) || titleKeyToCanonical.get(titleKey);

    if (existingCanonical && byCanonicalKey.has(existingCanonical)) {
      const prev = byCanonicalKey.get(existingCanonical)!;
      byCanonicalKey.set(existingCanonical, mergeMediaItemMetadata(prev, rawItem));
      continue;
    }

    byCanonicalKey.set(canonicalKey, { ...rawItem });
    idToCanonical.set(rawItem.id, canonicalKey);
    if (normalizeMediaTitle(rawItem.title)) {
      titleKeyToCanonical.set(titleKey, canonicalKey);
    }
  }

  // Enforce 1:1 artwork ownership so two distinct titles never share a poster or backdrop
  const claimedPosters = new Map<string, string>();
  const claimedBackdrops = new Map<string, string>();
  const result: MediaItem[] = [];

  for (const [canonicalKey, item] of byCanonicalKey.entries()) {
    let posterUrl = (item.posterUrl || '').trim();
    let backdropUrl = (item.backdropUrl || '').trim();

    const posterFileKey = normalizeArtworkFilename(posterUrl);
    if (posterFileKey) {
      const owner = claimedPosters.get(posterFileKey);
      if (owner && owner !== canonicalKey) {
        posterUrl = '';
      } else {
        claimedPosters.set(posterFileKey, canonicalKey);
      }
    }

    const backdropFileKey = normalizeArtworkFilename(backdropUrl);
    if (backdropFileKey) {
      // Never allow a vertical poster path to be reused as a 16:9 backdrop, or shared across titles
      const owner = claimedBackdrops.get(backdropFileKey);
      if ((owner && owner !== canonicalKey) || backdropFileKey === posterFileKey) {
        backdropUrl = '';
      } else {
        claimedBackdrops.set(backdropFileKey, canonicalKey);
      }
    }

    result.push(
      posterUrl === item.posterUrl && backdropUrl === item.backdropUrl
        ? item
        : { ...item, posterUrl, backdropUrl }
    );
  }

  return result;
}
