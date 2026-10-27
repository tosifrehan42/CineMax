# CineMax — Subtle Liquid Glass Visual Enhancement Plan

## 1. App Identity & Design Direction
- **Core Aesthetic Philosophy**: Enhance CineMax's existing dark obsidian and warm amber cinema aesthetic with a refined, physically grounded **Liquid Glass** material layer—adding subtle depth, translucent refraction, and crisp top-edge specular highlights to floating UI surfaces while leaving movie artwork, typography, layout structure, and brand colors untouched.
- **Color & Atmospheric Polarity**:
  - **Primary Canvas & Backdrop**: Preserved deep cinema obsidian (`#0A0D12` and `#090A0F`).
  - **Liquid Glass Navigation Surface**: Translucent obsidian (`rgba(10, 13, 18, 0.72)`) with `backdrop-filter: blur(16px) saturate(140%)`, paired with a `rgba(255, 255, 255, 0.09)` border and a top specular highlight (`inset 0 1px 0 0 rgba(255, 255, 255, 0.08)`).
  - **Liquid Glass Elevated Dialog & Panel Surface**: Deep translucent slate (`rgba(13, 16, 24, 0.78)`) with `backdrop-filter: blur(20px) saturate(135%)`, hairline edge (`rgba(255, 255, 255, 0.10)`), inner specular top highlight (`inset 0 1px 0 0 rgba(255, 255, 255, 0.12)`), and layered ambient elevation shadow.
  - **Liquid Glass Secondary Surface & Floating Controls**: Subtle smoked glass (`rgba(15, 19, 29, 0.65)` for cards/bars; `rgba(255, 255, 255, 0.045)` for interactive chips, search triggers, and segmented controls) with crisp inner edge highlights and smooth hover transitions (`rgba(255, 255, 255, 0.085)`).
  - **Brand Accents (Unchanged)**: Primary interactive amber (`#F59E0B` to `#D97706`) buttons, active indicators, and IMDb/TMDB rating badges remain crisp and recognizable in their existing brand colors.
- **Typography & Scannability**: Preserve `Outfit` for display headers, `Plus Jakarta Sans` for readable body copy and controls, and `JetBrains Mono` for metadata, runtime, and release years. Ensure high-contrast text legibility over all translucent surfaces.

---

## 2. Core User Flows
1. **Pre-Home Sign In / Sign Up Gate**:
   - Users opening CineMax encounter the full-screen authentication gate featuring a Liquid Glass card with a subtle specular top edge, a recessed Liquid Glass segmented tab selector (`Sign In` / `Create Account`), and translucent glass input fields that illuminate with a warm amber focus ring.
2. **Sticky Desktop Navigation & Mobile Bottom Bar**:
   - As users scroll through hero banners and movie rows, the sticky desktop header and mobile bottom navigation bar softly refract underlying ambient colors without reducing label or icon contrast, while respecting Android and iOS bottom safe-area insets.
3. **Interactive Discovery, Filtering & Search**:
   - Clicking the search trigger opens the Liquid Glass search overlay with a frosted header bar, translucent filter chips (`All`, `Movies`, `TV Series`), and crisp poster thumbnails.
   - On the Discover and Watchlist views, floating filter bars, genre pills, sort selectors, and segmented tabs use unified Liquid Glass control treatments while keeping movie poster grids completely sharp and unblurred.
4. **Cinematic Detail, Trailer & Player Modals**:
   - Opening a movie or TV series detail modal, trailer overlay, or player dialog presents an elevated Liquid Glass sheet with a subtle inner highlight and floating glass action controls (`Watchlist`, `Watched`, `Share`, season selectors, and close buttons), keeping backdrop art and episode lists crisp.

---

## 3. Key Features & Scope
- **Reusable Liquid Glass Styling System**:
  - Define a centralized, composable suite of utility classes in the global stylesheet for navigation bars, elevated modal panels, secondary floating surfaces, interactive glass controls, and segmented tab tracks.
  - Provide automatic `@supports not ((backdrop-filter: blur(1px)) or (-webkit-backdrop-filter: blur(1px)))` solid dark fallbacks so older browsers and restricted WebViews remain high-contrast and legible.
  - Respect `@media (prefers-reduced-motion: reduce)` and cap blur radii on mobile viewports to maintain smooth 60fps scrolling in the Capacitor Android WebView.
- **Selective Component Enhancements**:
  - **Navigation**: Sticky desktop header, search trigger button, user avatar pill, and mobile bottom navigation bar (with safe-area padding).
  - **Authentication**: Pre-home authentication card, segmented mode switcher, and secondary modal dialog.
  - **Overlays & Modals**: Search overlay panel and input bar, Movie/TV detail modal container and floating action pills, Trailer modal frame, Online Player modal header/controls, and Surprise Me modal card.
  - **Views & Floating Controls**: Hero secondary action controls, category/genre filter chips, Discover filter bar, Watchlist status tabs/menus, and Profile account summary cards.
- **Strict Non-Interference Boundaries**:
  - Zero blur or glass overlays covering movie posters, hero backdrop artwork, tables, or dense text blocks.
  - Primary amber CTA buttons keep their solid brand styling.
  - Existing routes, Supabase authentication, TMDB API integration, GitHub Pages `/CineMax/` build configuration, and Android `/` root path configuration remain completely intact.

---

## 4. Technical Architecture & Data Strategy

```
+-----------------------------------------------------------------------+
|                   Shared Liquid Glass Design Tokens                   |
|  - Navigation Glass   : blur(16px) saturate(140%) + specular border   |
|  - Elevated Panel     : blur(20px) saturate(135%) + inner highlight   |
|  - Secondary Surface  : blur(12px) saturate(125%) + hairline edge     |
|  - Interactive Control: translucent fill + top inset highlight        |
|  - Fallback & Mobile  : @supports solid fallback + mobile blur cap    |
+-----------------------------------+-----------------------------------+
                                    |
        +---------------------------+---------------------------+
        |                           |                           |
        v                           v                           v
+-------------------+     +-------------------+     +-------------------+
| Navigation & Auth |     | Dialogs & Modals  |     | Floating Controls |
| - Desktop Navbar  |     | - Search Overlay  |     | - Hero Controls   |
| - Mobile Nav Bar  |     | - Detail Modal    |     | - Discover Chips  |
| - Pre-Home Auth   |     | - Trailer/Player  |     | - Watchlist Tabs  |
| - Auth Modal      |     | - Surprise Modal  |     | - Profile Cards   |
+-------------------+     +-------------------+     +-------------------+
```

- **Performance & Android WebView Optimization**:
  - Apply `backdrop-filter` strictly to fixed, sticky, or modal container layers and standalone control bars—never to repeating movie poster cards inside horizontal carousels or large grids—preventing GPU overdraw on Android devices.
  - Include `-webkit-backdrop-filter` alongside `backdrop-filter` for full cross-browser and WebView compatibility.
- **Build & Deployment Verification**:
  - Run static type/lint checks, build the GitHub Pages production bundle (`/CineMax/`), and build/sync the Android Capacitor web bundle (`/`) to confirm both targets compile cleanly without regressions.
