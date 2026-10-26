# CineMax Search System Fix (GitHub Pages Static Deployment)

## 1. Root Cause Analysis

Tracing the search flow from `SearchOverlay.tsx` and `DiscoverView.tsx` through `fetchCatalogue()` and `resolveClientCatalogue()` in `src/services/mediaApi.ts` revealed four issues causing movie and TV search failures on GitHub Pages (`https://tosifrehan42.github.io/CineMax/`):

1. **`resolveClientCatalogue()` Never Queries TMDB Search Endpoints**:
   - On GitHub Pages (`staticHostWithoutApi === true` when `VITE_API_BASE_URL` is unset or unreachable), `fetchCatalogue()` delegates all requests to `resolveClientCatalogue()`.
   - Although `CLIENT_TMDB_API_KEY` (`import.meta.env.VITE_TMDB_API_KEY`) is already defined in `src/services/mediaApi.ts` and passed during the GitHub Actions build in `.github/workflows/deploy.yml`, `resolveClientCatalogue()` never calls TMDB `/search/movie`, `/search/tv`, or `/search/multi`.
   - Movie searches only filter the ~50 static seed titles plus the daily iTunes RSS top chart, so searching for almost any movie (e.g., *Inception*, *Interstellar*, *Baahubali*, *Dune*) fails to return live TMDB results.
2. **Restrictive Category Pre-Filtering During Search**:
   - In `resolveClientCatalogue()`, when a user searches in `DiscoverView` while a category tab is active (such as *Upcoming* or *Trending in India*), the category filter (e.g., `item.year >= 2024`) narrows the local pool *before* the search query runs, hiding matching titles outside that category.
3. **Lack of Live TMDB Pagination & Multi-Source Deduplication**:
   - Client-side search slices a static local array rather than requesting the requested `page` from TMDB `/search/*` and merging/deduplicating live TMDB items with local catalogue and TVMaze results.
4. **Silent Fallback When `VITE_TMDB_API_KEY` Is Missing or Invalid**:
   - When `VITE_TMDB_API_KEY` is missing or rejected (HTTP 401/403), `resolveClientCatalogue()` silently returns `tmdbConfigured: false` with only local/TVMaze items and no diagnostic status, making a degraded search appear as if no movies exist.

---

## 2. Planned Changes

### A. Client-Side TMDB Live Search & Normalization (`src/services/mediaApi.ts`)
- **TMDB Genre & Language Normalization**:
  - Add client-side TMDB genre ID mapping (`MOVIE_GENRES`, `TV_GENRES`), language mapping (`LANG_MAP`), mood derivation, and rating/year normalization matching `server.ts` so every TMDB search result maps cleanly into the `MediaItem` interface (`id: tmdb-movie-<id>` or `tmdb-tv-<id>`).
- **Live TMDB v3 Search Endpoints**:
  - Implement `searchClientTmdb(params, signal)` in `src/services/mediaApi.ts` using `CLIENT_TMDB_API_KEY`:
    - `type === 'movie'` -> `https://api.themoviedb.org/3/search/movie`
    - `type === 'series'` -> `https://api.themoviedb.org/3/search/tv`
    - `type === 'all'` (or omitted) -> `https://api.themoviedb.org/3/search/multi` (filtering to `media_type === 'movie' | 'tv'`)
  - Pass `query` (preserving multi-word spaces), `page`, `include_adult=false`, and the caller's `AbortSignal` so rapid typing cancels in-flight requests cleanly.
- **Global Search Across Categories & Filter Application**:
  - When `params.query` is non-empty in `resolveClientCatalogue()`, bypass category tab restrictions so search queries the full catalogue.
  - Apply explicit user filters (`type`, `genre`, `language`, `year`, `mood`) and sort order (`relevance`, `rating`, `year_desc`, `title_asc`) consistently across merged results.
- **Merging, Deduplication & Relevance Ranking**:
  - Merge live TMDB search results, local catalogue matches, and TVMaze fallback results using `dedupeMediaItems()` (deduplicating by canonical ID and normalized `type + title + year`).
  - Rank results via `scoreSearchMatch()` so exact title matches appear first, followed by prefix matches, whole-word matches, substring matches, and metadata matches, with popularity/rating tie-breakers.
  - Preserve TMDB pagination metadata (`page`, `totalPages`, `totalResults`) so "Load More" fetches subsequent pages from TMDB.
- **Search Diagnostics in `CatalogueResponse`**:
  - Extend `CatalogueResponse` with optional `searchWarning?: string` and `searchSource?: 'tmdb' | 'fallback'` metadata so the UI can distinguish between a verified live TMDB search and a fallback search when `VITE_TMDB_API_KEY` is missing or invalid.

### B. Search UI Feedback & State Handling (`src/components/SearchOverlay.tsx` & `src/components/DiscoverView.tsx`)
- **Multi-Word Input & Request Lifecycle**:
  - Preserve spaces naturally while typing in the search inputs, debounce requests (220ms in `SearchOverlay`, 250ms in `DiscoverView`), cancel stale requests via `AbortController`, and reset cleanly when the search input is cleared.
- **Fallback Warning Banner**:
  - When `response.searchWarning` is present (e.g., `VITE_TMDB_API_KEY` is not configured in the static build or TMDB returned an authentication/network error), display a non-intrusive warning banner above the fallback results in both `SearchOverlay` and `DiscoverView` explaining that live TMDB search is unavailable and showing local/TVMaze fallback results, with a retry action when applicable.

### C. GitHub Actions Workflow Verification (`.github/workflows/deploy.yml`)
- Keep `VITE_TMDB_API_KEY: ${{ secrets.VITE_TMDB_API_KEY }}` and add a safe, non-secret boolean step log during the workflow build that reports whether `VITE_TMDB_API_KEY` is set (without ever printing its value) so deployment logs clearly show if the repository secret is missing.

---

## 3. Verification Plan
1. Run `bun run lint` (`tsc --noEmit`) to verify strict TypeScript compilation across all modified files.
2. Run `bun run build` (`vite build`) to verify the production bundle for GitHub Pages builds cleanly.
3. Verify single-word and multi-word movie/TV queries, category-agnostic search in Discover, duplicate prevention, and fallback warning banners.
