import { createClient, SupabaseClient, Session, User } from '@supabase/supabase-js';
import {
  MediaItem,
  MediaType,
  UserProfile,
  WatchedEpisodeEntry,
  WatchHistoryEntry,
  WatchlistEntry,
  WatchStatus,
} from '../types';

export const SUPABASE_CHECKLIST_MIGRATION_SQL = `-- CineMax Checklist & TV Episode Progress Migration
-- Run this non-destructive script in your Supabase SQL Editor.

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

ALTER TABLE public.watched_episodes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own watched episodes" ON public.watched_episodes;
CREATE POLICY "Users can view own watched episodes" ON public.watched_episodes FOR SELECT TO authenticated USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "Users can insert own watched episodes" ON public.watched_episodes;
CREATE POLICY "Users can insert own watched episodes" ON public.watched_episodes FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "Users can update own watched episodes" ON public.watched_episodes;
CREATE POLICY "Users can update own watched episodes" ON public.watched_episodes FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "Users can delete own watched episodes" ON public.watched_episodes;
CREATE POLICY "Users can delete own watched episodes" ON public.watched_episodes FOR DELETE TO authenticated USING (auth.uid() = user_id);`;

export const SUPABASE_SCHEMA_SQL = `-- CineMax Phase 3: Persistent Auth, Watchlist, History, Episodes & Profile Schema
-- Run this non-destructive script in your Supabase SQL Editor.

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

CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_profiles_updated_at ON public.profiles;
CREATE TRIGGER trg_profiles_updated_at BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS trg_watchlist_updated_at ON public.watchlist_items;
CREATE TRIGGER trg_watchlist_updated_at BEFORE UPDATE ON public.watchlist_items FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS trg_watch_history_updated_at ON public.watch_history;
CREATE TRIGGER trg_watch_history_updated_at BEFORE UPDATE ON public.watch_history FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
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
CREATE TRIGGER on_auth_user_created AFTER INSERT ON auth.users FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.watchlist_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.watch_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.watched_episodes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own profile" ON public.profiles;
CREATE POLICY "Users can view own profile" ON public.profiles FOR SELECT TO authenticated USING (auth.uid() = id);
DROP POLICY IF EXISTS "Users can insert own profile" ON public.profiles;
CREATE POLICY "Users can insert own profile" ON public.profiles FOR INSERT TO authenticated WITH CHECK (auth.uid() = id);
DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;
CREATE POLICY "Users can update own profile" ON public.profiles FOR UPDATE TO authenticated USING (auth.uid() = id) WITH CHECK (auth.uid() = id);

DROP POLICY IF EXISTS "Users can view own watchlist" ON public.watchlist_items;
CREATE POLICY "Users can view own watchlist" ON public.watchlist_items FOR SELECT TO authenticated USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "Users can insert own watchlist" ON public.watchlist_items;
CREATE POLICY "Users can insert own watchlist" ON public.watchlist_items FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "Users can update own watchlist" ON public.watchlist_items;
CREATE POLICY "Users can update own watchlist" ON public.watchlist_items FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "Users can delete own watchlist" ON public.watchlist_items;
CREATE POLICY "Users can delete own watchlist" ON public.watchlist_items FOR DELETE TO authenticated USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can view own watch history" ON public.watch_history;
CREATE POLICY "Users can view own watch history" ON public.watch_history FOR SELECT TO authenticated USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "Users can insert own watch history" ON public.watch_history;
CREATE POLICY "Users can insert own watch history" ON public.watch_history FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "Users can update own watch history" ON public.watch_history;
CREATE POLICY "Users can update own watch history" ON public.watch_history FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "Users can delete own watch history" ON public.watch_history;
CREATE POLICY "Users can delete own watch history" ON public.watch_history FOR DELETE TO authenticated USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can view own watched episodes" ON public.watched_episodes;
CREATE POLICY "Users can view own watched episodes" ON public.watched_episodes FOR SELECT TO authenticated USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "Users can insert own watched episodes" ON public.watched_episodes;
CREATE POLICY "Users can insert own watched episodes" ON public.watched_episodes FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "Users can update own watched episodes" ON public.watched_episodes;
CREATE POLICY "Users can update own watched episodes" ON public.watched_episodes FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "Users can delete own watched episodes" ON public.watched_episodes;
CREATE POLICY "Users can delete own watched episodes" ON public.watched_episodes FOR DELETE TO authenticated USING (auth.uid() = user_id);`;

function isForbiddenSecretKey(token: string): boolean {
  const clean = (token || '').trim();
  if (!clean) return false;
  if (clean.startsWith('sb_secret_')) return true;
  if (clean.split('.').length !== 3) return false;
  try {
    const base64 = clean.split('.')[1].replace(/-/g, '+').replace(/_/g, '/');
    const json = atob(base64);
    const payload = JSON.parse(json);
    return payload?.role === 'service_role';
  } catch {
    return false;
  }
}

export function normalizeSupabaseBaseUrl(rawUrl: string): string {
  const trimmed = (rawUrl || '').trim();
  if (!trimmed || trimmed === 'MY_SUPABASE_URL' || trimmed === 'YOUR_SUPABASE_URL') {
    return '';
  }
  if (!trimmed.startsWith('https://') && !trimmed.startsWith('http://')) {
    return '';
  }
  try {
    const parsed = new URL(trimmed);
    // Always use the base project origin without /rest/v1/ or /auth/v1 suffixes
    return parsed.origin;
  } catch {
    return trimmed
      .replace(/\/(rest|auth|realtime|storage)\/v1\/?.*$/i, '')
      .replace(/\/+$/, '');
  }
}

let supabaseInstance: SupabaseClient | null = null;
let resolvedUrl = normalizeSupabaseBaseUrl(import.meta.env.VITE_SUPABASE_URL || '');
let resolvedAnonKey = (import.meta.env.VITE_SUPABASE_ANON_KEY || '').trim();
let securityWarning: string | null = null;
let initPromise: Promise<SupabaseClient | null> | null = null;

function buildClientIfValid(url: string, key: string): SupabaseClient | null {
  const cleanUrl = normalizeSupabaseBaseUrl(url);
  const cleanKey = (key || '').trim();
  if (
    !cleanUrl ||
    !cleanKey ||
    cleanKey === 'MY_SUPABASE_ANON_KEY' ||
    cleanKey === 'YOUR_SUPABASE_ANON_KEY'
  ) {
    return null;
  }
  if (isForbiddenSecretKey(cleanKey)) {
    securityWarning =
      'Security Error: A Supabase secret/service_role key was detected in VITE_SUPABASE_ANON_KEY. Client initialization blocked to protect your database. Please provide the public anon/publishable key instead.';
    return null;
  }
  return createClient(cleanUrl, cleanKey, {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
    },
  });
}

// Attempt immediate build-time initialization if VITE_SUPABASE_* is already baked in
supabaseInstance = buildClientIfValid(resolvedUrl, resolvedAnonKey);

export async function ensureSupabaseClient(): Promise<{
  client: SupabaseClient | null;
  configured: boolean;
  securityWarning: string | null;
}> {
  if (supabaseInstance) {
    return { client: supabaseInstance, configured: true, securityWarning };
  }
  if (securityWarning) {
    return { client: null, configured: false, securityWarning };
  }
  if (!initPromise) {
    initPromise = (async () => {
      try {
        const apiBase = (import.meta.env.VITE_API_BASE_URL || '').replace(/\/$/, '');
        const res = await fetch(`${apiBase}/api/status`);
        const contentType = res.headers.get('content-type') || '';
        if (res.ok && contentType.includes('application/json')) {
          const data = await res.json();
          if (data.supabaseSecurityWarning) {
            securityWarning = data.supabaseSecurityWarning;
            return null;
          }
          if (data.supabaseUrl && data.supabaseAnonKey) {
            resolvedUrl = data.supabaseUrl;
            resolvedAnonKey = data.supabaseAnonKey;
            supabaseInstance = buildClientIfValid(resolvedUrl, resolvedAnonKey);
            return supabaseInstance;
          }
        }
      } catch {
        // Ignore network error or non-JSON responses on static hosts
      }
      return null;
    })();
  }
  const client = await initPromise;
  return {
    client,
    configured: Boolean(client),
    securityWarning,
  };
}

export function getSupabaseClientSync(): SupabaseClient | null {
  return supabaseInstance;
}

export function isSchemaMissingError(err: any): boolean {
  if (!err) return false;
  const code = String(err.code || '');
  const msg = String(err.message || '').toLowerCase();
  return (
    code === '42P01' ||
    code === 'PGRST205' ||
    msg.includes('does not exist') ||
    msg.includes('could not find the table')
  );
}

export function extractNumericTmdbId(mediaId: string, media?: MediaItem): number {
  const match = mediaId.match(/(\d+)$/);
  if (match) {
    const parsed = parseInt(match[1], 10);
    if (!Number.isNaN(parsed) && parsed > 0) return parsed;
  }
  const source = mediaId || media?.title || 'unknown';
  let hash = 0;
  for (let i = 0; i < source.length; i++) {
    hash = (hash * 31 + source.charCodeAt(i)) & 0x7fffffff;
  }
  return hash || 1000;
}

export function parseRuntimeMinutes(media?: MediaItem): number {
  if (!media) return 125;
  if (media.type === 'tv') {
    const seasons = Math.max(1, media.seasons || 1);
    return seasons * 8 * 50; // ~400m per season
  }
  if (media.runtime) {
    const hoursMatch = media.runtime.match(/(\d+)\s*h/i);
    const minsMatch = media.runtime.match(/(\d+)\s*m/i);
    const hours = hoursMatch ? parseInt(hoursMatch[1], 10) : 0;
    const mins = minsMatch ? parseInt(minsMatch[1], 10) : 0;
    const total = hours * 60 + mins;
    if (total > 0) return total;
  }
  return 130;
}

export function isConstraintError(err: any): boolean {
  if (!err) return false;
  const code = String(err.code || '');
  const msg = String(err.message || '').toLowerCase();
  return code === '23514' || msg.includes('watchlist_items_status_check');
}

function toDbStatus(status: WatchStatus): string {
  if (status === 'plan_to_watch') return 'want_to_watch';
  return status;
}

function fromDbStatus(dbStatus: string): WatchStatus {
  if (dbStatus === 'want_to_watch' || dbStatus === 'plan_to_watch') {
    return 'plan_to_watch';
  }
  if (dbStatus === 'watching') return 'watching';
  if (dbStatus === 'completed') return 'completed';
  if (dbStatus === 'on_hold') return 'on_hold';
  if (dbStatus === 'dropped') return 'dropped';
  return 'plan_to_watch';
}

// ============================================================================
// Authentication Operations
// ============================================================================

export async function signUpWithEmail(
  email: string,
  password: string,
  displayName: string
): Promise<{ user: User | null; session: Session | null; error: string | null }> {
  const { client, securityWarning: secWarn } = await ensureSupabaseClient();
  if (!client) {
    return {
      user: null,
      session: null,
      error:
        secWarn ||
        'Supabase is not configured yet. Please set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY in your environment secrets.',
    };
  }

  const trimmedName = displayName.trim() || email.split('@')[0] || 'Cinema Enthusiast';
  const { data, error } = await client.auth.signUp({
    email: email.trim(),
    password,
    options: {
      data: {
        display_name: trimmedName,
      },
    },
  });

  if (error) {
    return { user: null, session: null, error: error.message };
  }

  // If a session was immediately established, ensure a profile row exists
  if (data.user && data.session) {
    await client
      .from('profiles')
      .upsert(
        {
          id: data.user.id,
          display_name: trimmedName,
        },
        { onConflict: 'id' }
      )
      .select()
      .maybeSingle();
  }

  return { user: data.user, session: data.session, error: null };
}

export async function signInWithEmail(
  email: string,
  password: string
): Promise<{ user: User | null; session: Session | null; error: string | null }> {
  const { client, securityWarning: secWarn } = await ensureSupabaseClient();
  if (!client) {
    return {
      user: null,
      session: null,
      error:
        secWarn ||
        'Supabase is not configured yet. Please set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY in your environment secrets.',
    };
  }

  const { data, error } = await client.auth.signInWithPassword({
    email: email.trim(),
    password,
  });

  if (error) {
    return { user: null, session: null, error: error.message };
  }
  return { user: data.user, session: data.session, error: null };
}

export async function signOutUser(): Promise<{ error: string | null }> {
  const { client } = await ensureSupabaseClient();
  if (!client) return { error: null };
  const { error } = await client.auth.signOut();
  return { error: error ? error.message : null };
}

// ============================================================================
// Profile Operations (public.profiles)
// ============================================================================

export async function fetchUserProfile(
  user: User
): Promise<{ profile: UserProfile | null; schemaMissing?: boolean; error: string | null }> {
  const { client } = await ensureSupabaseClient();
  if (!client) {
    return { profile: null, error: 'Supabase client not configured.' };
  }

  const { data, error } = await client
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .maybeSingle();

  if (error) {
    if (isSchemaMissingError(error)) {
      return {
        profile: null,
        schemaMissing: true,
        error: 'Database table "public.profiles" was not found. Please run the Phase 3 SQL schema in your Supabase SQL Editor.',
      };
    }
    return { profile: null, error: error.message };
  }

  if (!data) {
    const fallbackName =
      user.user_metadata?.display_name ||
      user.email?.split('@')[0] ||
      'Cinema Enthusiast';
    const { data: inserted, error: insertError } = await client
      .from('profiles')
      .upsert(
        {
          id: user.id,
          display_name: fallbackName,
          bio: '',
          favorite_genres: [],
        },
        { onConflict: 'id' }
      )
      .select('*')
      .single();

    if (insertError) {
      if (isSchemaMissingError(insertError)) {
        return {
          profile: null,
          schemaMissing: true,
          error: 'Database table "public.profiles" was not found. Please run the Phase 3 SQL schema in your Supabase SQL Editor.',
        };
      }
      return { profile: null, error: insertError.message };
    }

    return {
      profile: {
        id: inserted.id,
        email: user.email,
        username: inserted.username || null,
        displayName: inserted.display_name || fallbackName,
        bio: inserted.bio || '',
        avatarUrl: inserted.avatar_url || null,
        favoriteGenres: Array.isArray(inserted.favorite_genres) ? inserted.favorite_genres : [],
        createdAt: inserted.created_at || user.created_at || new Date().toISOString(),
        updatedAt: inserted.updated_at || new Date().toISOString(),
      },
      error: null,
    };
  }

  return {
    profile: {
      id: data.id,
      email: user.email,
      username: data.username || null,
      displayName: data.display_name || 'Cinema Enthusiast',
      bio: data.bio || '',
      avatarUrl: data.avatar_url || null,
      favoriteGenres: Array.isArray(data.favorite_genres) ? data.favorite_genres : [],
      createdAt: data.created_at || user.created_at || new Date().toISOString(),
      updatedAt: data.updated_at || new Date().toISOString(),
    },
    error: null,
  };
}

export async function updateUserProfile(
  userId: string,
  updates: {
    displayName: string;
    username?: string | null;
    bio?: string;
    avatarUrl?: string | null;
    favoriteGenres?: string[];
  }
): Promise<{ profile: UserProfile | null; error: string | null }> {
  const { client } = await ensureSupabaseClient();
  if (!client) {
    return { profile: null, error: 'Supabase is not configured.' };
  }

  const cleanUsername = updates.username?.trim() ? updates.username.trim() : null;
  if (cleanUsername && !/^[a-zA-Z0-9_]{3,30}$/.test(cleanUsername)) {
    return {
      profile: null,
      error: 'Username must be 3–30 characters using only letters, numbers, or underscores.',
    };
  }

  const payload = {
    id: userId,
    display_name: updates.displayName.trim() || 'Cinema Enthusiast',
    username: cleanUsername,
    bio: (updates.bio ?? '').trim().slice(0, 500),
    avatar_url: updates.avatarUrl?.trim() || null,
    favorite_genres: updates.favoriteGenres || [],
  };

  const { data, error } = await client
    .from('profiles')
    .upsert(payload, { onConflict: 'id' })
    .select('*')
    .single();

  if (error) {
    if (error.code === '23505') {
      return { profile: null, error: 'That username is already taken. Please choose another.' };
    }
    return { profile: null, error: error.message };
  }

  return {
    profile: {
      id: data.id,
      username: data.username || null,
      displayName: data.display_name,
      bio: data.bio || '',
      avatarUrl: data.avatar_url || null,
      favoriteGenres: Array.isArray(data.favorite_genres) ? data.favorite_genres : [],
      createdAt: data.created_at,
      updatedAt: data.updated_at,
    },
    error: null,
  };
}

// ============================================================================
// Watchlist & Favourites Operations (public.watchlist_items)
// ============================================================================

function mapDbWatchlistRow(row: any): WatchlistEntry {
  const snapshot =
    row.media_snapshot && typeof row.media_snapshot === 'object' && row.media_snapshot.id
      ? (row.media_snapshot as MediaItem)
      : undefined;

  return {
    id: row.id,
    mediaId: row.media_id,
    tmdbId: row.tmdb_id,
    mediaType: (row.media_type as MediaType) || snapshot?.type || 'movie',
    status: fromDbStatus(row.status),
    isFavourite: Boolean(row.is_favourite),
    addedAt: row.added_at ? String(row.added_at).split('T')[0] : new Date().toISOString().split('T')[0],
    updatedAt: row.updated_at,
    personalRating: row.personal_rating ?? 0,
    personalNotes: row.notes ?? '',
    mediaSnapshot: snapshot,
  };
}

export async function fetchUserWatchlist(
  userId: string
): Promise<{ items: WatchlistEntry[]; schemaMissing?: boolean; error: string | null }> {
  const { client } = await ensureSupabaseClient();
  if (!client) {
    return { items: [], error: 'Supabase is not configured.' };
  }

  const { data, error } = await client
    .from('watchlist_items')
    .select('*')
    .eq('user_id', userId)
    .order('added_at', { ascending: false });

  if (error) {
    if (isSchemaMissingError(error)) {
      return {
        items: [],
        schemaMissing: true,
        error: 'Database table "public.watchlist_items" was not found. Please run the Phase 3 SQL schema in your Supabase SQL Editor.',
      };
    }
    return { items: [], error: error.message };
  }

  return {
    items: (data || []).map(mapDbWatchlistRow),
    error: null,
  };
}

export async function upsertWatchlistItem(
  userId: string,
  entry: WatchlistEntry
): Promise<{
  item: WatchlistEntry | null;
  migrationNeeded?: boolean;
  error: string | null;
}> {
  const { client } = await ensureSupabaseClient();
  if (!client) {
    return { item: null, error: 'Supabase is not configured.' };
  }

  const media = entry.mediaSnapshot;
  const tmdbId = entry.tmdbId || extractNumericTmdbId(entry.mediaId, media);
  const mediaType: MediaType = entry.mediaType || media?.type || 'movie';
  const validRating =
    entry.personalRating && entry.personalRating >= 1 && entry.personalRating <= 10
      ? Math.round(entry.personalRating)
      : null;

  const payload = {
    user_id: userId,
    media_id: entry.mediaId,
    tmdb_id: tmdbId,
    media_type: mediaType,
    status: toDbStatus(entry.status),
    is_favourite: Boolean(entry.isFavourite),
    personal_rating: validRating,
    notes: entry.personalNotes ? entry.personalNotes.slice(0, 1000) : null,
    media_snapshot: media || {},
  };

  const { data, error } = await client
    .from('watchlist_items')
    .upsert(payload, { onConflict: 'user_id,media_id' })
    .select('*')
    .single();

  if (error) {
    if (isConstraintError(error)) {
      return {
        item: null,
        migrationNeeded: true,
        error:
          'Your Supabase watchlist_items table needs a quick SQL constraint update to store "On Hold" and "Dropped" statuses in the cloud. Copy and run the Checklist Migration SQL in your Supabase SQL Editor.',
      };
    }
    return { item: null, error: error.message };
  }

  return { item: mapDbWatchlistRow(data), error: null };
}

export async function deleteWatchlistItem(
  userId: string,
  mediaId: string
): Promise<{ error: string | null }> {
  const { client } = await ensureSupabaseClient();
  if (!client) {
    return { error: 'Supabase is not configured.' };
  }

  const { error } = await client
    .from('watchlist_items')
    .delete()
    .eq('user_id', userId)
    .eq('media_id', mediaId);

  return { error: error ? error.message : null };
}

export async function batchImportLocalWatchlist(
  userId: string,
  entries: WatchlistEntry[]
): Promise<{ items: WatchlistEntry[]; error: string | null }> {
  const { client } = await ensureSupabaseClient();
  if (!client) {
    return { items: [], error: 'Supabase is not configured.' };
  }
  if (entries.length === 0) return { items: [], error: null };

  const rows = entries.map((entry) => {
    const media = entry.mediaSnapshot;
    const validRating =
      entry.personalRating && entry.personalRating >= 1 && entry.personalRating <= 10
        ? Math.round(entry.personalRating)
        : null;
    return {
      user_id: userId,
      media_id: entry.mediaId,
      tmdb_id: entry.tmdbId || extractNumericTmdbId(entry.mediaId, media),
      media_type: entry.mediaType || media?.type || 'movie',
      status: toDbStatus(entry.status),
      is_favourite: Boolean(entry.isFavourite),
      personal_rating: validRating,
      notes: entry.personalNotes ? entry.personalNotes.slice(0, 1000) : null,
      media_snapshot: media || {},
    };
  });

  const { data, error } = await client
    .from('watchlist_items')
    .upsert(rows, { onConflict: 'user_id,media_id' })
    .select('*');

  if (error) {
    return { items: [], error: error.message };
  }

  return { items: (data || []).map(mapDbWatchlistRow), error: null };
}

// ============================================================================
// Watch History Operations (public.watch_history)
// ============================================================================

function mapDbHistoryRow(row: any): WatchHistoryEntry {
  const snapshot =
    row.media_snapshot && typeof row.media_snapshot === 'object' && row.media_snapshot.id
      ? (row.media_snapshot as MediaItem)
      : undefined;

  return {
    id: row.id,
    userId: row.user_id,
    mediaId: row.media_id,
    tmdbId: row.tmdb_id,
    mediaType: (row.media_type as MediaType) || snapshot?.type || 'movie',
    watchedAt: row.watched_at || new Date().toISOString(),
    personalRating: row.personal_rating ?? undefined,
    reviewNotes: row.review_notes ?? '',
    runtimeMinutes: Number(row.runtime_minutes) || parseRuntimeMinutes(snapshot),
    mediaSnapshot: snapshot,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export async function fetchUserWatchHistory(
  userId: string
): Promise<{ history: WatchHistoryEntry[]; schemaMissing?: boolean; error: string | null }> {
  const { client } = await ensureSupabaseClient();
  if (!client) {
    return { history: [], error: 'Supabase is not configured.' };
  }

  const { data, error } = await client
    .from('watch_history')
    .select('*')
    .eq('user_id', userId)
    .order('watched_at', { ascending: false });

  if (error) {
    if (isSchemaMissingError(error)) {
      return {
        history: [],
        schemaMissing: true,
        error: 'Database table "public.watch_history" was not found. Please run the Phase 3 SQL schema in your Supabase SQL Editor.',
      };
    }
    return { history: [], error: error.message };
  }

  return {
    history: (data || []).map(mapDbHistoryRow),
    error: null,
  };
}

export async function upsertWatchHistoryItem(
  userId: string,
  params: {
    mediaId: string;
    media?: MediaItem;
    watchedAt?: string;
    personalRating?: number;
    reviewNotes?: string;
  }
): Promise<{ entry: WatchHistoryEntry | null; error: string | null }> {
  const { client } = await ensureSupabaseClient();
  if (!client) {
    return { entry: null, error: 'Supabase is not configured.' };
  }

  const tmdbId = extractNumericTmdbId(params.mediaId, params.media);
  const mediaType: MediaType = params.media?.type || 'movie';
  const runtimeMinutes = parseRuntimeMinutes(params.media);
  const validRating =
    params.personalRating && params.personalRating >= 1 && params.personalRating <= 10
      ? Math.round(params.personalRating)
      : null;

  let isoWatchedAt = new Date().toISOString();
  if (params.watchedAt) {
    const parsed = new Date(params.watchedAt);
    if (!Number.isNaN(parsed.getTime())) {
      isoWatchedAt = parsed.toISOString();
    }
  }

  const payload = {
    user_id: userId,
    media_id: params.mediaId,
    tmdb_id: tmdbId,
    media_type: mediaType,
    watched_at: isoWatchedAt,
    personal_rating: validRating,
    review_notes: params.reviewNotes ? params.reviewNotes.slice(0, 2000) : null,
    runtime_minutes: runtimeMinutes,
    media_snapshot: params.media || {},
  };

  const { data, error } = await client
    .from('watch_history')
    .upsert(payload, { onConflict: 'user_id,media_id' })
    .select('*')
    .single();

  if (error) {
    return { entry: null, error: error.message };
  }

  return { entry: mapDbHistoryRow(data), error: null };
}

export async function deleteWatchHistoryItem(
  userId: string,
  mediaId: string
): Promise<{ error: string | null }> {
  const { client } = await ensureSupabaseClient();
  if (!client) {
    return { error: 'Supabase is not configured.' };
  }

  const { error } = await client
    .from('watch_history')
    .delete()
    .eq('user_id', userId)
    .eq('media_id', mediaId);

  return { error: error ? error.message : null };
}

// ============================================================================
// TV Series Watched Episodes Operations (public.watched_episodes)
// ============================================================================

function mapDbEpisodeRow(row: any): WatchedEpisodeEntry {
  return {
    id: row.id,
    userId: row.user_id,
    mediaId: row.media_id,
    seasonNumber: Number(row.season_number) || 1,
    episodeNumber: Number(row.episode_number) || 1,
    watchedAt: row.watched_at || new Date().toISOString(),
  };
}

export async function fetchUserWatchedEpisodes(
  userId: string
): Promise<{
  episodes: WatchedEpisodeEntry[];
  migrationNeeded?: boolean;
  error: string | null;
}> {
  const { client } = await ensureSupabaseClient();
  if (!client) {
    return { episodes: [], error: 'Supabase is not configured.' };
  }

  const { data, error } = await client
    .from('watched_episodes')
    .select('*')
    .eq('user_id', userId)
    .order('season_number', { ascending: true })
    .order('episode_number', { ascending: true });

  if (error) {
    if (isSchemaMissingError(error)) {
      // Do not block the main app if the new watched_episodes table hasn't been created yet
      return {
        episodes: [],
        migrationNeeded: true,
        error: null,
      };
    }
    return { episodes: [], error: error.message };
  }

  return {
    episodes: (data || []).map(mapDbEpisodeRow),
    error: null,
  };
}

export async function toggleWatchedEpisodeInDb(
  userId: string,
  mediaId: string,
  seasonNumber: number,
  episodeNumber: number,
  watched: boolean
): Promise<{
  entry: WatchedEpisodeEntry | null;
  migrationNeeded?: boolean;
  error: string | null;
}> {
  const { client } = await ensureSupabaseClient();
  if (!client) {
    return { entry: null, error: 'Supabase is not configured.' };
  }

  if (watched) {
    const { data, error } = await client
      .from('watched_episodes')
      .upsert(
        {
          user_id: userId,
          media_id: mediaId,
          season_number: seasonNumber,
          episode_number: episodeNumber,
          watched_at: new Date().toISOString(),
        },
        { onConflict: 'user_id,media_id,season_number,episode_number' }
      )
      .select('*')
      .single();

    if (error) {
      if (isSchemaMissingError(error)) {
        return {
          entry: null,
          migrationNeeded: true,
          error:
            'Episode progress was saved locally. Run the Checklist Migration SQL in your Supabase SQL Editor to create "public.watched_episodes" for cloud sync.',
        };
      }
      return { entry: null, error: error.message };
    }
    return { entry: mapDbEpisodeRow(data), error: null };
  } else {
    const { error } = await client
      .from('watched_episodes')
      .delete()
      .eq('user_id', userId)
      .eq('media_id', mediaId)
      .eq('season_number', seasonNumber)
      .eq('episode_number', episodeNumber);

    if (error) {
      if (isSchemaMissingError(error)) {
        return { entry: null, migrationNeeded: true, error: null };
      }
      return { entry: null, error: error.message };
    }
    return { entry: null, error: null };
  }
}

export async function setSeasonEpisodesWatchedInDb(
  userId: string,
  mediaId: string,
  seasonNumber: number,
  episodeNumbers: number[],
  watched: boolean
): Promise<{
  entries: WatchedEpisodeEntry[];
  migrationNeeded?: boolean;
  error: string | null;
}> {
  const { client } = await ensureSupabaseClient();
  if (!client) {
    return { entries: [], error: 'Supabase is not configured.' };
  }

  if (watched) {
    if (episodeNumbers.length === 0) return { entries: [], error: null };
    const nowIso = new Date().toISOString();
    const rows = episodeNumbers.map((epNum) => ({
      user_id: userId,
      media_id: mediaId,
      season_number: seasonNumber,
      episode_number: epNum,
      watched_at: nowIso,
    }));

    const { data, error } = await client
      .from('watched_episodes')
      .upsert(rows, { onConflict: 'user_id,media_id,season_number,episode_number' })
      .select('*');

    if (error) {
      if (isSchemaMissingError(error)) {
        return {
          entries: [],
          migrationNeeded: true,
          error:
            'Season progress was saved locally. Run the Checklist Migration SQL in your Supabase SQL Editor to sync "public.watched_episodes" to the cloud.',
        };
      }
      return { entries: [], error: error.message };
    }
    return { entries: (data || []).map(mapDbEpisodeRow), error: null };
  } else {
    const { error } = await client
      .from('watched_episodes')
      .delete()
      .eq('user_id', userId)
      .eq('media_id', mediaId)
      .eq('season_number', seasonNumber);

    if (error) {
      if (isSchemaMissingError(error)) {
        return { entries: [], migrationNeeded: true, error: null };
      }
      return { entries: [], error: error.message };
    }
    return { entries: [], error: null };
  }
}

export async function batchImportLocalWatchedEpisodes(
  userId: string,
  episodes: WatchedEpisodeEntry[]
): Promise<{ entries: WatchedEpisodeEntry[]; error: string | null }> {
  const { client } = await ensureSupabaseClient();
  if (!client || episodes.length === 0) {
    return { entries: [], error: null };
  }

  const rows = episodes.map((ep) => ({
    user_id: userId,
    media_id: ep.mediaId,
    season_number: ep.seasonNumber,
    episode_number: ep.episodeNumber,
    watched_at: ep.watchedAt || new Date().toISOString(),
  }));

  const { data, error } = await client
    .from('watched_episodes')
    .upsert(rows, { onConflict: 'user_id,media_id,season_number,episode_number' })
    .select('*');

  if (error) {
    if (isSchemaMissingError(error)) {
      return { entries: [], error: null };
    }
    return { entries: [], error: error.message };
  }

  return { entries: (data || []).map(mapDbEpisodeRow), error: null };
}
