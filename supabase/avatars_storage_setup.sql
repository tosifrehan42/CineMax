-- ============================================================================
-- CineMax Profile Picture Upload — Supabase Storage Setup (`avatars` Bucket)
-- Run this non-destructive script in your Supabase SQL Editor.
--
-- Privacy & Security Note:
-- The `avatars` bucket is configured as a public-read bucket (`public = true`)
-- so profile pictures can be rendered directly via standard `<img>` tags.
-- Anyone who has the direct public avatar URL can view the image, while
-- uploading, replacing, and deleting files are strictly restricted by
-- Row-Level Security (RLS) to the authenticated user inside their own
-- `<auth.uid()>/` folder.
-- ============================================================================

-- 1. Create or update the `avatars` bucket (5 MB limit, JPEG/PNG/WebP only)
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'avatars',
  'avatars',
  true,
  5242880, -- 5 MB (5 * 1024 * 1024 bytes)
  ARRAY['image/jpeg', 'image/png', 'image/webp']
)
ON CONFLICT (id) DO UPDATE
SET
  public = EXCLUDED.public,
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

-- 2. Strict Row-Level Security (RLS) Policies on `storage.objects`

-- Public read access for displaying avatars in the app
DROP POLICY IF EXISTS "Avatar images are publicly readable" ON storage.objects;
CREATE POLICY "Avatar images are publicly readable"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'avatars');

-- Authenticated users can upload ONLY into their own `<user-id>/` folder
DROP POLICY IF EXISTS "Users can upload own avatar in own folder" ON storage.objects;
CREATE POLICY "Users can upload own avatar in own folder"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'avatars'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

-- Authenticated users can update ONLY files inside their own `<user-id>/` folder
DROP POLICY IF EXISTS "Users can update own avatar in own folder" ON storage.objects;
CREATE POLICY "Users can update own avatar in own folder"
  ON storage.objects FOR UPDATE TO authenticated
  USING (
    bucket_id = 'avatars'
    AND (storage.foldername(name))[1] = auth.uid()::text
  )
  WITH CHECK (
    bucket_id = 'avatars'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

-- Authenticated users can delete ONLY files inside their own `<user-id>/` folder
DROP POLICY IF EXISTS "Users can delete own avatar in own folder" ON storage.objects;
CREATE POLICY "Users can delete own avatar in own folder"
  ON storage.objects FOR DELETE TO authenticated
  USING (
    bucket_id = 'avatars'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );
