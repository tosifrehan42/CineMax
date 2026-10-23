# CineMax GitHub Pages Blank Screen Remediation & Resilient Static Deployment

This plan resolves the root causes of the blank white screen on the live GitHub Pages deployment (`https://tosifrehan42.github.io/CineMax/`), configures production subpath asset resolution, introduces a startup error boundary so fatal initialization issues never render an empty page, sets up automated GitHub Actions deployment of the compiled bundle, and enables seamless catalogue and TV episode loading on static hosts without a Node.js server.

## User Review & Critical Decisions

> [!IMPORTANT]
> The root-cause investigation identified four compounding issues causing the blank white screen and broken static runtime on GitHub Pages:
> 1. **Missing Subpath Base Configuration**: The production build currently emits root-relative asset paths (`/assets/...`), which resolve to `https://tosifrehan42.github.io/assets/...` (HTTP 404) instead of `https://tosifrehan42.github.io/CineMax/assets/...`.
> 2. **Missing GitHub Actions Build & Deployment Pipeline**: No workflow existed in the repository to run the production build and publish the compiled output directory to GitHub Pages, risking raw uncompiled source files (`index.html` referencing `.tsx`) being served directly.
> 3. **Static-Host API Assumptions**: Catalogue discovery, live search, and TV season episode lookups previously assumed a local Express server (`/api/*`), which does not exist on GitHub Pages and returns HTML 404 pages instead of JSON.
> 4. **Silent Startup Failures**: The application entry point lacked a top-level error boundary or global uncaught exception listener, causing any startup error to fail silently as a blank screen.

- **Confirmed Decision 1 (GitHub Pages Deployment Pipeline)**: Configure a dedicated GitHub Actions workflow that compiles the production bundle with repository secrets and deploys the built static artifact to GitHub Pages.
- **Confirmed Decision 2 (Static-Host Data & API Resolution)**: Support an optional external backend URL (`VITE_API_BASE_URL`) and automatically fall back to client-side catalogue search, discovery filtering, and public CORS-compatible TV episode APIs (TMDB when configured, TVMaze, iTunes, and the curated catalogue) whenever the Express backend is unreachable.

---

## 1. Overview & Core Concept

- **What It Does**: Transforms CineMax into a dual-mode web application that runs identically in full-stack development/server environments and on static subpath hosts like GitHub Pages (`/CineMax/`), while surfacing clear diagnostic recovery UI if any runtime initialization failure ever occurs.
- **Target Audience / Persona**: Viewers and collectors accessing CineMax via the public GitHub Pages URL (`https://tosifrehan42.github.io/CineMax/`) across desktop and mobile browsers.
- **Key Value**: Eliminates 404 asset loading failures on subpath deployments, guarantees resilient catalogue browsing and TV episode progress tracking without requiring a hosted Node.js server, and prevents silent white-screen crashes.

---

## 2. User Experience & Visual Design

- **Key User Flows**:
  1. **Subpath Arrival & Instant Mount**: Navigating to `https://tosifrehan42.github.io/CineMax/` loads all JavaScript, CSS, and media assets under `/CineMax/assets/...` and mounts the full CineMax discovery experience immediately.
  2. **Seamless Static Discovery & TV Episode Tracking**: Searching titles, filtering the Discover grid, or expanding TV seasons in the Detail Modal checks the configured API endpoint first and transparently resolves via client-side catalogue and public TV metadata APIs when running on GitHub Pages—with zero broken states or failed JSON parses.
  3. **Diagnostic Startup Recovery Screen**: If a fatal initialization or render exception occurs, the user sees a high-contrast dark cinematic diagnostic panel displaying the exact error message, stack details, environment health check, and one-click actions to reload or clear corrupted local cache—never an unexplained white screen.
- **Visual Identity & Theme**:
  - *Aesthetic Direction*: Preserves CineMax's dark cinematic obsidian aesthetic (`#0a0a0a` canvas, `#141414` elevated surfaces, `#fbbf24` amber-gold primary accent) with zero changes to existing views, layouts, or animations.
  - *Color Palette & Mood*: 60% deep obsidian neutral canvas, 30% charcoal structural surfaces with subtle hairline borders (`rgba(255,255,255,0.08)`), and 10% warm cinema gold (`#fbbf24`) and crimson alert (`#ef4444`) accents for diagnostic states.
  - *Typography & Hierarchy*: Clean sans-serif display headings paired with readable body copy and `tabular-nums` monospace stack blocks inside the diagnostic error screen.
  - *Component Styling & Layout*: Full 1440px desktop viewport presence with single-elevation surfaces and responsive mobile adaptation.
- **Interactive Feedback & Motion**: Smooth 150ms–200ms transitions, skeleton loading placeholders during catalogue and season resolution, and explicit retry/reload controls on error states.

---

## 3. Key Product Decisions & Trade-Offs

- **Decision 1: Environment-Aware Base Path (`/CineMax/` in Production, `/` in Dev)**
  - *Chosen Approach*: Configure the bundler to emit `/CineMax/` (or `VITE_BASE_PATH` if overridden) during production builds while keeping `/` during local development server runs, and generate a `404.html` SPA fallback in the build output.
  - *Why*: Fixes GitHub Pages subpath asset loading (`/CineMax/assets/...`) without breaking local development on port 3000.
  - *Alternatives Considered*: Hardcoding `/CineMax/` in all environments, which complicates root-path preview servers.
- **Decision 2: Hybrid API + Client-Side Catalogue & Episode Engine**
  - *Chosen Approach*: Enhance the media service layer to validate HTTP status and `Content-Type: application/json` before parsing responses, honor `VITE_API_BASE_URL` when configured, and automatically execute client-side filtering, sorting, pagination, live external search (TMDB / TVMaze / iTunes), and TV season episode lookups when `/api/*` is absent on GitHub Pages.
  - *Why*: GitHub Pages only serves static files and returns HTML 404 pages for `/api/*` routes. Validating JSON content-type and falling back client-side ensures Discover, Search, and TV Series Progress work out of the box on GitHub Pages.
  - *Alternatives Considered*: Requiring a separately hosted Express server for basic browsing, which leaves the app broken until external backend infrastructure is deployed.
- **Decision 3: Multi-Layer Startup Error Handling**
  - *Chosen Approach*: Wrap the root React tree in a class-based `StartupErrorBoundary` and register early `window` listeners (`error` and `unhandledrejection`) before React mounts if the root container remains empty.
  - *Why*: Catches both synchronous React render errors and pre-mount module/initialization errors, displaying the exact underlying error message without swallowing console logs.

---

## 4. Technical Architecture & Data Strategy *(Technical Reference)*

- **Architecture & Component Diagram**:

```
┌───────────────────────────────────────────────────────────────────────────┐
│                 GitHub Pages Static Host (/CineMax/)                      │
│  ┌─────────────────────────┐       ┌───────────────────────────────────┐  │
│  │ index.html / 404.html   │──────▶│ Startup Error Guard & Boundary    │  │
│  │ (Base: /CineMax/)       │       │ (Pre-mount & React Render Catch)  │  │
│  └─────────────────────────┘       └─────────────────┬─────────────────┘  │
└──────────────────────────────────────────────────────┼────────────────────┘
                                                       │
                                                       ▼
┌───────────────────────────────────────────────────────────────────────────┐
│                         CineMax React Application                         │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐  ┌───────────────┐  │
│  │   HomeView   │  │ DiscoverView │  │ ChecklistView│  │  DetailModal  │  │
│  └──────┬───────┘  └──────┬───────┘  └──────┬───────┘  └───────┬───────┘  │
│         └─────────────────┴────────┬────────┴──────────────────┘          │
│                                    ▼                                      │
│  ┌─────────────────────────────────────────────────────────────────────┐  │
│  │             Hybrid Media & Persistence Service Layer                │  │
│  └───┬─────────────────────────────┬───────────────────────────────┬───┘  │
└──────┼─────────────────────────────┼───────────────────────────────┼──────┘
       │ 1. Primary (If Available)   │ 2. Static Fallback            │ 3. Auth & Sync
       ▼                             ▼                               ▼
┌─────────────────────┐   ┌─────────────────────────────┐   ┌───────────────┐
│ Express / External  │   │ Client-Side Catalogue Engine│   │   Supabase    │
│ API (VITE_API_BASE) │   │ + TMDB / TVMaze / iTunes    │   │ Auth & Tables │
└─────────────────────┘   └─────────────────────────────┘   └───────────────┘
```

- **Data Model & State**:
  - **Build & Routing State**: Production assets resolve relative to `/CineMax/`; SPA deep links fallback via `404.html`.
  - **Hybrid Media Resolution**: Requests first check `VITE_API_BASE_URL` (or `/api/*` when running with the Express server). If the endpoint returns 404, non-JSON HTML, or a network error, the service switches cleanly to client-side resolution so subsequent requests do not repeatedly stall.
  - **Supabase Client Resilience**: Reads `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` baked at build time; only queries `/api/config` if build-time variables are absent and the response is verified JSON.
- **Interactive Component & State Mapping**:
  - **Startup Error Boundary**: Captures `error` and `errorInfo`, logs the full error to `console.error`, and renders the error message, stack trace, and interactive `Reload Application` and `Reset Local Cache & Reload` handlers.
  - **Discover & Search Flows**: Client-side fallback supports full text search, genre/type/mood/year/rating filtering, sorting (`rating`, `year`, `title`, `popularity`), pagination, and live external title enrichment.
  - **TV Episode Tracker in Detail Modal**: Resolves season count and per-episode lists (`episodeNumber`, `name`, `overview`, `airDate`, `stillUrl`, `runtime`) via TMDB (if `VITE_TMDB_API_KEY` is provided) or TVMaze CORS API so users can check/uncheck episodes and seasons on GitHub Pages.
