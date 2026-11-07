# CineMax: Google-Style Intelligent Deterministic Search & Franchise Matching Engine

Upgrades CineMax's deterministic search and import matching engine into a relevance-driven, franchise-aware search engine that understands sequel numbering, subtitled installments (such as *"final destination 6"* → *"Final Destination Bloodlines (2025)"*), partial queries, Roman/Arabic numerals, and spelling variations without relying on any LLM or Gemini API.

## User Review & Critical Decisions

> [!IMPORTANT]
> **100% Deterministic & LLM-Free Architecture**: All query expansion, franchise installment resolution, fuzzy spelling similarity, and candidate ranking run deterministically in TypeScript against TMDB metadata and canonical anchor records—with zero Gemini or external AI calls.

- **Franchise & Installment Identity Model**: Rather than treating a sequel number (`2`–`19` or Roman `II`–`XIX`) as a mandatory literal token in the official title, the matcher cross-references a structured **Franchise & Installment Registry**. When a query specifies a franchise installment number (e.g., *"final destination 6"*, *"john wick 3"*, *"fast 5"*, *"scream 5"*, *"mission impossible 7"*), candidates that match the canonical subtitled installment receive full installment alignment credit instead of the `candidateMissingSequelNumber` penalty, while wrong installments in the same franchise (e.g., *Final Destination 2*, *Final Destination 5*, or the 2000 original *Final Destination*) still receive strong wrong-installment penalties.
- **Relevance-First Ranking & Noise Filtering**: Candidate ranking prioritizes exact/canonical title matches, franchise installment identity, and fuzzy token similarity first, using release year, format hints, and TMDB popularity/vote counts strictly as secondary signals. Low-relevance tail items that fall below a minimum relevance threshold are filtered out when strong matches exist so the results list stays clean and focused.

---

## 1. Overview & Core Concept

- **What It Does**: Transforms live search and completed-list import matching into an intent-aware search engine capable of bridging how users casually type queries (*"final destination 6"*, *"final destination bloodline"*, *"john wick chapter iii"*, *"spider man no way home"*, *"dune 2"*) with how TMDB officially indexes titles (*"Final Destination Bloodlines"*, *"John Wick: Chapter 3 – Parabellum"*, *"Spider-Man: No Way Home"*, *"Dune: Part Two"*).
- **Target Audience / Persona**: Viewers searching CineMax's catalogue in real time or importing watched lists who use shorthand sequel numbers, omit punctuation or articles, type Roman or Arabic numerals interchangeably, or make minor singular/plural or spelling typos.
- **Key Value**: Guarantees that the intended movie or TV series appears as the `#1` search result on the first keystroke cadence (250ms debounce) while preserving multi-edition ambiguity detection (e.g., *"the office"*, *"dune"*) for safe import confirmation.

---

## 2. User Experience & Visual Design

- **Key User Flows**:
  1. **Franchise Shorthand & Subtitled Sequel Search**: Typing `"final destination 6"` or `"final destination bloodline"` into the Search Overlay resolves to **Final Destination Bloodlines (2025)** as the `#1` result with a **TMDB Smart Match** indicator, followed by related franchise installments in relevance order.
  2. **Numeral & Punctuation Equivalence**: Typing `"john wick 3"`, `"john wick chapter iii"`, `"spider man no way home"`, `"dark knight"`, or `"dune 2"` surfaces the exact canonical installment first without requiring colons, hyphens, or leading articles.
  3. **Protected Numeric Titles**: Searching `"1917"` or `"blade runner 2049"` preserves the numbers as core title tokens rather than stripping them as release years or penalizing them as sequel numbers.
  4. **Ambiguous Multi-Edition Queries**: Searching `"the office"` or `"dune"` surfaces both major editions/adaptations prominently (*The Office* US 2005 & UK 2001; *Dune* 2021, *Dune: Part Two* 2024, & *Dune* 1984) and flags them for user confirmation during batch import rather than guessing.
- **Visual Identity & Theme**:
  - Preserves CineMax's obsidian-and-gold (`#0a0a0c` / `#f5c518`) SearchOverlay and ImportCompletedModal layout, filter pills (*All Formats*, *Movies*, *TV Series*), keyboard navigation, and responsive cards.
- **Interactive Feedback & Motion**:
  - Maintains the existing 250ms debounce, `AbortController` request cancellation, query-level caching, and immediate progressive rendering as the user types.

---

## 3. Key Product Decisions & Trade-Offs

- **Decision 1: Structured Franchise & Installment Registry vs. Naive Regex Replacement**
  - *Chosen Approach*: Upgrade the alias table into a structured **Franchise & Installment Registry** where each entry defines:
    - `franchiseKey` and `baseTitle` (e.g., `"Final Destination"`, `"John Wick"`, `"Spider-Man"`, `"The Dark Knight"`, `"Dune"`, `"Mission: Impossible"`, `"Harry Potter"`, `"The Lord of the Rings"`, `"Avengers"`, `"Alien"`, `"Mad Max"`, `"Knives Out"`, `"Pirates of the Caribbean"`)
    - `installmentNumber` (e.g., `6` for *Final Destination Bloodlines*, `4` for *The Final Destination*, `3` for *John Wick: Chapter 3 – Parabellum*)
    - `canonicalTitle`, `yearHint`, `mediaTypeHint`, `tmdbId`, and shorthand/subtitle patterns.
  - *Why*: Many major movies drop numbers in favor of subtitles (*Final Destination Bloodlines*, *The Dark Knight*, *The Dark Knight Rises*, *Glass Onion*, *Mad Max: Fury Road*, *Prometheus*, *Alien: Romulus*). A structured registry allows both query expansion (generating canonical TMDB queries AND base franchise queries) and scoring (`computeDeterministicTitleSimilarity` + `scoreDeterministicCandidate`) to recognize that `"final destination 6"` and `"Final Destination Bloodlines"` represent the exact same installment (`installment = 6`).
  - *Alternatives Considered*: Dropping the missing-sequel-number penalty globally. Rejected because removing the penalty globally would allow `"john wick 3"` to score high against the original `"John Wick"` (2014).

- **Decision 2: Combined Token + Fuzzy Levenshtein/Damerau & Stemming Similarity**
  - *Chosen Approach*: Enhance `computeDeterministicTitleSimilarity()` with per-token inflection tolerance (singular/plural like `bloodline` ↔ `bloodlines`) and bounded Levenshtein edit-distance similarity (`>= 0.80` token similarity for words of length `>= 4`) alongside whole-title normalized similarity.
  - *Why*: Ensures queries like `"final destination bloodline"`, `"interstelar"`, or `"spiderman no way home"` achieve near-exact title similarity scores (`90+`) against their official titles without matching unrelated words.

- **Decision 3: Multi-Variant Query Expansion & Canonical Anchor Coverage**
  - *Chosen Approach*: Expand search queries into a deduplicated, prioritized set of variants:
    1. Canonical official title from the Franchise & Installment Registry (e.g., `"Final Destination Bloodlines"`)
    2. Original and normalized punctuation-free query
    3. Roman ↔ Arabic numeral variant (`"john wick chapter iii"` ↔ `"John Wick: Chapter 3"`)
    4. Base franchise title (`"Final Destination"`) when a sequel shorthand is detected so TMDB returns the full franchise slate for ranking
    Additionally, ensure key canonical anchor records (including *Final Destination Bloodlines (2025)*, the *Final Destination* films, and *1917 (2019)*) are present in the local anchor catalogue so both live TMDB mode and offline/fallback mode pass every query deterministically.

---

## 4. Technical Architecture & Data Strategy *(Technical Reference)*

### Architecture & Component Diagram

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                        SearchOverlay / ImportCompletedModal                 │
│   • 250ms debounce, AbortController cancellation, Movie / TV / All filters  │
└──────────────────────────────────────┬──────────────────────────────────────┘
                                       │
                                       ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                    Multi-Variant Query Expansion Engine                     │
│  ┌─────────────────────────┐  ┌──────────────────────────┐  ┌────────────┐  │
│  │ Inline Hint Extractor   │  │ Franchise & Installment  │  │ Numeral &  │  │
│  │ • Year & Movie/TV hints │  │ Registry                 │  │ Punctuation│  │
│  │ • Protects "1917",      │  │ • Maps "final dest 6" -> │  │ Normalizer │  │
│  │   "Blade Runner 2049"   │  │   "Final Destination     │  │ • III <-> 3│  │
│  └─────────────────────────┘  │   Bloodlines" (2025, #6) │  └────────────┘  │
│                               └──────────────────────────┘                  │
└──────────────────────────────────────┬──────────────────────────────────────┘
                                       │
                  Generates bounded TMDB search variants:
                  [Canonical Title, Normalized Query, Base Franchise, Numeral Variant]
                                       │
                                       ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                    TMDB Search & Anchor Catalogue Retrieval                 │
│   • Dedupes parallel queries via request cache                              │
│   • Searches TMDB (/search/movie, /search/tv, /search/multi) + Anchor Pool  │
└──────────────────────────────────────┬──────────────────────────────────────┘
                                       │
                                       ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                Google-Style Relevance & Installment Ranking Engine          │
│  1. Exact / Original / Canonical Alias Title Match (100 - 115 pts)          │
│  2. Franchise + Installment Identity Match (recognizes subtitled sequels,   │
│     penalizes wrong installment numbers)                                    │
│  3. Token Overlap + Inflection (bloodline/bloodlines) + Fuzzy Edit Distance │
│  4. Release Year & Media Type Alignment                                     │
│  5. Secondary Tie-Breakers ONLY: TMDB Vote Count & Rating (max 0..5 pts)    │
│  6. Irrelevant Tail Filtering & Multi-Edition Ambiguity Detection           │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Key Scoring & Ranking Rules

1. **Franchise-Aware Sequel Matching in `computeDeterministicTitleSimilarity()` and `scoreDeterministicCandidate()`**:
   - Extract explicit installment numbers (`2..19` or Roman `II..XIX`) from both query and candidate, ignoring protected numeric titles (`1917`, `Blade Runner 2049`, `2001: A Space Odyssey`, `Wonder Woman 1984`, etc.).
   - Look up franchise installment metadata for both the query and the candidate:
     - If the query resolves to a known franchise installment (e.g., `franchise = "final-destination"`, `installment = 6`, canonical title `"Final Destination Bloodlines"`), a candidate matching `"Final Destination Bloodlines"` is recognized as **Installment #6** — it is **never** penalized by `candidateMissingSequelNumber` and receives a canonical installment match boost.
     - Conversely, candidates belonging to the same franchise with a **different** installment number (e.g., *Final Destination* [Installment #1, 2000], *Final Destination 2* [#2], *Final Destination 5* [#5]) receive an explicit wrong-installment penalty (`-35` pts) so they rank below the exact installment while still appearing as relevant franchise results.
2. **Fuzzy Spelling & Singular/Plural Matching**:
   - Add `computeTokenSimilarity(tokenA, tokenB)` supporting:
     - Exact match (`1.0`)
     - Singular/plural & suffix normalization (`bloodline` ↔ `bloodlines` = `0.97`)
     - Bounded Damerau-Levenshtein similarity for typos (`interstelar` ↔ `interstellar`, `parabelum` ↔ `parabellum` >= `0.82`)
3. **Relevance Filtering**:
   - Filter out candidates with `score <= 0` or candidates that fall far below a high-confidence top match (`score < 32` when top match `>= 95`), preventing unrelated filler results from cluttering the search grid.
4. **Automated Verification Suite**:
   - Create a dedicated automated test script (`scripts/verify-smart-search.ts`) verifying all 12 required queries (`final destination 6`, `final destination bloodline`, `john wick 3`, `john wick chapter iii`, `dark knight`, `spider man no way home`, `dune 2`, `the office`, `breaking bad`, `blade runner 2049`, `1917`, `interstellar`), plus sequel disambiguation, fuzzy typos, movie/TV filtering, and batch import ambiguity handling.
