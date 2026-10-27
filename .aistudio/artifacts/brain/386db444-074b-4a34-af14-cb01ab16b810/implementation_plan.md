# CineMax Mobile Liquid Glass Navbar Responsive Layout Fix

This update resolves horizontal crowding and tab clipping in the mobile top navigation bar and its category sub-bar while preserving the existing dark cinematic aesthetic, amber/gold accents, desktop navigation layout, and Liquid Glass materials.

## User Review & Critical Decisions

> [!IMPORTANT]
> All requirements were clearly specified in your request, so no additional clarification questions are required before reviewing this plan:
> - **Desktop Layout Preservation**: The desktop (`md` and above) top navigation bar layout, spacing, and controls remain untouched.
> - **Mobile Sub-Bar Adaptive Behavior**: `All Titles`, `Movies`, and `Series` share available width proportionally (`flex-1 min-w-0`), while the `Size Tool` button collapses to an accessible icon-only control with tooltip on narrow screens (`< 390px`) and expands to show its full label when horizontal space permits.
> - **Animated Water-Bubble Active Indicator**: A dynamically measured Liquid Glass water-bubble pill indicator smoothly tracks the active category tab (`All Titles`, `Movies`, or `Series`) and recalculates geometry on tab switches and viewport resizes.

---

## 1. Overview & Core Concept

- **What It Does**: Eliminates horizontal clipping and control crowding in the mobile primary navbar row and the `All Titles / Movies / Series / Size Tool` sub-navigation bar across narrow mobile viewports (`320px`, `360px`, `390px`, `430px`).
- **Target Audience / Persona**: Mobile web and Capacitor Android users browsing CineMax across compact and standard phone screens.
- **Key Value**: Every navigation control and category tab (`All Titles`, `Movies`, `Series`, and `Size Tool`) remains completely visible, single-line, and comfortably tappable without horizontal page overflow or clipped text.

---

## 2. User Experience & Visual Design

- **Key User Flows**:
  1. **Mobile Primary Row Interaction**: Users on compact viewports (`320px–430px`) see the CineMax brand mark alongside the Search trigger, Quality & File Size shortcut, Surprise Me trigger, optional Admin trigger, Profile avatar, and Sign Out button cleanly contained inside the rounded Liquid Glass shell.
  2. **Mobile Category Switching (`All Titles` / `Movies` / `Series`)**: Tapping any of the three category tabs glides the translucent Liquid Glass water-bubble indicator to the selected tab while filtering the home catalog.
  3. **Adaptive Size Tool Access**: On ultra-narrow screens (`320px–389px`), tapping the compact hard-drive icon button opens the Quality & File Size Estimator modal (with accessible label and tooltip); on wider mobile screens (`390px+`), the `Size Tool` text label displays inline beside the icon.
- **Visual Identity & Theme**:
  - *Aesthetic Direction*: Dark cinematic interface with Apple-inspired translucent Liquid Glass floating bars and specular highlights.
  - *Color Palette & Mood*: Deep obsidian backgrounds (`#0A0D12`), translucent dark glass surfaces (`rgba(12, 16, 24, 0.72)`), crisp specular borders, and warm amber/gold (`#F59E0B`) active accents.
  - *Typography & Hierarchy*: Single-line `whitespace-nowrap` tab labels with responsive font sizing (`11px` at `320px` scaling to `12px` at `360px+`) so all three category names remain legible without truncation.
  - *Component Styling & Layout*: Proportional flex distribution (`flex-1 min-w-0`) for the three category tabs paired with a `shrink-0` adaptive `Size Tool` button inside the rounded bottom sub-bar shell.
- **Interactive Feedback & Motion**: Smooth cubic-bezier position and width transitions for the Liquid Glass water-bubble active tab indicator, synchronized with `ResizeObserver` and window resize events.

---

## 3. Key Product Decisions & Trade-Offs

- **Decision 1: Proportional Flex Sharing + Measured Water-Bubble Indicator for Category Tabs**
  - *Chosen Approach*: Place `All Titles`, `Movies`, and `Series` in a `flex-1 min-w-0` segmented track where each tab uses `flex-1 min-w-0 justify-center whitespace-nowrap`, backed by a `ResizeObserver`-driven sliding Liquid Glass water-bubble indicator.
  - *Why*: Guarantees all three labels fit side-by-side without horizontal scrolling or clipping on `320px–430px` screens, while keeping the animated water-bubble aligned to the exact DOM bounds of the active tab even after orientation or window size changes.
  - *Alternatives Considered*: Fixed-width tabs or horizontal scrolling containers were rejected because they clip the `Series` tab or hide navigation options off-screen.
- **Decision 2: Responsive Icon-Only Collapse for `Size Tool` & Decorative Tab Icons on Narrow Viewports**
  - *Chosen Approach*: Collapse the `Size Tool` text label to an icon-only button below `390px` (preserving `aria-label` and `title`), and hide secondary decorative icons inside `Movies`/`Series` tabs below `360px` so the text labels (`All Titles`, `Movies`, `Series`) always have breathing room.
  - *Why*: Preserves 100% of functionality and label readability at `320px` without shrinking text below legible sizes.
  - *Alternatives Considered*: Wrapping labels onto two lines or removing the `Size Tool` button was rejected to keep the sub-bar compact and preserve existing capabilities.

---

## 4. Technical Architecture & Data Strategy *(Technical Reference)*

- **Architecture & Component Diagram**:
```text
┌─────────────────────────────────────────────────────────────────────────┐
│             Sticky Inset Liquid Glass Header Shell                      │
│          (Max-Width 1440px, Safe-Area Top Inset, Rounded)               │
├─────────────────────────────────────────────────────────────────────────┤
│  Primary Row (Mobile Compact / Desktop Unchanged)                       │
│  ┌─────────────────────┐   ┌─────────────────────────────────────────┐  │
│  │ Brand Logo (shrink) │   │ Action Cluster (Search, Quality/Size,   │  │
│  │ Icon + "CineMax"    │   │ Surprise, Admin?, Profile, Sign Out)    │  │
│  └─────────────────────┘   └─────────────────────────────────────────┘  │
├─────────────────────────────────────────────────────────────────────────┤
│  Mobile Home Sub-Bar (All Titles / Movies / Series + Size Tool)         │
│  ┌───────────────────────────────────────────────────┐ ┌─────────────┐  │
│  │ Category Track (relative, flex-1, min-w-0)        │ │ Size Tool   │  │
│  │ ┌───────────────────────────────────────────────┐ │ │ (shrink-0)  │  │
│  │ │ Animated Liquid Glass Water-Bubble Indicator  │ │ │ Icon always │  │
│  │ │ (tracks active tab offsetLeft & offsetWidth)  │ │ │ Text >=390px│  │
│  │ └───────────────────────────────────────────────┘ │ └─────────────┘  │
│  │ [ All Titles (flex-1) | Movies (flex-1) | Series ]│                  │
│  └───────────────────────────────────────────────────┘                  │
└─────────────────────────────────────────────────────────────────────────┘
```

- **Data Model & State**:
  - `homeHubMode` (`'all' | 'movie' | 'tv'`): Existing parent state controlling the active category filter.
  - `bubbleStyle` (`{ left: number; width: number; opacity: number }`): Local measured geometry state for the mobile sub-bar water-bubble indicator, updated whenever `homeHubMode` changes or the tab container resizes.
- **Interactive Component & State Mapping**:
  - **Mobile Primary Row Controls**: Compact responsive hit targets (`32px–36px` on narrow mobile, full spacing on `sm`/`md+`) invoke existing handlers (`onOpenSearch`, `onOpenQualityModal`, `onSurpriseMe`, `onOpenAdmin`, `setActiveTab('profile')`, `onSignOut`) without horizontal overflow.
  - **Mobile Sub-Bar Category Track**: Clicking `All Titles`, `Movies`, or `Series` calls `setHomeHubMode(id)` and smoothly animates the water-bubble indicator (`translate3d(left, 0, 0)` and `width`) to the active button's measured box.
  - **Resize Synchronization**: A `ResizeObserver` attached to the mobile tab track and active tab buttons (plus `window.resize` listener) recalculates indicator coordinates immediately when switching between `320px`, `360px`, `390px`, `430px`, and desktop breakpoints.
