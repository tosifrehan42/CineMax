# CineMax — Custom Android Launcher Icon & Pre-Home Authentication Gate

This update replaces the default Capacitor launcher icon with a custom dark-obsidian and golden **"CM" monogram** Android app icon across all density buckets and adaptive icon layers, and introduces a full-screen **Sign In / Sign Up authentication gate** powered by the existing Supabase Auth client before users enter the CineMax home experience.

## User Review & Critical Decisions

> [!IMPORTANT]
> The following product and design choices have been confirmed and govern the implementation:

- **Confirmed Decision 1 — Android Launcher Icon Motif**: Bold golden **"CM" monogram** with a subtle cinema spotlight glow set against CineMax's deep obsidian background (`#0A0D12`), keeping the website's existing header emblem unchanged.
- **Confirmed Decision 2 — Post-Sign-Up Email Confirmation Flow**: When Supabase requires email verification before issuing an active session, display a clear verification banner and automatically switch the authentication gate to the **Sign In** tab with the user's email address pre-filled.
- **Confirmed Decision 3 — Session Persistence & Route Protection**: Reuse the single existing Supabase client (`persistSession: true`, `autoRefreshToken: true`) and gate all primary views (`home`, `discover`, `watchlist`, `estimator`, `profile`, `admin`) behind an active authenticated session so direct URL navigation cannot bypass login.

---

## 1. Overview & Core Concept

- **What It Does**:
  1. **Custom Android App Icon**: Gives the installed `CineMax` Android application (`in.vertexstudios.cinemax`) a recognizable, cinema-grade launcher icon across both legacy density mipmaps (`mdpi` through `xxxhdpi`) and Android 8.0+ adaptive icon foreground/background layers (`mipmap-anydpi-v26`).
  2. **Mandatory Pre-Home Authentication Gate**: Presents a responsive, full-screen Sign In / Sign Up experience when the app opens without an active session, while immediately restoring the authenticated Home screen on subsequent launches when a valid Supabase session is persisted.
- **Target Audience / Persona**: CineMax web and Android users who want a cohesive native app identity on their device home screen and immediate, automatic cloud synchronization of their watchlist, episode progress, and viewing history upon entering the app.
- **Key Value**: Eliminates the generic default Capacitor icon on Android devices and ensures every user session is backed by authenticated Supabase cloud state from the moment the home screen loads.

---

## 2. User Experience & Visual Design

- **Key User Flows**:
  1. **App Launch & Session Check**:
     - On startup, CineMax checks for an existing persisted Supabase session (`client.auth.getSession()`).
     - While the initial session check resolves, a branded dark-cinema loading screen prevents any flash of unauthenticated home content or premature login form flicker.
  2. **Unauthenticated Launch → Sign In / Sign Up Gate**:
     - If no valid session exists, the user sees the full-screen CineMax Authentication Gate instead of the Home view or navigation bars.
     - Users can switch cleanly between **Sign In** and **Create Account (Sign Up)** using single-line segmented controls with generous $\ge 44\text{px}$ touch hitboxes.
     - **Sign In**: Validates email and password ($\ge 6$ characters), authenticates via `signInWithEmail()`, and transitions directly into the CineMax Home page.
     - **Sign Up**: Collects Display Name, Email Address, and Password, registers via `signUpWithEmail()`, and either enters the Home page immediately (if a session is returned) or switches to **Sign In** with the email pre-filled and a clear confirmation notice (if email verification is enabled in Supabase).
  3. **Authenticated Session & Sign Out**:
     - Once signed in, the full CineMax experience (Home, Movies, Series, Discover, Watchlist, Quality & File Size Estimator, Profile, and verified Admin Dashboard) unlocks, and the session persists across refreshes and Android app restarts.
     - Clicking **Sign Out** in either the top navigation bar or the **Profile / Account** view clears the Supabase session, resets in-memory cloud state, and immediately returns the user to the Authentication Gate.
- **Visual Identity & Theme**:
  - *Aesthetic Direction*: Atmospheric Dark Cinema (`#0A0D12` obsidian canvas, `#121621` elevated slate cards, hairline `rgba(255,255,255,0.08)` borders).
  - *Color Palette & Mood*: 60% deep obsidian neutral canvas (`#0A0D12`), 30% structural slate surfaces (`#0d0e14` / `#121621`), and 10% warm cinema-gold accent (`#F59E0B` to `#D97706`) concentrated on primary CTAs, active tabs, and the Android launcher monogram.
  - *Typography & Hierarchy*: `Outfit` display headlines (`clamp(1.75rem, 3vw, 2.5rem)`, `text-wrap: balance`) paired with `Plus Jakarta Sans` body prose and `JetBrains Mono` (`tabular-nums`) for technical metadata.
  - *Component Styling & Layout*: Full-viewport split layout on desktop (`max-w-6xl` two-column showcase with curated cinema highlights on the left and the interactive authentication card on the right) that adapts seamlessly to a one-handed, thumb-friendly mobile layout ($375\text{px}$–$430\text{px}$) with $\ge 44\text{px}$ interactive controls.
- **Interactive Feedback & Motion**:
  - Instant inline validation and clear, human-readable error banners paired with icons (never color alone).
  - Smooth `150ms` opacity/transform transitions and disabled loading states (`Signing In...` / `Creating Account...`) to prevent duplicate submissions.

---

## 3. Key Product Decisions & Trade-Offs

- **Decision 1: Unified Authentication Gate Reusing Existing Supabase Client**
  - *Chosen Approach*: Drive both the pre-home Authentication Gate and session lifecycle from the existing `ensureSupabaseClient()`, `signInWithEmail()`, `signUpWithEmail()`, and `signOutUser()` service functions.
  - *Why*: Guarantees a single source of truth for JWT tokens, Row Level Security (RLS), admin verification, and Capacitor Android WebView origin compatibility (`https://localhost` -> `https://cinemax-kxpv.onrender.com/api/status` runtime fallback if build-time env vars are absent).
  - *Alternatives Considered*: Creating a separate login page router or secondary auth store, which would duplicate session listeners and risk state desynchronization.
- **Decision 2: Adaptive + Legacy Mipmap Android Launcher Icons**
  - *Chosen Approach*: Provide both Android 8.0+ adaptive icon layers (`ic_launcher_background` color `#0A0D12` + safe-zone `ic_launcher_foreground` mipmaps) and legacy square/round PNG mipmaps (`ic_launcher.png` and `ic_launcher_round.png`) across `mdpi`, `hdpi`, `xhdpi`, `xxhdpi`, and `xxxhdpi`.
  - *Why*: Ensures crisp rendering across all Android launcher shapes (circle, squircle, rounded square, teardrop) while keeping the web navbar logo untouched.

---

## 4. Technical Architecture & Data Strategy *(Technical Reference)*

### Architecture & Component Diagram

```
┌──────────────────────────────────────────────────────────────────────────┐
│                     CineMax Application Startup                          │
│         (GitHub Pages /CineMax/  OR  Capacitor Android https://localhost)│
└────────────────────────────────────┬─────────────────────────────────────┘
                                     │
                                     ▼
┌──────────────────────────────────────────────────────────────────────────┐
│              Supabase Session Manager (supabaseClient.ts)                │
│  • Build-time VITE_SUPABASE_* or runtime /api/status fallback            │
│  • client.auth.getSession() + client.auth.onAuthStateChange()            │
└───────────────┬───────────────────────┬───────────────────────┬──────────┘
                │                       │                       │
     [isAuthInitializing]        [!authUser]              [authUser]
                │                       │                       │
                ▼                       ▼                       ▼
┌───────────────────────┐ ┌───────────────────────────┐ ┌──────────────────┐
│  Cinema Startup       │ │  Full-Screen Auth Gate    │ │ Authenticated    │
│  Splash Loader        │ │  • Sign In / Sign Up Tabs │ │ CineMax Shell    │
│  (Prevents UI flash)  │ │  • Email Pre-fill on      │ │ • Navbar         │
└───────────────────────┘ │    Verify Notice          │ │ • Home / Movies  │
                          │  • Input & Error Handling │ │   / Series       │
                          └───────────────────────────┘ │ • Discover &     │
                                                        │   Live Search    │
                                                        │ • Cloud Watchlist│
                                                        │ • Profile &      │
                                                        │   Sign Out       │
                                                        └──────────────────┘
```

### Data Model & State
- **`isAuthInitializing` (`boolean`)**: Holds the startup gate in a clean loading state until `ensureSupabaseClient()` and `client.auth.getSession()` complete.
- **`authUser` (`User | null`)**: Determines whether the user enters the authenticated CineMax shell or remains at the Authentication Gate.
- **Route & Modal Protection**:
  - When `authUser` is `null` (including immediately after `handleSignOut()`), any open modals (`selectedMedia`, `trailerMedia`, `onlinePlaybackTarget`, `isSurpriseOpen`, `isSearchOpen`) are closed, any `/admin` URL state is reset to the root path, and the Authentication Gate is rendered exclusively.

### Interactive Component & State Mapping
- **Sign In / Sign Up Mode Toggle**: Switches between `'signin'` and `'signup'`, clearing stale error banners while preserving typed email text.
- **Sign Up Verification Transition**: When `signUpWithEmail()` returns `user && !session`, switches mode to `'signin'`, keeps the `email` input populated, clears the password field, and displays a confirmation banner instructing the user to verify their email and sign in.
- **Sign Out Action (Navbar & ProfileView)**: Calls `handleSignOut()`, invoking `signOutUser()`, clearing cached admin and cloud state, resetting active tab to `'home'`, and returning immediately to the Authentication Gate.
- **Android Icon Pipeline**: Updates `/android/app/src/main/res/values/ic_launcher_background.xml` (`#0A0D12`) and generates all density PNGs (`mdpi` 48px/108px, `hdpi` 72px/162px, `xhdpi` 96px/216px, `xxhdpi` 144px/324px, `xxxhdpi` 192px/432px) for `ic_launcher.png`, `ic_launcher_round.png`, and `ic_launcher_foreground.png`.
