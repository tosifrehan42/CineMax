import {
  MediaType,
  WatchProviderCategory,
  WatchProviderOffer,
  WatchProvidersInfo,
} from '../types';

const TMDB_LOGO_BASE = 'https://image.tmdb.org/t/p/w92';

export const DEFAULT_WATCH_REGION = 'IN';
export const DEFAULT_WATCH_REGION_NAME = 'India';
export const JUSTWATCH_TMDB_ATTRIBUTION =
  'Streaming availability data for India (IN) powered by JustWatch & TMDB.';

const CATEGORY_LABELS: Record<
  WatchProviderCategory,
  WatchProviderOffer['categoryLabel']
> = {
  free: 'Free',
  ads: 'Ad-Supported',
  flatrate: 'Subscription',
  rent: 'Rent',
  buy: 'Buy',
};

const CATEGORY_ORDER: WatchProviderCategory[] = [
  'free',
  'ads',
  'flatrate',
  'rent',
  'buy',
];

/**
 * Normalizes a raw TMDB `/watch/providers` response object into a typed WatchProvidersInfo
 * for the target region (defaulting to India `IN`).
 *
 * - Never fabricates provider URLs or implies a title is free unless TMDB's `free` or `ads`
 *   arrays explicitly contain that provider for the region.
 * - Preserves the returned `results[region].link` availability URL supplied by TMDB/JustWatch.
 */
export function normalizeTmdbWatchProviders(
  rawWatchProviders: any,
  mediaType: MediaType,
  tmdbId: number | string,
  region: string = DEFAULT_WATCH_REGION
): WatchProvidersInfo {
  const cleanRegion = (region || DEFAULT_WATCH_REGION).toUpperCase();
  const regionName =
    cleanRegion === 'IN' ? DEFAULT_WATCH_REGION_NAME : cleanRegion;

  const results = rawWatchProviders?.results;
  const regionData = results?.[cleanRegion];

  const fallbackTmdbWatchUrl = `https://www.themoviedb.org/${mediaType}/${tmdbId}/watch?locale=${cleanRegion}`;
  const suppliedLink =
    typeof regionData?.link === 'string' && regionData.link.trim().startsWith('http')
      ? regionData.link.trim()
      : undefined;
  const tmdbWatchUrl = suppliedLink || fallbackTmdbWatchUrl;

  if (!regionData || typeof regionData !== 'object') {
    return {
      region: cleanRegion,
      regionName,
      tmdbWatchUrl,
      offers: [],
      status: 'none_in_region',
      attributionText: JUSTWATCH_TMDB_ATTRIBUTION,
    };
  }

  const offers: WatchProviderOffer[] = [];
  const seenKey = new Set<string>();

  for (const category of CATEGORY_ORDER) {
    const rawList: any[] = Array.isArray(regionData[category])
      ? regionData[category]
      : [];

    for (const entry of rawList) {
      const providerId = Number(entry?.provider_id || 0);
      const providerName = String(entry?.provider_name || '').trim();
      if (!providerName) continue;

      const dedupeKey = `${category}:${providerId || providerName.toLowerCase()}`;
      if (seenKey.has(dedupeKey)) continue;
      seenKey.add(dedupeKey);

      const logoPath =
        typeof entry?.logo_path === 'string' && entry.logo_path.trim()
          ? entry.logo_path.trim()
          : '';

      offers.push({
        providerId,
        providerName,
        logoUrl: logoPath ? `${TMDB_LOGO_BASE}${logoPath}` : undefined,
        category,
        categoryLabel: CATEGORY_LABELS[category],
        url: tmdbWatchUrl,
        isOfficialProviderUrl: false,
        displayPriority:
          typeof entry?.display_priority === 'number'
            ? entry.display_priority
            : 999,
      });
    }
  }

  return {
    region: cleanRegion,
    regionName,
    tmdbWatchUrl,
    offers,
    status: offers.length > 0 ? 'available' : 'none_in_region',
    attributionText: JUSTWATCH_TMDB_ATTRIBUTION,
  };
}

/**
 * Returns an honest unconfigured WatchProvidersInfo state when neither the backend
 * proxy nor a client-side TMDB API key is available.
 */
export function buildUnconfiguredWatchProviders(
  region: string = DEFAULT_WATCH_REGION
): WatchProvidersInfo {
  const cleanRegion = (region || DEFAULT_WATCH_REGION).toUpperCase();
  return {
    region: cleanRegion,
    regionName: cleanRegion === 'IN' ? DEFAULT_WATCH_REGION_NAME : cleanRegion,
    offers: [],
    status: 'unconfigured',
    attributionText: JUSTWATCH_TMDB_ATTRIBUTION,
  };
}
