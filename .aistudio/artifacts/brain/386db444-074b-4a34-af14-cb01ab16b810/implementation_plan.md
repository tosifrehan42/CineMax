# CineMax Performance & Responsiveness Optimization Plan

## 1. Audit Summary & Identified Bottlenecks

1. **React Re-render Cascades & O(N) Card Lookups (`src/App.tsx`, `src/components/MediaCarouselRow.tsx`, `src/components/MediaCard.tsx`)**
   - Every `MediaCard` across 13+ carousels calls `isInWatchlist(id)`, `getWatchlistStatus(id)`, and `getWatchedEpisodesCount(id)`, which execute linear `.some()`, `.find()`, and `.filter()` array scans on `activeWatchlist` and `activeWatchedEpisodes`.
   - Inline arrow functions passed to `MediaCard` (`onToggleWatchlist={(id) => onToggleWatchlist(id, item)}`, `onUpdateStatus`) and non-memoized handlers in `App.tsx` create new function references on every render, defeating component memoization.
   - `onRegisterMedia` in `App.tsx` creates a new `knownMedia` array reference even when all incoming media items are already registered, triggering redundant top-level `App` and `HomeView` re-renders.

2. **Home Mount 13-Request Burst & Redundant Catalogue Queries (`src/components/HomeView.tsx`, `src/services/mediaApi.ts`)**
   - `HomeView` fires 13 concurrent `fetchCatalogue` requests via `Promise.all` on initial mount and updates 13 separate state variables sequentially, causing network contention and frame drops on mobile CPUs.
   - `fetchCatalogue` and `fetchTitleDetails` in `mediaApi.ts` lack an in-memory client response cache and in-flight request deduplication for identical queries when switching tabs or hub modes.

3. **Poster & Backdrop Image Sizing, Decoding & Retry Loops (`src/components/MediaPoster.tsx`)**
   - Default `src` attributes on TMDB `<img>` elements use `w500`/`w780`/`w1280` URLs directly instead of normalizing default poster `src` to `w342` (with `w342`, `w500`, `w780` in `srcSet`) and backdrop `src` to `w780` (with `w780`, `w1280` in `srcSet`).
   - Images lack explicit `decoding="async"`, `fetchPriority={priority ? 'high' : 'auto'}`, and intrinsic `width`/`height` attributes.
   - Failed image URLs are only stored in local component state (`hasPosterError`, `hasBackdropError`), so unmounting and remounting cards (e.g., switching tabs or filtering) triggers repeated network requests for broken image URLs.
   - The loading placeholder uses a spinning border animation (`animate-spin`) on every uncached poster card simultaneously; replacing it with a lightweight static/shimmer surface reduces GPU paint overhead.

4. **Mobile Scroll Stutter & Expensive CSS Effects (`src/components/MediaCard.tsx`, `src/components/MediaCarouselRow.tsx`, `src/index.css`)**
   - Every `MediaCard` renders `backdrop-blur-md` on its top-right watchlist button and rank badge (`~180` blurred layers across the Home page), causing severe GPU compositing lag during touch scrolling on Android devices.
   - `MediaCarouselRow` attaches a `scroll` listener that invokes `setState` (`setCanScrollLeft`, `setCanScrollRight`) on every scroll event without `requestAnimationFrame` throttling.
   - Long lists of below-the-fold carousel rows and Discover grid cards lack CSS `content-visibility: auto` containment and `prefers-reduced-motion` guards.

5. **Initial Bundle Size (`src/App.tsx`, `vite.config.ts`)**
   - `App.tsx` eagerly imports all secondary views (`DiscoverView`, `WatchlistView`, `ProfileView`, `AdminDashboardView`, `QualityFileSizeEstimator`) and heavy modals (`DetailModal`, `TrailerModal`, `SurpriseMeModal`, `SearchOverlay`, `AuthModal`), parsing all code upfront before the Home view becomes interactive.

---

## 2. Planned Changes by File

### A. React Rendering & State Optimization
- **`src/App.tsx`**
  - Replace linear array scans in `isInWatchlist`, `getWatchlistStatus`, and `getWatchedEpisodesCount` with `useMemo`-computed `Map<string, WatchStatus>` (`watchlistStatusMap`) and `Map<string, number>` (`watchedEpisodesCountMap`) for O(1) lookups.
  - Wrap `handleRegisterMedia`, `handleToggleWatchlist`, `handleUpdateStatus`, `handleRemoveFromWatchlist`, `handlePlayTrailer`, `handleSelectMedia`, `handleExploreMood`, `handleExploreCategory`, `handleExploreGenre`, and `handleTabChange` in `useCallback`.
  - Short-circuit `handleRegisterMedia` when no genuinely new or enriched `MediaItem` entries exist so `knownMedia` state does not trigger unnecessary re-renders.
- **`src/components/MediaCard.tsx`**
  - Wrap `MediaCard` in `React.memo` with a custom props comparator or stable callback signature (`onToggleWatchlist(mediaId, media)`, `onUpdateStatus(mediaId, status, media)`) so cards do not re-render unless their own `media`, `isInWatchlist`, `watchlistStatus`, `watchedEpisodesCount`, or `rankBadge` changes.
- **`src/components/MediaCarouselRow.tsx` & `src/components/Navbar.tsx`**
  - Wrap `MediaCarouselRow` and `Navbar` in `React.memo` and pass stable handlers directly to `MediaCard` without creating per-item inline arrow functions inside `.map()`.

### B. Image Sizing, Lazy Loading & Failed-URL Deduplication
- **`src/components/MediaPoster.tsx`**
  - Add a module-level `Set<string>` (`failedImageUrls`) to remember failed poster and backdrop URLs across the session and prevent repeated network requests when cards remount.
  - Normalize TMDB poster default `src` to `w342` (with `w342`, `w500`, `w780` in `srcSet`) and backdrop default `src` to `w780` (with `w780`, `w1280` in `srcSet`).
  - Add `decoding={priority ? 'sync' : 'async'}`, `fetchPriority={priority ? 'high' : 'auto'}`, and explicit `width`/`height` dimensions (`width={342} height={513}` for posters, `width={1280} height={720}` for backdrops) to prevent layout shifts.
  - Replace the per-card spinning loader inside poster placeholders with a lightweight, zero-layout-shift gradient skeleton surface.
  - Wrap `MediaPoster` in `React.memo`.

### C. Scrolling, Animations & Mobile Compositing
- **`src/components/MediaCard.tsx`**
  - Replace mobile per-card `backdrop-blur-md` on the watchlist trigger button and rank badge with high-contrast solid/semi-opaque surfaces on mobile (`bg-[#0B0E14]/90 md:backdrop-blur-md`), preserving desktop glassmorphism while eliminating mobile GPU overdraw.
- **`src/components/MediaCarouselRow.tsx`**
  - Throttle `updateScrollButtons` inside a `requestAnimationFrame` guard and only call `setState` when boolean scroll-boundary states actually flip.
  - Add smooth touch momentum and containment classes (`touch-pan-x`, `overscroll-x-contain`) to horizontal scroll tracks.
- **`src/index.css`**
  - Add `@media (prefers-reduced-motion: reduce)` rules to disable non-essential transitions, animations, and smooth-scroll behavior when requested by the operating system.
  - Add a `.cv-auto` utility (`content-visibility: auto; contain-intrinsic-size: auto 340px;`) for below-the-fold carousel sections to reduce initial layout and paint work on mobile.

### D. Staggered Catalogue Loading & Client API Caching
- **`src/services/mediaApi.ts`**
  - Add an in-memory TTL cache (`clientCatalogueCache`, 5-minute TTL) and in-flight request deduplication (`inFlightCatalogueRequests`) for `fetchCatalogue` and `fetchTitleDetails`, bypassed when `refresh: true` is passed.
- **`src/components/HomeView.tsx`**
  - Consolidate the 13 row state slices into a single batched `ottRows` state object so updates commit in at most 2 renders instead of 13 separate state updates.
  - Load above-the-fold priority rows first (`trending_india`, `top_10_movies`, `top_10_tv`, `now_playing_movies`), then defer below-the-fold rows (`popular_movies`, `popular_tv`, `top_rated_movies`, `top_rated_tv`, `upcoming_movies`, `hindi_movies`, `south_indian_cinema`, `anime`, `documentaries`) using `requestIdleCallback` / a short timer with proper cleanup on unmount.

### E. Bundle Splitting with `React.lazy` & `Suspense`
- **`src/App.tsx`**
  - Lazy-load secondary views (`DiscoverView`, `WatchlistView`, `ProfileView`, `AdminDashboardView`, `QualityFileSizeEstimator`) and heavy modals (`DetailModal`, `TrailerModal`, `SurpriseMeModal`, `SearchOverlay`, `AuthModal`) using `React.lazy` and lightweight `Suspense` fallbacks so the Home view loads and becomes interactive with minimal upfront JS execution.

---

## 3. Verification Plan
1. Run `lint_applet` (`npm run lint`) to verify zero TypeScript or syntax errors.
2. Run `compile_applet` (`npm run build`) to verify production bundle chunking and clean compilation.
3. Verify that all existing features (Home hub modes, Discover filters & debounced search, Watchlist status & episode tracking, Trailer playback & fallbacks, Quality & File Size Estimator, Profile, and Admin dashboard) remain intact.
