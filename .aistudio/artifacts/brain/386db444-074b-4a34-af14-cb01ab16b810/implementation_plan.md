# Catalogue Poster, Metadata & Deduplication Integrity Plan

## 1. Root Cause Audit & Architecture Overview
An audit of the catalogue seed files, API mappers, and carousel components revealed three root causes behind mismatched posters, inaccurate card metadata, and duplicate titles:

1. **Cross-Title Hardcoded Poster & Backdrop Reuse (`src/data/franchiseData.ts` & `src/data/mediaData.ts`)**:
   - Multiple titles in `INDIAN_TRENDING_ITEMS`, `REGIONAL_AND_GENRE_ANCHOR_ITEMS`, and `FRANCHISE_COLLECTIONS` hardcode another movie or series' TMDB image path:
     - *RRR*, *Maharaja*, and *Kantara* all point to `/nEufeZlyAOLqO2brrs0yeF1lgXO.jpg` (*RRR*'s poster) and `/i0Y0wP8H6SRgjr6QmuwbtQbS24D.jpg`.
     - *Tumbbad*, *Jawan*, and *Aavesham* all point to `/jFt1gS4BGHlK8xt76Y81Alp4dbt.jpg` (*Jawan*'s poster).
     - *Kalki 2898 AD* and *Vikram* point to `/b0PlSFdDwbyK0cf5RxwDpaOJQvQ.jpg` (*The Batman*'s backdrop) and `/9SSEUrSqhljBMzRe4aBTh17rUaC.jpg`.
     - *The Family Man* points to *Severance*'s poster (`/pPHpeI2X1qEd1CS1SeyrdhZ4qnT.jpg`) and backdrop (`/hPea3Qy5Gd6z4kJLUruBbwAH8Rm.jpg`).
     - *Sacred Games* and *Dangal* share `/p2lVAcPuRPSO8Al6hDDGw0OgMi8.jpg` and `/wPjtacig0kIkVcTQmXoNt6jbMwo.jpg`.
     - *3 Idiots* and *12th Fail* share `/66A9MqXOyVFCssoloscw79z8Tew.jpg` and `/wPjtacig0kIkVcTQmXoNt6jbMwo.jpg`.
     - *Dune: Prophecy* points to *Dune: Part Two*'s poster (`/1pdfLvkbY9ohJlCjQH2CZjjYVvJ.jpg`) and backdrop (`/xOMo8BRK7PfcJv9JCnx7s5hj0PX.jpg`).
     - *The Last Dance* points to *Inception*'s poster (`/oYuLEt3zVCKq57qu2F8dT7NIa6f.jpg`) and backdrop (`/8ZTVqvKDQ8emSGUEMjsS4yHAwrp.jpg`).
     - *Planet Earth II* uses a broken poster path (`/t9a72F7fI3b5z2z1q5W4x0A8c6.jpg`) and *Blade Runner*'s backdrop (`/eIi3klFf7mp3oL5EEF4mLIDs26r.jpg`).
     - *Arrival* in `src/data/mediaData.ts` reuses its vertical 2:3 `poster_path` (`/x2FJsf1ElAgr63Y3PNPtJrcmpoe.jpg`) as its 16:9 `backdropUrl`.

2. **Canonical Identity & Cross-Source Deduplication Gaps**:
   - Seed titles use slug IDs (`dune-part-two`, `severance`, `the-batman`), whereas live TMDB responses and anchor items use `tmdb-movie-{id}` / `tmdb-tv-{id}`.
   - Existing deduplication in `HomeView.tsx`, `MediaCarouselRow.tsx`, `DiscoverView.tsx`, `mediaApi.ts`, and `server.ts` only checks `item.id` or `type:title`, allowing the same canonical title to appear twice in a row or grid and allowing a shared `posterUrl` to render under two different titles.

3. **Metadata & Category Filtering Inaccuracies**:
   - Multi-season TV series in `src/data/mediaData.ts` (*Severance*, *Succession*, *The Bear*, *Arcane*, *Mindhunter*, *Dark*) list their most recent season year instead of their original `first_air_date` year.
   - `HomeView.tsx` seeds the **New & Upcoming Releases** state by sorting all `initialItems` by `year`, surfacing older or TV titles before live movie data loads.
   - Open-catalogue fallbacks in `server.ts` and `src/services/mediaApi.ts` synthesize ratings (`7.1 + (h % 21) / 10`), default runtimes (`124m`), or estimated season counts (`Math.round((show.weight || 85) / 22)`) when upstream APIs omit those fields.

---

## 2. Key Changes & File-by-File Implementation

### A. Canonical Media Identity & Artwork Sanitizer (`src/utils/mediaIntegrity.ts`)
- Create a shared utility module used by both client (`src/services/mediaApi.ts`, `HomeView.tsx`, `MediaCarouselRow.tsx`, `DiscoverView.tsx`) and server (`server.ts`):
  - **`getCanonicalMediaKey(item)`**: Resolves `(mediaType + tmdbId)` via `SEED_TO_TMDB_ID` or `tmdb-{type}-{id}` pattern, falling back to normalized `type:title:year` when no TMDB ID exists.
  - **`dedupeMediaItems(items)`**: Deduplicates any array of `MediaItem` records by canonical media key AND ensures no two distinct titles in a list share the exact same non-empty `posterUrl`.
  - **`sanitizeMediaItemArtwork(item)`**: Prevents vertical `posterUrl` reuse as `backdropUrl` and strips any `posterUrl` or `backdropUrl` that collides with another title's canonical artwork so `MediaPoster` cleanly renders the title's own bespoke typographic card when an image is absent.

### B. Seed & Regional Catalogue Cleanup (`src/data/franchiseData.ts` & `src/data/mediaData.ts`)
- **Audit & Fix Every Seed Entry**:
  - Correct TMDB IDs in `src/data/franchiseData.ts` (e.g. *Maharaja* `tmdb-movie-1266798`, *12th Fail* `tmdb-movie-1160164`, *Kantara* `tmdb-movie-858414`).
  - Assign each title its own verified, unique artwork URL (from TMDB or official TVMaze artwork for TV series) or `''` (empty string) when a verified unique URL is not statically bundled—completely eliminating every cross-title duplicate `posterUrl` and `backdropUrl`.
  - Update TV series `year` values in `src/data/mediaData.ts` to match their official `first_air_date` year (*Severance*: `2022`, *Succession*: `2018`, *The Bear*: `2022`, *Arcane*: `2021`, *Mindhunter*: `2017`, *Dark*: `2017`).
  - Fix *Arrival*'s `backdropUrl` in `src/data/mediaData.ts` so it does not reuse its vertical 2:3 poster path.

### C. Backend & Client API Mapping (`server.ts` & `src/services/mediaApi.ts`)
- **Strict Type & Category Enforcement**:
  - Ensure `hindi_movies`, `south_indian_cinema`, `now_playing_movies`, `upcoming_movies`, `popular_movies`, `top_rated_movies`, and `top_10_movies` strictly filter and map `movie` items, while `popular_tv`, `top_rated_tv`, and `top_10_tv` strictly filter and map `tv` items.
  - Ensure **New & Upcoming Releases** (`upcoming_movies`) only includes movies from `2024` onward in fallback mode and never mixes in older catalog titles.
- **No Fabricated Metadata**:
  - Remove synthetic rating formulas (`7.1 + (h % 21) / 10`), default `124m` movie runtimes, and weight-based TV season guesses from the Apple iTunes RSS and TVMaze open-catalog mappers; preserve `0` (rendered as `NR`) when rating is absent and omit `runtime` / `seasons` when unknown so `MediaCard` displays `Film` or `Series` honestly.
- **Runtime Artwork Enrichment for Static/Seed Items**:
  - When TMDB is configured on the server or client, automatically enrich any seed/regional item missing a `posterUrl` or `backdropUrl` using its exact `(mediaType, tmdbId)` lookup.

### D. UI Carousel & Card Integrity (`src/components/HomeView.tsx`, `src/components/MediaCarouselRow.tsx`, `src/components/DiscoverView.tsx`)
- **`HomeView.tsx`**:
  - Initialize `upcomingItems` exclusively with verified recent/upcoming movies (`type === 'movie' && year >= 2024`) rather than sorting all `initialItems`.
  - Apply `dedupeMediaItems` across every Home carousel row (`trendingItems`, `top10Movies`, `top10Tv`, `trendingIndia`, `nowPlayingMovies`, `recentlyReleased`, `upcomingItems`, `hindiMovies`, `southIndianMovies`, `animeItems`, `documentaryItems`).
- **`MediaCarouselRow.tsx` & `DiscoverView.tsx`**:
  - Upgrade row and grid deduplication to use `dedupeMediaItems` so no carousel or Discover page can ever render duplicate canonical titles or duplicate poster URLs.

---

## 3. Verification & Self-Check
- Create and run a verification script/check confirming:
  1. Zero duplicate `posterUrl` or `backdropUrl` values exist across distinct titles in `MEDIA_ITEMS` + `EXTRA_ANCHOR_ITEMS` + `FRANCHISE_COLLECTIONS`.
  2. Every item has a valid canonical key `(mediaType + tmdbId)` and matching `type`, `year`, and `genres`.
  3. TypeScript lint (`lint_applet`) and full production build (`compile_applet`) pass with zero errors.
