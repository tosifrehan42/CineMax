# Resilient Admin Access State & Session Lifecycle Fix

Eliminates the bug where the CineMax Admin Dashboard tab and `/admin` view disappear after login, during periodic Supabase JWT refreshes, or on browser page reloads by replacing fragile boolean checks with an explicit, user-scoped state machine (`loading` | `allowed` | `denied` | `error`), session restoration gating, automatic token-refresh recovery, and bounded exponential-backoff retries.

## User Review & Critical Decisions

> [!IMPORTANT]
> The following architectural and UX decisions incorporate your confirmed preferences from our clarification step while keeping server-side `CINEMAX_ADMIN_USER_ID` allowlist enforcement mandatory on every API operation.

- **Confirmed Decision 1 — Navbar Persistence During Transient Failures**: Once administrator access is verified for the authenticated user's session, the Navbar **Admin** tab remains visible if a background check or network request experiences a temporary error, surfacing any connection status or retry controls inside the Admin Dashboard view rather than hiding the navigation entry.
- **Confirmed Decision 2 — User-Scoped Session Cache with Background Revalidation**: Verified `'allowed'` status is cached in `sessionStorage` keyed strictly to the authenticated user's UUID (`cinemax_admin_verified:<user.id>`). On page reload (including `/CineMax/admin`), the UI immediately restores the verified navigation state while revalidating against the `admin-users` Edge Function in the background. If the server explicitly returns `HTTP 403` (`FORBIDDEN_NOT_ADMIN`) or the user signs out / switches accounts, the cache and state are cleared immediately.
- **Confirmed Decision 3 — 3 Automatic Retries with Exponential Backoff**: Transient network failures, Edge Function cold starts, or `5xx` responses automatically retry up to 3 times (`400ms`, `1000ms`, `2200ms`) before entering the `error` state with a visible manual **Retry Verification** button.

---

## 1. Overview & Root Cause Analysis

- **Why the Admin Dashboard Disappeared**:
  1. **Object Reference Churn on Token Refresh**: Supabase's `onAuthStateChange` emits a new `session.user` object reference on every `TOKEN_REFRESHED`, `SIGNED_IN`, and tab-focus event even when `user.id` has not changed. Because the admin check effect depended on the `authUser` object reference, every token refresh triggered a fresh `checkAdminAccess()` call.
  2. **All Non-200 Errors Treated as Non-Admin (`false`)**: Any momentary network blip, Edge Function cold-start timeout, or `5xx`/`401` during a token transition caused `res.status === 200 && Boolean(res.isAdmin)` to evaluate to `false`, immediately hiding the Navbar Admin tab.
  3. **Premature Initial Render Before Session Restoration**: On page refresh (especially at `/CineMax/admin`), `authUser` initialized as `null` while `client.auth.getSession()` was still asynchronous, causing the dashboard to flash `HTTP 401 · Authentication Required` before session restoration completed.
  4. **Expired Token Race (`HTTP 401`) Without Session Revalidation**: If `invokeAdminBackend` ran right as an access token expired, it did not call `client.auth.refreshSession()` / `client.auth.getUser()` to obtain a fresh JWT before retrying.
  5. **Misleading Fallback Error Classification**: When the `admin-users` Edge Function experienced a transient network error on GitHub Pages, falling through to the non-existent `/api/admin/users` static path caused the client to report `503 EDGE_FUNCTION_NOT_DEPLOYED` instead of a retryable network/transient error.

---

## 2. User Experience & Visual Design

- **Key User Flows**:
  - **Initial Login & Page Refresh on `/CineMax/admin`**: While Supabase restores the session from storage, the Admin Dashboard displays a calm, layout-stable loading skeleton (`Verifying administrator session...`) rather than flashing an unauthenticated `401` screen.
  - **Seamless Background Token Refreshes**: When Supabase refreshes the JWT in the background for the same `user.id`, no redundant `checkAdminAccess()` network call is fired, and the Admin tab stays uninterrupted in the Navbar.
  - **Transient Network or Cold-Start Recovery**: If an Edge Function call encounters a temporary timeout or `5xx` error, the client automatically performs up to 3 exponential-backoff retries. If all retries fail, the Admin tab remains accessible (if previously verified for this user ID) and the dashboard displays a clear **Temporary Connection Issue** banner with a **Retry Now** button—distinct from the `403 Access Denied` and `Setup Required` screens.
  - **Explicit Denial (`HTTP 403`) or Sign-Out**: If the server explicitly responds with `HTTP 403` (`FORBIDDEN_NOT_ADMIN`) or the user signs out, the cached state for that user is purged immediately and the Admin tab is removed.
- **Visual Identity & Theme**:
  - Preserves CineMax's obsidian dark palette (`#090a0f` canvas, `#0d0e14` structural cards, `#f59e0b` amber accents), `Outfit` display headers, `Plus Jakarta Sans` body prose, and `JetBrains Mono` (`tabular-nums`) for UUIDs, status codes, and metrics.
  - Follows strict SaaS dashboard state completeness: dedicated loading skeleton, transient retryable error banner, `401` sign-in prompt (only after auth initialization finishes with no session), and `403` non-admin denial view.

---

## 3. Key Product Decisions & Trade-Offs

- **Explicit 4-State Admin Access Machine (`'loading' | 'allowed' | 'denied' | 'error'`)**:
  - *Chosen Approach*: Replace the single `isAdmin: boolean` with `adminAccessState: 'loading' | 'allowed' | 'denied' | 'error'` paired with `verifiedAdminUserId: string | null` and `isAuthInitializing: boolean`.
  - *Why*: Prevents network hiccups or in-flight checks from being conflated with an explicit `403` authorization denial.
- **Deduplicating Auth State Changes by `user.id`**:
  - *Chosen Approach*: Track the active `authUserId = authUser?.id ?? null`. Only reset admin verification when `authUserId` changes (sign-out or account switch). On `TOKEN_REFRESHED` for the same `user.id`, keep the current `'allowed'` state intact.
  - *Why*: Eliminates periodic tab disappearance when Supabase rotates short-lived JWTs in the background.
- **Automatic `401` Session Revalidation + Bounded Exponential Backoff**:
  - *Chosen Approach*: Inside the admin API client, if an operation receives `HTTP 401`, refresh/revalidate the session via `client.auth.refreshSession()` once and retry with the new `access_token`. For network errors, timeouts, or `502`/`503`/`504` responses, retry up to 3 times (`400ms`, `1000ms`, `2200ms`).
  - *Why*: Handles Edge Function cold starts and token rotation races transparently without weakening server-side security.

---

## 4. Technical Architecture & Data Strategy *(Technical Reference)*

### Architecture & State Lifecycle Diagram

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                   Supabase Auth Session Lifecycle                           │
│  1. Boot: isAuthInitializing = true -> client.auth.getSession()             │
│  2. Events: onAuthStateChange (SIGNED_IN, TOKEN_REFRESHED, SIGNED_OUT)      │
└───────────────────────────────┬─────────────────────────────────────────────┘
                                │
                                ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│               Admin Access State Machine (Keyed by user.id)                 │
│                                                                             │
│  • Sign-Out / User ID Changed ──► Clear sessionStorage cache                │
│                                   adminAccessState = 'denied' (if signed    │
│                                   out) or 'loading' (if new user ID)        │
│                                                                             │
│  • Same User ID + TOKEN_REFRESHED ► Preserve 'allowed' state (no flicker)   │
│                                                                             │
│  • Initial Load / Refresh ──────► Read sessionStorage['cinemax_admin:<id>'] │
│                                   If cached 'allowed', show Admin tab       │
│                                   immediately & revalidate in background    │
└───────────────────────────────┬─────────────────────────────────────────────┘
                                │
                                ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│            Resilient Admin API Client (invokeAdminBackend)                  │
│                                                                             │
│  • HTTP 200 (isAdmin: true)  ──► adminAccessState = 'allowed' (cache UID)   │
│  • HTTP 403 (Not in Allowlist) ► adminAccessState = 'denied'  (purge cache) │
│  • HTTP 401 (Token Expired)  ──► client.auth.refreshSession() -> Retry once │
│  • Network / 5xx / Cold Start ─► 3x Exponential Backoff (400ms/1s/2.2s)     │
│                                  If still failing:                          │
│                                  adminAccessState = 'error' (keep tab if    │
│                                  previously 'allowed' for this user.id;     │
│                                  show Retry banner in AdminDashboardView)   │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Interactive Component & State Mapping

1. **Auth Initialization & Session Restoration Gate**:
   - Track `isAuthInitializing` (starts `true`, becomes `false` only after `ensureSupabaseClient()` and `client.auth.getSession()` settle).
   - When navigating directly to `/CineMax/admin` or `/admin` on page refresh, the route waits for `isAuthInitializing === false` before deciding whether the user is unauthenticated (`401`).
2. **Admin Access Verification & Caching**:
   - Helper functions read/write `sessionStorage` key `cinemax_admin_verified_uid` for the current `user.id`.
   - `showAdminTabInNavbar` is `true` when `isAuthenticated && (adminAccessState === 'allowed' || (adminAccessState !== 'denied' && verifiedAdminUserId === authUser.id))`.
   - Note: This cache only controls client-side UI visibility so the tab does not vanish on refresh or transient network errors; every data fetch and mutation in the Admin Dashboard still sends the caller's live Bearer JWT to the `admin-users` Edge Function, which independently verifies `CINEMAX_ADMIN_USER_ID`.
3. **Edge Function Invocation & Error Differentiation**:
   - Distinguish genuine HTTP `403 FORBIDDEN_NOT_ADMIN` responses from transient network/fetch errors (`FunctionsFetchError`, `FunctionsRelayError`, `500`/`502`/`504`).
   - Only fallback to `/api/admin/users` when running on `localhost` / local dev or when `VITE_API_BASE_URL` is configured, preventing a failed GitHub Pages `/api/admin/users` `404` from masking a transient Edge Function error as `EDGE_FUNCTION_NOT_DEPLOYED`.
4. **Admin Dashboard View States**:
   - **Loading State**: Shown while `isAuthInitializing` or initial `adminAccessState === 'loading'` (when no cached list data is present).
   - **Transient Error State**: Shown when a request fails after 3 automatic retries, preserving any already-loaded user table or displaying a dedicated **Temporary Server/Network Error** card with a manual **Retry Now** button that re-triggers both `checkAdminAccess` and `loadUsers`.
   - **Explicit Forbidden State (`403`)**: Shown only when the server explicitly denies authorization (`status === 403 && code === 'FORBIDDEN_NOT_ADMIN'`).
