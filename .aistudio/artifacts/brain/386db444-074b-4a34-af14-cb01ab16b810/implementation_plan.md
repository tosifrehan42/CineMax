# CineMax Mobile Scroll Freeze Elimination Plan

This plan resolves the intermittent 1–2 second vertical scrolling freeze on mobile devices by eliminating mid-scroll synchronous React commit cascades, removing `content-visibility: auto` layout recalculations on horizontal carousels, replacing per-poster React load state transitions with browser-native painting, and switching mobile sticky chrome to solid GPU-friendly surfaces.

## User Review & Critical Decisions

> [!IMPORTANT]
> All three mobile scroll optimization decisions have been confirmed and incorporated into the architecture below:

- **Confirmed Decision 1 — Progressive Row Mounting**: Mount the top 4 Home catalogue rows immediately and progressively mount remaining below-the-fold rows in batches of 4 via a lightweight `IntersectionObserver` with generous root margin (`600px`), coupled with `React.startTransition` for secondary feed updates so background API responses never block an active touch scroll.
- **Confirmed Decision 2 — Mobile Sticky Navigation Surfaces**: Use solid high-opacity dark surfaces (`#0A0D12/98`) on mobile for the sticky top header and fixed bottom navigation bar, preserving `backdrop-blur-xl` exclusively on desktop (`md:backdrop-blur-xl`) to prevent dual-edge GPU compositor tile thrashing during 60–120Hz touch scrolling.
- **Confirmed Decision 3 — Instant Native Poster Painting**: Remove per-card `isPosterLoaded` React state updates and opacity fade transitions on poster load so lazy-decoded images paint natively on the browser compositor thread without triggering 15–30 React re-renders mid-scroll.

---

## 1. Overview & Core Concept

- **What It Does**: Eliminates the 1–2 second main-thread and GPU compositor stalls that occur on mobile (especially Android Chrome) during vertical scrolling across the Home and Discover feeds while preserving all existing CineMax features, visual hierarchy, and touch interactions.
- **Root Causes Identified During Audit**:
  1. **Mid-Scroll Synchronous React Commit Cascade**: Approximately 1–2 seconds after initial load—right as a mobile user begins scrolling vertically—9 secondary TMDB category requests resolve simultaneously. Their resolution calls both `onRegisterMedia` (rebuilding the global `knownMedia` array and triggering `HomeView` to re-score/re-filter 250+ items) and `setOttRows` (replacing 9 fallback rows with ~130 new TMDB `MediaCard` items in a single synchronous React commit that unmounts ~130 old card subtrees and mounts ~130 new ones on the main thread).
  2. **`content-visibility: auto` Layout Thrashing on Nested Horizontal Scrollers**: Every horizontal carousel row previously used `content-visibility: auto` with a fixed `contain-intrinsic-size: auto 340px`. On mobile Chrome, when horizontal `overflow-x: auto; scroll-snap-type: x mandatory` containers cross the viewport boundary during a vertical fling, the browser synchronously unskips the subtree, calculates scroll-snap geometry for 14 cards, and adjusts scroll anchoring whenever the real row height differs from `340px`.
  3. **Per-Poster `onLoad` React State Storm**: Every `MediaPoster` previously maintained `isPosterLoaded` React state and a `useEffect` reset. Scrolling quickly through rows caused 20+ lazy images to finish decoding within a narrow window, firing 20+ separate React state updates and CSS opacity transitions during active touch scrolling.
  4. **Dual Full-Width Mobile `backdrop-blur-xl` Compositor Load & Offscreen Hero Timer**: Both the top sticky header and bottom fixed navigation bar applied a 24px `backdrop-blur-xl` filter on mobile, forcing the mobile GPU to sample and blur both viewport edges on every frame, while the Hero Spotlight 8-second interval continued swapping high-resolution backdrops even when scrolled completely offscreen.
- **Target Audience / Persona**: Mobile and desktop OTT viewers browsing long multi-row catalogues, swiping horizontal carousels, and filtering titles on 60Hz–120Hz touchscreens.
- **Key Value**: Uninterrupted, native-feeling vertical and horizontal touch scrolling on Android and iOS without 1–2 second freezes, layout jumps, or delayed taps.

---

## 2. User Experience & Visual Design

- **Key User Flows**:
  - **Initial Load & Immediate Vertical Scroll**: The Hero Spotlight and top 4 catalogue rows render immediately. As the user scrolls down, a lightweight sentinel (`600px` ahead of the viewport) smoothly mounts the next batch of 4 rows before the user reaches them, with zero blank flashes or scroll jumps.
  - **Background Feed Hydration Without Stalls**: When secondary TMDB feeds finish loading in the background, updates are wrapped in low-priority `React.startTransition` and batched cleanly so active touch gestures always take priority over React rendering.
  - **Pause Offscreen Hero Rotation**: When the user scrolls past the Hero Spotlight, its 8-second auto-advance timer automatically pauses via an `IntersectionObserver` and resumes only when scrolled back into view.
- **Visual Identity & Theme**:
  - *Aesthetic Direction*: Preserves the existing **Atmospheric Dark OTT Cinema** aesthetic without any visual redesign.
  - *Color Palette & Mood*: Deep obsidian canvas (`#0A0D12`), elevated slate card surfaces (`#121721`), warm cinema gold accents (`#F59E0B`), and crisp alabaster typography (`#F8FAFC`).
  - *Typography & Hierarchy*: Preserves `Plus Jakarta Sans` display headings, `Inter` body copy, and `JetBrains Mono` (`tabular-nums`) for ratings, years, and episode counters.
  - *Component Styling & Layout*: Retains the 1440px desktop container, 2:3 portrait poster aspect ratios (`aspect-[2/3]`), and horizontal `touch-pan-x` carousels while removing `.cv-auto` scroll-snap containment conflicts.
- **Interactive Feedback & Motion**:
  - Instant browser-native image painting with zero layout shift (`aspect-[2/3]` and explicit `width`/`height` attributes).
  - Lightweight solid dark surfaces on mobile (`bg-[#0A0D12]/95`) for sticky navigation and fallback backdrops, reserving expensive blur filters (`md:backdrop-blur-xl`, `md:blur-xl`) for desktop GPUs.

---

## 3. Key Product Decisions & Trade-Offs

- **Decision 1: Progressive Row Batching (4 Rows at a Time) + `React.startTransition`**
  - *Chosen Approach*: Mount the first 4 Home catalogue rows initially and reveal additional batches of 4 rows as the user scrolls within `600px` of the bottom sentinel, while wrapping background TMDB state hydration in `React.startTransition`.
  - *Why*: Bounds the initial DOM size to ~55 movie cards instead of ~210+, and prevents the Phase 2 TMDB response from locking the main thread for 1–2 seconds when it arrives mid-scroll.
  - *Alternatives Considered*: `content-visibility: auto` on every carousel row was removed because browser engines struggle with intrinsic size estimation and synchronous layer creation on nested horizontal `scroll-snap` containers during fast vertical flings.
- **Decision 2: Browser-Native Poster Painting Without Per-Card React State**
  - *Chosen Approach*: Render `<img loading="lazy" decoding="async" />` directly over the lightweight dark placeholder gradient without firing `setIsPosterLoaded(true)` on every image load; use React state only when an image actually errors (`hasError`).
  - *Why*: Eliminates hundreds of React state updates and style recalculations as images decode during vertical and horizontal scrolling.
  - *Alternatives Considered*: Keeping per-card `onLoad` state transitions causes main-thread micro-tasks on every decoded poster image during fast scrolling.
- **Decision 3: Solid Mobile Sticky Bars & Desktop-Only Scroll Button Listeners**
  - *Chosen Approach*: Replace `backdrop-blur-xl` on mobile sticky header and bottom nav with solid `#0A0D12/95` (`md:backdrop-blur-xl` on desktop), and attach horizontal carousel scroll-button listeners only when desktop arrow buttons are visible (`>= 768px`).
  - *Why*: Mobile users swipe carousels directly by touch and never see the desktop `<` / `>` arrow buttons (`hidden md:flex`), so running `scroll` and `window.resize` listeners across 15 rows on mobile wastes main-thread and rAF cycles.

---

## 4. Technical Architecture & Data Strategy *(Technical Reference)*

### Architecture & Component Diagram

```
┌────────────────────────────────────────────────────────────────────────────┐
│                        App State & Media Registry                          │
│  • Deduped knownMedia registry (skips no-op state updates if IDs exist)    │
│  • Stable memoized callbacks (onToggleWatchlist, onSelectMedia, etc.)      │
└─────────────────────────────────────┬──────────────────────────────────────┘
                                      │
        ┌─────────────────────────────┴─────────────────────────────┐
        ▼                                                           ▼
┌───────────────────────────────────────┐   ┌────────────────────────────────┐
│       Navbar (Mobile & Desktop)       │   │     HomeView & DiscoverView    │
│ • Mobile: Solid bg-[#0A0D12]/95       │   │ • Phase 1 Priority Feed        │
│ • Desktop: md:backdrop-blur-xl        │   │ • Phase 2 wrapped in           │
│ • Zero scroll listeners               │   │   React.startTransition()      │
└───────────────────────────────────────┘   └───────────────┬────────────────┘
                                                            │
                ┌───────────────────────────────────────────┴──────────┐
                ▼                                                      ▼
┌───────────────────────────────────────┐   ┌────────────────────────────────┐
│            HeroSpotlight              │   │  Progressive Row Batcher (4x)  │
│ • IntersectionObserver pauses 8s      │   │ • Single IntersectionObserver  │
│   auto-rotation when scrolled away    │   │   (rootMargin: 600px)          │
│ • Eager priority hero image           │   │ • Mounts 4 rows per step       │
└───────────────────────────────────────┘   └───────────────┬────────────────┘
                                                            │
                                                            ▼
                                            ┌────────────────────────────────┐
                                            │        MediaCarouselRow        │
                                            │ • Native touch-pan-x scroller  │
                                            │ • No content-visibility stall  │
                                            │ • Desktop-only scroll listener │
                                            └───────────────┬────────────────┘
                                                            │
                                                            ▼
                                            ┌────────────────────────────────┐
                                            │    MediaCard & MediaPoster     │
                                            │ • Strict React.memo props      │
                                            │ • Native lazy img decode       │
                                            │ • Zero onLoad React setState   │
                                            └────────────────────────────────┘
```

### Data Model & State

- **Progressive Row Count (`visibleRowCount`)**: Local numeric state in `HomeView` initialized to `4` and incremented by `4` (up to total rows) when the bottom sentinel intersects a `600px` vertical lookahead margin.
- **Low-Priority Feed Hydration (`startTransition`)**: Secondary TMDB catalogue responses update `ottRows` inside `React.startTransition` so React yields to incoming touch/scroll frames on mobile devices.
- **Deduplicated Media Registration (`handleRegisterMedia`)**: Only schedules a `knownMedia` state update when genuinely new items or newly enriched episode counts are discovered, avoiding redundant root `App` re-renders when Home or Discover sees already-registered titles.

### Interactive Component & State Mapping

- **Hero Spotlight Offscreen Pause**: A single `IntersectionObserver` on the `HeroSpotlight` root container sets `isInViewport`. The 8-second rotation interval runs only when `isInViewport && !isPaused`, preventing offscreen backdrop decoding while scrolling down the page.
- **Horizontal Carousel Scroll Tracking**: `MediaCarouselRow` checks `window.matchMedia('(min-width: 768px)')` before attaching `scroll` and `resize` listeners for the desktop-only `<` / `>` chevron buttons, eliminating 15 redundant `resize` and `scroll` listeners on mobile devices.
- **Poster Fallback & Native Painting**: `MediaPoster` renders the `<img>` element with `loading={priority ? 'eager' : 'lazy'}` and `decoding="async"` without an `onLoad` state toggle. On mobile, wide backdrop fallbacks use a lightweight gradient instead of a `blur-xl` (`24px` CSS blur) filter.
