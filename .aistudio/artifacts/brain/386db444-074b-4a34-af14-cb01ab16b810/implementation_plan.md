# CineMax GitHub Pages (`/CineMax/`) Production & TMDB v3 Architecture Fix

This plan resolves the episode metadata failure, static-host catalogue fallback, and India (`IN`) OTT provider linking when CineMax is deployed to GitHub Pages (`/CineMax/`) without an Express backend. It aligns build-time secret verification, client-side TMDB v3 key sanitization, canonical TMDB ID resolution, and official OTT platform deep links while preserving all existing features and security boundaries.

## User Review & Critical Decisions

> [!IMPORTANT]
> The following architectural decisions incorporate your confirmed answers and establish how CineMax operates on static hosts (`https://tosifrehan42.github.io/CineMax/`):

- **Confirmed Decision 1 — Live Client-Side TMDB v3 Catalogue & Search on Static Hosts**: When deployed to GitHub Pages with `VITE_TMDB_API_KEY`, the Home and Discover catalogue rows and search queries will call TMDB v3 endpoints (`/trending/*`, `/movie/*`, `/tv/*`, `/discover/*`, `/search/*`) directly from the browser rather than falling back to the unenriched TVMaze/iTunes open catalogue.
- **Confirmed Decision 2 — Strict GitHub Actions Secret Verification**: The deployment workflow will accept either `secrets.VITE_TMDB_API_KEY` or `secrets.TMDB_API_KEY` and fail fast before building if neither is configured (or if a v4 bearer token / placeholder is supplied), without ever printing or exposing the key value in logs.
- **Confirmed Decision 3 — Official India (`IN`) OTT Platform Deep Links with TMDB Fallback**: Clicking an India OTT provider card under **Where to Watch in India (IN)** will open the verified official platform watch/search URL for that title in India (Netflix India, Prime Video India, JioHotstar / Disney+ Hotstar, ZEE5, SonyLIV, Apple TV India, Lionsgate Play, Hoichoi, Sun NXT, Aha, MUBI, Crunchyroll, YouTube Movies, Google Play Movies) while keeping the official TMDB/JustWatch India locale page (`results.IN.link`) as the fallback and dedicated **All India Options** link.

---

## 1. Overview & Core Concept

- **What It Does**: Enables CineMax's static GitHub Pages deployment (`/CineMax/`) to operate as a first-class TMDB v3 client when no Express backend is present, delivering live catalogue rows, accurate multi-season TV episode catalogues, and clickable India (`IN`) OTT streaming links.
- **Target Audience / Persona**: Cinephiles browsing CineMax on desktop and mobile via GitHub Pages who expect real season/episode breakdowns, episode watch checklists, and direct links to stream titles on Indian OTT platforms.
- **Key Value**: Eliminates the static-host failure path where missing build-time env injection or unmapped non-TMDB IDs caused episode lists to error out and India OTT watch providers to appear unconfigured.

---

## 2. User Experience & Visual Design

- **Key User Flows**:
  1. **Home & Discover Browsing on GitHub Pages**: On initial load at `/CineMax/`, the client detects static hosting (`*.github.io` or unreachable `/api/*` without a remote `VITE_API_BASE_URL`) and immediately resolves all 15 Home rows and Discover filters against TMDB v3 using the sanitized v3 API key.
  2. **Series Episode Catalogue & Season Switching**: Opening any TV or anime series modal fetches `GET /3/tv/{tv_id}?append_to_response=credits,recommendations,watch/providers` and `GET /3/tv/{tv_id}/season/{season_number}`, rendering all real seasons and episodes (`S01E01`…`S01E25`) with real air dates and runtimes, plus retryable error handling if a network failure occurs.
  3. **Where to Watch in India (`IN`)**: The detail modal displays verified India OTT availability grouped by offer category (`Subscription`, `Free`, `Ad-Supported`, `Rent`, `Buy`). Clicking a provider card opens the official OTT platform search/watch page for that title in India in a new tab, accompanied by the **All India Options** TMDB/JustWatch link and attribution.
- **Visual Identity & Theme**:
  - *Aesthetic Direction*: Preserves CineMax's existing dark theatrical aesthetic (`--background: #08090c`, modal surface `#0d0e14`, card surface `#0B0F17`, subtle `border-white/10` hairlines).
  - *Color Palette & Mood*: Warm IMAX amber primary accent (`#f59e0b` / `amber-400`), emerald verification badges (`#10b981` / `emerald-400`) for authorized Play Online sources and completed episodes, and rose alert states (`#f43f5e` / `rose-400`) for retryable network errors.
  - *Typography & Hierarchy*: `Outfit` for display titles and section headers, `Inter` for synopses and provider metadata, and `JetBrains Mono` (`font-mono tabular-nums`) for episode codes (`S01E01`), runtimes, ratings, and release years.
  - *Component Styling & Layout*: Preserves the existing responsive 12-column detail modal layout, mobile-friendly touch carousels, and progressive row mounting.
- **Interactive Feedback & Motion**: Clear loading spinners while fetching season episodes or India OTT providers, retry buttons on network errors, and external-link hover states on OTT provider cards.

---

## 3. Key Product Decisions & Trade-Offs

- **Decision 1 — Root-Cause Resolution for Episode Metadata Errors on GitHub Pages**:
  - *Chosen Approach*: Sanitize `VITE_TMDB_API_KEY` (stripping accidental surrounding quotes/whitespace while rejecting v4 `eyJ...` JWTs and placeholders), bypass `/api/*` probes immediately when running on `*.github.io` without a valid remote `VITE_API_BASE_URL` (ignoring any accidental `localhost` or `127.0.0.1` values on static hosts), and allow `fetchTitleDetails` and `fetchTvSeasonEpisodes` to resolve canonical TMDB IDs by title + year search (`GET /3/search/tv` or `GET /3/search/movie`) whenever an item's ID is not already prefixed with `tmdb-` or listed in the static seed map.
  - *Why*: Previously, three compounding factors caused the episode error on GitHub Pages: (1) `.github/workflows/deploy.yml` did not inject `VITE_TMDB_API_KEY` before your recent edit, (2) `resolveClientCatalogue` returned `tvmaze-tv-*` / `live-movie-*` records even when `VITE_TMDB_API_KEY` was present, and (3) `extractCanonicalTmdbIdentity` returned `null` for non-`tmdb-*` IDs, causing `fetchTvSeasonEpisodes` and `fetchTitleDetails` to skip TMDB v3.
  - *Alternatives Considered*: Relying solely on hardcoded seed maps was rejected because any searched or newly trending series would still fail to resolve episodes or India OTT providers.
- **Decision 2 — Official India (`IN`) OTT Platform URL Resolution**:
  - *Chosen Approach*: Map TMDB's verified India (`IN`) provider offers (`provider_id` / `provider_name`) to their official India platform watch/search URLs (e.g., Netflix, Amazon Prime Video India, JioHotstar / Disney+ Hotstar, ZEE5, SonyLIV, Apple TV India, Lionsgate Play, MUBI, Crunchyroll, YouTube, Google Play) parameterized with the exact title, while falling back to TMDB's `results.IN.link` (`https://www.themoviedb.org/{type}/{id}/watch?locale=IN`) for niche providers and exposing the TMDB/JustWatch locale page via the **All India Options** link.
  - *Why*: TMDB's v3 `/watch/providers` API returns only a single aggregate TMDB locale link (`results.IN.link`) rather than per-provider URLs. Generating verified official platform URLs for each provider returned in `results.IN` gives users a direct 1-click path to the streaming service while remaining 100% grounded in TMDB's regional availability data.
  - *Alternatives Considered*: Linking every provider card only to the generic TMDB watch page was passed over per your preference for direct OTT platform URLs with TMDB fallback.

---

## 4. Technical Architecture & Data Strategy *(Technical Reference)*

### Architecture & Static-Host Execution Diagram

```
┌────────────────────────────────────────────────────────────────────────────┐
│                GitHub Actions Build & Deploy Workflow                      │
│  1. Resolve VITE_TMDB_API_KEY = secrets.VITE_TMDB_API_KEY || TMDB_API_KEY  │
│  2. Validate non-empty v3 key (reject eyJ* JWTs & placeholders silently)   │
│  3. Sanitize VITE_API_BASE_URL (reject localhost/127.0.0.1 on Pages)       │
│  4. Build Vite SPA bundle with base='/CineMax/' & verify dist/ assets      │
└───────────────────────────────────────┬────────────────────────────────────┘
                                        │
                                        ▼
┌────────────────────────────────────────────────────────────────────────────┐
│                   Browser Runtime on GitHub Pages (/CineMax/)              │
│  ┌──────────────────────────────────────────────────────────────────────┐  │
│  │ Environment & Host Detector                                          │  │
│  │ • Detects *.github.io or static host without remote VITE_API_BASE_URL│  │
│  │ • Sanitizes VITE_TMDB_API_KEY (strips quotes/spaces, validates v3)   │  │
│  └──────────────────┬───────────────────────────────────┬───────────────┘  │
│                     │                                   │                  │
│                     ▼                                   ▼                  │
│  ┌─────────────────────────────────────┐ ┌──────────────────────────────┐  │
│  │ Client TMDB v3 Catalogue Engine     │ │ Detail & Episode Resolver    │  │
│  │ • /3/trending, /3/movie/*, /3/tv/*  │ │ • Resolves canonical TMDB ID │  │
│  │ • /3/discover/* (India, Anime, etc.)│ │   (prefix, seed, or /search) │  │
│  │ • /3/search/movie & /3/search/tv    │ │ • /3/{type}/{id} + providers │  │
│  │ • Normalizes to tmdb-{type}-{id}    │ │ • /3/tv/{id}/season/{num}    │  │
│  └──────────────────┬──────────────────┘ └──────────────┬───────────────┘  │
│                     │                                   │                  │
│                     └─────────────────┬─────────────────┘                  │
│                                       ▼                                    │
│  ┌──────────────────────────────────────────────────────────────────────┐  │
│  │ DetailModal & India (IN) Watch Providers Normalizer                  │  │
│  │ • Reads watch/providers.results.IN (flatrate, free, ads, rent, buy)  │  │
│  │ • Builds direct OTT platform URL per provider + TMDB IN fallback URL │  │
│  │ • Renders all real season episodes, checklist toggles & retry states │  │
│  └──────────────────────────────────────────────────────────────────────┘  │
└────────────────────────────────────────────────────────────────────────────┘
```

### Data Model & State
- **TMDB Identity Cache**: In-memory client map caching resolved `(mediaType, rawId, title, year) -> tmdbId` so non-`tmdb-*` items (such as legacy watchlist snapshots or TVMaze items) resolve their exact TMDB v3 numeric ID once and reuse it across `fetchTitleDetails` and `fetchTvSeasonEpisodes`.
- **India (`IN`) Watch Provider Offer Model**: Each `WatchProviderOffer` retains `providerId`, `providerName`, `logoUrl`, `category` (`flatrate` | `free` | `ads` | `rent` | `buy`), `categoryLabel`, `url` (direct official OTT platform URL for the title in India, or `tmdbWatchUrl` fallback), and `isOfficialProviderUrl`.

### Interactive Component & State Mapping
- **Catalogue & Search (`Home` / `Discover`)**: When `CLIENT_TMDB_API_KEY` is present on a static host, category rows (`trending_india`, `now_playing_movies`, `top_10_movies`, `top_10_tv`, `hindi_movies`, `south_indian_cinema`, `anime`, `documentaries`, etc.) and search/filter controls query TMDB v3 directly and return canonical `tmdb-movie-{id}` and `tmdb-tv-{id}` items with `provider: 'tmdb'` and `tmdbConfigured: true`.
- **Detail Modal (`DetailModal`)**:
  - Passes `(activeMedia.id, selectedSeason, controller.signal, activeMedia.title, activeMedia.year)` to `fetchTvSeasonEpisodes` so even if a title was opened from a legacy or non-TMDB ID, it resolves the canonical TMDB TV ID and fetches `GET /3/tv/{tv_id}/season/{season_number}`.
  - Displays real episode counts per season tab, complete episode lists, retryable error states when an API request fails, and clickable India (`IN`) OTT provider cards with JustWatch & TMDB attribution.
