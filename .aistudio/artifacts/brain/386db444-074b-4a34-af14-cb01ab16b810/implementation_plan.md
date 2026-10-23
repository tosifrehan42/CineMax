# CineMax — Secure Admin Dashboard Implementation Plan

## 1. Overview & Security Architecture
Implement a dedicated, production-hardened **Admin Dashboard (`/admin`)** in CineMax that works seamlessly on both **GitHub Pages (`/CineMax/admin`)** and the local/AI Studio preview (`/admin`).

- **Zero Client-Side Trust**:
  - Admin authorization is enforced exclusively on the server side using the `CINEMAX_ADMIN_USER_ID` secret (a comma-separated allowlist or single Supabase Auth user UUID).
  - Never expose any `service_role` or secret key in `VITE_*` variables, client bundles, or GitHub Actions frontend build secrets.
  - Every request to the admin backend independently verifies the caller's Bearer JWT via `supabase.auth.getUser(token)` and checks that `caller.id` matches `CINEMAX_ADMIN_USER_ID` (returning `HTTP 401` for missing/invalid tokens and `HTTP 403` for authenticated non-admin accounts).
  - The frontend calls a lightweight `check_access` action to determine whether to show the **Admin** link in the navigation bar as a UI convenience; non-admins who visit `/admin` directly see a clear **403 Unauthorized — Administrator Access Required** screen with zero user data exposed.

## 2. Supabase Edge Function (`supabase/functions/admin-users/index.ts`)
Create a single, self-contained Supabase Edge Function `admin-users` (plus matching local Express proxy routes in `server.ts` when running locally with server-side env vars) that handles all privileged operations using the server-only `SUPABASE_SERVICE_ROLE_KEY` and `CINEMAX_ADMIN_USER_ID`:

1. **`check_access`**:
   - Verifies the caller's JWT and returns `{ isAdmin: true, adminUserId: caller.id }` if `caller.id` is in `CINEMAX_ADMIN_USER_ID`, or `HTTP 403` (`{ isAdmin: false }`) otherwise.
2. **`list_users`**:
   - Accepts `{ page, perPage, searchQuery, filterStatus }` (enforcing safe pagination bounds, e.g., `perPage` between `5` and `50`, default `15`).
   - Fetches Auth users via `adminClient.auth.admin.listUsers()`, computes accurate overview statistics (**Total Users**, **Confirmed Users**, **Unconfirmed Users**, **Recent Registrations [last 7 days]**, and **Suspended Users**), filters by email/ID/username search query, and returns only sanitized user summaries (`id`, `email`, `created_at`, `last_sign_in_at`, `email_confirmed_at`, `banned_until`, `is_Admin`, plus basic `display_name` and `username` from `public.profiles`). Never returns password hashes, tokens, or raw sensitive metadata.
3. **`get_user_detail`**:
   - Fetches a single user's Auth record (`adminClient.auth.admin.getUserById(targetUserId)`), their basic `public.profiles` row (`display_name`, `username`, `avatar_url`, `favorite_genres`, `created_at`, `updated_at`), and **privacy-safe aggregate counts only** (`watchlistCount`, `favouritesCount`, `watchedHistoryCount`, `watchedEpisodesCount`) using `select('*', { count: 'exact', head: true })`.
   - Never exposes private journal notes, personal ratings, or individual watchlist titles.
   - Also returns recent audit log entries for that target user from `public.admin_audit_logs`.
4. **`send_password_reset`**:
   - Triggers a standard Supabase password-reset email for the user's email address via `resetPasswordForEmail(email, { redirectTo })` and records an `admin_audit_logs` entry.
5. **`confirm_email` / `update_email_confirmation`**:
   - Confirms an unconfirmed user's email via `adminClient.auth.admin.updateUserById(targetUserId, { email_confirm: true })` and logs the action in `public.admin_audit_logs`.
6. **`suspend_user` & `restore_user`**:
   - Blocks self-suspension if `targetUserId === caller.id`.
   - Uses `adminClient.auth.admin.updateUserById(targetUserId, { ban_duration })` supporting selectable durations (`'24h'`, `'168h'` [7d], `'720h'` [30d], or `'876000h'` [Indefinite ~100 years]) for suspension, or `'none'` to restore access.
   - Clearly documents in the UI that `ban_duration` prevents new sign-ins and token refreshes immediately, while existing short-lived JWT access tokens remain valid until their natural expiration.
   - Records the action and duration in `public.admin_audit_logs`.
7. **`delete_user`**:
   - Strictly blocks self-deletion if `targetUserId === caller.id`.
   - Requires explicit confirmation in the request payload (`confirmDelete: true`).
   - Deletes any avatar files in `storage.objects` under `<targetUserId>/`, calls `adminClient.auth.admin.deleteUser(targetUserId)` (which cascades to `public.profiles`, `public.watchlist_items`, `public.watch_history`, and `public.watched_episodes`), and records the deletion in `public.admin_audit_logs`.

## 3. Audit Log Database Migration (`supabase/admin_audit_logs_migration.sql`)
- Create a dedicated, non-destructive SQL migration file `/supabase/admin_audit_logs_migration.sql` creating `public.admin_audit_logs`:
  - Columns: `id` (UUID PK), `admin_user_id` (UUID), `target_user_id` (UUID), `target_email` (TEXT), `action` (TEXT check constraint: `'suspend_user'`, `'restore_user'`, `'delete_user'`, `'confirm_email'`, `'send_password_reset'`), `details` (JSONB without any secrets/tokens), `created_at` (TIMESTAMPTZ).
  - Enable strict Row-Level Security (`ALTER TABLE public.admin_audit_logs ENABLE ROW LEVEL SECURITY;`) with **zero public/authenticated client policies** so ordinary users cannot read, insert, update, or delete audit logs via the anon key—only the server-side Edge Function (after verifying `CINEMAX_ADMIN_USER_ID`) can write and read audit logs.

## 4. Routing & Admin Dashboard UI (`src/components/AdminDashboardView.tsx`, `Navbar.tsx`, `App.tsx`)
- **GitHub Pages & SPA `/admin` Route Support**:
  - Detect `/admin` or `/CineMax/admin` (as well as `#/admin`) on initial page load and `popstate` events in `App.tsx`, syncing the URL bar cleanly when switching between `/admin` and standard CineMax tabs.
  - Show the **Admin** navigation badge in `Navbar.tsx` only when the server-side `check_access` check confirms the signed-in user is the configured administrator (while still allowing direct URL navigation to `/admin` so the administrator can see setup/deployment diagnostics or non-admins see a proper 403 state).
- **Admin Dashboard Interface**:
  - **Overview KPI Cards**: Total Users, Confirmed Users, Unconfirmed Users, and Recent Registrations (last 7 days).
  - **Searchable, Filterable, Paginated User Table**: Filter by status (`All`, `Confirmed`, `Unconfirmed`, `Suspended`), search by email, UUID, or username, and paginate cleanly on desktop and mobile.
  - **User Detail Drawer / Panel**: Displays Auth metadata, profile summary, privacy-safe aggregate counts (`Watchlist Items`, `Favourites`, `Journal Entries`, `Episodes Tracked`), and action buttons (**Confirm Email**, **Send Password Reset Email**, **Suspend Account [24h / 7d / 30d / Indefinite]**, **Restore Account**, **Delete Account**).
  - **Destructive Action Confirmation Modal**: Requires explicit confirmation before suspending or deleting a user, clearly explaining token expiry behavior for suspensions and `ON DELETE CASCADE` record removal for deletions.
  - **Recent Admin Audit Log Panel**: Displays the latest recorded administrative actions.
  - **Deployment & Secret Setup Guide Modal/Drawer**: If the `admin-users` Edge Function is not yet deployed or `CINEMAX_ADMIN_USER_ID` is not set in Supabase Edge Function secrets, displays clear, step-by-step CLI and Supabase Dashboard instructions.
