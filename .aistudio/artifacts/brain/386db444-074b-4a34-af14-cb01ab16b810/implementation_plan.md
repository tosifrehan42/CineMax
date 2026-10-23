# CineMax — Profile Picture Upload Implementation Plan

## 1. Overview & Architecture
Implement a complete, end-to-end **Profile Picture Upload** feature in CineMax that allows authenticated users to upload, crop/frame, change, and remove their profile picture using **Supabase Storage (`avatars` bucket)** and the existing **`public.profiles.avatar_url`** column, while updating the avatar across the entire app (`ProfileView`, `Edit Profile` modal, and `Navbar`) without a page reload.

## 2. Profile UI & Avatar Rendering (`Navbar.tsx`, `ProfileView.tsx`, `AvatarCropModal.tsx`)
- **Global Avatar Display**:
  - Update `Navbar.tsx` and `ProfileView.tsx` to render the user's `userProfile.avatarUrl` image whenever present, with an automatic `onError` fallback to the existing stylized amber initials avatar if an image URL fails to load.
- **Upload, Change & Remove Controls**:
  - Place clear **Upload Photo** (when no avatar is set), **Change Photo**, and **Remove Photo** controls in **both** the `ProfileView` hero header card and inside the **Edit Cinephile Profile** modal.
  - Display a concise privacy note near the upload control stating that profile avatars are stored in a public bucket so avatar URLs can be viewed by anyone with the link, while uploads and deletions are strictly restricted to the account owner via Row-Level Security (RLS).
- **Interactive Circular Crop, Position & Client-Side Optimization (`src/components/AvatarCropModal.tsx`)**:
  - Validate selected files immediately on the client:
    - Allowed MIME types: `image/jpeg`, `image/png`, `image/webp`.
    - Maximum input file size: **10 MB** (`10 * 1024 * 1024` bytes).
  - Open an interactive **Circular Crop & Position Modal** with zoom slider and drag-to-reposition controls on an HTML5 `<canvas>`.
  - Export the framed image as an optimized square `512 × 512` WebP/JPEG/PNG blob guaranteed to be well under the **5 MB** Supabase Storage bucket limit.
  - Display real-time uploading state, disable duplicate submissions while an upload or removal is in progress, and preserve the previous avatar if an error occurs.

## 3. Supabase Storage & RLS Setup (`supabase/avatars_storage_setup.sql` & `supabaseClient.ts`)
- **Dedicated Non-Destructive SQL Setup Script**:
  - Create `/supabase/avatars_storage_setup.sql` (and expose a copyable helper in the UI if the `avatars` bucket is not yet provisioned) that:
    1. Creates the `avatars` bucket in `storage.buckets` (`public = true`, `file_size_limit = 5242880` [5 MB], `allowed_mime_types = ARRAY['image/jpeg', 'image/png', 'image/webp']`).
    2. Applies strict `storage.objects` RLS policies scoped to `bucket_id = 'avatars'` and `(storage.foldername(name))[1] = auth.uid()::text` so authenticated users can `INSERT`, `UPDATE`, and `DELETE` **only** files inside their own `<user-id>/` folder, while allowing public `SELECT` for displaying avatars.
- **Scoped File Paths & Safe Storage Cleanup**:
  - Verify the active authenticated session via `client.auth.getSession()` / `client.auth.getUser()` before any upload or delete operation.
  - Generate paths strictly from the authenticated user's UID and a collision-safe timestamp/UUID: `<user-id>/avatar-<timestamp>-<random>.<ext>`.
  - Extract internal storage object paths safely from existing `avatar_url` values only when they belong to the current user's `<user-id>/` prefix.

## 4. Atomic Database Integration (`src/services/supabaseClient.ts` & `src/App.tsx`)
- **Targeted `public.profiles.avatar_url` Updates**:
  - Fix `updateUserProfile` so editing text fields (`displayName`, `username`, `bio`, `favoriteGenres`) never overwrites an existing `avatar_url` when `avatarUrl` is not passed.
  - Add `uploadUserAvatar(fileBlob, mimeType, currentAvatarUrl)`:
    1. Verifies active session and validates MIME type (`image/jpeg`, `image/png`, `image/webp`) and size ($\le 5\text{ MB}$ post-crop / $\le 10\text{ MB}$ raw).
    2. Uploads the file to `avatars` at `<user-id>/<unique-name>.<ext>` with `upsert: false`.
    3. Retrieves the public URL and updates `public.profiles.avatar_url` for `id = user.id` without touching unrelated profile columns.
    4. **Rollback on DB Failure**: If updating `public.profiles` fails, deletes the newly uploaded storage object immediately and returns the exact error so the UI keeps the previous avatar.
    5. **Post-Success Old File Cleanup**: Only after both the new upload and `public.profiles` update succeed, deletes the previous `<user-id>/...` storage file (if one existed).
  - Add `removeUserAvatar(currentAvatarUrl)`:
    1. Verifies active session and updates `public.profiles` to set `avatar_url = null` for `id = user.id`.
    2. Only after the database update succeeds, removes the old storage object from `<user-id>/...` in the `avatars` bucket.

## 5. Validation & Verification
- Run `npm run lint` (`tsc --noEmit`) and `npm run build` (`vite build`) to verify zero TypeScript or bundling issues.
- Verify file validation (invalid MIME types, files $>10\text{ MB}$), signed-out guardrails, interactive crop/zoom preview, bucket/RLS error guidance, and state propagation across `Navbar` and `ProfileView`.
