# CineMax Premium OTT Redesign Plan

## 1. Overview & Aesthetic Direction
Redesign CineMax into a cohesive, dark-cinematic OTT discovery experience (`#0A0D12` obsidian canvas, `#121721` elevated surfaces, `#F59E0B` amber accents, Plus Jakarta Sans + Inter + JetBrains Mono typography) inspired by the usability patterns of Netflix, Prime Video, and JioHotstar while preserving all existing features, routes, and security rules.

---

## 2. Information Architecture & Responsive Navigation (`Navbar.tsx` & `App.tsx`)

### Desktop Navigation (`md` and up)
- Sticky, compact top navigation bar (`h-16`, `max-w-[1440px]` centered container) with:
  - **CineMax** brand logo
  - **Primary hubs**: `Home`, `Movies` (Home OTT hub filtered to Movies), `Series` (Home OTT hub filtered to Series), `Discover`, `Watchlist`, `Quality & File Size`
  - **Utility & Account**: Compact inline `Search` trigger/input, `Surprise Me` action, `Profile / Account` controls, and `Admin` (shown only when `adminAccessStatus === 'allowed'` or cached for the verified admin user ID).

### Mobile Navigation (`< md`)
- **Compact Top Bar**: CineMax logo, quick Search input/trigger, Surprise Me button, and Account/Profile avatar button (plus Admin badge only for verified admins).
- **Fixed Bottom Navigation Bar**: `Home`, `Discover`, `Watchlist`, and `Profile` (opens account/auth drawer or modal) with `pb-[env(safe-area-inset-bottom)]` and sufficient bottom page padding (`pb-24 md:pb-12`) so content is never obscured.
- **Quality & File Size Access**: Prominently accessible via a compact banner/shortcut inside `Discover` and a quick-access pill in the mobile top bar/tools menu.

---

## 3. Home Page OTT Hierarchy (`HomeView.tsx`, `HeroSpotlight.tsx`, `MediaCarouselRow.tsx`, `FranchiseModal.tsx`)

When on `Home` (or the `Movies` / `Series` hub tabs), sections render in this exact hierarchy using real API/TMDB and curated fallback datasets, with cross-row deduplication so the same title does not repeat endlessly:

1. **Featured Cinematic Hero (`HeroSpotlight.tsx`)**
   - Wide 16:9 / 21:9 backdrop artwork with multi-stop bottom and left vignette gradients (`from-[#0A0D12] via-[#0A0D12]/80 to-transparent`).
   - Displays title, release year, content format badge (`MOVIE` / `SERIES`), runtime or seasons count, IMDb/TMDB rating, language, and genre metadata.
   - Primary actions: **Watch Trailer** (opens real YouTube trailer modal) and **View Details**.
   - Secondary action: **Add to Watchlist** (or current watchlist status badge).
   - Safe featured-title rotation (`8s` interval paused on hover/focus) with compact indicator pills and previous/next controls. Compact height on mobile (`min-h-[380px] sm:min-h-[440px] lg:min-h-[540px]`) so the first content row peeks above the fold.

2. **Continue Watching**
   - Rendered **only** when the user has genuine viewing progress (`status === 'watching'` or non-empty `watchedEpisodes`). Hidden completely when empty—never populated with dummy progress bars.

3. **Recommended For You**
   - Clearly labeled personalized recommendations based on the user's `favoriteGenres`, watchlist items, and high-rated history (with a clear subtitle indicating which genres/titles power the row, or a "Popular picks for new viewers" subtitle when no history exists yet).

4. **Trending in India**
   - Dedicated dataset using TMDB India region discovery/trending (`region=IN` / Indian language & regional popularity) with verified fallback titles.

5. **Top 10 Movies & Top 10 Series**
   - Independently sourced movie and series datasets rendered with oversized typographic `#1`–`#10` rank numerals alongside each `2:3` poster card.

6. **Popular Movies** (shown in `Home` and `Movies` hub)
7. **Popular Series** (shown in `Home` and `Series` hub)
8. **Top Rated Movies** (shown in `Home` and `Movies` hub)
9. **Top Rated Series** (shown in `Home` and `Series` hub)
10. **New & Upcoming** (recent and upcoming releases sorted by release date)
11. **Browse by Genre** (interactive genre pills that dynamically load a genre carousel or jump to Discover)
12. **Franchise Collections / Watch Order**
    - Curated multi-film/series franchises (e.g., Marvel Infinity Saga, Dune, The Dark Knight, Spider-Verse, John Wick, Avatar, Harry Potter, MonsterVerse, Lord of the Rings) backed by real catalogue entries.
    - Selecting a franchise opens the **Franchise Watch-Order Modal** (`FranchiseModal.tsx`) showing chronological/release order, overall completion progress (`X of Y watched`), and direct `Watch Trailer`, `View Details`, and `Watchlist` toggles for each installment.

---

## 4. Content Carousels & Portrait Title Cards (`MediaCarouselRow.tsx` & `MediaCard.tsx`)

- **Portrait `2:3` Cards**:
  - Desktop (`1440px` container): `5–7` cards visible per row (`w-[175px] sm:w-[190px] lg:w-[205px]`).
  - Mobile (`360px–430px`): `2.3–3` cards visible per row (`w-[140px] sm:w-[160px]`) with horizontal peek and `snap-x snap-mandatory` touch scrolling.
- **Horizontal Carousel Controls**:
  - Smooth native horizontal touch scrolling + keyboard arrow navigation + hover-revealed left/right chevron buttons on desktop.
- **Clean Unboxed Metadata**:
  - Poster image with subtle top-right rating badge and status indicator.
  - Below poster: single-line/two-line title + compact unboxed metadata line (`2024 · 2h 46m · ★ 8.5` or `2022 · 2 Seasons · ★ 8.7`).
  - Desktop hover/focus reveals quick actions (`Watch Trailer`, `Details`, `Watchlist +`); mobile provides direct tap for Details and a clean visible Watchlist/Trailer action button without requiring hover.

---

## 5. Discover Workspace (`DiscoverView.tsx`, `server.ts`, `mediaApi.ts`)

- **Compact Inline Filter Bar**:
  - **Search input** with `250ms` debounce and clear button.
  - **Format segmented toggle**: `All`, `Movies`, `Series`.
  - **Genre dropdown**: All genres (`Action`, `Sci-Fi`, `Drama`, `Thriller`, `Animation`, `Crime`, `Comedy`, `Fantasy`, `Horror`, `Romance`, `Mystery`, `Adventure`).
  - **Release Year dropdown**: `All Years`, `2025–2026`, `2024`, `2020–2023`, `2010–2019`, `2000–2009`, `Classic (<2000)`.
  - **Language dropdown**: `All Languages`, `English`, `Hindi`, `Korean`, `Japanese`, `Spanish`, `Tamil`, `Telugu`, `French`.
  - **Minimum Rating dropdown**: `Any Rating`, `7.0+`, `7.5+`, `8.0+`, `8.5+`.
  - **Sort By dropdown**: `Relevance` (auto-selected when a search query is active), `Popularity`, `Highest Rated`, `Release Year (Newest)`, `Title (A–Z)`.
- **Active Filter Chips & Shortcut**:
  - Dismissible chips for every active filter + `Clear All` action + total results counter.
  - Prominent **Quality & File Size Estimator** shortcut card/button right in the Discover header.
- **End-to-End Backend & Static Filtering**:
  - Update `/api/catalogue` in `server.ts` and `resolveClientCatalogue()` in `src/services/mediaApi.ts` so `year`, `language`, `genre`, `minRating`, `type`, `search`, and `sortBy` work seamlessly with both live TMDB API discovery and the static GitHub Pages catalogue fallback.

---

## 6. Preserved Features & Verification Plan
- **Preserved Functionality**:
  - Supabase Auth, session persistence, and profile avatar upload/removal (`ProfileModal.tsx`).
  - Verified Admin Dashboard (`/admin` and `/CineMax/admin`) with server-side Supabase Edge Function authorization.
  - Watchlist management across all 5 statuses (`watchlist`, `watching`, `completed`, `on_hold`, `dropped`), TV episode tracker, and Viewing Journal.
  - Real YouTube Trailer Modal (`TrailerModal.tsx`) with official trailer ranking and verified fallback keys.
  - Quality & File Size Estimator (`QualityGuide.tsx`) and Surprise Me modal (`SurpriseMeModal.tsx`).
- **Verification**:
  - Run `lint_applet` and `compile_applet` (`npm run build`).
  - Test API endpoints for Home categories, Trending in India, Top 10 Movies/Series, and multi-filter Discover queries.
  - Verify responsive layouts across `360px`, `390px`, `768px`, `1024px`, and `1440px` viewports and confirm `/CineMax/` GitHub Pages asset paths.
