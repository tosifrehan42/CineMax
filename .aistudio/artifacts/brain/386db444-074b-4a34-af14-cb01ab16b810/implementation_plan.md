# CineMax: Gemini AI-Powered Smart Search & Import Matching Plan

## 1. Overview & Architecture
Enhance CineMax's search and completed-list import matching with server-side Google Gemini title normalization (`gemini-3.8-flash` via `@google/genai`) while preserving TMDB as the single source of truth for all media metadata, IDs, posters, ratings, and release years.

- **Security & Fallback First**: All Gemini calls execute exclusively on the server (`process.env.GEMINI_API_KEY` with `User-Agent: 'aistudio-build'`). If `GEMINI_API_KEY` is missing, rate-limited, or unreachable, Search and Import gracefully fall back to direct TMDB and local catalogue matching without breaking any workflow.
- **Zero Fabrication Guarantee**: Gemini only suggests normalized canonical title strings, alternate search queries, optional media type hints, and release year hints. Every displayed candidate is fetched and verified from TMDB or the CineMax catalogue and deduplicated via `dedupeMediaItems()` / `getCanonicalMediaKey()`.

---

## 2. Server-Side Title Resolution Service (`src/server/titleResolutionService.ts` & `server.ts`)

### A. `src/server/titleResolutionService.ts` *(New)*
- Reuses `gemini-3.8-flash` with `@google/genai` (`Type.OBJECT` / `Type.ARRAY` structured `responseSchema`, `responseMimeType: 'application/json'`) matching `src/server/importImageExtractor.ts`.
- Supports both single-query normalization (Search) and batch title normalization (Import List):
  - **Input Schema**:
    ```ts
    export interface TitleResolutionInputItem {
      rowId?: string;
      title: string;
      mediaTypeHint?: 'movie' | 'tv' | null;
      yearHint?: number | null;
    }
    ```
  - **Output Schema**:
    ```ts
    export interface ResolvedTitleSuggestion {
      rowId: string;
      originalTitle: string;
      normalizedTitle: string;
      alternateQueries: string[];
      mediaTypeHint: 'movie' | 'tv' | null;
      yearHint: number | null;
      confidence: number;
      aiAssisted: boolean;
    }
    ```
- **Safeguards & Performance Controls**:
  - Validates inputs: maximum `50` titles per request, maximum `200` characters per title.
  - Short-lived in-memory LRU/TTL cache (`15 minutes`, up to `500` normalized title entries) keyed by normalized `(title + mediaTypeHint + yearHint)` so repeated searches or re-imports resolve instantaneously without redundant model calls.
  - `8,000ms` request timeout using `Promise.race` / `AbortController` so slow model calls never hang Search or Import.
  - Safe fallback generator when `GEMINI_API_KEY` is unconfigured or errors occur (returns `aiAssisted: false` with deterministic shorthand expansion for common patterns like numbered sequels and punctuation).

### B. `POST /api/ai/resolve-titles` in `server.ts`
- Mounts `POST /api/ai/resolve-titles` with JSON body validation (`express.json({ limit: '256kb' })`).
- Accepts `{ items: TitleResolutionInputItem[] }` or `{ query: string, mediaTypeHint?: 'movie' | 'tv' }` and returns `{ aiConfigured: boolean, items: ResolvedTitleSuggestion[], warning?: string }`.

---

## 3. Feature A: Intelligent Search (`src/services/mediaApi.ts` & `src/components/SearchOverlay.tsx`)

### A. Smart Search Trigger & Multi-Query TMDB Resolution (`src/services/mediaApi.ts`)
- Add `resolveTitlesWithAi()` client helper (with client-side short-TTL cache and `AbortSignal` support) calling `POST /api/ai/resolve-titles`.
- Add `evaluateDirectSearchConfidence(query, items)`:
  - Checks whether the initial direct `fetchCatalogue()` results already contain a strong canonical title match (e.g., exact or high-tier normalized title match among the top results).
  - **Rule**: Direct TMDB search always runs first after the 250ms debounce. Gemini is invoked **only** when query length is `>= 3` characters and direct results are empty, weak, or lack a confident title match (e.g., `"john wick 3"` where TMDB's raw search ranks partial matches or misses `"John Wick: Chapter 3 – Parabellum"`).
- When triggered:
  1. Calls `resolveTitlesWithAi([{ title: query, mediaTypeHint }])`.
  2. Queries `fetchCatalogue()` in parallel (up to 3 unique queries: `normalizedTitle` + top 2 distinct `alternateQueries`), respecting the active `typeFilter` (`all` | `movie` | `tv`) and `AbortSignal`.
  3. Merges and deduplicates all returned TMDB items with the initial results via `dedupeMediaItems()`.
  4. Re-ranks candidates so exact matches against `normalizedTitle` (e.g., `"John Wick: Chapter 3 – Parabellum"`, `"The Dark Knight"`, `"Spider-Man: No Way Home"`, `"Avengers: Endgame"`) rank at the top while keeping ambiguous franchises (e.g., `"The Office"`) grouped cleanly as real TMDB candidates.

### B. Subtle UI Enhancements (`src/components/SearchOverlay.tsx`)
- Preserves existing 250ms debounce, `requestIdRef` race protection, keyboard navigation, and Liquid Glass styling.
- Shows a subtle status pill (`"AI-assisted search · Resolving canonical title..."` while resolving, and `"AI-assisted match: [Normalized Title]"` when Gemini expanded the query into a canonical title different from the raw input).

---

## 4. Feature B: Intelligent Import List Matching (`src/services/completedImportService.ts` & `src/components/ImportCompletedModal.tsx`)

### A. Batch Title Normalization Before TMDB Matching (`src/services/completedImportService.ts`)
- Extend `ExtractedImportItem` and `ResolvedImportRow` with optional AI normalization metadata (`normalizedTitle?: string`, `alternateQueries?: string[]`, `aiConfidence?: number`, `aiAssisted?: boolean`) while strictly preserving `id`/`rowId`, `rawLine`, original `title`, `yearHint`, `mediaTypeHint`, `watchedAtHint`, `personalRatingHint`, `notesHint`, `seasonNumber`, and `episodeNumbers`.
- In `resolveExtractedImportItems()`:
  1. Before querying TMDB, send extracted items in batches of up to `25` titles per request to `POST /api/ai/resolve-titles`.
  2. For each item, query `fetchCatalogue()` using the original title and (when distinct) the AI `normalizedTitle` + up to 2 fallback `alternateQueries` (with bounded concurrency `4`).
  3. Merge and deduplicate all candidate `MediaItem` records via `dedupeMediaItems()`.
- Enhance `scoreMediaCandidate(item, candidate, aiSuggestion?)`:
  - Evaluates candidate title similarity against `item.title`, `aiSuggestion.normalizedTitle`, and `aiSuggestion.alternateQueries`.
  - Enforces strict type safety: if `item.mediaTypeHint` was explicitly provided by the user/file (`movie` or `tv`), candidates of the opposite type receive `-100` and are never auto-matched. When `item.mediaTypeHint` is not explicitly provided, `aiSuggestion.mediaTypeHint` provides only a soft tie-breaker bonus (`+8`) so ambiguous titles like `"The Office"` still surface rival candidates for review.
  - Populates clear, informative `matchReason` messages:
    - When AI normalized a shorthand title to a verified TMDB match: `"AI recognized 'John Wick 3' as 'John Wick: Chapter 3 – Parabellum'; TMDB verified the match."`
    - When ambiguous or conflicting year/type candidates exist: keeps `matchStatus = 'ambiguous'` with a clear explanation so the user confirms in the review step.

### B. Review UI Refinements (`src/components/ImportCompletedModal.tsx`)
- In Step 2 (Review), display an unobtrusive `AI-assisted match` badge and show the original extracted title alongside the resolved canonical TMDB title when they differ.
- Pre-populate the manual "Change Match" search drawer with quick-filter chips for any AI `alternateQueries` so ambiguous or unmatched rows are effortless to refine.

---

## 5. Planned File Modifications
1. **`src/server/titleResolutionService.ts`** *(new)*: Server-side Gemini structured JSON title resolution service with input validation, timeout, TTL cache, and fallback logic.
2. **`server.ts`**: Add `POST /api/ai/resolve-titles` endpoint wired to `resolveTitlesWithGemini`.
3. **`src/services/mediaApi.ts`**: Add `resolveTitlesWithAi`, confidence evaluation for direct search results, and multi-query TMDB search merging/ranking.
4. **`src/components/SearchOverlay.tsx`**: Integrate two-stage search (direct TMDB first, AI-assisted resolution when needed) and subtle AI-assisted status indicator.
5. **`src/services/completedImportService.ts`**: Add batch AI title normalization step in `resolveExtractedImportItems`, multi-query TMDB candidate gathering, and enhanced `scoreMediaCandidate` + `matchReason` generation.
6. **`src/components/ImportCompletedModal.tsx`**: Display subtle `AI-assisted match` indicator and canonical vs. original title context in the review list.
