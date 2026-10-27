import{n as e}from"./rolldown-runtime-WkwZ5CU-.js";import{$ as t,At as n,C as r,L as i,Ot as a,Q as o,U as s,V as c,et as l,ht as u,it as d,mt as f,o as p,ot as m,r as h,vt as g}from"./vendor-icons-Brl-4LJW.js";import{t as _}from"./vendor-react-Biue1KOw.js";import{M as v,N as y,O as b,P as x,S}from"./index-2XuDSoMs.js";var C=e(n(),1),w=_(),T=`/app/applet/src/components/AuthModal.tsx`,E=({isOpen:e,onClose:n,supabaseConfigured:_,securityWarning:E,initialMode:D=`signin`,onAuthSuccess:O})=>{let[k,A]=(0,C.useState)(D),[j,M]=(0,C.useState)(``),[N,P]=(0,C.useState)(``),[F,I]=(0,C.useState)(!1),[L,R]=(0,C.useState)(``),[z,B]=(0,C.useState)(!1),[V,H]=(0,C.useState)(null),[U,W]=(0,C.useState)(null),[G,K]=(0,C.useState)(!1),[q,J]=(0,C.useState)(!1);return(0,C.useEffect)(()=>{e&&(A(D),H(null),W(null))},[e,D]),(0,C.useEffect)(()=>{if(!e)return;let t=e=>{e.key===`Escape`&&n()};return window.addEventListener(`keydown`,t),()=>window.removeEventListener(`keydown`,t)},[e,n]),e?(0,w.jsxDEV)(`div`,{className:`fixed inset-0 z-50 overflow-y-auto cm-glass-backdrop flex items-center justify-center p-4 animate-in fade-in duration-200`,children:[(0,w.jsxDEV)(`div`,{className:`fixed inset-0`,onClick:n},void 0,!1,{fileName:T,lineNumber:169,columnNumber:7},void 0),(0,w.jsxDEV)(`div`,{className:`relative z-10 w-full max-w-md cm-glass-panel rounded-2xl overflow-hidden my-auto`,children:[(0,w.jsxDEV)(`div`,{className:`px-6 pt-6 pb-4 border-b border-white/[0.07] cm-glass-subbar flex items-center justify-between`,children:[(0,w.jsxDEV)(`div`,{className:`flex items-center gap-2.5`,children:[(0,w.jsxDEV)(`div`,{className:`w-8 h-8 rounded-lg bg-gradient-to-br from-amber-400 to-amber-600 flex items-center justify-center text-black shadow-md shadow-amber-500/20`,children:(0,w.jsxDEV)(o,{className:`w-4 h-4 stroke-[2.5]`},void 0,!1,{fileName:T,lineNumber:176,columnNumber:15},void 0)},void 0,!1,{fileName:T,lineNumber:175,columnNumber:13},void 0),(0,w.jsxDEV)(`div`,{children:[(0,w.jsxDEV)(`h2`,{className:`font-['Outfit'] text-lg font-bold text-white tracking-tight`,children:k===`signin`?`Sign In to CineMax`:k===`signup`?`Create Cinephile Account`:`Reset Your Password`},void 0,!1,{fileName:T,lineNumber:179,columnNumber:15},void 0),(0,w.jsxDEV)(`p`,{className:`text-xs text-slate-400`,children:k===`forgot_password`?`Receive a secure password recovery link via email`:`Cloud-synced watchlist, favourites & viewing journal`},void 0,!1,{fileName:T,lineNumber:186,columnNumber:15},void 0)]},void 0,!0,{fileName:T,lineNumber:178,columnNumber:13},void 0)]},void 0,!0,{fileName:T,lineNumber:174,columnNumber:11},void 0),(0,w.jsxDEV)(`button`,{onClick:n,"aria-label":`Close authentication modal`,className:`p-2 rounded-lg text-slate-400 hover:text-white cm-glass-control`,children:(0,w.jsxDEV)(h,{className:`w-4 h-4`},void 0,!1,{fileName:T,lineNumber:199,columnNumber:13},void 0)},void 0,!1,{fileName:T,lineNumber:194,columnNumber:11},void 0)]},void 0,!0,{fileName:T,lineNumber:173,columnNumber:9},void 0),k===`forgot_password`?(0,w.jsxDEV)(`div`,{className:`px-6 pt-4`,children:(0,w.jsxDEV)(`button`,{type:`button`,onClick:()=>{A(`signin`),H(null),W(null)},className:`inline-flex items-center gap-1.5 text-xs font-semibold text-amber-400 hover:text-amber-300 transition-colors py-1`,children:[(0,w.jsxDEV)(a,{className:`w-3.5 h-3.5`},void 0,!1,{fileName:T,lineNumber:250,columnNumber:15},void 0),(0,w.jsxDEV)(`span`,{children:`Back to Sign In`},void 0,!1,{fileName:T,lineNumber:251,columnNumber:15},void 0)]},void 0,!0,{fileName:T,lineNumber:241,columnNumber:13},void 0)},void 0,!1,{fileName:T,lineNumber:240,columnNumber:11},void 0):(0,w.jsxDEV)(`div`,{className:`px-6 pt-4`,children:(0,w.jsxDEV)(`div`,{className:`grid grid-cols-2 gap-1 p-1 cm-glass-segmented rounded-xl`,children:[(0,w.jsxDEV)(`button`,{type:`button`,onClick:()=>{A(`signin`),H(null),W(null)},className:`py-2 text-xs font-semibold rounded-lg transition-colors ${k===`signin`?`bg-amber-500 text-slate-950`:`text-slate-400 hover:text-white`}`,children:`Sign In`},void 0,!1,{fileName:T,lineNumber:207,columnNumber:15},void 0),(0,w.jsxDEV)(`button`,{type:`button`,onClick:()=>{A(`signup`),H(null),W(null)},className:`py-2 text-xs font-semibold rounded-lg transition-colors ${k===`signup`?`bg-amber-500 text-slate-950`:`text-slate-400 hover:text-white`}`,children:`Create Account`},void 0,!1,{fileName:T,lineNumber:222,columnNumber:15},void 0)]},void 0,!0,{fileName:T,lineNumber:206,columnNumber:13},void 0)},void 0,!1,{fileName:T,lineNumber:205,columnNumber:11},void 0),!_&&(0,w.jsxDEV)(`div`,{className:`mx-6 mt-4 p-3.5 rounded-xl bg-amber-500/10 border border-amber-500/30 text-xs text-amber-200 space-y-2`,children:(0,w.jsxDEV)(`div`,{className:`flex items-start gap-2`,children:[(0,w.jsxDEV)(u,{className:`w-4 h-4 text-amber-400 shrink-0 mt-0.5`},void 0,!1,{fileName:T,lineNumber:260,columnNumber:15},void 0),(0,w.jsxDEV)(`div`,{className:`space-y-1`,children:[(0,w.jsxDEV)(`p`,{className:`font-semibold text-amber-300`,children:E?`Security Warning`:`Supabase Connection Not Configured`},void 0,!1,{fileName:T,lineNumber:262,columnNumber:17},void 0),(0,w.jsxDEV)(`p`,{className:`text-amber-200/80 leading-relaxed`,children:E||`To enable live cloud authentication and PostgreSQL persistence, add VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY in AI Studio Secrets.`},void 0,!1,{fileName:T,lineNumber:265,columnNumber:17},void 0)]},void 0,!0,{fileName:T,lineNumber:261,columnNumber:15},void 0)]},void 0,!0,{fileName:T,lineNumber:259,columnNumber:13},void 0)},void 0,!1,{fileName:T,lineNumber:258,columnNumber:11},void 0),(0,w.jsxDEV)(`form`,{onSubmit:async e=>{if(e.preventDefault(),z)return;if(H(null),W(null),!_){H(E||`Supabase credentials are not configured yet. Add VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY in AI Studio Secrets.`);return}let t=j.trim();if(!t)H(`Please enter your email address.`);else if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(t))H(`Please enter a valid email address (for example, name@example.com).`);else{if(k!==`forgot_password`){if(!N){H(`Please enter your password.`);return}if(N.length<6){H(`Password must be at least 6 characters long.`);return}}B(!0);try{if(k===`forgot_password`){let{error:e}=await v(t);e?H(e):W(`If an account exists for ${t}, we've sent a password reset link. Please check your inbox and spam folder.`)}else if(k===`signup`){let{user:e,session:r,error:i}=await x(t,N,L);i?H(i):e&&!r?(A(`signin`),M(t),P(``),W(`Account created for ${t}! Please check your email inbox to confirm your address, then sign in below.`)):r&&(P(``),O?.(),n())}else{let{session:e,error:r}=await y(t,N);r?H(r):e&&(P(``),O?.(),n())}}catch(e){H(b(e?.message))}finally{B(!1)}}},className:`p-6 space-y-4`,noValidate:!0,children:[V&&(0,w.jsxDEV)(`div`,{className:`p-3 rounded-xl bg-red-500/10 border border-red-500/30 text-xs text-red-300 flex items-start gap-2`,children:[(0,w.jsxDEV)(u,{className:`w-4 h-4 text-red-400 shrink-0 mt-0.5`},void 0,!1,{fileName:T,lineNumber:278,columnNumber:15},void 0),(0,w.jsxDEV)(`span`,{children:V},void 0,!1,{fileName:T,lineNumber:279,columnNumber:15},void 0)]},void 0,!0,{fileName:T,lineNumber:277,columnNumber:13},void 0),U&&(0,w.jsxDEV)(`div`,{className:`p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-xs text-emerald-300 flex items-start gap-2`,children:[(0,w.jsxDEV)(f,{className:`w-4 h-4 text-emerald-400 shrink-0 mt-0.5`},void 0,!1,{fileName:T,lineNumber:285,columnNumber:15},void 0),(0,w.jsxDEV)(`span`,{children:U},void 0,!1,{fileName:T,lineNumber:286,columnNumber:15},void 0)]},void 0,!0,{fileName:T,lineNumber:284,columnNumber:13},void 0),k===`signup`&&(0,w.jsxDEV)(`div`,{className:`space-y-1.5`,children:[(0,w.jsxDEV)(`label`,{className:`block text-xs font-medium text-slate-300`,children:`Display Name`},void 0,!1,{fileName:T,lineNumber:292,columnNumber:15},void 0),(0,w.jsxDEV)(`div`,{className:`relative`,children:[(0,w.jsxDEV)(p,{className:`w-4 h-4 text-slate-500 absolute left-3.5 top-1/2 -translate-y-1/2`},void 0,!1,{fileName:T,lineNumber:296,columnNumber:17},void 0),(0,w.jsxDEV)(`input`,{type:`text`,value:L,onChange:e=>R(e.target.value),placeholder:`Alex Rivera`,maxLength:80,className:`w-full pl-10 pr-3.5 py-2.5 text-sm cm-glass-input rounded-xl text-white placeholder:text-slate-500 focus:outline-none`},void 0,!1,{fileName:T,lineNumber:297,columnNumber:17},void 0)]},void 0,!0,{fileName:T,lineNumber:295,columnNumber:15},void 0)]},void 0,!0,{fileName:T,lineNumber:291,columnNumber:13},void 0),(0,w.jsxDEV)(`div`,{className:`space-y-1.5`,children:[(0,w.jsxDEV)(`label`,{className:`block text-xs font-medium text-slate-300`,children:`Email Address`},void 0,!1,{fileName:T,lineNumber:310,columnNumber:13},void 0),(0,w.jsxDEV)(`div`,{className:`relative`,children:[(0,w.jsxDEV)(i,{className:`w-4 h-4 text-slate-500 absolute left-3.5 top-1/2 -translate-y-1/2`},void 0,!1,{fileName:T,lineNumber:314,columnNumber:15},void 0),(0,w.jsxDEV)(`input`,{type:`email`,required:!0,autoComplete:`email`,value:j,onChange:e=>M(e.target.value),placeholder:`you@example.com`,className:`w-full pl-10 pr-3.5 py-2.5 text-sm cm-glass-input rounded-xl text-white placeholder:text-slate-500 focus:outline-none`},void 0,!1,{fileName:T,lineNumber:315,columnNumber:15},void 0)]},void 0,!0,{fileName:T,lineNumber:313,columnNumber:13},void 0)]},void 0,!0,{fileName:T,lineNumber:309,columnNumber:11},void 0),k!==`forgot_password`&&(0,w.jsxDEV)(`div`,{className:`space-y-1.5`,children:[(0,w.jsxDEV)(`label`,{className:`block text-xs font-medium text-slate-300`,children:`Password`},void 0,!1,{fileName:T,lineNumber:329,columnNumber:15},void 0),(0,w.jsxDEV)(`div`,{className:`relative`,children:[(0,w.jsxDEV)(c,{className:`w-4 h-4 text-slate-500 absolute left-3.5 top-1/2 -translate-y-1/2`},void 0,!1,{fileName:T,lineNumber:333,columnNumber:17},void 0),(0,w.jsxDEV)(`input`,{type:F?`text`:`password`,required:!0,minLength:6,autoComplete:k===`signin`?`current-password`:`new-password`,value:N,onChange:e=>P(e.target.value),placeholder:`••••••••`,className:`w-full pl-10 pr-11 py-2.5 text-sm cm-glass-input rounded-xl text-white placeholder:text-slate-500 focus:outline-none`},void 0,!1,{fileName:T,lineNumber:334,columnNumber:17},void 0),(0,w.jsxDEV)(`button`,{type:`button`,onClick:()=>I(e=>!e),"aria-label":F?`Hide password`:`Show password`,className:`absolute right-1 top-1/2 -translate-y-1/2 min-h-[38px] min-w-[38px] flex items-center justify-center text-slate-400 hover:text-white rounded-lg transition-colors`,children:F?(0,w.jsxDEV)(l,{className:`w-4 h-4`},void 0,!1,{fileName:T,lineNumber:351,columnNumber:21},void 0):(0,w.jsxDEV)(t,{className:`w-4 h-4`},void 0,!1,{fileName:T,lineNumber:353,columnNumber:21},void 0)},void 0,!1,{fileName:T,lineNumber:344,columnNumber:17},void 0)]},void 0,!0,{fileName:T,lineNumber:332,columnNumber:15},void 0),(0,w.jsxDEV)(`div`,{className:`flex items-center justify-between gap-2 pt-0.5`,children:[(0,w.jsxDEV)(`p`,{className:`text-[11px] text-slate-500`,children:`Managed securely by Supabase Auth.`},void 0,!1,{fileName:T,lineNumber:358,columnNumber:17},void 0),k===`signin`&&(0,w.jsxDEV)(`button`,{type:`button`,onClick:()=>{A(`forgot_password`),H(null),W(null)},className:`ml-auto text-xs font-semibold text-amber-400 hover:text-amber-300 transition-colors focus:outline-none focus-visible:underline whitespace-nowrap py-0.5`,children:`Forgot password?`},void 0,!1,{fileName:T,lineNumber:362,columnNumber:19},void 0)]},void 0,!0,{fileName:T,lineNumber:357,columnNumber:15},void 0)]},void 0,!0,{fileName:T,lineNumber:328,columnNumber:13},void 0),(0,w.jsxDEV)(`button`,{type:`submit`,disabled:z,className:`w-full py-2.5 px-4 rounded-xl bg-gradient-to-r from-amber-400 to-amber-500 hover:from-amber-300 hover:to-amber-400 disabled:opacity-50 text-slate-950 font-bold text-sm shadow-md shadow-amber-500/20 transition-all flex items-center justify-center gap-2`,children:z?(0,w.jsxDEV)(w.Fragment,{children:[(0,w.jsxDEV)(s,{className:`w-4 h-4 animate-spin`},void 0,!1,{fileName:T,lineNumber:385,columnNumber:17},void 0),(0,w.jsxDEV)(`span`,{children:k===`signin`?`Signing In...`:k===`signup`?`Creating Account...`:`Sending Recovery Link...`},void 0,!1,{fileName:T,lineNumber:386,columnNumber:17},void 0)]},void 0,!0,{fileName:T,lineNumber:384,columnNumber:15},void 0):(0,w.jsxDEV)(`span`,{children:k===`signin`?`Sign In`:k===`signup`?`Create Account`:`Send Password Reset Link`},void 0,!1,{fileName:T,lineNumber:395,columnNumber:15},void 0)},void 0,!1,{fileName:T,lineNumber:378,columnNumber:11},void 0)]},void 0,!0,{fileName:T,lineNumber:275,columnNumber:9},void 0),(0,w.jsxDEV)(`div`,{className:`px-6 py-4 bg-black/40 border-t border-white/5 space-y-3`,children:[(0,w.jsxDEV)(`div`,{className:`flex items-center justify-between text-xs text-slate-400`,children:[(0,w.jsxDEV)(`span`,{className:`flex items-center gap-1.5`,children:[(0,w.jsxDEV)(r,{className:`w-3.5 h-3.5 text-emerald-400`},void 0,!1,{fileName:T,lineNumber:410,columnNumber:15},void 0),(0,w.jsxDEV)(`span`,{children:`Protected by PostgreSQL Row Level Security`},void 0,!1,{fileName:T,lineNumber:411,columnNumber:15},void 0)]},void 0,!0,{fileName:T,lineNumber:409,columnNumber:13},void 0),(0,w.jsxDEV)(`button`,{type:`button`,onClick:()=>K(e=>!e),className:`text-amber-400 hover:text-amber-300 font-medium flex items-center gap-1`,children:[(0,w.jsxDEV)(d,{className:`w-3 h-3`},void 0,!1,{fileName:T,lineNumber:418,columnNumber:15},void 0),(0,w.jsxDEV)(`span`,{children:G?`Hide SQL`:`SQL Schema`},void 0,!1,{fileName:T,lineNumber:419,columnNumber:15},void 0)]},void 0,!0,{fileName:T,lineNumber:413,columnNumber:13},void 0)]},void 0,!0,{fileName:T,lineNumber:408,columnNumber:11},void 0),G&&(0,w.jsxDEV)(`div`,{className:`space-y-2 pt-1`,children:[(0,w.jsxDEV)(`div`,{className:`flex items-center justify-between text-[11px] text-slate-400`,children:[(0,w.jsxDEV)(`span`,{children:`Run in Supabase SQL Editor (also saved at supabase/schema.sql):`},void 0,!1,{fileName:T,lineNumber:426,columnNumber:17},void 0),(0,w.jsxDEV)(`button`,{type:`button`,onClick:()=>{navigator.clipboard?.writeText(S),J(!0),setTimeout(()=>J(!1),2500)},className:`px-2 py-1 rounded bg-white/10 hover:bg-white/15 text-white font-medium flex items-center gap-1`,children:q?(0,w.jsxDEV)(w.Fragment,{children:[(0,w.jsxDEV)(g,{className:`w-3 h-3 text-emerald-400`},void 0,!1,{fileName:T,lineNumber:434,columnNumber:23},void 0),(0,w.jsxDEV)(`span`,{children:`Copied`},void 0,!1,{fileName:T,lineNumber:435,columnNumber:23},void 0)]},void 0,!0,{fileName:T,lineNumber:433,columnNumber:21},void 0):(0,w.jsxDEV)(w.Fragment,{children:[(0,w.jsxDEV)(m,{className:`w-3 h-3`},void 0,!1,{fileName:T,lineNumber:439,columnNumber:23},void 0),(0,w.jsxDEV)(`span`,{children:`Copy SQL`},void 0,!1,{fileName:T,lineNumber:440,columnNumber:23},void 0)]},void 0,!0,{fileName:T,lineNumber:438,columnNumber:21},void 0)},void 0,!1,{fileName:T,lineNumber:427,columnNumber:17},void 0)]},void 0,!0,{fileName:T,lineNumber:425,columnNumber:15},void 0),(0,w.jsxDEV)(`pre`,{className:`max-h-36 overflow-y-auto p-2.5 rounded-lg bg-black/80 border border-white/10 text-[10px] font-mono text-slate-300 whitespace-pre`,children:`-- CineMax Phase 3: Persistent Auth, Watchlist, History, Episodes & Profile Schema
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
CREATE POLICY "Users can delete own avatar in own folder" ON storage.objects FOR DELETE TO authenticated USING (bucket_id = 'avatars' AND (storage.foldername(name))[1] = auth.uid()::text);`},void 0,!1,{fileName:T,lineNumber:445,columnNumber:15},void 0)]},void 0,!0,{fileName:T,lineNumber:424,columnNumber:13},void 0)]},void 0,!0,{fileName:T,lineNumber:407,columnNumber:9},void 0)]},void 0,!0,{fileName:T,lineNumber:171,columnNumber:7},void 0)]},void 0,!0,{fileName:T,lineNumber:168,columnNumber:5},void 0):null};export{E as AuthModal};