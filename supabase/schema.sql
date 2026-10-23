-- ============================================================================
-- CineMax Phase 3: Supabase Persistent Auth, Watchlist, History & Profile Schema
-- Run this non-destructive script in your Supabase SQL Editor.
-- ============================================================================

-- 1. PROFILES TABLE (1:1 with auth.users)
CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  username TEXT UNIQUE CHECK (username IS NULL OR (char_length(username) BETWEEN 3 AND 30 AND username ~ '^[a-zA-Z0-9_]+$')),
  display_name TEXT NOT NULL DEFAULT 'Cinema Enthusiast' CHECK (char_length(display_name) BETWEEN 1 AND 80),
  bio TEXT NOT NULL DEFAULT '' CHECK (char_length(bio) <= 500),
  avatar_url TEXT,
  favorite_genres TEXT[] NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 2. WATCHLIST & FAVOURITES TABLE
CREATE TABLE IF NOT EXISTS public.watchlist_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  media_id TEXT NOT NULL CHECK (char_length(media_id) > 0),
  tmdb_id INTEGER NOT NULL,
  media_type TEXT NOT NULL CHECK (media_type IN ('movie', 'tv')),
  status TEXT NOT NULL DEFAULT 'want_to_watch' CHECK (status IN ('want_to_watch', 'plan_to_watch', 'watching', 'completed', 'on_hold', 'dropped')),
  is_favourite BOOLEAN NOT NULL DEFAULT FALSE,
  personal_rating SMALLINT CHECK (personal_rating IS NULL OR (personal_rating >= 1 AND personal_rating <= 10)),
  notes TEXT CHECK (notes IS NULL OR char_length(notes) <= 1000),
  media_snapshot JSONB NOT NULL DEFAULT '{}'::jsonb,
  added_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT watchlist_user_media_unique UNIQUE (user_id, media_id)
);

-- Safe non-destructive migration for existing watchlist_items tables to support on_hold & dropped
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'watchlist_items_status_check'
  ) THEN
    ALTER TABLE public.watchlist_items DROP CONSTRAINT watchlist_items_status_check;
  END IF;
  ALTER TABLE public.watchlist_items
    ADD CONSTRAINT watchlist_items_status_check
    CHECK (status IN ('want_to_watch', 'plan_to_watch', 'watching', 'completed', 'on_hold', 'dropped'));
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

CREATE INDEX IF NOT EXISTS idx_watchlist_user_id ON public.watchlist_items(user_id);
CREATE INDEX IF NOT EXISTS idx_watchlist_user_status ON public.watchlist_items(user_id, status);
CREATE INDEX IF NOT EXISTS idx_watchlist_user_fav ON public.watchlist_items(user_id, is_favourite);

-- 3. WATCH HISTORY TABLE (Dated Viewing Journal & Personal Ratings)
CREATE TABLE IF NOT EXISTS public.watch_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  media_id TEXT NOT NULL CHECK (char_length(media_id) > 0),
  tmdb_id INTEGER NOT NULL,
  media_type TEXT NOT NULL CHECK (media_type IN ('movie', 'tv')),
  watched_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  personal_rating SMALLINT CHECK (personal_rating IS NULL OR (personal_rating >= 1 AND personal_rating <= 10)),
  review_notes TEXT CHECK (review_notes IS NULL OR char_length(review_notes) <= 2000),
  runtime_minutes INTEGER NOT NULL DEFAULT 0 CHECK (runtime_minutes >= 0),
  media_snapshot JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT watch_history_user_media_unique UNIQUE (user_id, media_id)
);

CREATE INDEX IF NOT EXISTS idx_watch_history_user_watched_at ON public.watch_history(user_id, watched_at DESC);

-- 3B. WATCHED EPISODES TABLE (TV Series Episode Progress Checklist)
CREATE TABLE IF NOT EXISTS public.watched_episodes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  media_id TEXT NOT NULL CHECK (char_length(media_id) > 0),
  season_number INTEGER NOT NULL CHECK (season_number >= 1),
  episode_number INTEGER NOT NULL CHECK (episode_number >= 1),
  watched_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT watched_episodes_user_media_ep_unique UNIQUE (user_id, media_id, season_number, episode_number)
);

CREATE INDEX IF NOT EXISTS idx_watched_episodes_user_media ON public.watched_episodes(user_id, media_id);

-- 4. UPDATED_AT TIMESTAMP TRIGGER
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_profiles_updated_at ON public.profiles;
CREATE TRIGGER trg_profiles_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS trg_watchlist_updated_at ON public.watchlist_items;
CREATE TRIGGER trg_watchlist_updated_at
  BEFORE UPDATE ON public.watchlist_items
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS trg_watch_history_updated_at ON public.watch_history;
CREATE TRIGGER trg_watch_history_updated_at
  BEFORE UPDATE ON public.watch_history
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- 5. AUTO-CREATE PROFILE ON AUTH SIGNUP TRIGGER
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, display_name, username)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'display_name', split_part(NEW.email, '@', 1), 'Cinema Enthusiast'),
    NULL
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- 6. ENABLE ROW LEVEL SECURITY (RLS) & POLICIES
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.watchlist_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.watch_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.watched_episodes ENABLE ROW LEVEL SECURITY;

-- Profiles Policies
DROP POLICY IF EXISTS "Users can view own profile" ON public.profiles;
CREATE POLICY "Users can view own profile"
  ON public.profiles FOR SELECT TO authenticated
  USING (auth.uid() = id);

DROP POLICY IF EXISTS "Users can insert own profile" ON public.profiles;
CREATE POLICY "Users can insert own profile"
  ON public.profiles FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = id);

DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;
CREATE POLICY "Users can update own profile"
  ON public.profiles FOR UPDATE TO authenticated
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

-- Watchlist Policies
DROP POLICY IF EXISTS "Users can view own watchlist" ON public.watchlist_items;
CREATE POLICY "Users can view own watchlist"
  ON public.watchlist_items FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert own watchlist" ON public.watchlist_items;
CREATE POLICY "Users can insert own watchlist"
  ON public.watchlist_items FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update own watchlist" ON public.watchlist_items;
CREATE POLICY "Users can update own watchlist"
  ON public.watchlist_items FOR UPDATE TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete own watchlist" ON public.watchlist_items;
CREATE POLICY "Users can delete own watchlist"
  ON public.watchlist_items FOR DELETE TO authenticated
  USING (auth.uid() = user_id);

-- Watch History Policies
DROP POLICY IF EXISTS "Users can view own watch history" ON public.watch_history;
CREATE POLICY "Users can view own watch history"
  ON public.watch_history FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert own watch history" ON public.watch_history;
CREATE POLICY "Users can insert own watch history"
  ON public.watch_history FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update own watch history" ON public.watch_history;
CREATE POLICY "Users can update own watch history"
  ON public.watch_history FOR UPDATE TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete own watch history" ON public.watch_history;
CREATE POLICY "Users can delete own watch history"
  ON public.watch_history FOR DELETE TO authenticated
  USING (auth.uid() = user_id);

-- Watched Episodes Policies
DROP POLICY IF EXISTS "Users can view own watched episodes" ON public.watched_episodes;
CREATE POLICY "Users can view own watched episodes"
  ON public.watched_episodes FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert own watched episodes" ON public.watched_episodes;
CREATE POLICY "Users can insert own watched episodes"
  ON public.watched_episodes FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update own watched episodes" ON public.watched_episodes;
CREATE POLICY "Users can update own watched episodes"
  ON public.watched_episodes FOR UPDATE TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete own watched episodes" ON public.watched_episodes;
CREATE POLICY "Users can delete own watched episodes"
  ON public.watched_episodes FOR DELETE TO authenticated
  USING (auth.uid() = user_id);

-- 7. SUPABASE STORAGE: `avatars` BUCKET & FOLDER-SCOPED RLS POLICIES
-- Note: `public = true` allows public avatar URLs to be viewed by anyone who has the URL,
-- while upload, update, and delete operations are strictly restricted by RLS to the
-- authenticated user's own `<auth.uid()>/` folder.
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'avatars',
  'avatars',
  true,
  5242880, -- 5 MB
  ARRAY['image/jpeg', 'image/png', 'image/webp']
)
ON CONFLICT (id) DO UPDATE
SET
  public = EXCLUDED.public,
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

DROP POLICY IF EXISTS "Avatar images are publicly readable" ON storage.objects;
CREATE POLICY "Avatar images are publicly readable"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'avatars');

DROP POLICY IF EXISTS "Users can upload own avatar in own folder" ON storage.objects;
CREATE POLICY "Users can upload own avatar in own folder"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'avatars'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

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

DROP POLICY IF EXISTS "Users can delete own avatar in own folder" ON storage.objects;
CREATE POLICY "Users can delete own avatar in own folder"
  ON storage.objects FOR DELETE TO authenticated
  USING (
    bucket_id = 'avatars'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

-- 8. ADMIN AUDIT LOGS TABLE (Server-Only via RLS)
CREATE TABLE IF NOT EXISTS public.admin_audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_user_id UUID NOT NULL,
  admin_email TEXT,
  target_user_id UUID NOT NULL,
  target_email TEXT,
  action TEXT NOT NULL CHECK (
    action IN (
      'suspend_user',
      'restore_user',
      'delete_user',
      'confirm_email',
      'send_password_reset'
    )
  ),
  details JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_admin_audit_logs_created_at
  ON public.admin_audit_logs (created_at DESC);

CREATE INDEX IF NOT EXISTS idx_admin_audit_logs_target_user
  ON public.admin_audit_logs (target_user_id, created_at DESC);

ALTER TABLE public.admin_audit_logs ENABLE ROW LEVEL SECURITY;


