# CineMax Service Worker, Offline Access & PWA Implementation Plan

## 1. Overview & Goals
Enable seamless offline access to the **CineMax** application shell, user watchlist, previously viewed titles/episodes, and catalogue discovery feeds via a multi-tier Service Worker and local-first storage architecture, accompanied by full Progressive Web App (PWA) installability and an unobtrusive offline/sync status indicator.

---

## 2. Service Worker & Caching Architecture (`vite-plugin-pwa` + Custom Runtime Cache)

### A. App Shell Precaching & Navigation Fallback
- Integrate `vite-plugin-pwa` in `vite.config.ts` with `registerType: 'autoUpdate'` and `devOptions.enabled: true` (respecting `base` paths `/` in dev/Capacitor and `/CineMax/` in GitHub Pages builds).
- Remove the legacy inline `serviceWorker.getRegistrations()...unregister()` block in `index.html` so registered service workers remain active across reloads.
- Precache core application shell assets (`index.html`, compiled JS/CSS bundles, SVG/PNG icons, and font stylesheets) while excluding large promotional video files (`*.mp4`) from precaching.
- Configure SPA navigation fallback (`navigateFallback: 'index.html'`) so refreshing any route while offline loads the CineMax app shell immediately.

### B. Multi-Tier Runtime Caching Strategies
1. **Poster & Backdrop Media Assets (`CacheFirst` + Background Warm-Up)**
   - Cache poster and backdrop images from `image.tmdb.org`, `is1-ssl.mzstatic.com` (Apple iTunes posters), and `static.tvmaze.com` in `cinemax-media-posters-cache` (up to 400 entries, 30-day retention, supporting opaque `[0, 200]` responses).
   - **Proactive Watchlist & History Poster Warming**: Whenever the user's watchlist or watch history loads or updates, proactively warm the Service Worker image cache (`caches.open('cinemax-media-posters-cache')`) for all watchlist and recently viewed poster/backdrop URLs so they render even if the user goes offline before scrolling to them.
2. **Viewed Title Details & Season Episode Metadata (`NetworkFirst` + Persistent Local Snapshot)**
   - Cache `/api/title/*`, `/api/tv/*/season/*`, `/api/trailer/*`, `api.themoviedb.org/3/*`, and `api.tvmaze.com/shows/*` in `cinemax-title-details-cache` with a fast network timeout (`3s`) falling back to cached responses.
   - Persist viewed title detail payloads (`item` + `similar`) and viewed TV season episode lists in a dedicated bounded IndexedDB/localStorage store (`src/services/offlineCacheService.ts`) so `fetchTitleDetails` and `fetchTvSeasonEpisodes` in `src/services/mediaApi.ts` resolve instantaneously when offline—even on static or hybrid hosts.
3. **Catalogue & Discovery Feeds (`StaleWhileRevalidate` / `NetworkFirst`)**
   - Cache `/api/catalogue*`, Apple iTunes RSS feeds, and TVMaze show feeds in `cinemax-catalogue-cache`, plus persist the most recent catalogue responses per category in `offlineCacheService.ts` so Home and Discover tabs remain browsable offline.
4. **Google Fonts (`CacheFirst`)**
   - Cache `fonts.googleapis.com` and `fonts.gstatic.com` for 1 year (`cinemax-fonts-cache`) so typography (`Outfit` and `Plus Jakarta Sans`) never degrades offline.

---

## 3. Local-First Watchlist & Episode Progress Queue with Auto-Sync

### A. Cloud Snapshot Persistence for Signed-In Users
- Mirror signed-in user state (`cloudWatchlist`, `cloudWatchedEpisodes`, `watchHistory`, and `userProfile`) into user-scoped local cache keys (`cinemax_cloud_cache_<userId>`) whenever loaded or mutated.
- If a signed-in user opens CineMax while offline or mutations occur without connectivity, hydrate immediately from the user-scoped local snapshot so their full watchlist and episode progress are available offline.

### B. Offline Mutation Queue & Automatic Supabase Replay
- Create an offline sync queue in `src/services/offlineSyncQueue.ts` backed by `localStorage` (`cinemax_offline_mutation_queue`):
  - Queues mutations when `!navigator.onLine` or when a Supabase network call fails due to connectivity:
    - `UPSERT_WATCHLIST` (status, favourite toggle, personal rating, notes, mediaSnapshot)
    - `DELETE_WATCHLIST`
    - `TOGGLE_EPISODE` (single episode watched/unwatched)
    - `SET_SEASON_EPISODES` (mark full season watched/unwatched)
    - `UPSERT_HISTORY` / `DELETE_HISTORY`
  - Optimistically updates the UI state and local cache immediately.
  - Automatically flushes and deduplicates queued operations in FIFO order when connectivity is restored (`window` `online` event) or upon app launch when online and authenticated, updating sync status in real time.

---

## 4. PWA Installability, Manifest & Offline Status UI

### A. Web App Manifest & Compliant Icons
- Generate high-contrast CineMax brand icons in `public/`:
  - `public/icon.svg` (scalable vector brand emblem)
  - `public/pwa-192x192.png` (`192×192`, `purpose: "any"`)
  - `public/pwa-512x512.png` (`512×512`, `purpose: "any"`)
  - `public/pwa-maskable-512x512.png` (`512×512`, `purpose: "maskable"` with safe-zone padding on `#090a0f` obsidian background)
  - `public/apple-touch-icon.png` (`180×180` PNG for iOS Safari home screen)
- Configure the Web App Manifest (`name: "CineMax - Premium Cinema & TV Discovery"`, `short_name: "CineMax"`, `display: "standalone"`, `theme_color: "#090a0f"`, `background_color: "#090a0f"`).

### B. Subtle Offline / Sync Status Banner & In-App Install Prompt
- Create `src/hooks/usePWAStatus.ts` to track:
  - Online/offline connectivity (`isOnline`)
  - Pending offline sync mutations count & active syncing state (`pendingSyncCount`, `isSyncing`, `lastSyncedAt`)
  -Cached offline readiness (number of watchlist & viewed titles cached for offline access)
  - PWA installability (`isInstallable`, `isInstalled`, `isIOS`, `install()`)
- Create `src/components/OfflineStatusBanner.tsx`:
  - Renders a compact, non-intrusive "Liquid Glass" status bar below the top navbar or bottom-left corner when:
    - **Offline**: *"Offline Mode · Watchlist & viewed titles available from local cache"* (with count of cached titles and pending changes if any).
    - **Syncing / Reconnected**: *"Back online · Syncing X offline changes to cloud..."* → briefly confirms *"All changes synced"* before auto-dismissing.
- Add a clean **Install App** action (`src/components/PWAInstallButton.tsx`) integrated into the Profile / Settings view and subtle header action when installable (auto-hides when already installed in `standalone` mode or running inside Capacitor Android, and includes an iOS Safari "Add to Home Screen" guide modal).

---

## 5. Planned File Changes
- **`vite.config.ts`**: Add `VitePWA` plugin configuration with Workbox runtime caching rules for app shell, Google Fonts, TMDB/iTunes/TVMaze poster assets, and API routes.
- **`tsconfig.json`**: Add `"vite-plugin-pwa/client"` to `compilerOptions.types`.
- **`index.html`**: Remove the legacy service worker unregistration loop; add PWA meta tags (`theme-color`, `apple-mobile-web-app-capable`, `apple-touch-icon`, `icon.svg`).
- **`public/icon.svg`**, **`public/pwa-192x192.png`**, **`public/pwa-512x512.png`**, **`public/pwa-maskable-512x512.png`**, **`public/apple-touch-icon.png`**: Brand icon assets for PWA installation.
- **`src/services/offlineCacheService.ts`** *(new)*: Persistent offline storage and Cache Storage warm-up for watchlist posters, viewed title details (`item` + `similar`), viewed TV season episodes, and recent catalogue feeds.
- **`src/services/offlineSyncQueue.ts`** *(new)*: Local-first mutation queue and automatic Supabase replay engine on reconnect.
- **`src/services/mediaApi.ts`**: Wire `fetchCatalogue`, `fetchTitleDetails`, `fetchTvSeasonEpisodes`, and `fetchMediaTrailers` to read/write through `offlineCacheService` so previously viewed titles and seasons work seamlessly offline.
- **`src/hooks/usePWAStatus.ts`** *(new)*: Hook managing service worker registration, online/offline state, sync queue events, and `beforeinstallprompt` / iOS install flow.
- **`src/components/OfflineStatusBanner.tsx`** *(new)*: Subtle Liquid Glass offline/sync indicator and PWA install prompt modal.
- **`src/App.tsx`** & **`src/components/Navbar.tsx`**: Connect cloud state snapshot caching, offline mutation queueing/replay, poster cache warming for watchlist/history items, and mount `OfflineStatusBanner` / install trigger.
