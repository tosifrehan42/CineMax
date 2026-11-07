# CineMax — Mobile UI/UX Responsive Refinement Plan

## 1. Executive Summary & Design Goals

CineMax delivers a rich OTT discovery, tracking, and playback experience, but on narrow smartphone viewports (`320px`–`430px`) several controls compete for horizontal space, vertical headers stack too tall, and multi-control filter bars push content below the fold.

This refinement upgrades CineMax into a cohesive, mobile-first OTT interface across `320px`, `360px`, `375px`, `390px`, `414px`, and `430px` viewports while keeping desktop layouts (`md:` and above) visually unchanged:

- **Zero Horizontal Overflow & Unclipped Controls**: Every header bar, segmented control, modal sheet, and action group adapts cleanly down to `320px` width without text truncation collisions or horizontal scroll bleed.
- **44px Ergonomic Touch Targets & Thumb-Zone Alignment**: All primary interactive controls (navigation triggers, search, filter toggles, watchlist buttons, modal close/action buttons) meet a minimum `44px × 44px` hitbox and respect device safe-area insets (`env(safe-area-inset-*)`) and dynamic viewport sizing (`100dvh` with `100vh` fallback).
- **Preserved Aesthetic & Performance Discipline**: Retains the Obsidian Cinema palette (`#0A0D12` background, `#F59E0B` amber accents, liquid-glass surfaces, `Outfit` / `Plus Jakarta Sans` / `JetBrains Mono` typography) and lightweight CSS-only touch/hover feedback with zero new runtime animation overhead.

---

## 2. Mobile Layout & Navigation Architecture

```
+-----------------------------------------------------------------------+
| TOP HEADER (Mobile < 768px, Sticky, Safe-Area Top)                    |
| [ CineMax Logo ]                      [ Search ] [ Profile ] [ More ] |
+-----------------------------------------------------------------------+
| HOME HUB SWITCHER (Shown on Home View only, 3 Equal Segments)         |
| [      All Titles      |        Movies        |        Series       ] |
+-----------------------------------------------------------------------+
|                                                                       |
| COMPACT MOBILE HERO SPOTLIGHT                                         |
| - Balanced vertical height & reinforced bottom/left reading gradient  |
| - 2-line max title wrap + compact single-line metadata strip          |
| - 2-line synopsis clamp                                               |
| - Primary [ Play / Preview ] + Secondary [ Checklist ] [ More Info ]  |
|                                                                       |
+-----------------------------------------------------------------------+
| HORIZONTAL POSTER CAROUSELS & TOP 10 ROW                              |
| [ Poster 1 ]  [ Poster 2 ]  [ Peek 3.. ]  (2+ cards visible + peek)   |
| - Proportional Top 10 rank numerals on narrow screens                 |
+-----------------------------------------------------------------------+
|                                                                       |
| FLOATING MOBILE OVERFLOW SHEET (Triggered by Header [ More ] Button)  |
| - Surprise Me                                                         |
| - Quality & File Size Estimator                                       |
| - Install App (PWA, when available)                                   |
| - Admin Dashboard (when verified admin)                               |
| - Sign Out (when signed in)                                           |
+-----------------------------------------------------------------------+
| FLOATING BOTTOM NAVIGATION BAR (Safe-Area Bottom, 4 Equal Tabs)       |
| [     Home     ]   [   Discover   ]   [  Watchlist  ]   [  Profile  ] |
+-----------------------------------------------------------------------+
```

---

## 3. Core Refinement Areas & Architectural Rationale

### A. Mobile Navigation Restructure & Overflow Menu
- **Why**: Packing the brand logo, search button, file size estimator, surprise me button, PWA installer, admin trigger, user profile, and sign-out button into a single `320px`–`430px` top bar causes severe crowding and tiny tap targets. Similarly, repeating the "Size Tool" button inside the mobile Home hub switcher squeezes the `All Titles / Movies / Series` tabs.
- **Approach**:
  - **Mobile Top Header**: Streamline to four balanced elements: the **CineMax** brand mark on the left, and **Search** (`44px`), **Profile / Sign In** (`44px`), and a **More / Tools** button (`44px`) on the right.
  - **Mobile Overflow Sheet / Menu**: Tapping the **More / Tools** button opens a glass popover/sheet housing secondary utilities: *Surprise Me*, *Quality & File Size Estimator*, *Install App* (when installable), *Admin Access* (when verified), and *Sign Out* (when authenticated), with keyboard `Escape` and backdrop-tap dismissal.
  - **Home Hub Segmented Switcher**: Remove the duplicate mobile "Size Tool" button from the Home sub-bar and allocate 100% of the row to a 3-column equal-width segmented control (`All Titles`, `Movies`, `Series`) with high-contrast active styling and zero label clipping.
  - **Floating Bottom Navigation**: Refine the 4 primary tabs (`Home`, `Discover`, `Watchlist`, `Profile`) with balanced `48px+` touch targets, crisp icon/label alignment, safe-area bottom inset clearance, and matching bottom padding on the main layout container so content and footers are never obscured.

### B. Mobile Hero Spotlight Optimization
- **Why**: The mobile hero currently enforces a tall minimum height and stacks multi-row metadata badges and wide action buttons that wrap awkwardly on `320px`–`360px` screens.
- **Approach**:
  - Reduce mobile vertical height while maintaining desktop (`sm:` / `md:` / `lg:`) dimensions unchanged.
  - Strengthen the bottom and lower-left vignette gradients on mobile so headlines and synopses remain effortless to read over bright backdrops.
  - Condense mobile metadata into a clean single-row summary (`Format · Year · Rating · Runtime/Seasons`) with secondary audio/resolution tags hidden on extra-narrow screens.
  - Arrange hero actions into a responsive touch-friendly layout (`min-h-[44px]` buttons) where primary playback/preview and secondary checklist/details controls fit cleanly without horizontal overflow, alongside accessible slide indicators.

### C. Poster Carousels, Top 10 Row & Content Grids
- **Why**: Fixed `160px`–`215px` card widths leave awkward partial crops on `320px`–`375px` viewports, and `text-7xl` Top 10 numerals consume too much horizontal space on narrow phones.
- **Approach**:
  - **Standard Carousels**: Scale poster widths fluidly across mobile breakpoints (`136px` at `320px`, `148px` at `380px+`, `164px` on `sm:`, and existing `180px`–`198px` on desktop) so 2 full posters plus a clear peek of the next card are always visible.
  - **Top 10 Carousel**: Scale the rank numeral (`text-4xl` / `text-5xl` on mobile up to `text-8xl` on desktop) and left padding so the poster remains the visual hero.
  - **Poster Cards**: Ensure the quick-watchlist corner button provides a generous mobile tap hitbox without colliding with the rating badge, and keep below-card titles (`line-clamp-1`) and year/genre metadata legible.
  - **Catalogue & Watchlist Grids**: Standardize on `grid-cols-2` for mobile phones, `sm:grid-cols-3` for tablets, and preserve `md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6` on desktop.

### D. Discover Page Mobile Filter Drawer / Collapsible Panel
- **Why**: Rendering all five filter dropdowns (Genre, Year, Language, Minimum Rating, Sort By) plus mood chips expanded at all times pushes actual search and discovery results far below the fold on mobile.
- **Approach**:
  - Above the fold on mobile, display: (1) compact header, (2) full-width search bar, (3) `All / Movies / TV` segmented selector and horizontal category strip, and (4) a **Filters** toggle bar showing the active filter count badge and a one-tap **Reset** action.
  - Collapse the detailed filter controls by default on mobile (`< md`) into an expandable glass panel arranged in a clean 2-column grid (`Genre`, `Year`, `Language`, `Min Rating`, `Sort By`), followed by Mood pills and an explicit **Apply / Done** and **Reset** footer.
  - Keep the filter bar permanently expanded on desktop (`md:block`) so the desktop experience is untouched.

### E. Search Overlay & Detail Modal Mobile Ergonomics
- **Why**: Fixed top padding (`pt-16`) on the search overlay wastes vertical space when the mobile virtual keyboard appears, and long button labels inside the Detail Modal can overflow narrow viewports.
- **Approach**:
  - **Search Overlay**: Anchor the modal near the top of the mobile viewport (`pt-2 sm:pt-24`) using dynamic viewport height (`max-h-[calc(100dvh-1rem)] sm:max-h-[80vh]`) so the input and scrollable results remain visible above the on-screen keyboard, paired with `44px` clear and close targets.
  - **Detail Modal**: Format as a near-full-screen mobile sheet (`max-h-[96dvh] sm:max-h-[92vh]`) with a compact mobile backdrop header (`h-44 sm:h-64`), `44px` floating Close and Share controls in the top-right safe zone, a properly proportioned mobile poster (`w-36 sm:w-56`), and full-width touch-friendly action buttons (`min-h-[44px]`) that wrap long labels cleanly.

### F. Watchlist & Profile Views Mobile Cleanup
- **Why**: Multi-item action headers, 5-status filter pills, and wide checklist tables can feel cramped on narrow screens.
- **Approach**:
  - **Watchlist View**: Arrange KPI summary cards in a balanced `grid-cols-2 sm:grid-cols-4` layout with compact mobile padding; organize the search bar, status filter chips (horizontally scrollable with snap on mobile), and format/sort selectors into clean stacked rows; ensure the Checklist Table view scrolls horizontally with smooth touch momentum and legible sticky/compact cells.
  - **Profile View**: Stack the user identity header, cloud sync status badge, and quick action buttons cleanly on mobile; keep the 4-card stats grid in a 2×2 mobile layout (`grid-cols-2 sm:grid-cols-4`); make taste-profile radar/bar cards, favourite genre chips, and account settings forms effortless to scan and tap on narrow screens.

---

## 4. Verification & Acceptance Criteria

1. **Responsive Viewport Audit**: Verify layout integrity, typography hierarchy, and zero horizontal overflow across `320px`, `360px`, `375px`, `390px`, `414px`, and `430px` widths, while confirming desktop (`1024px+`) remains visually unchanged.
2. **Touch Target & Safe-Area Compliance**: Confirm `44px` minimum hitboxes on primary mobile controls and proper `100dvh` / `env(safe-area-inset-*)` spacing on headers, bottom navigation, and modals.
3. **Zero Regressions**: Verify that deterministic TMDB search, franchise matching, OCR/list import, Supabase authentication/sync, and build/lint checks pass with zero errors.
