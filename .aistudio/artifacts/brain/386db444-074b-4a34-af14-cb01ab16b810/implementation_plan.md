# Animated Liquid Glass Water Bubble for Tab Navigation

This update introduces a reusable, spring-physics **Liquid Glass Water Bubble** active-tab indicator that smoothly glides, stretches horizontally in flight, and settles with a gentle squish across CineMax's navigation bars and segmented tab selectors while preserving the dark cinematic identity and amber/gold palette.

## User Review & Critical Decisions

> [!IMPORTANT]
> Your requirements specify all target surfaces, spring physics, and optical material properties in detail:
> - **Single Shared Indicator Per Tab Group**: Each navigation bar or segmented control renders one shared floating water-bubble element behind the tab buttons (`z-0`), preventing duplicate bubbles during rapid tab switching.
> - **Spring + Velocity Stretch & Squish Physics**: Powered by `motion/react` motion values and velocity-linked scale transforms (`scaleX` / `scaleY`), the bubble stretches subtly along its horizontal travel vector and settles smoothly on arrival.
> - **Consistent Coverage Across Navigation & Segmented Controls**: Applied to Desktop primary navigation, Mobile floating bottom navigation, Mobile `All Titles / Movies / Series` segmented sub-bar, Auth (`Sign In / Sign Up`) segmented switchers, Discover format/category tabs, and Watchlist status/view/type segmented selectors.

---

## 1. Overview & Core Concept

- **What It Does**: Replaces static active-tab backgrounds and underlines with a unified, physically animated Liquid Glass water bubble that travels from the previously selected tab to the newly selected tab.
- **Target Audience / Persona**: CineMax users navigating across desktop and mobile web or the Capacitor Android app who expect fluid, tactile, Apple-inspired spatial feedback.
- **Key Value**: Provides immediate visual continuity when switching tabs, accurately adapting to variable tab widths, responsive breakpoints, and rapid consecutive taps without layout shifts or frame drops.

---

## 2. User Experience & Visual Design

- **Key User Flows**:
  1. **Initial Mount**: When any navigation bar or segmented control loads, the water bubble measures the active tab's exact DOM bounds and positions itself immediately under the selected tab without an initial fly-in animation.
  2. **Tab Selection & Mid-Air Retargeting**: Selecting a new tab animates the bubble's horizontal offset and width using a tuned spring. While moving, horizontal velocity induces a subtle liquid stretch (`scaleX` expansion paired with slight `scaleY` compression) followed by a gentle settling squish as the bubble comes to rest. Rapidly tapping multiple tabs smoothly retargets the single bubble in mid-flight.
  3. **Responsive Resize & Safe-Area Adaptation**: Resizing the browser window, rotating a mobile device, or changing responsive label visibility (`Size Tool` collapse or mobile breakpoint shifts) triggers a `ResizeObserver` update that snaps the bubble to the updated tab geometry without lag.
- **Visual Identity & Theme**:
  - *Aesthetic Direction*: Dark cinematic obsidian surfaces (`#0A0D12`) paired with optical Liquid Glass refraction, specular top rims, and warm amber/gold caustics (`#F59E0B`).
  - *Color Palette & Mood*:
    - **Amber-Glass Bubble Variant**: Translucent amber-gold liquid body with a crisp white specular top rim and inner surface sheen for high-emphasis segmented controls (`All Titles / Movies / Series`, Auth mode tabs, Discover format toggle, Watchlist status tabs) where active text is dark (`#090A0F`) or high-contrast white.
    - **Obsidian-Amber Glass Pill Variant**: Translucent refractive glass body with a warm amber inner glow, specular edge highlight, and luminous bottom caustic accent for Desktop primary navigation tabs and Mobile floating bottom navigation tabs where active text and icons remain bright white/amber.
  - *Typography & Hierarchy*: All tab icons, labels, and numeric badges sit at `z-10` above the `z-0` water bubble so text remains crisp and readable at all times.
- **Interactive Feedback & Motion**:
  - Spring parameters tuned for responsive, non-sluggish motion (`stiffness: 400`, `damping: 30`, `mass: 0.68`).
  - Users with `prefers-reduced-motion: reduce` enabled receive instant position/width updates without spring oscillation or elastic deformation.

---

## 3. Key Product Decisions & Trade-Offs

- **Decision 1: Measured DOM Geometry + `motion/react` Spring Velocity Deformation**
  - *Chosen Approach*: Build a reusable hook and indicator component that measures each tab button's `offsetLeft` and `offsetWidth` within its relative track container, drives `x` and `width` via `useSpring`, and derives `scaleX` / `scaleY` from the instantaneous horizontal velocity (`useVelocity`).
  - *Why*: Unlike separate per-tab `layoutId` clones that can leave ghost duplicates during rapid state changes or scroll containers, a single persistent DOM node per tab group guarantees zero duplicate bubbles, zero layout shift, and hardware-accelerated `transform` animations on Android WebView.
  - *Alternatives Considered*: Pure CSS transitions cannot dynamically stretch and squish based on travel velocity, and per-tab conditional `layoutId` elements can flicker when tabs conditionally mount/unmount.
- **Decision 2: Instant Geometry Sync on Resize vs. Animated Spring on Tab Change**
  - *Chosen Approach*: Distinguish between user-initiated tab changes (which animate via spring + liquid stretch) and environmental layout changes (`ResizeObserver`, `window.resize`, initial mount, or font loading, which call `.jump()` on the motion values).
  - *Why*: Ensures the bubble never lags behind its tab when resizing the viewport between `320px`, `360px`, `390px`, `430px`, and Desktop widths.

---

## 4. Technical Architecture & Data Strategy *(Technical Reference)*

- **Architecture & Component Diagram**:
```text
┌─────────────────────────────────────────────────────────────────────────┐
│                Reusable Liquid Glass Water Bubble System                │
│  ┌───────────────────────────────────────────────────────────────────┐  │
│  │ useLiquidTabBubble(activeKey, deps)                               │  │
│  │  • Stores containerRef & tabRefs map                              │  │
│  │  • Measures active tab offsetLeft & offsetWidth                   │  │
│  │  • Initial mount & ResizeObserver -> motionValue.jump()           │  │
│  │  • Active tab change -> spring animate(x, width) + velocity       │  │
│  │    driven scaleX (1 -> 1.07 -> 0.985 -> 1) & scaleY deformation   │  │
│  └─────────────────────────────────┬─────────────────────────────────┘  │
│                                    ▼                                    │
│  ┌───────────────────────────────────────────────────────────────────┐  │
│  │ <LiquidTabBubble /> (Single persistent aria-hidden layer, z-0)    │  │
│  │  • Optical backdrop blur + specular rim + inner caustic sheen     │  │
│  │  • Variants: 'nav-pill' | 'amber-pill' | 'subtle-glass'           │  │
│  └─────────────────────────────────┬─────────────────────────────────┘  │
└────────────────────────────────────┼────────────────────────────────────┘
                                     │
        ┌────────────────────────────┼────────────────────────────┐
        ▼                            ▼                            ▼
┌───────────────────┐      ┌───────────────────┐      ┌───────────────────┐
│   Navbar Shell    │      │  Auth Switchers   │      │ Catalogue & Lists │
│ • Desktop Top Nav │      │ • AuthScreen Tabs │      │ • Discover Format │
│ • Mobile Sub-Bar  │      │ • AuthModal Tabs  │      │   & Category Tabs │
│ • Mobile Bottom   │      │                   │      │ • Watchlist View, │
│   Floating Bar    │      │                   │      │   Status & Type   │
└───────────────────┘      └───────────────────┘      └───────────────────┘
```

- **Data Model & State**:
  - `activeKey`: Identifier of the currently selected tab within a group (e.g., `'home-all'`, `'movies'`, `'discover'`, `'signin'`).
  - `xSpring`, `widthSpring`: `motion/react` spring motion values tracking the active tab's horizontal offset and width.
  - `scaleX`, `scaleY`: Velocity-coupled transforms that stretch the bubble horizontally during high-speed travel and settle with a subtle squish on arrival.
- **Interactive Component & State Mapping**:
  - **Desktop Primary Navbar**: Clicking `Home`, `Movies`, `Series`, `Discover`, `Watchlist`, `Quality & File Size`, or `Admin` glides the translucent obsidian-amber water bubble across the desktop nav bar while keeping the active bottom caustic glow and badge counts crisp.
  - **Mobile Sub-Bar (`All Titles / Movies / Series`)**: Tapping any category tab glides the amber-glass water bubble smoothly across the proportional flex track while coexisting with the adaptive `Size Tool` button.
  - **Mobile Floating Bottom Navbar (`Home / Discover / Watchlist / Profile`)**: Tapping any bottom tab glides a full-height inset Liquid Glass water-bubble pill between the 4 columns.
  - **Auth, Discover & Watchlist Segmented Controls**: Switching between `Sign In / Sign Up`, Discover `Format` / `Category` presets, or Watchlist `Status`, `Media Type`, and `View Mode` tabs animates the shared water bubble across the segmented track.
