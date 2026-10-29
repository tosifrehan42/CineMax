# CineMax — Import Completed Movies & TV Series into My Account

Add a production-grade **Import Completed List** workflow to CineMax across both the web application and the Capacitor Android app, allowing signed-in users to import their watched movies and TV series from screenshots (PNG, JPG, WEBP), text files (TXT, CSV, JSON), or pasted lists, review and adjust TMDB matches before saving, and idempotently sync completed records to their cloud Watchlist and Viewing Journal.

---

## User Review & Critical Decisions

> [!IMPORTANT]
> The following product and UX decisions were confirmed during interactive clarification and govern the implementation:

- **Confirmed Decision 1 — Entry Point Placement**: Place the **Import Completed List** action button in **both** the Watchlist & Checklist header and the Profile Viewing Journal header so users can launch an import from either collection view.
- **Confirmed Decision 2 — Watched Date Default & Override**: When an imported item does not specify an explicit watched date in the source file, default its Viewing Journal timestamp to **today's date** while providing an optional **date override picker** in the review preview (and preserving any existing `watched_at` date when updating a title already in the user's Viewing Journal unless an explicit replacement date is supplied).
- **Confirmed Decision 3 — Existing Watchlist Item Handling**: When an imported title already exists in the user's Watchlist under another status (such as *Watching* or *Want to Watch*), **upgrade its status to Completed** while strictly preserving the user's existing personal rating, review notes, favourite flag, and added date.
- **Confirmed Decision 4 — Episode Progress Discipline**: Do not fabricate episode-level progress for imported TV series unless explicit season/episode numbers are present in the imported entry; when explicit season/episode information is provided, sync only those specified episodes.

---

## 1. Overview & Core Concept

- **What It Does**: Provides a guided 3-step modal workflow (**Source Input → Match Review & Correction → Cloud Import & Summary**) that turns unstructured or structured lists of watched titles—including screenshots of numbered phone notes or watchlist apps, TXT lists, CSV spreadsheets, JSON exports, or pasted text—into canonical CineMax `completed` Watchlist entries and dated Viewing Journal records.
- **Target Audience / Persona**: CineMax web and Android users migrating existing watched lists from notes apps, spreadsheets, or screenshots into their cloud-synced CineMax account without manual one-by-one entry.
- **Key Value**: Eliminates tedious manual logging while guaranteeing zero duplicate records, accurate movie-vs-series disambiguation via live TMDB + local catalog resolution, and full preservation of existing ratings, notes, and favourites.

---

## 2. User Experience & Visual Design

- **Key User Flows**:
  1. **Launch & Authentication Gate**:
     - Clicking **Import Completed List** in either the Watchlist header or the Profile Viewing Journal header opens the **Import Completed Titles** modal (or prompts Sign In first if the user is currently in guest mode).
  2. **Step 1 — Input Source Selection (Upload File or Paste Text)**:
     - A Liquid Glass segmented switcher (`Upload File` | `Paste Text List`) lets the user choose their input method.
     - **File Upload Zone**: Accepts `.png`, `.jpg`, `.jpeg`, `.webp` (up to 8 MB for screenshots of lists) and `.txt`, `.csv`, `.json` (up to 2 MB). Validates file format and size immediately with clear inline error feedback for malformed or empty files.
     - **Text Paste Area**: Supports numbered lists (`1. Oppenheimer (2023)`), bulleted lines, CSV rows, or `Title - Movie/TV - Year` lines, with a one-click sample format preview.
  3. **Step 2 — Interactive TMDB Match Review & Disambiguation**:
     - Displays summary counters using tabular numerals (`tabular-nums`): **Total Extracted**, **Matched**, **Needs Review (Ambiguous)**, **Already Completed**, and **Unmatched**.
     - Filter tabs (`All`, `Matched`, `Needs Review`, `Unmatched`) allow quick inspection of large lists.
     - A global **Default Watched Date** date picker (defaulting to today) applies to newly imported entries that do not carry a per-item watched date, alongside per-row date/type controls.
     - Each extracted row displays:
       - Include/skip checkbox and original extracted text (`Title`, detected `Movie`/`Series` hint, release year, optional `S01E01` / season info, or parsed watched date).
       - Resolved TMDB poster thumbnail (with resilient fallback), canonical title, release year, media type label, and match status indicator (`Matched`, `Already in Account`, `Ambiguous — Verify Match`, or `Unmatched`).
       - **Alternate Candidates & Inline Search Override**: Users can switch between top candidate matches in one click or open an inline live search box on any row to search TMDB/CineMax for a different Movie or TV Series.
  4. **Step 3 — Idempotent Cloud Sync & Import Report**:
     - Shows real-time progress while writing confirmed entries to Supabase (`watchlist_items`, `watch_history`, and optional explicit `watched_episodes`).
     - Displays a structured completion summary:
       - **Newly Imported** count
       - **Already Present / Upgraded to Completed** count
       - **Skipped by User** count
       - **Unmatched** count
       - **Failed Writes** count (if any network or RLS error occurred), with a **Retry Failed Items** action that re-runs only the failed subset.
     - Immediately updates in-memory `watchlist`, `watchHistory`, and `watchedEpisodes` state so the Watchlist and Viewing Journal reflect the imported titles without reloading the page.

- **Visual Identity & Theme**:
  - **Aesthetic Direction**: Established CineMax dark cinema aesthetic with Apple-inspired Liquid Glass modal surfaces (`cm-glass-nav`, `cm-glass-surface`, `cm-glass-control`) and spring-animated `LiquidTabBubble` segmented switchers.
  - **Color Palette & Mood**: Deep obsidian background (`#0A0D12` / `#10141D`), translucent slate structural borders (`border-white/10`), warm amber primary accents (`#F59E0B`), semantic emerald (`#10B981`) for verified matches, amber (`#F59E0B`) for ambiguous candidates needing review, and rose (`#F43F5E`) for unmatched or failed rows.
  - **Typography & Hierarchy**: `Outfit` for modal headers and section titles, `Plus Jakarta Sans` for dense scannable row metadata, and `tabular-nums` for all counters, years, and progress metrics.
  - **Component Styling & Layout**: Single-elevation row layout separated by hairline dividers (`border-white/[0.07]`), responsive single-line controls (`whitespace-nowrap shrink-0`), and mobile-friendly touch targets ($\ge 40\text{px}$) that fit cleanly from `320px` Android screens to `1440px` desktop viewports.

---

## 3. Key Product Decisions & Trade-Offs

- **Decision 1 — Server-Side Multimodal Gemini Extraction for Screenshots + Deterministic Parser for Text/CSV/JSON**:
  - *Chosen Approach*: Parse `.txt`, `.csv`, `.json`, and pasted text deterministically using a structured parser (supporting numbered lists, years in parentheses, `Movie`/`TV`/`Series` tags, `S01E02` patterns, and ISO dates), while routing uploaded `.png`/`.jpg`/`.webp` screenshots to a dedicated server-side endpoint (`POST /api/import/extract-image`) powered by `@google/genai` (`gemini-3.8-flash` with strict `Type.ARRAY` JSON schema and `process.env.GEMINI_API_KEY`).
  - *Why*: Deterministic parsing is instantaneous and 100% predictable for text/CSV/JSON files, while server-side multimodal Gemini accurately reads multi-column or numbered mobile screenshots without ever exposing `GEMINI_API_KEY` to the client bundle.
  - *Alternatives Considered*: Client-side OCR (rejected due to poor accuracy on stylized movie screenshots and heavy WASM bundle size) or sending text files to an LLM (rejected due to unnecessary latency when deterministic parsing is faster and exact).

- **Decision 2 — Type-Aware Multi-Candidate TMDB & Catalog Scoring**:
  - *Chosen Approach*: Resolve each extracted entry against both the CineMax curated/live catalog and `/api/media` search, scoring candidates by normalized title similarity, exact/near release year match, and explicit media type (`movie` vs `tv`) constraint. Classify matches into `matched` (high confidence), `ambiguous` (multiple plausible candidates or year/type discrepancy), or `unmatched` (no reliable candidate found).
  - *Why*: Prevents a movie from silently matching a namesake TV series (or vice versa) and gives the user full control to pick an alternate candidate or search manually before anything is written to their account.

- **Decision 3 — Non-Destructive Idempotent Merge in Supabase**:
  - *Chosen Approach*: Before writing confirmed items, compare each canonical `mediaId` (`movie-<tmdbId>` / `tv-<tmdbId>` or seed ID) against the user's current `watchlist` and `watchHistory`. Merge existing fields (`personalRating`, `personalNotes`/`reviewNotes`, `isFavourite`, `addedAt`, and existing `watchedAt` unless an explicit import date override was provided) and upsert via the existing ` watchlist_user_media_unique (user_id, media_id)` and `watch_history_user_media_unique (user_id, media_id)` constraints.
  - *Why*: Requires **zero destructive database migrations**, respects existing RLS policies (`auth.uid() = user_id`), and guarantees that importing the same file twice never duplicates rows or erases user reviews.

---

## 4. Technical Architecture & Data Strategy *(Technical Reference)*

- **Architecture & Component Diagram**:

```
┌──────────────────────────────────────────────────────────────────────────────┐
│                     CineMax Client (Web & Capacitor Android)                 │
│                                                                              │
│  ┌────────────────────────────┐         ┌─────────────────────────────────┐  │
│  │     WatchlistView Header   │         │  ProfileView (Viewing Journal)  │  │
│  │  [Import Completed List]   │         │     [Import Completed List]     │  │
│  └─────────────┬──────────────┘         └────────────────┬────────────────┘  │
│                └────────────────────┬────────────────────┘                   │
│                                     ▼                                        │
│            ┌─────────────────────────────────────────────────┐               │
│            │          ImportCompletedModal (3-Step UI)       │               │
│            │  1. File/Paste Input & Format Validation        │               │
│            │  2. TMDB Match Preview, Disambiguation & Search │               │
│            │  3. Progress Tracker, Summary & Retry Handler   │               │
│            └───────┬────────────────────────┬────────────────┘               │
│                    │                        │                                │
│                    ▼                        ▼                                │
│     ┌─────────────────────────────┐  ┌────────────────────────────────────┐  │
│     │ Import Extraction & Matcher │  │ Idempotent Supabase Sync Engine    │  │
│     │ - TXT / CSV / JSON Parser   │  │ - Preserves rating/notes/favourite │  │
│     │ - Type/Year/Title Scorer    │  │ - Upserts watchlist_items          │  │
│     │ - Canonical ID Normalization│  │ - Upserts watch_history            │  │
│     └──────┬───────────────┬──────┘  │ - Optional explicit episodes sync  │  │
│            │               │         └─────────────────┬──────────────────┘  │
└────────────┼───────────────┼───────────────────────────┼─────────────────────┘
             │               │                           │
             ▼               ▼                           ▼
┌──────────────────────┐ ┌─────────────────────┐ ┌─────────────────────────────┐
│ POST /api/import/    │ │ GET /api/media      │ │ Supabase Postgres + RLS     │
│   extract-image      │ │ (TMDB + Catalog     │ │ - public.watchlist_items    │
│ (@google/genai       │ │  Search & Identity) │ │ - public.watch_history      │
│  gemini-3.8-flash)   │ └─────────────────────┘ │ - public.watched_episodes   │
└──────────────────────┘                         └─────────────────────────────┘
```

- **Data Model & State**:
  - `ExtractedImportItem`: `{ rawLine: string; title: string; mediaTypeHint?: 'movie' | 'tv'; yearHint?: number; seasonNumber?: number; episodeNumbers?: number[]; watchedAtHint?: string; personalRatingHint?: number; notesHint?: string }`
  - `ResolvedImportRow`: Links each `ExtractedImportItem` to:
    - `matchStatus`: `'matched' | 'ambiguous' | 'unmatched'`
    - `selectedMedia`: `MediaItem | null` (using CineMax's canonical `mediaId` and `tmdbId`)
    - `candidates`: `MediaItem[]` (top alternative matches from TMDB/catalog)
    - `existingState`: `'none' | 'already_completed' | 'upgrade_to_completed'` (derived from the user's current `watchlist` and `watchHistory`)
    - `selected`: `boolean` (auto-checked for `matched`, unchecked by default for `ambiguous` until reviewed or confirmed, unchecked for `unmatched`)
    - `watchedDateOverride`: `string` (ISO `YYYY-MM-DD`, defaulting to explicit `watchedAtHint`, existing `watchedAt`, or global default date)
  - `ImportExecutionSummary`: `{ importedNewCount: number; updatedExistingCount: number; skippedCount: number; unmatchedCount: number; failedItems: Array<{ rowId: string; title: string; error: string }> }`

- **Interactive Component & State Mapping**:
  - **Source Input Validation**: Rejects unsupported file extensions, empty files, images $> 8\text{ MB}$, or text/CSV/JSON files $> 2\text{ MB}$ with clear, non-technical guidance. Malformed JSON or CSV syntax reports the exact parsing issue without crashing.
  - **Server-Side Image Extraction (`POST /api/import/extract-image`)**: Accepts `{ mimeType, dataBase64 }`, validates MIME type (`image/png`, `image/jpeg`, `image/webp`) and payload size, calls `ai.models.generateContent` with `model: 'gemini-3.8-flash'` and a structured `Type.OBJECT` / `Type.ARRAY` `responseSchema`, and returns extracted items. If `GEMINI_API_KEY` is missing or the image contains no recognizable titles, returns a clear structured error message—never fabricated titles.
  - **Match Disambiguation & Manual Override**: Each row in the preview supports changing the media type filter (`All` / `Movie` / `TV`), picking from alternative candidates, or running a live title search query to select the exact TMDB title.
  - **Idempotent Execution & Partial Failure Recovery**: Processes confirmed rows sequentially or in bounded batches against `watchlist_items` and `watch_history` (plus `watched_episodes` only when explicit episode numbers exist). An item is counted as imported/updated **only** when both its `watchlist_items` and `watch_history` upserts succeed. Any row that fails a database write is captured in `failedItems` and can be retried in-place without re-uploading the file.
