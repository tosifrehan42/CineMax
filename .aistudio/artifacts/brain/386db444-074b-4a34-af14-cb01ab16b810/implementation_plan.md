# CineMax — Premium Cinematic Motion & Interaction System

## 1. Architectural Vision & Design Direction

### Aesthetic & Motion Philosophy
CineMax will be upgraded with a unified, studio-grade motion system inspired by luxury streaming platforms and flagship automotive digital interfaces. Every animation is engineered to feel tactile, weighted, and restrained:
- **Visual Identity Preserved**: Deep obsidian/charcoal surfaces (`#0A0D12`), warm amber and gold luminescence (`#F59E0B`), multi-layered liquid-glass panels, and `Plus Jakarta Sans` editorial typography remain untouched.
- **Physics & Timing Discipline**: All motion is driven through the installed `motion/react` library using a shared set of harmonic easing curves (`cubic-bezier(0.16, 1, 0.3, 1)` for entrances, `cubic-bezier(0.4, 0, 1, 1)` for exits) and critically damped spring presets (`stiffness: 380, damping: 32` for interactive controls; `stiffness: 280, damping: 28` for overlays and layout indicators).
- **Compositor-Only Execution**: Animations strictly target `transform` (`translate3d`, `scale`, `rotateX`, `rotateY`) and `opacity` to maintain 60fps/120fps fluidity without layout thrashing or permanent `will-change` memory overhead.

---

## 2. Visual System & Motion Architecture

```
+-----------------------------------------------------------------------------------+
|                        GLOBAL CINEMATIC MOTION ENGINE                             |
|  - Easing Curves: Expo Out [0.16, 1, 0.3, 1] | Clean Exit [0.4, 0, 1, 1]          |
|  - Damped Springs: Snappy Control | Gentle Surface | Modal Panel | Liquid Bubble  |
|  - Capability Guard: prefers-reduced-motion + Desktop Fine-Pointer Detection      |
+-----------------------------------------+-----------------------------------------+
                                          |
        +---------------------------------+---------------------------------+
        |                                 |                                 |
        v                                 v                                 v
+-----------------------+     +-----------------------+     +-----------------------+
|   VIEWPORT & HERO     |     |   INTERACTIVE CARDS   |     |  OVERLAYS & MODALS    |
|   ORCHESTRATION       |     |   & NAVIGATION        |     |  (AnimatePresence)    |
+-----------------------+     +-----------------------+     +-----------------------+
| - Hero Crossfade +    |     | - Desktop 3D Pointer  |     | - Backdrop Fade +     |
|   Subtle 1.03->1.0    |     |   Tilt (±3.5 deg)     |     |   Panel Scale/Lift    |
|   Initial Scale       |     | - Hover Elevation +   |     | - Detail, Trailer,    |
| - Staggered Metadata  |     |   Amber Border Glow   |     |   Player, Auth,       |
|   & CTA Entrance      |     | - Bounded Staggered   |     |   Surprise, Import,   |
| - Page/Tab Crossfade  |     |   Grid/Row Reveal     |     |   Franchise, Crop     |
| - Once-Only Scroll    |     | - Liquid-Glass Tab    |     | - Search Focus Glow   |
|   Section Reveals     |     |   Indicator Gliding   |     |   & Result Stagger    |
+-----------------------+     +-----------------------+     +-----------------------+
```

---

## 3. Core Experience Upgrades

### 3.1 Global Motion System (`motion/react`)
- **Centralized Motion Primitives**: Reusable variants for `fadeUp`, `fadeDown`, `fadeIn`, `scaleReveal`, `staggerContainer`, `staggerItem`, `modalBackdrop`, `modalPanel`, `popoverMenu`, and `pageViewTransition`.
- **Capability & Accessibility Hook**: A dedicated hook combines `useReducedMotion()` from `motion/react` with `(hover: hover) and (pointer: fine)` media query detection. When reduced motion is active, spatial translations and 3D tilts automatically collapse into instantaneous or ultra-short opacity crossfades.

### 3.2 Hero Spotlight Experience
- **Backdrop Transition**: When the featured title changes (auto-advance or manual selection), `AnimatePresence` orchestrates a smooth crossfade paired with a subtle initial settle from `scale(1.03)` to `scale(1.0)` over `0.85s`—never looping continuously.
- **Editorial Stagger**: The taxonomy badge, title, metadata pills, synopsis, and primary/secondary action buttons reveal in a choreographed upward cascade (`45ms` stagger step) with soft amber ambient illumination on the primary CTA.

### 3.3 Movie & TV Poster Cards
- **Restrained Hover & Desktop 3D Tilt**: On desktop fine-pointer devices, cards respond to cursor movement with a damped 3D perspective tilt (capped at `±3.5°` on X/Y axes) alongside a `-4px` vertical lift and `1.015` scale. Touch and mobile devices automatically bypass tilt and hover-only states.
- **Surface & Action Polish**: Hovering illuminates the card border with a warm amber specular rim, gently zooms the poster artwork (`1.04x`), and reveals metadata/quick-action controls.
- **Tactile Watchlist Popover**: The watchlist status menu (`Want to Watch`, `Watched`) opens and closes via `AnimatePresence` with a crisp spring scale-and-fade from its trigger anchor, accompanied by tactile button press compression (`scale: 0.95`).
- **Bounded Viewport Entrances**: Poster grids and horizontal carousels animate newly visible cards once on scroll entry with a capped stagger index (`Math.min(index, 10) * 35ms`) so pagination or filtering never introduces cumulative latency.

### 3.4 Navigation, Tabs & View Switching
- **Liquid-Glass Navigation**: Desktop top navigation, hub mode switchers (`Movies & TV`, `Anime`, `Asian Dramas`), and mobile bottom navigation bars glide smoothly between active states with synchronized icon/label luminance and tactile tap feedback.
- **Page & View Transitions**: Switching between `Home`, `Discover`, `Watchlist`, `Runtime Calculator`, `Profile`, and `Admin` uses a short (`200ms`), non-blocking `AnimatePresence` fade-and-lift transition that preserves `React.lazy` / `Suspense` boundaries and scroll/application state.

### 3.5 Modals, Overlays & Search Interactions
- **Unified Modal Choreography**: All modals (`DetailModal`, `SearchOverlay`, `AuthModal`, `TrailerModal`, `OnlinePlayerModal`, `ImportCompletedModal`, `SurpriseMeModal`, `ChangePasswordModal`, `FranchiseModal`, and `AvatarCropModal`) animate both entrance and exit with a synchronized backdrop fade and panel spring reveal (`opacity: 0 -> 1`, `scale: 0.96 -> 1`, `y: 12 -> 0`), while preserving `Escape` key handling and focus restoration.
- **Search Overlay Polish**: Opening the search overlay smoothly focuses the input with an animated amber focus ring, transitions loading states cleanly, and staggers incoming search results without altering any TMDB query expansion, franchise matching, or deterministic ranking logic.

### 3.6 Scroll Reveals, Liquid Glass & Micro-Interactions
- **Scroll-Triggered Section Reveals**: Section headers, horizontal carousels, discovery grids, watchlist sections, and profile analytics reveal once as they enter the viewport (`viewport={{ once: true, margin: "-40px" }}`).
- **Liquid Glass & CSS Refinement**: Specular highlights, active amber glows, and glass border transitions are refined while removing permanent `will-change: transform, width` declarations that waste GPU memory at rest.
- **Micro-Interactions**: All buttons, icon triggers, filter pills, checkboxes, and notification banners (`OfflineStatusBanner`) respond within `150–180ms` with subtle press scaling and luminous focus/hover states.

---

## 4. Key Trade-Offs & Technical Safeguards

- **Bounded Stagger vs. Full-Grid Stagger**: Rather than staggering 40+ cards sequentially on large screens (which makes bottom rows feel sluggish), stagger delays are capped at the first 10 items per batch (`max 350ms` offset) and run once per viewport entry.
- **Desktop-Only 3D Tilt**: 3D pointer tilt uses `motionValue` springs updated via pointer events only on `(hover: hover) and (pointer: fine)` viewports, ensuring zero main-thread overhead or sticky hover artifacts on mobile/tablet touchscreens.
- **Zero Functional Mutation**: All deterministic title matching, TMDB fetching, OCR import pipelines, watchlist persistence, and Supabase authentication flows remain 100% untouched.
