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
CREATE POLICY "Users can delete own watched episodes" ON public.watched_episodes FOR DELETE TO authenticated USING (auth.uid() = user_id);

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('avatars', 'avatars', true, 5242880, ARRAY['image/jpeg', 'image/png', 'image/webp'])
ON CONFLICT (id) DO UPDATE
SET public = EXCLUDED.public, file_size_limit = EXCLUDED.file_size_limit, allowed_mime_types = EXCLUDED.allowed_mime_types;

DROP POLICY IF EXISTS "Avatar images are publicly readable" ON storage.objects;
CREATE POLICY "Avatar images are publicly readable" ON storage.objects FOR SELECT USING (bucket_id = 'avatars');
DROP POLICY IF EXISTS "Users can upload own avatar in own folder" ON storage.objects;
CREATE POLICY "Users can upload own avatar in own folder" ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id = 'avatars' AND (storage.foldername(name))[1] = auth.uid()::text);
DROP POLICY IF EXISTS "Users can update own avatar in own folder" ON storage.objects;
CREATE POLICY "Users can update own avatar in own folder" ON storage.objects FOR UPDATE TO authenticated USING (bucket_id = 'avatars' AND (storage.foldername(name))[1] = auth.uid()::text) WITH CHECK (bucket_id = 'avatars' AND (storage.foldername(name))[1] = auth.uid()::text);
DROP POLICY IF EXISTS "Users can delete own avatar in own folder" ON storage.objects;
CREATE POLICY "Users can delete own avatar in own folder" ON storage.objects FOR DELETE TO authenticated USING (bucket_id = 'avatars' AND (storage.foldername(name))[1] = auth.uid()::text);`;

export const SUPABASE_AVATARS_BUCKET_SQL = `-- CineMax Profile Picture Upload — Supabase Storage Setup (\`avatars\` Bucket)
-- Run this non-destructive script in your Supabase SQL Editor.

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
  );`;

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
let resolvedUrl = normalizeSupabaseBaseUrl(import.meta.env?.VITE_SUPABASE_URL || '');
let resolvedAnonKey = (import.meta.env?.VITE_SUPABASE_ANON_KEY || '').trim();
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

export interface RecoveryUrlSnapshot {
  isRecoveryLink: boolean;
  recoveryError: string | null;
  code: string | null;
  tokenHash: string | null;
  accessToken: string | null;
  refreshToken: string | null;
  rawUrl: string;
}

const RECOVERY_SESSION_STORAGE_KEY = 'cinemax_password_recovery_active';
const RECOVERY_ERROR_STORAGE_KEY = 'cinemax_password_recovery_error';

function parseParamsFromSegment(segment: string): URLSearchParams {
  const cleaned = (segment || '').replace(/^[#?]/, '');
  return new URLSearchParams(cleaned);
}

export function inspectRecoveryUrlState(urlString?: string): RecoveryUrlSnapshot {
  const rawUrl =
    urlString ?? (typeof window !== 'undefined' ? window.location.href : '');
  if (!rawUrl) {
    return {
      isRecoveryLink: false,
      recoveryError: null,
      code: null,
      tokenHash: null,
      accessToken: null,
      refreshToken: null,
      rawUrl: '',
    };
  }

  let searchStr = '';
  let hashStr = '';
  const isCustomScheme = rawUrl.startsWith('in.vertexstudios.cinemax://');

  try {
    const parsed = new URL(rawUrl);
    searchStr = parsed.search || '';
    hashStr = parsed.hash || '';
  } catch {
    const hashIdx = rawUrl.indexOf('#');
    const queryIdx = rawUrl.indexOf('?');
    if (queryIdx !== -1) {
      searchStr =
        hashIdx !== -1 && hashIdx > queryIdx
          ? rawUrl.slice(queryIdx, hashIdx)
          : rawUrl.slice(queryIdx);
    }
    if (hashIdx !== -1) {
      hashStr = rawUrl.slice(hashIdx);
    }
  }

  // Handle cases where hash itself contains a query string (e.g. #/reset-password?type=recovery)
  let hashPath = hashStr.replace(/^#/, '');
  let extraHashQuery = '';
  const hashQueryIdx = hashPath.indexOf('?');
  if (hashQueryIdx !== -1) {
    extraHashQuery = hashPath.slice(hashQueryIdx + 1);
    hashPath = hashPath.slice(0, hashQueryIdx);
  }

  const searchParams = parseParamsFromSegment(searchStr);
  const hashParams = parseParamsFromSegment(
    extraHashQuery ? `${hashPath}&${extraHashQuery}` : hashStr
  );

  const mode = (
    searchParams.get('mode') ||
    hashParams.get('mode') ||
    ''
  ).toLowerCase();
  const type = (
    searchParams.get('type') ||
    hashParams.get('type') ||
    ''
  ).toLowerCase();
  const code = searchParams.get('code') || hashParams.get('code') || null;
  const tokenHash =
    searchParams.get('token_hash') || hashParams.get('token_hash') || null;
  const accessToken =
    hashParams.get('access_token') || searchParams.get('access_token') || null;
  const refreshToken =
    hashParams.get('refresh_token') ||
    searchParams.get('refresh_token') ||
    null;

  const errorCode =
    hashParams.get('error_code') || searchParams.get('error_code') || '';
  const errorDesc =
    hashParams.get('error_description') ||
    searchParams.get('error_description') ||
    hashParams.get('error') ||
    searchParams.get('error') ||
    '';

  const hasExplicitRecoveryMarker =
    mode === 'reset-password' ||
    type === 'recovery' ||
    (isCustomScheme && rawUrl.toLowerCase().includes('reset-password')) ||
    hashPath.toLowerCase().includes('reset-password');

  const hasOtpExpiredOnUrl =
    errorCode.toLowerCase() === 'otp_expired' ||
    errorDesc.toLowerCase().includes('email link is invalid or has expired');

  let recoveryError: string | null = null;
  if ((hasExplicitRecoveryMarker || hasOtpExpiredOnUrl) && (errorCode || errorDesc)) {
    const decoded = decodeURIComponent(errorDesc.replace(/\+/g, ' ')).trim();
    if (
      errorCode.toLowerCase() === 'otp_expired' ||
      decoded.toLowerCase().includes('expired') ||
      decoded.toLowerCase().includes('invalid')
    ) {
      recoveryError =
        'This password reset link is invalid, has expired, or has already been used. Please request a new password reset link below.';
    } else {
      recoveryError =
        decoded ||
        'Unable to verify this password reset link. Please request a new link.';
    }
  }

  return {
    isRecoveryLink: Boolean(hasExplicitRecoveryMarker || hasOtpExpiredOnUrl),
    recoveryError,
    code,
    tokenHash,
    accessToken,
    refreshToken,
    rawUrl,
  };
}

// Capture the initial URL snapshot BEFORE createClient(detectSessionInUrl: true) strips the URL hash
let activeRecoverySnapshot: RecoveryUrlSnapshot =
  typeof window !== 'undefined'
    ? inspectRecoveryUrlState(window.location.href)
    : {
        isRecoveryLink: false,
        recoveryError: null,
        code: null,
        tokenHash: null,
        accessToken: null,
        refreshToken: null,
        rawUrl: '',
      };

if (typeof window !== 'undefined') {
  try {
    if (activeRecoverySnapshot.isRecoveryLink) {
      sessionStorage.setItem(RECOVERY_SESSION_STORAGE_KEY, '1');
      if (activeRecoverySnapshot.recoveryError) {
        sessionStorage.setItem(
          RECOVERY_ERROR_STORAGE_KEY,
          activeRecoverySnapshot.recoveryError
        );
      } else {
        sessionStorage.removeItem(RECOVERY_ERROR_STORAGE_KEY);
      }
    } else if (sessionStorage.getItem(RECOVERY_SESSION_STORAGE_KEY) === '1') {
      const savedErr = sessionStorage.getItem(RECOVERY_ERROR_STORAGE_KEY);
      activeRecoverySnapshot = {
        ...activeRecoverySnapshot,
        isRecoveryLink: true,
        recoveryError: savedErr || null,
      };
    }
  } catch {
    // Ignore storage access errors in restricted webviews
  }
}

export function isPasswordRecoveryFlowActive(): boolean {
  if (activeRecoverySnapshot.isRecoveryLink) return true;
  if (typeof window !== 'undefined') {
    const current = inspectRecoveryUrlState(window.location.href);
    if (current.isRecoveryLink) {
      activeRecoverySnapshot = current;
      return true;
    }
    try {
      return sessionStorage.getItem(RECOVERY_SESSION_STORAGE_KEY) === '1';
    } catch {
      return false;
    }
  }
  return false;
}

export function getPasswordRecoveryError(): string | null {
  if (activeRecoverySnapshot.recoveryError) {
    return activeRecoverySnapshot.recoveryError;
  }
  if (typeof window !== 'undefined') {
    try {
      return sessionStorage.getItem(RECOVERY_ERROR_STORAGE_KEY);
    } catch {
      return null;
    }
  }
  return null;
}

export function clearPasswordRecoveryFlowState(): void {
  activeRecoverySnapshot = {
    isRecoveryLink: false,
    recoveryError: null,
    code: null,
    tokenHash: null,
    accessToken: null,
    refreshToken: null,
    rawUrl: '',
  };
  if (typeof window !== 'undefined') {
    try {
      sessionStorage.removeItem(RECOVERY_SESSION_STORAGE_KEY);
      sessionStorage.removeItem(RECOVERY_ERROR_STORAGE_KEY);
    } catch {
      // Ignore
    }
    try {
      const url = new URL(window.location.href);
      url.searchParams.delete('mode');
      url.searchParams.delete('type');
      url.searchParams.delete('code');
      url.searchParams.delete('token_hash');
      url.searchParams.delete('error');
      url.searchParams.delete('error_code');
      url.searchParams.delete('error_description');
      const cleanSearch = url.searchParams.toString();
      const cleanPath =
        url.pathname + (cleanSearch ? `?${cleanSearch}` : '');
      window.history.replaceState({}, document.title, cleanPath);
    } catch {
      // Ignore URL cleanup errors on non-standard schemes
    }
  }
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
        const rawEnvBase = (import.meta.env.VITE_API_BASE_URL || '').trim().replace(/\/$/, '');
        const isStaticOrCap =
          typeof window !== 'undefined' &&
          (window.location.hostname.toLowerCase().endsWith('.github.io') ||
            Boolean((window as any).Capacitor?.isNativePlatform?.()) ||
            window.location.protocol === 'capacitor:' ||
            window.location.protocol === 'file:' ||
            (window.location.hostname.toLowerCase() === 'localhost' &&
              !window.location.port));
        const apiBase =
          rawEnvBase && rawEnvBase !== 'MY_APP_URL'
            ? rawEnvBase
            : isStaticOrCap
            ? 'https://cinemax-kxpv.onrender.com'
            : '';
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
  if (!client) {
    initPromise = null;
  }
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
// Authentication & Password Management Operations
// ============================================================================

export const ANDROID_RESET_PASSWORD_DEEP_LINK =
  'in.vertexstudios.cinemax://reset-password';
export const GITHUB_PAGES_RESET_PASSWORD_URL =
  'https://tosifrehan42.github.io/CineMax/?mode=reset-password';

export function isCapacitorNativePlatform(): boolean {
  if (typeof window === 'undefined') return false;
  return (
    Boolean((window as any).Capacitor?.isNativePlatform?.()) ||
    window.location.protocol === 'capacitor:' ||
    window.location.protocol === 'file:'
  );
}

export function getPasswordResetRedirectUrl(): {
  redirectTo: string;
  androidSchemeUrl: string;
  webFallbackUrl: string;
} {
  const customEnvRedirect = (
    import.meta.env?.VITE_PASSWORD_RESET_REDIRECT_URL || ''
  ).trim();
  if (customEnvRedirect) {
    return {
      redirectTo: customEnvRedirect,
      androidSchemeUrl: ANDROID_RESET_PASSWORD_DEEP_LINK,
      webFallbackUrl: GITHUB_PAGES_RESET_PASSWORD_URL,
    };
  }

  if (typeof window === 'undefined' || isCapacitorNativePlatform()) {
    // Use the universal HTTPS GitHub Pages reset URL by default so links work on both
    // Android (via App Links / "Open in CineMax App" deep link bridge) and desktop/mobile browsers
    return {
      redirectTo: GITHUB_PAGES_RESET_PASSWORD_URL,
      androidSchemeUrl: ANDROID_RESET_PASSWORD_DEEP_LINK,
      webFallbackUrl: GITHUB_PAGES_RESET_PASSWORD_URL,
    };
  }

  const origin = window.location.origin;
  const host = window.location.hostname.toLowerCase();
  if (host.endsWith('.github.io')) {
    return {
      redirectTo: `${origin}/CineMax/?mode=reset-password`,
      androidSchemeUrl: ANDROID_RESET_PASSWORD_DEEP_LINK,
      webFallbackUrl: `${origin}/CineMax/?mode=reset-password`,
    };
  }

  const rawBase = import.meta.env?.BASE_URL || '/';
  const normalizedBase = rawBase.endsWith('/') ? rawBase : `${rawBase}/`;
  const redirectTo = `${origin}${normalizedBase}?mode=reset-password`;

  return {
    redirectTo,
    androidSchemeUrl: ANDROID_RESET_PASSWORD_DEEP_LINK,
    webFallbackUrl: GITHUB_PAGES_RESET_PASSWORD_URL,
  };
}

export function buildAndroidDeepLinkFromCurrentUrl(): string {
  if (typeof window === 'undefined') return ANDROID_RESET_PASSWORD_DEEP_LINK;
  const search = window.location.search || '';
  const hash = window.location.hash || '';
  return `${ANDROID_RESET_PASSWORD_DEEP_LINK}${search}${hash}`;
}

export function validatePasswordPolicy(
  password: string,
  confirmPassword?: string
): { valid: boolean; error: string | null } {
  if (!password) {
    return { valid: false, error: 'Please enter a password.' };
  }
  if (password.length < 6) {
    return {
      valid: false,
      error: 'Password must be at least 6 characters long.',
    };
  }
  if (password.length > 72) {
    return {
      valid: false,
      error: 'Password must be 72 characters or fewer.',
    };
  }
  if (confirmPassword !== undefined && password !== confirmPassword) {
    return {
      valid: false,
      error: 'Passwords do not match. Please re-enter your confirmation password.',
    };
  }
  return { valid: true, error: null };
}

export function formatAuthErrorMessage(rawMessage: string | null | undefined): string {
  const msg = (rawMessage || '').trim();
  if (!msg) return 'Authentication failed. Please try again.';
  const lower = msg.toLowerCase();
  if (lower.includes('invalid login credentials')) {
    return 'Invalid email or password. Please check your credentials and try again, or create a new account.';
  }
  if (lower.includes('email not confirmed')) {
    return 'Your email address has not been confirmed yet. Please check your inbox (and spam folder) for the confirmation link.';
  }
  if (lower.includes('user already registered') || lower.includes('already been registered')) {
    return 'An account with this email already exists. Please switch to Sign In to access your account.';
  }
  if (lower.includes('same_password') || lower.includes('different from the old password')) {
    return 'Your new password must be different from your current password.';
  }
  if (
    lower.includes('otp_expired') ||
    lower.includes('email link is invalid or has expired') ||
    lower.includes('token has expired') ||
    lower.includes('auth session missing')
  ) {
    return 'This password reset session has expired or is no longer valid. Please request a new password reset link.';
  }
  if (lower.includes('redirect') && (lower.includes('not allowed') || lower.includes('invalid'))) {
    return 'The password reset redirect URL is not allowlisted in Supabase Auth yet. Ensure https://tosifrehan42.github.io/CineMax/** and in.vertexstudios.cinemax://reset-password are added under Authentication → URL Configuration.';
  }
  if (lower.includes('failed to fetch') || lower.includes('networkerror') || lower.includes('load failed')) {
    return 'Unable to reach the authentication service. Please check your internet connection and try again.';
  }
  if (lower.includes('rate limit') || lower.includes('too many requests') || lower.includes('over_email_send_rate_limit') || lower.includes('for security purposes, you can only request this')) {
    return 'Too many requests in a short period. Please wait a minute before requesting another email.';
  }
  return msg;
}

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
    return { user: null, session: null, error: formatAuthErrorMessage(error.message) };
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
    return { user: null, session: null, error: formatAuthErrorMessage(error.message) };
  }
  return { user: data.user, session: data.session, error: null };
}

export async function signOutUser(): Promise<{ error: string | null }> {
  clearPasswordRecoveryFlowState();
  const { client } = await ensureSupabaseClient();
  if (!client) return { error: null };
  const { error } = await client.auth.signOut();
  return { error: error ? formatAuthErrorMessage(error.message) : null };
}

export async function requestPasswordResetEmail(
  email: string
): Promise<{ error: string | null; redirectTo: string }> {
  const cleanEmail = (email || '').trim();
  const { redirectTo } = getPasswordResetRedirectUrl();

  if (!cleanEmail) {
    return { error: 'Please enter your email address.', redirectTo };
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail)) {
    return {
      error: 'Please enter a valid email address (for example, name@example.com).',
      redirectTo,
    };
  }

  const { client, securityWarning: secWarn } = await ensureSupabaseClient();
  if (!client) {
    return {
      error:
        secWarn ||
        'Supabase is not configured yet. Please set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY in your environment secrets.',
      redirectTo,
    };
  }

  const { error } = await client.auth.resetPasswordForEmail(cleanEmail, {
    redirectTo,
  });

  if (error) {
    return {
      error: formatAuthErrorMessage(error.message),
      redirectTo,
    };
  }

  return { error: null, redirectTo };
}

export async function exchangeRecoveryUrlForSession(
  incomingUrl?: string
): Promise<{ session: Session | null; error: string | null }> {
  const { client, securityWarning: secWarn } = await ensureSupabaseClient();
  if (!client) {
    return {
      session: null,
      error:
        secWarn ||
        'Supabase authentication service is not configured yet.',
    };
  }

  const snapshot = incomingUrl
    ? inspectRecoveryUrlState(incomingUrl)
    : activeRecoverySnapshot.rawUrl
    ? activeRecoverySnapshot
    : inspectRecoveryUrlState(
        typeof window !== 'undefined' ? window.location.href : ''
      );

  if (incomingUrl && snapshot.isRecoveryLink) {
    activeRecoverySnapshot = snapshot;
    try {
      sessionStorage.setItem(RECOVERY_SESSION_STORAGE_KEY, '1');
      if (snapshot.recoveryError) {
        sessionStorage.setItem(
          RECOVERY_ERROR_STORAGE_KEY,
          snapshot.recoveryError
        );
      } else {
        sessionStorage.removeItem(RECOVERY_ERROR_STORAGE_KEY);
      }
    } catch {
      // Ignore
    }
  }

  if (snapshot.recoveryError) {
    return { session: null, error: snapshot.recoveryError };
  }

  try {
    // 1. Explicit #access_token & #refresh_token (Implicit flow or Android custom scheme deep link)
    if (snapshot.accessToken && snapshot.refreshToken) {
      const { data, error } = await client.auth.setSession({
        access_token: snapshot.accessToken,
        refresh_token: snapshot.refreshToken,
      });
      if (error) {
        return {
          session: null,
          error: formatAuthErrorMessage(error.message),
        };
      }
      if (data.session) {
        return { session: data.session, error: null };
      }
    }

    // 2. Explicit token_hash OTP verification (?token_hash=...&type=recovery)
    if (snapshot.tokenHash) {
      const { data, error } = await client.auth.verifyOtp({
        token_hash: snapshot.tokenHash,
        type: 'recovery',
      });
      if (error) {
        return {
          session: null,
          error: formatAuthErrorMessage(error.message),
        };
      }
      if (data.session) {
        return { session: data.session, error: null };
      }
    }

    // 3. PKCE code exchange (?code=...)
    if (snapshot.code) {
      // Check if detectSessionInUrl already exchanged it
      const existing = await client.auth.getSession();
      if (existing.data.session) {
        return { session: existing.data.session, error: null };
      }
      const { data, error } = await client.auth.exchangeCodeForSession(
        snapshot.code
      );
      if (error) {
        return {
          session: null,
          error: formatAuthErrorMessage(error.message),
        };
      }
      if (data.session) {
        return { session: data.session, error: null };
      }
    }

    // 4. Check existing session established automatically by Supabase detectSessionInUrl
    const { data, error } = await client.auth.getSession();
    if (error) {
      return { session: null, error: formatAuthErrorMessage(error.message) };
    }
    if (data.session) {
      return { session: data.session, error: null };
    }

    return {
      session: null,
      error:
        'This password reset link is invalid, has expired, or has already been used. Please request a new password reset link.',
    };
  } catch (err: any) {
    return {
      session: null,
      error: formatAuthErrorMessage(err?.message),
    };
  }
}

export async function completePasswordReset(
  newPassword: string,
  confirmPassword?: string
): Promise<{ user: User | null; error: string | null }> {
  const validation = validatePasswordPolicy(newPassword, confirmPassword);
  if (!validation.valid) {
    return { user: null, error: validation.error };
  }

  const { client, securityWarning: secWarn } = await ensureSupabaseClient();
  if (!client) {
    return {
      user: null,
      error:
        secWarn ||
        'Supabase authentication service is not configured yet.',
    };
  }

  const { data: sessionData } = await client.auth.getSession();
  if (!sessionData?.session) {
    return {
      user: null,
      error:
        'Your password recovery session has expired or is missing. Please request a new password reset link.',
    };
  }

  const { data, error } = await client.auth.updateUser({
    password: newPassword,
  });

  if (error) {
    return { user: null, error: formatAuthErrorMessage(error.message) };
  }

  clearPasswordRecoveryFlowState();
  return { user: data.user, error: null };
}

export async function changeSignedInUserPassword(
  email: string,
  currentPassword: string,
  newPassword: string,
  confirmPassword?: string
): Promise<{ error: string | null }> {
  if (!currentPassword) {
    return { error: 'Please enter your current password to verify your identity.' };
  }

  const validation = validatePasswordPolicy(newPassword, confirmPassword);
  if (!validation.valid) {
    return { error: validation.error };
  }

  if (currentPassword === newPassword) {
    return {
      error: 'Your new password must be different from your current password.',
    };
  }

  const cleanEmail = (email || '').trim();
  if (!cleanEmail) {
    return {
      error: 'Unable to determine your account email address. Please sign out and sign in again.',
    };
  }

  const { client, securityWarning: secWarn } = await ensureSupabaseClient();
  if (!client) {
    return {
      error:
        secWarn ||
        'Supabase authentication service is not configured yet.',
    };
  }

  // Step 1: Re-authenticate with current password to verify user identity
  const { error: verifyError } = await client.auth.signInWithPassword({
    email: cleanEmail,
    password: currentPassword,
  });

  if (verifyError) {
    const lower = (verifyError.message || '').toLowerCase();
    if (lower.includes('invalid login credentials')) {
      return {
        error:
          'Your current password is incorrect. Please check your current password and try again.',
      };
    }
    return { error: formatAuthErrorMessage(verifyError.message) };
  }

  // Step 2: Update password via Supabase Auth
  const { error: updateError } = await client.auth.updateUser({
    password: newPassword,
  });

  if (updateError) {
    return { error: formatAuthErrorMessage(updateError.message) };
  }

  return { error: null };
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

  const payload: Record<string, unknown> = {
    id: userId,
    display_name: updates.displayName.trim() || 'Cinema Enthusiast',
    username: cleanUsername,
    bio: (updates.bio ?? '').trim().slice(0, 500),
    favorite_genres: updates.favoriteGenres || [],
  };

  if (updates.avatarUrl !== undefined) {
    payload.avatar_url = updates.avatarUrl?.trim() || null;
  }

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
// Profile Picture Upload & Storage Operations (`avatars` Bucket + `public.profiles.avatar_url`)
// ============================================================================

export const ALLOWED_AVATAR_MIME_TYPES = [
  'image/jpeg',
  'image/png',
  'image/webp',
] as const;

export const MAX_AVATAR_INPUT_BYTES = 10 * 1024 * 1024; // 10 MB raw selection limit
export const MAX_AVATAR_UPLOAD_BYTES = 5 * 1024 * 1024; // 5 MB Supabase Storage bucket limit

export function validateAvatarFile(
  file: { type: string; size: number },
  maxBytes: number = MAX_AVATAR_INPUT_BYTES
): { valid: boolean; error: string | null } {
  if (!file || typeof file.size !== 'number') {
    return { valid: false, error: 'Please select a valid image file.' };
  }
  const mime = (file.type || '').toLowerCase();
  if (
    !ALLOWED_AVATAR_MIME_TYPES.includes(
      mime as (typeof ALLOWED_AVATAR_MIME_TYPES)[number]
    )
  ) {
    return {
      valid: false,
      error: 'Unsupported file format. Please choose a JPEG, PNG, or WebP image.',
    };
  }
  if (file.size <= 0) {
    return { valid: false, error: 'The selected image file is empty.' };
  }
  if (file.size > maxBytes) {
    const maxMb = (maxBytes / (1024 * 1024)).toFixed(0);
    const actualMb = (file.size / (1024 * 1024)).toFixed(2);
    return {
      valid: false,
      error: `Image is too large (${actualMb} MB). Maximum allowed file size is ${maxMb} MB.`,
    };
  }
  return { valid: true, error: null };
}

/**
 * Safely extracts the internal `<user-id>/<filename>` object path from a Supabase Storage
 * public avatar URL ONLY if it resides inside the authenticated user's own `<userId>/` folder.
 */
export function extractOwnAvatarStoragePath(
  avatarUrl: string | null | undefined,
  userId: string
): string | null {
  if (!avatarUrl || !userId) return null;
  try {
    const cleanUrl = avatarUrl.split('?')[0];
    const marker = '/storage/v1/object/public/avatars/';
    const idx = cleanUrl.indexOf(marker);
    if (idx === -1) return null;
    const rawPath = decodeURIComponent(cleanUrl.slice(idx + marker.length));
    if (!rawPath || rawPath.includes('..') || rawPath.startsWith('/')) {
      return null;
    }
    const parts = rawPath.split('/');
    if (parts.length !== 2 || parts[0] !== userId || !parts[1]) {
      return null;
    }
    return rawPath;
  } catch {
    return null;
  }
}

function getExtensionFromMime(mimeType: string): 'jpg' | 'png' | 'webp' {
  const normalized = (mimeType || '').toLowerCase();
  if (normalized === 'image/png') return 'png';
  if (normalized === 'image/webp') return 'webp';
  return 'jpg';
}

function isBucketOrStorageRlsError(err: any): boolean {
  const msg = String(err?.message || err?.error || '').toLowerCase();
  return (
    msg.includes('bucket not found') ||
    msg.includes('nosuchbucket') ||
    msg.includes('row-level security') ||
    msg.includes('violates row-level security')
  );
}

export async function uploadUserAvatar(params: {
  fileBlob: Blob;
  mimeType: string;
  previousAvatarUrl?: string | null;
}): Promise<{
  profile: UserProfile | null;
  avatarUrl: string | null;
  bucketSetupNeeded?: boolean;
  error: string | null;
}> {
  const { client } = await ensureSupabaseClient();
  if (!client) {
    return {
      profile: null,
      avatarUrl: null,
      error: 'Supabase is not configured. Please check VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY.',
    };
  }

  // 1. Verify active authenticated session before attempting upload
  const { data: sessionData, error: sessionError } = await client.auth.getSession();
  const activeUser = sessionData?.session?.user;
  if (sessionError || !activeUser) {
    return {
      profile: null,
      avatarUrl: null,
      error: 'Your session has expired or you are signed out. Please sign in again to upload a profile photo.',
    };
  }

  // 2. Validate MIME type & post-optimization blob size (<= 5 MB bucket limit)
  const validation = validateAvatarFile(
    { type: params.mimeType, size: params.fileBlob.size },
    MAX_AVATAR_UPLOAD_BYTES
  );
  if (!validation.valid) {
    return {
      profile: null,
      avatarUrl: null,
      error: validation.error,
    };
  }

  // 3. Generate unique path strictly scoped to `<authenticated-user-id>/<unique-file>.<ext>`
  const ext = getExtensionFromMime(params.mimeType);
  const randomSuffix = Math.random().toString(36).slice(2, 10);
  const storagePath = `${activeUser.id}/avatar-${Date.now()}-${randomSuffix}.${ext}`;

  // 4. Upload to `avatars` bucket
  const { error: uploadError } = await client.storage
    .from('avatars')
    .upload(storagePath, params.fileBlob, {
      contentType: params.mimeType,
      cacheControl: '3600',
      upsert: false,
    });

  if (uploadError) {
    const needsSetup = isBucketOrStorageRlsError(uploadError);
    return {
      profile: null,
      avatarUrl: null,
      bucketSetupNeeded: needsSetup,
      error: needsSetup
        ? `Supabase Storage "avatars" bucket or RLS policy is not set up yet (${uploadError.message}). Run the Avatars Storage SQL script in your Supabase SQL Editor.`
        : `Avatar upload failed: ${uploadError.message}`,
    };
  }

  // 5. Retrieve public URL
  const { data: publicUrlData } = client.storage
    .from('avatars')
    .getPublicUrl(storagePath);

  const publicUrl = publicUrlData?.publicUrl;
  if (!publicUrl) {
    await client.storage.from('avatars').remove([storagePath]).catch(() => {});
    return {
      profile: null,
      avatarUrl: null,
      error: 'Could not generate a usable public URL for the uploaded avatar.',
    };
  }

  // 6. Save `avatar_url` to `public.profiles` without overwriting unrelated columns
  let updatedRow: any = null;
  const { data: updateData, error: updateError } = await client
    .from('profiles')
    .update({ avatar_url: publicUrl })
    .eq('id', activeUser.id)
    .select('*')
    .maybeSingle();

  if (updateError) {
    // Clean up newly uploaded storage object since saving to DB failed
    await client.storage.from('avatars').remove([storagePath]).catch(() => {});
    return {
      profile: null,
      avatarUrl: null,
      error: `Failed to save avatar URL to your profile: ${updateError.message}`,
    };
  }

  if (updateData) {
    updatedRow = updateData;
  } else {
    // If profile row did not exist yet, insert it with safe defaults
    const fallbackName =
      activeUser.user_metadata?.display_name ||
      activeUser.email?.split('@')[0] ||
      'Cinema Enthusiast';
    const { data: insertedRow, error: insertError } = await client
      .from('profiles')
      .upsert(
        {
          id: activeUser.id,
          display_name: fallbackName,
          avatar_url: publicUrl,
        },
        { onConflict: 'id' }
      )
      .select('*')
      .single();

    if (insertError || !insertedRow) {
      await client.storage.from('avatars').remove([storagePath]).catch(() => {});
      return {
        profile: null,
        avatarUrl: null,
        error: `Failed to save avatar URL to your profile: ${
          insertError?.message || 'Profile row could not be created.'
        }`,
      };
    }
    updatedRow = insertedRow;
  }

  // 7. Only after both new upload AND database update succeed, delete previous storage object
  const oldStoragePath = extractOwnAvatarStoragePath(
    params.previousAvatarUrl,
    activeUser.id
  );
  if (oldStoragePath && oldStoragePath !== storagePath) {
    await client.storage
      .from('avatars')
      .remove([oldStoragePath])
      .catch(() => {
        // Non-fatal if old file was already removed
      });
  }

  return {
    profile: {
      id: updatedRow.id,
      email: activeUser.email,
      username: updatedRow.username || null,
      displayName: updatedRow.display_name || 'Cinema Enthusiast',
      bio: updatedRow.bio || '',
      avatarUrl: updatedRow.avatar_url || publicUrl,
      favoriteGenres: Array.isArray(updatedRow.favorite_genres)
        ? updatedRow.favorite_genres
        : [],
      createdAt: updatedRow.created_at || activeUser.created_at || new Date().toISOString(),
      updatedAt: updatedRow.updated_at || new Date().toISOString(),
    },
    avatarUrl: updatedRow.avatar_url || publicUrl,
    error: null,
  };
}

export async function removeUserAvatar(
  previousAvatarUrl?: string | null
): Promise<{
  profile: UserProfile | null;
  error: string | null;
}> {
  const { client } = await ensureSupabaseClient();
  if (!client) {
    return { profile: null, error: 'Supabase is not configured.' };
  }

  // 1. Verify active authenticated session
  const { data: sessionData, error: sessionError } = await client.auth.getSession();
  const activeUser = sessionData?.session?.user;
  if (sessionError || !activeUser) {
    return {
      profile: null,
      error: 'Your session has expired or you are signed out. Please sign in again.',
    };
  }

  // 2. Set `public.profiles.avatar_url` to NULL without overwriting unrelated columns
  const { data: updatedRow, error: updateError } = await client
    .from('profiles')
    .update({ avatar_url: null })
    .eq('id', activeUser.id)
    .select('*')
    .maybeSingle();

  if (updateError) {
    return {
      profile: null,
      error: `Failed to remove avatar from your profile: ${updateError.message}`,
    };
  }

  // 3. Delete previous storage file from user's folder after DB update succeeds
  const oldStoragePath = extractOwnAvatarStoragePath(
    previousAvatarUrl,
    activeUser.id
  );
  if (oldStoragePath) {
    await client.storage
      .from('avatars')
      .remove([oldStoragePath])
      .catch(() => {});
  }

  if (!updatedRow) {
    return {
      profile: null,
      error: null,
    };
  }

  return {
    profile: {
      id: updatedRow.id,
      email: activeUser.email,
      username: updatedRow.username || null,
      displayName: updatedRow.display_name || 'Cinema Enthusiast',
      bio: updatedRow.bio || '',
      avatarUrl: null,
      favoriteGenres: Array.isArray(updatedRow.favorite_genres)
        ? updatedRow.favorite_genres
        : [],
      createdAt: updatedRow.created_at || activeUser.created_at || new Date().toISOString(),
      updatedAt: updatedRow.updated_at || new Date().toISOString(),
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
