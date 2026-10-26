import{i as e,n as t,o as n,t as r}from"./jsx-dev-runtime-BxYMlXN8.js";import{A as i,B as a,C as o,D as s,H as c,K as l,L as u,Q as d,U as f,et as p,j as m,tt as h,v as g,z as _}from"./index-BOpViwda.js";var v=n(e(),1),y=r(),b=`/app/applet/src/components/AuthModal.tsx`,x=({isOpen:e,onClose:n,supabaseConfigured:r,securityWarning:x,initialMode:S=`signin`,onAuthSuccess:C})=>{let[w,T]=(0,v.useState)(S),[E,D]=(0,v.useState)(``),[O,k]=(0,v.useState)(``),[A,j]=(0,v.useState)(``),[M,N]=(0,v.useState)(!1),[P,F]=(0,v.useState)(null),[I,L]=(0,v.useState)(null),[R,z]=(0,v.useState)(!1),[B,V]=(0,v.useState)(!1);return(0,v.useEffect)(()=>{e&&(T(S),F(null),L(null))},[e,S]),(0,v.useEffect)(()=>{if(!e)return;let t=e=>{e.key===`Escape`&&n()};return window.addEventListener(`keydown`,t),()=>window.removeEventListener(`keydown`,t)},[e,n]),e?(0,y.jsxDEV)(`div`,{className:`fixed inset-0 z-50 overflow-y-auto bg-black/80 backdrop-blur-md flex items-center justify-center p-4 animate-in fade-in duration-200`,children:[(0,y.jsxDEV)(`div`,{className:`fixed inset-0`,onClick:n},void 0,!1,{fileName:b,lineNumber:139,columnNumber:7},void 0),(0,y.jsxDEV)(`div`,{className:`relative z-10 w-full max-w-md bg-[#0d0e14] border border-white/10 rounded-2xl shadow-2xl overflow-hidden my-auto`,children:[(0,y.jsxDEV)(`div`,{className:`px-6 pt-6 pb-4 border-b border-white/5 flex items-center justify-between`,children:[(0,y.jsxDEV)(`div`,{className:`flex items-center gap-2.5`,children:[(0,y.jsxDEV)(`div`,{className:`w-8 h-8 rounded-lg bg-gradient-to-br from-amber-400 to-amber-600 flex items-center justify-center text-black shadow-md shadow-amber-500/20`,children:(0,y.jsxDEV)(u,{className:`w-4 h-4 stroke-[2.5]`},void 0,!1,{fileName:b,lineNumber:146,columnNumber:15},void 0)},void 0,!1,{fileName:b,lineNumber:145,columnNumber:13},void 0),(0,y.jsxDEV)(`div`,{children:[(0,y.jsxDEV)(`h2`,{className:`font-['Outfit'] text-lg font-bold text-white tracking-tight`,children:w===`signin`?`Sign In to CineMax`:`Create Cinephile Account`},void 0,!1,{fileName:b,lineNumber:149,columnNumber:15},void 0),(0,y.jsxDEV)(`p`,{className:`text-xs text-slate-400`,children:`Cloud-synced watchlist, favourites & viewing journal`},void 0,!1,{fileName:b,lineNumber:152,columnNumber:15},void 0)]},void 0,!0,{fileName:b,lineNumber:148,columnNumber:13},void 0)]},void 0,!0,{fileName:b,lineNumber:144,columnNumber:11},void 0),(0,y.jsxDEV)(`button`,{onClick:n,"aria-label":`Close authentication modal`,className:`p-2 rounded-lg text-slate-400 hover:text-white hover:bg-white/5 transition-colors`,children:(0,y.jsxDEV)(t,{className:`w-4 h-4`},void 0,!1,{fileName:b,lineNumber:163,columnNumber:13},void 0)},void 0,!1,{fileName:b,lineNumber:158,columnNumber:11},void 0)]},void 0,!0,{fileName:b,lineNumber:143,columnNumber:9},void 0),(0,y.jsxDEV)(`div`,{className:`px-6 pt-4`,children:(0,y.jsxDEV)(`div`,{className:`grid grid-cols-2 gap-1 p-1 bg-black/50 rounded-xl border border-white/5`,children:[(0,y.jsxDEV)(`button`,{type:`button`,onClick:()=>{T(`signin`),F(null),L(null)},className:`py-2 text-xs font-semibold rounded-lg transition-colors ${w===`signin`?`bg-amber-500 text-slate-950`:`text-slate-400 hover:text-white`}`,children:`Sign In`},void 0,!1,{fileName:b,lineNumber:170,columnNumber:13},void 0),(0,y.jsxDEV)(`button`,{type:`button`,onClick:()=>{T(`signup`),F(null),L(null)},className:`py-2 text-xs font-semibold rounded-lg transition-colors ${w===`signup`?`bg-amber-500 text-slate-950`:`text-slate-400 hover:text-white`}`,children:`Create Account`},void 0,!1,{fileName:b,lineNumber:185,columnNumber:13},void 0)]},void 0,!0,{fileName:b,lineNumber:169,columnNumber:11},void 0)},void 0,!1,{fileName:b,lineNumber:168,columnNumber:9},void 0),!r&&(0,y.jsxDEV)(`div`,{className:`mx-6 mt-4 p-3.5 rounded-xl bg-amber-500/10 border border-amber-500/30 text-xs text-amber-200 space-y-2`,children:(0,y.jsxDEV)(`div`,{className:`flex items-start gap-2`,children:[(0,y.jsxDEV)(f,{className:`w-4 h-4 text-amber-400 shrink-0 mt-0.5`},void 0,!1,{fileName:b,lineNumber:207,columnNumber:15},void 0),(0,y.jsxDEV)(`div`,{className:`space-y-1`,children:[(0,y.jsxDEV)(`p`,{className:`font-semibold text-amber-300`,children:x?`Security Warning`:`Supabase Connection Not Configured`},void 0,!1,{fileName:b,lineNumber:209,columnNumber:17},void 0),(0,y.jsxDEV)(`p`,{className:`text-amber-200/80 leading-relaxed`,children:x||`To enable live cloud authentication and PostgreSQL persistence, add VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY in AI Studio Secrets.`},void 0,!1,{fileName:b,lineNumber:212,columnNumber:17},void 0)]},void 0,!0,{fileName:b,lineNumber:208,columnNumber:15},void 0)]},void 0,!0,{fileName:b,lineNumber:206,columnNumber:13},void 0)},void 0,!1,{fileName:b,lineNumber:205,columnNumber:11},void 0),(0,y.jsxDEV)(`form`,{onSubmit:async e=>{if(e.preventDefault(),F(null),L(null),!r){F(x||`Supabase credentials are not configured yet. Add VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY in AI Studio Secrets.`);return}let t=E.trim();if(!t||!O)F(`Please enter both your email address and password.`);else if(O.length<6)F(`Password must be at least 6 characters long.`);else{N(!0);try{if(w===`signup`){let{user:e,session:r,error:i}=await h(t,O,A);i?F(i):e&&!r?(T(`signin`),D(t),k(``),L(`Account created for ${t}! Please check your email inbox to confirm your address, then sign in below.`)):r&&(k(``),C?.(),n())}else{let{session:e,error:r}=await p(t,O);r?F(r):e&&(k(``),C?.(),n())}}catch(e){F(e?.message||`Authentication failed. Please try again.`)}finally{N(!1)}}},className:`p-6 space-y-4`,children:[P&&(0,y.jsxDEV)(`div`,{className:`p-3 rounded-xl bg-red-500/10 border border-red-500/30 text-xs text-red-300 flex items-start gap-2`,children:[(0,y.jsxDEV)(f,{className:`w-4 h-4 text-red-400 shrink-0 mt-0.5`},void 0,!1,{fileName:b,lineNumber:225,columnNumber:15},void 0),(0,y.jsxDEV)(`span`,{children:P},void 0,!1,{fileName:b,lineNumber:226,columnNumber:15},void 0)]},void 0,!0,{fileName:b,lineNumber:224,columnNumber:13},void 0),I&&(0,y.jsxDEV)(`div`,{className:`p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-xs text-emerald-300 flex items-start gap-2`,children:[(0,y.jsxDEV)(c,{className:`w-4 h-4 text-emerald-400 shrink-0 mt-0.5`},void 0,!1,{fileName:b,lineNumber:232,columnNumber:15},void 0),(0,y.jsxDEV)(`span`,{children:I},void 0,!1,{fileName:b,lineNumber:233,columnNumber:15},void 0)]},void 0,!0,{fileName:b,lineNumber:231,columnNumber:13},void 0),w===`signup`&&(0,y.jsxDEV)(`div`,{className:`space-y-1.5`,children:[(0,y.jsxDEV)(`label`,{className:`block text-xs font-medium text-slate-300`,children:`Display Name`},void 0,!1,{fileName:b,lineNumber:239,columnNumber:15},void 0),(0,y.jsxDEV)(`div`,{className:`relative`,children:[(0,y.jsxDEV)(g,{className:`w-4 h-4 text-slate-500 absolute left-3.5 top-1/2 -translate-y-1/2`},void 0,!1,{fileName:b,lineNumber:243,columnNumber:17},void 0),(0,y.jsxDEV)(`input`,{type:`text`,value:A,onChange:e=>j(e.target.value),placeholder:`Alex Rivera`,maxLength:80,className:`w-full pl-10 pr-3.5 py-2.5 text-sm bg-black/50 border border-white/10 rounded-xl text-white placeholder:text-slate-500 focus:outline-none focus:border-amber-400`},void 0,!1,{fileName:b,lineNumber:244,columnNumber:17},void 0)]},void 0,!0,{fileName:b,lineNumber:242,columnNumber:15},void 0)]},void 0,!0,{fileName:b,lineNumber:238,columnNumber:13},void 0),(0,y.jsxDEV)(`div`,{className:`space-y-1.5`,children:[(0,y.jsxDEV)(`label`,{className:`block text-xs font-medium text-slate-300`,children:`Email Address`},void 0,!1,{fileName:b,lineNumber:257,columnNumber:13},void 0),(0,y.jsxDEV)(`div`,{className:`relative`,children:[(0,y.jsxDEV)(s,{className:`w-4 h-4 text-slate-500 absolute left-3.5 top-1/2 -translate-y-1/2`},void 0,!1,{fileName:b,lineNumber:261,columnNumber:15},void 0),(0,y.jsxDEV)(`input`,{type:`email`,required:!0,autoComplete:`email`,value:E,onChange:e=>D(e.target.value),placeholder:`you@example.com`,className:`w-full pl-10 pr-3.5 py-2.5 text-sm bg-black/50 border border-white/10 rounded-xl text-white placeholder:text-slate-500 focus:outline-none focus:border-amber-400`},void 0,!1,{fileName:b,lineNumber:262,columnNumber:15},void 0)]},void 0,!0,{fileName:b,lineNumber:260,columnNumber:13},void 0)]},void 0,!0,{fileName:b,lineNumber:256,columnNumber:11},void 0),(0,y.jsxDEV)(`div`,{className:`space-y-1.5`,children:[(0,y.jsxDEV)(`label`,{className:`block text-xs font-medium text-slate-300`,children:`Password`},void 0,!1,{fileName:b,lineNumber:275,columnNumber:13},void 0),(0,y.jsxDEV)(`div`,{className:`relative`,children:[(0,y.jsxDEV)(i,{className:`w-4 h-4 text-slate-500 absolute left-3.5 top-1/2 -translate-y-1/2`},void 0,!1,{fileName:b,lineNumber:279,columnNumber:15},void 0),(0,y.jsxDEV)(`input`,{type:`password`,required:!0,minLength:6,autoComplete:w===`signin`?`current-password`:`new-password`,value:O,onChange:e=>k(e.target.value),placeholder:`••••••••`,className:`w-full pl-10 pr-3.5 py-2.5 text-sm bg-black/50 border border-white/10 rounded-xl text-white placeholder:text-slate-500 focus:outline-none focus:border-amber-400`},void 0,!1,{fileName:b,lineNumber:280,columnNumber:15},void 0)]},void 0,!0,{fileName:b,lineNumber:278,columnNumber:13},void 0),(0,y.jsxDEV)(`p`,{className:`text-[11px] text-slate-500`,children:`Managed securely by Supabase Auth. CineMax never stores raw passwords.`},void 0,!1,{fileName:b,lineNumber:291,columnNumber:13},void 0)]},void 0,!0,{fileName:b,lineNumber:274,columnNumber:11},void 0),(0,y.jsxDEV)(`button`,{type:`submit`,disabled:M,className:`w-full py-2.5 px-4 rounded-xl bg-gradient-to-r from-amber-400 to-amber-500 hover:from-amber-300 hover:to-amber-400 disabled:opacity-50 text-slate-950 font-bold text-sm shadow-md shadow-amber-500/20 transition-all flex items-center justify-center gap-2`,children:M?(0,y.jsxDEV)(y.Fragment,{children:[(0,y.jsxDEV)(m,{className:`w-4 h-4 animate-spin`},void 0,!1,{fileName:b,lineNumber:303,columnNumber:17},void 0),(0,y.jsxDEV)(`span`,{children:w===`signin`?`Signing In...`:`Creating Account...`},void 0,!1,{fileName:b,lineNumber:304,columnNumber:17},void 0)]},void 0,!0,{fileName:b,lineNumber:302,columnNumber:15},void 0):(0,y.jsxDEV)(`span`,{children:w===`signin`?`Sign In`:`Create Account`},void 0,!1,{fileName:b,lineNumber:307,columnNumber:15},void 0)},void 0,!1,{fileName:b,lineNumber:296,columnNumber:11},void 0)]},void 0,!0,{fileName:b,lineNumber:222,columnNumber:9},void 0),(0,y.jsxDEV)(`div`,{className:`px-6 py-4 bg-black/40 border-t border-white/5 space-y-3`,children:[(0,y.jsxDEV)(`div`,{className:`flex items-center justify-between text-xs text-slate-400`,children:[(0,y.jsxDEV)(`span`,{className:`flex items-center gap-1.5`,children:[(0,y.jsxDEV)(o,{className:`w-3.5 h-3.5 text-emerald-400`},void 0,!1,{fileName:b,lineNumber:316,columnNumber:15},void 0),(0,y.jsxDEV)(`span`,{children:`Protected by PostgreSQL Row Level Security`},void 0,!1,{fileName:b,lineNumber:317,columnNumber:15},void 0)]},void 0,!0,{fileName:b,lineNumber:315,columnNumber:13},void 0),(0,y.jsxDEV)(`button`,{type:`button`,onClick:()=>z(e=>!e),className:`text-amber-400 hover:text-amber-300 font-medium flex items-center gap-1`,children:[(0,y.jsxDEV)(_,{className:`w-3 h-3`},void 0,!1,{fileName:b,lineNumber:324,columnNumber:15},void 0),(0,y.jsxDEV)(`span`,{children:R?`Hide SQL`:`SQL Schema`},void 0,!1,{fileName:b,lineNumber:325,columnNumber:15},void 0)]},void 0,!0,{fileName:b,lineNumber:319,columnNumber:13},void 0)]},void 0,!0,{fileName:b,lineNumber:314,columnNumber:11},void 0),R&&(0,y.jsxDEV)(`div`,{className:`space-y-2 pt-1`,children:[(0,y.jsxDEV)(`div`,{className:`flex items-center justify-between text-[11px] text-slate-400`,children:[(0,y.jsxDEV)(`span`,{children:`Run in Supabase SQL Editor (also saved at supabase/schema.sql):`},void 0,!1,{fileName:b,lineNumber:332,columnNumber:17},void 0),(0,y.jsxDEV)(`button`,{type:`button`,onClick:()=>{navigator.clipboard?.writeText(d),V(!0),setTimeout(()=>V(!1),2500)},className:`px-2 py-1 rounded bg-white/10 hover:bg-white/15 text-white font-medium flex items-center gap-1`,children:B?(0,y.jsxDEV)(y.Fragment,{children:[(0,y.jsxDEV)(l,{className:`w-3 h-3 text-emerald-400`},void 0,!1,{fileName:b,lineNumber:340,columnNumber:23},void 0),(0,y.jsxDEV)(`span`,{children:`Copied`},void 0,!1,{fileName:b,lineNumber:341,columnNumber:23},void 0)]},void 0,!0,{fileName:b,lineNumber:339,columnNumber:21},void 0):(0,y.jsxDEV)(y.Fragment,{children:[(0,y.jsxDEV)(a,{className:`w-3 h-3`},void 0,!1,{fileName:b,lineNumber:345,columnNumber:23},void 0),(0,y.jsxDEV)(`span`,{children:`Copy SQL`},void 0,!1,{fileName:b,lineNumber:346,columnNumber:23},void 0)]},void 0,!0,{fileName:b,lineNumber:344,columnNumber:21},void 0)},void 0,!1,{fileName:b,lineNumber:333,columnNumber:17},void 0)]},void 0,!0,{fileName:b,lineNumber:331,columnNumber:15},void 0),(0,y.jsxDEV)(`pre`,{className:`max-h-36 overflow-y-auto p-2.5 rounded-lg bg-black/80 border border-white/10 text-[10px] font-mono text-slate-300 whitespace-pre`,children:`-- CineMax Phase 3: Persistent Auth, Watchlist, History, Episodes & Profile Schema
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
CREATE POLICY "Users can delete own avatar in own folder" ON storage.objects FOR DELETE TO authenticated USING (bucket_id = 'avatars' AND (storage.foldername(name))[1] = auth.uid()::text);`},void 0,!1,{fileName:b,lineNumber:351,columnNumber:15},void 0)]},void 0,!0,{fileName:b,lineNumber:330,columnNumber:13},void 0)]},void 0,!0,{fileName:b,lineNumber:313,columnNumber:9},void 0)]},void 0,!0,{fileName:b,lineNumber:141,columnNumber:7},void 0)]},void 0,!0,{fileName:b,lineNumber:138,columnNumber:5},void 0):null};export{x as AuthModal};