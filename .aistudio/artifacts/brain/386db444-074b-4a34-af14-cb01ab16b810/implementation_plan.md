# CineMax — Deterministic TMDB Smart Matching & Client-Side OCR Migration

Migrate CineMax completely away from runtime Gemini API dependencies to a fast, deterministic, TMDB-powered title normalization, candidate ranking, and ambiguity-detection engine paired with lazy-loaded browser OCR via Tesseract.js.

### User Review & Critical Decisions

> [!IMPORTANT]
> This migration removes all runtime calls to `@google/genai`, `/api/ai/resolve-titles`, and `/api/import/extract-image`, eliminating external LLM latency, quota limits, and `503` / timeout failures while preserving every existing search, watchlist, and completed-import workflow.

- **Zero Runtime Gemini Dependency**: All `GoogleGenAI` imports, `GEMINI_API_KEY` runtime checks, `/api/ai/resolve-titles`, `/api/import/extract-image`, and `@google/genai` package dependencies will be removed after migrating all callers.
- **Deterministic Title Resolution & Alias Engine**: A shared deterministic normalization service will handle case/punctuation normalization, explicit year and Movie/TV tag extraction, preservation of numeric titles (`1917`, `Blade Runner 2049`, `2001: A Space Odyssey`), Roman/Arabic sequel conversions, franchise shorthand rules (`john wick 3` -> `John Wick: Chapter 3 – Parabellum`), and bounded alternative TMDB search queries.
- **On-Device Browser OCR via Lazy-Loaded Tesseract.js**: Screenshot imports (`PNG`, `JPG`, `JPEG`, `WEBP` up to 8 MB) will run locally in the browser using `tesseract.js` (`eng`), with live percentage progress, automatic worker termination in `finally`, and CDN/worker/WASM path configuration compatible with Vite dev, GitHub Pages (`/CineMax/`), and Capacitor Android.
- **Truthful UI Labels**: All `"AI-assisted search"` and `"AI-assisted match"` badges and banners will be replaced with truthful `"TMDB Smart Match"` and `"Browser OCR"` indicators while preserving the signature black-and-gold CineMax aesthetic.

---

### 1. Overview & Core Concept

- **What It Does**: Provides instant, deterministic movie and TV series recognition across Smart Search and Completed List Import by combining local linguistic normalization and franchise alias expansion with live TMDB multi/movie/TV search, multi-factor candidate scoring, and client-side screenshot OCR.
- **Target Audience / Persona**: CineMax users searching with informal/abbreviated queries (`"john wick 3"`, `"dark knight"`, `"spider man no way home"`) or importing watched lists from screenshots, TXT, CSV, or JSON files across Web, GitHub Pages, and Android.
- **Key Value**: Sub-second title resolution with 100% deterministic behavior, zero server-side LLM timeouts or rate limits, full privacy for screenshot OCR (images never leave the browser), and strict disambiguation when multiple adaptations or release years exist (`The Office`, `Dune`).

---

### 2. User Experience & Visual Design

- **Key User Flows**:
  - **Smart Search (`SearchOverlay`)**:
    1. User types a query (250ms debounce, `AbortController` cancellation, Movie/TV/All filter tabs).
    2. Direct TMDB search runs immediately; if the query is informal, abbreviated, or lacks an exact canonical hit in the top results, deterministic query expansion runs bounded follow-up TMDB queries in parallel and ranks the merged pool.
    3. When deterministic normalization resolves a shorthand query (e.g., `"john wick 3"` -> `"John Wick: Chapter 3 – Parabellum"`) or detects multi-edition ambiguity (`"The Office"`, `"Dune"`), a subtle gold banner displays **TMDB Smart Match** or an ambiguity notice without fabricating any data.
  - **Completed List Import & Browser OCR (`ImportCompletedModal`)**:
    1. User uploads a `PNG`/`JPG`/`JPEG`/`WEBP` screenshot (up to 8 MB) or `TXT`/`CSV`/`JSON` file, or pastes text.
    2. For screenshots, Tesseract.js is dynamically imported only when needed, displaying live OCR progress (`"Reading screenshot with local OCR (45%)..."`) and terminating the worker immediately upon completion.
    3. Extracted lines pass through `parseTextImportList()`, preserving explicit years, `[Movie]`/`[TV]` tags, `S01E01` episode ranges, watched dates, and `9/10` ratings. If a screenshot is unreadable, a clear error recommends pasting text or using TXT/CSV.
    4. Each extracted item is deterministically normalized and matched against TMDB in bounded concurrency batches (`4` at a time), classifying rows into **Matched** (auto-selected), **Needs Review / Ambiguous** (unselected by default, with clear disambiguation reason), or **Unmatched**.
- **Visual Identity & Theme**:
  - Preserves the existing CineMax Obsidian & Amber Gold glassmorphic aesthetic (`#090a0f` backdrop, `#f59e0b` accents, `Outfit` display typography, `Inter` body, `JetBrains Mono` metadata).
- **Interactive Feedback & Motion**:
  - Live step-by-step progress bars for both **Browser OCR Extraction** and **TMDB Candidate Matching**, keyboard navigation in SearchOverlay, and expandable per-row TMDB candidate override drawers in Import Review.

---

### 3. Key Product Decisions & Trade-Offs

- **Decision 1: Deterministic Normalization + TMDB Multi-Query Expansion Instead of LLM Guessing**
  - *Chosen Approach*: Combine a deterministic normalization & alias rule engine (handling punctuation, articles, Roman/Arabic numerals, hyphenated compounds like `Spider-Man`/`X-Men`, and franchise shorthands) with TMDB's native `/search/movie`, `/search/tv`, and `/search/multi` endpoints.
  - *Why*: TMDB natively indexes original, translated, and alternative titles; pairing deterministic query expansion with multi-factor candidate scoring guarantees zero hallucinated titles and zero external AI latency.
- **Decision 2: Strict Ambiguity Detection Over Forced Auto-Matching**
  - *Chosen Approach*: Automatically mark an imported row as `matched` only when score thresholds are met (`score >= 88`, or exact normalized title with `score >= 76`) AND there is no close rival (`score gap <= 12`), no year conflict, and no multi-edition ambiguity (`The Office` 2005 vs 2001, `Dune` 2021 vs 1984 / Part Two).
  - *Why*: Protects user watchlists and viewing journals from silent mismatches while making manual 1-click selection effortless in the review UI.
- **Decision 3: Dynamic On-Demand Browser OCR with Explicit Worker Lifecycle**
  - *Chosen Approach*: Dynamically `import('tesseract.js')` inside the image extraction handler, preprocess the image onto an offscreen canvas for clean contrast if needed, configure explicit CDN paths for worker/core/lang assets so Vite `/CineMax/` base paths and Capacitor WebViews resolve reliably, and always call `await worker.terminate()` in a `finally` block.
  - *Why*: Keeps the initial application bundle lightweight, avoids uploading user screenshots to a backend server, and prevents memory leaks from orphaned Web Workers.

---

### 4. Technical Architecture & Data Strategy *(Technical Reference)*

- **Architecture & Data-Flow Diagram**:

```
┌──────────────────────────────────────────────────────────────────────────────┐
│                        CineMax Client & Server Runtime                       │
└───────────────────┬──────────────────────────────────────┬───────────────────┘
                    │                                      │
                    ▼                                      ▼
┌───────────────────────────────────────┐  ┌───────────────────────────────────┐
│      SearchOverlay (Smart Search)     │  │   ImportCompletedModal (Wizard)   │
│  • 250ms debounce + AbortController   │  │  • TXT / CSV / JSON / Paste       │
│  • All / Movie / TV filter tabs       │  │  • PNG / JPG / WEBP (<= 8 MB)     │
└───────────────────┬───────────────────┘  └───────┬───────────────────┬───────┘
                    │                              │                   │
                    │                              │ Image File        │ Text / Rows
                    │                              ▼                   │
                    │              ┌───────────────────────────────┐   │
                    │              │  Lazy Client-Side Browser OCR │   │
                    │              │  • Dynamic import tesseract.js│   │
                    │              │  • Live progress callback     │   │
                    │              │  • worker.terminate() cleanup │   │
                    │              └───────────────┬───────────────┘   │
                    │                              │ Raw OCR Lines     │
                    │                              ▼                   │
                    │              ┌───────────────────────────────┐   │
                    │              │     parseTextImportList()     │◄──┘
                    │              │  • Year / Type / SxxExx / Date│
                    │              └───────────────┬───────────────┘
                    │                              │
                    ▼                              ▼
┌──────────────────────────────────────────────────────────────────────────────┐
│             Deterministic Title Normalization & Matching Engine              │
│  • Case/diacritic/punctuation stripping & compound word normalization        │
│  • Protected numeric titles (1917, Blade Runner 2049, 2001, 300)             │
│  • Roman <-> Arabic numeral & franchise shorthand expansion                  │
│  • Bounded alternative query generation (up to 3 TMDB queries)               │
└─────────────────────────────────────────┬────────────────────────────────────┘
                                          │
                                          ▼
┌──────────────────────────────────────────────────────────────────────────────┐
│            TMDB Search & Multi-Factor Candidate Ranking Engine               │
│  • Uses existing fetchCatalogue() (/search/movie, /search/tv, /search/multi) │
│  • Scores exact/canonical title, token overlap, year, media type, TMDB ID    │
│  • Detects multi-edition / cross-type / year ambiguity (The Office, Dune)    │
└──────────────────────────────────────────────────────────────────────────────┘
```

- **Deterministic Scoring & Ambiguity Model**:
  - **Title Similarity (0–102 pts)**: Exact normalized match (`100`), canonical shorthand match (`102`), article-stripped exact match (`98`), prefix/subtitle match (`74–78` with sequel-number mismatch penalty), and token recall/precision overlap (`0–74`).
  - **Media Type Alignment**: Hard exclusion (`-100`) when explicit input type (`movie` vs `tv`) contradicts candidate type; `+18` bonus when explicit type matches; `+10` bonus when deterministic hint matches.
  - **Release Year Alignment**: `+26` for exact year match, `+14` for `±1` year, `-6` for `±2` years, `-26` for `>2` years mismatch (forcing `ambiguous` status).
  - **Canonical Identity & Popularity Tie-Breakers**: `+10` for canonical `tmdb-*` identity and `+1..4` secondary tie-breaker from established vote count/rating so primary theatrical/series releases outrank obscure shorts with the same name.
  - **Ambiguity Triggers**: Marks a row `ambiguous` (`selected: false`) whenever:
    1. Explicit `yearHint` differs from the best candidate by `>1` year.
    2. Multiple adaptations/editions share the title or franchise root without an explicit year (`The Office` US 2005 vs UK 2001; `Dune` 1984 vs 2021 vs `Dune: Part Two` 2024).
    3. Top two distinct candidates have a score gap `<= 12` and no explicit year/type disambiguates them.
    4. Best candidate score is `< 88` (unless it is an unambiguous exact title match with score `>= 76`).
