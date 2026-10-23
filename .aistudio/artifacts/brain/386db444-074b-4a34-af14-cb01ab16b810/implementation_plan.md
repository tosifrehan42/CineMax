# CineMax — GitHub Pages Parity & Cache-Safe Deployment Plan

Ensure `https://tosifrehan42.github.io/CineMax/` behaves identically to the Google AI Studio preview across Trending, Popular Movies, Upcoming Movies, Popular TV, Top Rated, and Discover sections while preventing stale cached builds.

## User Review & Critical Decisions

> [!IMPORTANT]
> Comparing the live GitHub Pages deployment (commit `306328b765a5393574f227fab5f87b55b8d8e92b`, bundle `/CineMax/assets/index-CIN9B_09.js`) against the AI Studio preview revealed the exact reason why the live site exhibits old behavior:
> 1. In the AI Studio preview, `server.ts` serves `/api/catalogue` using the live expanded catalogue (Apple iTunes Movie RSS feeds + TVMaze API + 20 curated anchor titles) and applies category-specific filtering and sorting (`trending`, `popular_movies`, `upcoming_movies`, `popular_tv`, `top_rated_movies`, `top_rated_tv`).
> 2. On GitHub Pages, `server.ts` cannot run, so `fetchCatalogue()` falls back to `resolveClientCatalogue()` in the frontend—which currently ignores `params.category` and only reads the 20 static seed items, causing every section on the Home page to receive the exact same unfiltered static list.

- **Confirmed Decision 1 — Static Client Parity with AI Studio Preview**: Update the client-side static fallback engine so that when `/api/*` is unreachable on GitHub Pages, it executes the exact same live expanded catalogue loader (iTunes Movie RSS + TVMaze API + live search/episode enrichment) and category-specific filtering/sorting (`trending`, `popular_movies`, `upcoming_movies`, `popular_tv`, `top_rated_movies`, `top_rated_tv`) as `server.ts`, without altering `server.ts`, Supabase, or existing components.
- **Confirmed Decision 2 — Cache-Busting & CI Asset Verification**: Add `Cache-Control: no-cache, no-store, must-revalidate` meta headers and automatic stale service-worker cleanup in `index.html`, and verify in GitHub Actions that every hashed JS/CSS file referenced in `dist/index.html` physically exists in `dist/assets/`.

---

## 1. Overview & Core Concept

- **What It Does**: Eliminates the behavioral discrepancy between the Google AI Studio preview and the static GitHub Pages deployment while hardening the deployment pipeline against stale HTML or service-worker caches.
- **Target Audience / Persona**: Visitors and signed-in CineMax users accessing `https://tosifrehan42.github.io/CineMax/`.
- **Key Value**: Trending, Popular Movies, Upcoming Releases, Popular TV, Top Rated Masterpieces, Load More pagination, live search, and TV episode lists work on GitHub Pages with the exact same data and ranking as the AI Studio preview.

---

## 2. User Experience & Visual Design

- **Key User Flows**:
  1. **Home Page Sections (`Trending`, `Popular Feature Films`, `Upcoming & Recent Releases`, `Popular Television & Series`, `Top Rated Masterpieces`)**: On GitHub Pages, each section displays its distinct category-filtered and ranked titles with working "Load More" pagination across the live expanded catalogue.
  2. **Discover & Live Search**: Switching category tabs (`Trending Now`, `Popular Movies`, `Upcoming Movies`, `Top Rated Movies`, `Popular TV Shows`, `Top Rated TV`), filtering by genre/mood/rating, and searching titles queries the full live expanded catalogue and live TVMaze search endpoint just like the AI Studio preview.
  3. **TV Series Episode Progress & Details**: Opening any TV series on GitHub Pages loads real episode lists and cast details from TVMaze when `/api/*` is unavailable.
- **Visual Identity & Theme**:
  - Preserves 100% of the existing CineMax dark obsidian (`#090a0f`) aesthetic, `#f59e0b` amber accents, `Outfit` / `Plus Jakarta Sans` typography, checklist controls, and Supabase integration without modification.

---

## 3. Key Product Decisions & Trade-Offs

- **Decision 1: Full Parity Between `server.ts` and Static Client Fallback**
  - *Chosen Approach*: Mirror `server.ts`'s `getLiveExpandedCatalog()` (with 30-minute in-memory + `sessionStorage` caching), `effectiveType` derivation from `category` (`popular_movies` / `upcoming_movies` / `top_rated_movies` → `movie`; `popular_tv` / `top_rated_tv` → `tv`), category sorting (`top_rated_*` by rating descending, `upcoming_movies` by release year and rating descending), multi-word search ranking (`rankSearchResults`), and TVMaze cast/episode enrichment inside the client fallback used when `/api/*` returns 404 on GitHub Pages.
  - *Why*: In the AI Studio preview, `fetchApiJson('/api/...')` succeeds and uses `server.ts` unchanged. On GitHub Pages, `/api/...` returns 404 HTML and seamlessly runs the identical logic in the browser using public CORS-enabled endpoints (`itunes.apple.com` and `api.tvmaze.com`), without exposing any private API keys.
- **Decision 2: Stale Cache Prevention & Hashed Asset Verification**
  - *Chosen Approach*: Add HTTP cache-control meta tags and a startup check that unregisters any rogue/stale service workers on `/CineMax/`, plus a CI step in `.github/workflows/deploy.yml` that extracts the exact `/CineMax/assets/index-*.js` and `/CineMax/assets/index-*.css` paths from `dist/index.html` and verifies those files exist in `dist/assets/` before uploading the Pages artifact.
  - *Why*: Ensures browsers always revalidate `index.html` and load the latest content-hashed JavaScript and CSS bundles after each GitHub Actions deployment.

---

## 4. Technical Architecture & Data Strategy *(Technical Reference)*

### Architecture & Request Resolution Diagram

```
┌───────────────────────────────────────────────────────────────────────────┐
│                   CineMax Frontend (HomeView / DiscoverView)              │
│   fetchCatalogue({ category, page, type, genre, mood, sortBy, query })    │
└─────────────────────────────────────┬─────────────────────────────────────┘
                                      │
                                      ▼
┌───────────────────────────────────────────────────────────────────────────┐
│                  fetchApiJson('/api/catalogue?...')                       │
│         Checks HTTP 200 OK + Content-Type: application/json               │
└─────────────────┬───────────────────────────────────────┬─────────────────┘
                  │                                       │
     [AI Studio Preview / Express]           [GitHub Pages Static Host]
     HTTP 200 JSON from server.ts            HTTP 404 HTML from GitHub Pages
                  │                                       │
                  ▼                                       ▼
┌───────────────────────────────────┐   ┌───────────────────────────────────┐
│     Express Backend (server.ts)   │   │  Client Live Catalogue Fallback   │
│  • Unchanged AI Studio behavior   │   │  • Loads 20 seed items + live     │
│  • TMDB API (if key configured)   │   │    iTunes RSS + TVMaze shows      │
│    or Live Expanded Catalogue     │   │  • Applies exact category type &  │
│  • Category filtering & ranking   │   │    sorting (Trending, Top Rated,  │
│                                   │   │    Popular, Upcoming, TV)         │
│                                   │   │  • Live TVMaze search & episodes  │
└───────────────────────────────────┘   └───────────────────────────────────┘
```

### Interactive Component & Deployment Verification Mapping

- **Category Resolution (`resolveClientCatalogue`)**:
  - Derives `effectiveType` from `params.type` and `params.category` (`category.includes('movies')` → `'movie'`, `category.includes('_tv')` → `'tv'`), matching `server.ts` lines 652–659.
  - Sorts `top_rated_movies` and `top_rated_tv` by `b.rating - a.rating`, and `upcoming_movies` by `b.year - a.year || b.rating - a.rating`, matching `server.ts` lines 959–963.
  - Supports multi-genre intersection and normalized title search ranking (`normalizeForSearch` + `getTitleMatchTier`), matching `server.ts` lines 930–985.
- **GitHub Actions Verification (`.github/workflows/deploy.yml`)**:
  - Runs `bun install --frozen-lockfile`, `bun run lint`, and `bun run build` (`base: '/CineMax/'`).
  - Parses `dist/index.html` to extract referenced `/CineMax/assets/*.js` and `/CineMax/assets/*.css` filenames and verifies each corresponding file exists in `dist/assets/`.
  - Uploads `./dist` via `actions/upload-pages-artifact@v3` and deploys via `actions/deploy-pages@v4`.
