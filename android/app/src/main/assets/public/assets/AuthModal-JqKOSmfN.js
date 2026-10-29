import{a as e}from"./rolldown-runtime-BWaJ3C7D.js";import{$ as t,C as n,G as r,L as i,Mt as a,Pt as o,St as s,U as c,V as l,_t as u,ct as d,gt as f,nt as p,o as m,ot as h,r as g,tt as _}from"./vendor-icons-ZcS233Ax.js";import{t as v}from"./vendor-react-CrxJtI4K.js";import{A as y,I as b,L as x,P as S,b as C,w,y as T}from"./index-DneTnPXs.js";var E=e(o(),1),D=v(),O=`/app/applet/src/components/AuthModal.tsx`,k=({isOpen:e,onClose:o,supabaseConfigured:v,securityWarning:k,initialMode:A=`signin`,onAuthSuccess:j})=>{let[M,N]=(0,E.useState)(A),P=C(e&&(M===`signin`||M===`signup`)?M:null,[e,M]),[F,I]=(0,E.useState)(``),[L,R]=(0,E.useState)(``),[z,B]=(0,E.useState)(!1),[V,H]=(0,E.useState)(``),[U,W]=(0,E.useState)(!1),[G,K]=(0,E.useState)(null),[q,J]=(0,E.useState)(null),[Y,X]=(0,E.useState)(!1),[Z,Q]=(0,E.useState)(!1);return(0,E.useEffect)(()=>{e&&(N(A),K(null),J(null))},[e,A]),(0,E.useEffect)(()=>{if(!e)return;let t=e=>{e.key===`Escape`&&o()};return window.addEventListener(`keydown`,t),()=>window.removeEventListener(`keydown`,t)},[e,o]),e?(0,D.jsxDEV)(`div`,{className:`fixed inset-0 z-50 overflow-y-auto cm-glass-backdrop flex items-center justify-center p-4 animate-in fade-in duration-200`,children:[(0,D.jsxDEV)(`div`,{className:`fixed inset-0`,onClick:o},void 0,!1,{fileName:O,lineNumber:175,columnNumber:7},void 0),(0,D.jsxDEV)(`div`,{className:`relative z-10 w-full max-w-md cm-glass-panel rounded-2xl overflow-hidden my-auto`,children:[(0,D.jsxDEV)(`div`,{className:`px-6 pt-6 pb-4 border-b border-white/[0.07] cm-glass-subbar flex items-center justify-between`,children:[(0,D.jsxDEV)(`div`,{className:`flex items-center gap-2.5`,children:[(0,D.jsxDEV)(`div`,{className:`w-8 h-8 rounded-lg bg-gradient-to-br from-amber-400 to-amber-600 flex items-center justify-center text-black shadow-md shadow-amber-500/20`,children:(0,D.jsxDEV)(t,{className:`w-4 h-4 stroke-[2.5]`},void 0,!1,{fileName:O,lineNumber:182,columnNumber:15},void 0)},void 0,!1,{fileName:O,lineNumber:181,columnNumber:13},void 0),(0,D.jsxDEV)(`div`,{children:[(0,D.jsxDEV)(`h2`,{className:`font-['Outfit'] text-lg font-bold text-white tracking-tight`,children:M===`signin`?`Sign In to CineMax`:M===`signup`?`Create Cinephile Account`:`Reset Your Password`},void 0,!1,{fileName:O,lineNumber:185,columnNumber:15},void 0),(0,D.jsxDEV)(`p`,{className:`text-xs text-slate-400`,children:M===`forgot_password`?`Receive a secure password recovery link via email`:`Cloud-synced watchlist, favourites & viewing journal`},void 0,!1,{fileName:O,lineNumber:192,columnNumber:15},void 0)]},void 0,!0,{fileName:O,lineNumber:184,columnNumber:13},void 0)]},void 0,!0,{fileName:O,lineNumber:180,columnNumber:11},void 0),(0,D.jsxDEV)(`button`,{onClick:o,"aria-label":`Close authentication modal`,className:`p-2 rounded-lg text-slate-400 hover:text-white cm-glass-control`,children:(0,D.jsxDEV)(g,{className:`w-4 h-4`},void 0,!1,{fileName:O,lineNumber:205,columnNumber:13},void 0)},void 0,!1,{fileName:O,lineNumber:200,columnNumber:11},void 0)]},void 0,!0,{fileName:O,lineNumber:179,columnNumber:9},void 0),M===`forgot_password`?(0,D.jsxDEV)(`div`,{className:`px-6 pt-4`,children:(0,D.jsxDEV)(`button`,{type:`button`,onClick:()=>{N(`signin`),K(null),J(null)},className:`inline-flex items-center gap-1.5 text-xs font-semibold text-amber-400 hover:text-amber-300 transition-colors py-1`,children:[(0,D.jsxDEV)(a,{className:`w-3.5 h-3.5`},void 0,!1,{fileName:O,lineNumber:270,columnNumber:15},void 0),(0,D.jsxDEV)(`span`,{children:`Back to Sign In`},void 0,!1,{fileName:O,lineNumber:271,columnNumber:15},void 0)]},void 0,!0,{fileName:O,lineNumber:261,columnNumber:13},void 0)},void 0,!1,{fileName:O,lineNumber:260,columnNumber:11},void 0):(0,D.jsxDEV)(`div`,{className:`px-6 pt-4`,children:(0,D.jsxDEV)(`div`,{ref:P.containerRef,className:`relative grid grid-cols-2 gap-1 p-1 cm-glass-segmented rounded-xl overflow-hidden`,children:[(0,D.jsxDEV)(T,{controller:P,variant:`amber`,className:`top-1 bottom-1 rounded-lg`},void 0,!1,{fileName:O,lineNumber:216,columnNumber:15},void 0),(0,D.jsxDEV)(`button`,{ref:P.registerTab(`signin`),type:`button`,onClick:()=>{N(`signin`),K(null),J(null)},className:`relative z-10 py-2 text-xs font-semibold rounded-lg transition-colors ${M===`signin`?P.ready?`text-slate-950 font-bold`:`bg-amber-500 text-slate-950 font-bold`:`text-slate-400 hover:text-white`}`,children:`Sign In`},void 0,!1,{fileName:O,lineNumber:221,columnNumber:15},void 0),(0,D.jsxDEV)(`button`,{ref:P.registerTab(`signup`),type:`button`,onClick:()=>{N(`signup`),K(null),J(null)},className:`relative z-10 py-2 text-xs font-semibold rounded-lg transition-colors ${M===`signup`?P.ready?`text-slate-950 font-bold`:`bg-amber-500 text-slate-950 font-bold`:`text-slate-400 hover:text-white`}`,children:`Create Account`},void 0,!1,{fileName:O,lineNumber:239,columnNumber:15},void 0)]},void 0,!0,{fileName:O,lineNumber:212,columnNumber:13},void 0)},void 0,!1,{fileName:O,lineNumber:211,columnNumber:11},void 0),!v&&(0,D.jsxDEV)(`div`,{className:`mx-6 mt-4 p-3.5 rounded-xl bg-amber-500/10 border border-amber-500/30 text-xs text-amber-200 space-y-2`,children:(0,D.jsxDEV)(`div`,{className:`flex items-start gap-2`,children:[(0,D.jsxDEV)(u,{className:`w-4 h-4 text-amber-400 shrink-0 mt-0.5`},void 0,!1,{fileName:O,lineNumber:280,columnNumber:15},void 0),(0,D.jsxDEV)(`div`,{className:`space-y-1`,children:[(0,D.jsxDEV)(`p`,{className:`font-semibold text-amber-300`,children:k?`Security Warning`:`Supabase Connection Not Configured`},void 0,!1,{fileName:O,lineNumber:282,columnNumber:17},void 0),(0,D.jsxDEV)(`p`,{className:`text-amber-200/80 leading-relaxed`,children:k||`To enable live cloud authentication and PostgreSQL persistence, add VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY in AI Studio Secrets.`},void 0,!1,{fileName:O,lineNumber:285,columnNumber:17},void 0)]},void 0,!0,{fileName:O,lineNumber:281,columnNumber:15},void 0)]},void 0,!0,{fileName:O,lineNumber:279,columnNumber:13},void 0)},void 0,!1,{fileName:O,lineNumber:278,columnNumber:11},void 0),(0,D.jsxDEV)(`form`,{onSubmit:async e=>{if(e.preventDefault(),U)return;if(K(null),J(null),!v){K(k||`Supabase credentials are not configured yet. Add VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY in AI Studio Secrets.`);return}let t=F.trim();if(!t)K(`Please enter your email address.`);else if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(t))K(`Please enter a valid email address (for example, name@example.com).`);else{if(M!==`forgot_password`){if(!L){K(`Please enter your password.`);return}if(L.length<6){K(`Password must be at least 6 characters long.`);return}}W(!0);try{if(M===`forgot_password`){let{error:e}=await S(t);e?K(e):J(`If an account exists for ${t}, we've sent a password reset link. Please check your inbox and spam folder.`)}else if(M===`signup`){let{user:e,session:n,error:r}=await x(t,L,V);r?K(r):e&&!n?(N(`signin`),I(t),R(``),J(`Account created for ${t}! Please check your email inbox to confirm your address, then sign in below.`)):n&&(R(``),j?.(),o())}else{let{session:e,error:n}=await b(t,L);n?K(n):e&&(R(``),j?.(),o())}}catch(e){K(y(e?.message))}finally{W(!1)}}},className:`p-6 space-y-4`,noValidate:!0,children:[G&&(0,D.jsxDEV)(`div`,{className:`p-3 rounded-xl bg-red-500/10 border border-red-500/30 text-xs text-red-300 flex items-start gap-2`,children:[(0,D.jsxDEV)(u,{className:`w-4 h-4 text-red-400 shrink-0 mt-0.5`},void 0,!1,{fileName:O,lineNumber:298,columnNumber:15},void 0),(0,D.jsxDEV)(`span`,{children:G},void 0,!1,{fileName:O,lineNumber:299,columnNumber:15},void 0)]},void 0,!0,{fileName:O,lineNumber:297,columnNumber:13},void 0),q&&(0,D.jsxDEV)(`div`,{className:`p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-xs text-emerald-300 flex items-start gap-2`,children:[(0,D.jsxDEV)(f,{className:`w-4 h-4 text-emerald-400 shrink-0 mt-0.5`},void 0,!1,{fileName:O,lineNumber:305,columnNumber:15},void 0),(0,D.jsxDEV)(`span`,{children:q},void 0,!1,{fileName:O,lineNumber:306,columnNumber:15},void 0)]},void 0,!0,{fileName:O,lineNumber:304,columnNumber:13},void 0),M===`signup`&&(0,D.jsxDEV)(`div`,{className:`space-y-1.5`,children:[(0,D.jsxDEV)(`label`,{className:`block text-xs font-medium text-slate-300`,children:`Display Name`},void 0,!1,{fileName:O,lineNumber:312,columnNumber:15},void 0),(0,D.jsxDEV)(`div`,{className:`relative`,children:[(0,D.jsxDEV)(m,{className:`w-4 h-4 text-slate-500 absolute left-3.5 top-1/2 -translate-y-1/2`},void 0,!1,{fileName:O,lineNumber:316,columnNumber:17},void 0),(0,D.jsxDEV)(`input`,{type:`text`,value:V,onChange:e=>H(e.target.value),placeholder:`Alex Rivera`,maxLength:80,className:`w-full pl-10 pr-3.5 py-2.5 text-sm cm-glass-input rounded-xl text-white placeholder:text-slate-500 focus:outline-none`},void 0,!1,{fileName:O,lineNumber:317,columnNumber:17},void 0)]},void 0,!0,{fileName:O,lineNumber:315,columnNumber:15},void 0)]},void 0,!0,{fileName:O,lineNumber:311,columnNumber:13},void 0),(0,D.jsxDEV)(`div`,{className:`space-y-1.5`,children:[(0,D.jsxDEV)(`label`,{className:`block text-xs font-medium text-slate-300`,children:`Email Address`},void 0,!1,{fileName:O,lineNumber:330,columnNumber:13},void 0),(0,D.jsxDEV)(`div`,{className:`relative`,children:[(0,D.jsxDEV)(i,{className:`w-4 h-4 text-slate-500 absolute left-3.5 top-1/2 -translate-y-1/2`},void 0,!1,{fileName:O,lineNumber:334,columnNumber:15},void 0),(0,D.jsxDEV)(`input`,{type:`email`,required:!0,autoComplete:`email`,value:F,onChange:e=>I(e.target.value),placeholder:`you@example.com`,className:`w-full pl-10 pr-3.5 py-2.5 text-sm cm-glass-input rounded-xl text-white placeholder:text-slate-500 focus:outline-none`},void 0,!1,{fileName:O,lineNumber:335,columnNumber:15},void 0)]},void 0,!0,{fileName:O,lineNumber:333,columnNumber:13},void 0)]},void 0,!0,{fileName:O,lineNumber:329,columnNumber:11},void 0),M!==`forgot_password`&&(0,D.jsxDEV)(`div`,{className:`space-y-1.5`,children:[(0,D.jsxDEV)(`label`,{className:`block text-xs font-medium text-slate-300`,children:`Password`},void 0,!1,{fileName:O,lineNumber:349,columnNumber:15},void 0),(0,D.jsxDEV)(`div`,{className:`relative`,children:[(0,D.jsxDEV)(l,{className:`w-4 h-4 text-slate-500 absolute left-3.5 top-1/2 -translate-y-1/2`},void 0,!1,{fileName:O,lineNumber:353,columnNumber:17},void 0),(0,D.jsxDEV)(`input`,{type:z?`text`:`password`,required:!0,minLength:6,autoComplete:M===`signin`?`current-password`:`new-password`,value:L,onChange:e=>R(e.target.value),placeholder:`••••••••`,className:`w-full pl-10 pr-11 py-2.5 text-sm cm-glass-input rounded-xl text-white placeholder:text-slate-500 focus:outline-none`},void 0,!1,{fileName:O,lineNumber:354,columnNumber:17},void 0),(0,D.jsxDEV)(`button`,{type:`button`,onClick:()=>B(e=>!e),"aria-label":z?`Hide password`:`Show password`,className:`absolute right-1 top-1/2 -translate-y-1/2 min-h-[38px] min-w-[38px] flex items-center justify-center text-slate-400 hover:text-white rounded-lg transition-colors`,children:z?(0,D.jsxDEV)(p,{className:`w-4 h-4`},void 0,!1,{fileName:O,lineNumber:371,columnNumber:21},void 0):(0,D.jsxDEV)(_,{className:`w-4 h-4`},void 0,!1,{fileName:O,lineNumber:373,columnNumber:21},void 0)},void 0,!1,{fileName:O,lineNumber:364,columnNumber:17},void 0)]},void 0,!0,{fileName:O,lineNumber:352,columnNumber:15},void 0),M===`signin`?(0,D.jsxDEV)(`div`,{className:`flex items-center justify-end pt-1`,children:(0,D.jsxDEV)(`button`,{type:`button`,"data-testid":`modal-forgot-password-link`,onClick:()=>{N(`forgot_password`),K(null),J(null)},className:`inline-flex items-center gap-1.5 min-h-[36px] px-2 -mr-1 rounded-lg text-xs sm:text-[13px] font-semibold text-amber-400 hover:text-amber-300 hover:bg-amber-500/10 underline-offset-4 hover:underline transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-400/60 whitespace-nowrap`,children:[(0,D.jsxDEV)(r,{className:`w-3.5 h-3.5 shrink-0`},void 0,!1,{fileName:O,lineNumber:389,columnNumber:21},void 0),(0,D.jsxDEV)(`span`,{children:`Forgot Password?`},void 0,!1,{fileName:O,lineNumber:390,columnNumber:21},void 0)]},void 0,!0,{fileName:O,lineNumber:379,columnNumber:19},void 0)},void 0,!1,{fileName:O,lineNumber:378,columnNumber:17},void 0):(0,D.jsxDEV)(`p`,{className:`text-[11px] text-slate-500 pt-0.5`,children:`Minimum 6 characters · Managed securely by Supabase Auth.`},void 0,!1,{fileName:O,lineNumber:394,columnNumber:17},void 0)]},void 0,!0,{fileName:O,lineNumber:348,columnNumber:13},void 0),(0,D.jsxDEV)(`button`,{type:`submit`,disabled:U,className:`w-full py-2.5 px-4 rounded-xl bg-gradient-to-r from-amber-400 to-amber-500 hover:from-amber-300 hover:to-amber-400 disabled:opacity-50 text-slate-950 font-bold text-sm shadow-md shadow-amber-500/20 transition-all flex items-center justify-center gap-2`,children:U?(0,D.jsxDEV)(D.Fragment,{children:[(0,D.jsxDEV)(c,{className:`w-4 h-4 animate-spin`},void 0,!1,{fileName:O,lineNumber:408,columnNumber:17},void 0),(0,D.jsxDEV)(`span`,{children:M===`signin`?`Signing In...`:M===`signup`?`Creating Account...`:`Sending Recovery Link...`},void 0,!1,{fileName:O,lineNumber:409,columnNumber:17},void 0)]},void 0,!0,{fileName:O,lineNumber:407,columnNumber:15},void 0):(0,D.jsxDEV)(`span`,{children:M===`signin`?`Sign In`:M===`signup`?`Create Account`:`Send Password Reset Link`},void 0,!1,{fileName:O,lineNumber:418,columnNumber:15},void 0)},void 0,!1,{fileName:O,lineNumber:401,columnNumber:11},void 0),M===`forgot_password`&&(0,D.jsxDEV)(`div`,{className:`pt-1 text-center`,children:(0,D.jsxDEV)(`button`,{type:`button`,onClick:()=>{N(`signin`),K(null),J(null)},className:`text-xs text-slate-400 hover:text-amber-300 transition-colors py-1`,children:[`Remembered your password?`,` `,(0,D.jsxDEV)(`span`,{className:`font-semibold text-amber-400`,children:`Return to Sign In`},void 0,!1,{fileName:O,lineNumber:440,columnNumber:17},void 0)]},void 0,!0,{fileName:O,lineNumber:430,columnNumber:15},void 0)},void 0,!1,{fileName:O,lineNumber:429,columnNumber:13},void 0)]},void 0,!0,{fileName:O,lineNumber:295,columnNumber:9},void 0),(0,D.jsxDEV)(`div`,{className:`px-6 py-4 bg-black/40 border-t border-white/5 space-y-3`,children:[(0,D.jsxDEV)(`div`,{className:`flex items-center justify-between text-xs text-slate-400`,children:[(0,D.jsxDEV)(`span`,{className:`flex items-center gap-1.5`,children:[(0,D.jsxDEV)(n,{className:`w-3.5 h-3.5 text-emerald-400`},void 0,!1,{fileName:O,lineNumber:452,columnNumber:15},void 0),(0,D.jsxDEV)(`span`,{children:`Protected by PostgreSQL Row Level Security`},void 0,!1,{fileName:O,lineNumber:453,columnNumber:15},void 0)]},void 0,!0,{fileName:O,lineNumber:451,columnNumber:13},void 0),(0,D.jsxDEV)(`button`,{type:`button`,onClick:()=>X(e=>!e),className:`text-amber-400 hover:text-amber-300 font-medium flex items-center gap-1`,children:[(0,D.jsxDEV)(h,{className:`w-3 h-3`},void 0,!1,{fileName:O,lineNumber:460,columnNumber:15},void 0),(0,D.jsxDEV)(`span`,{children:Y?`Hide SQL`:`SQL Schema`},void 0,!1,{fileName:O,lineNumber:461,columnNumber:15},void 0)]},void 0,!0,{fileName:O,lineNumber:455,columnNumber:13},void 0)]},void 0,!0,{fileName:O,lineNumber:450,columnNumber:11},void 0),Y&&(0,D.jsxDEV)(`div`,{className:`space-y-2 pt-1`,children:[(0,D.jsxDEV)(`div`,{className:`flex items-center justify-between text-[11px] text-slate-400`,children:[(0,D.jsxDEV)(`span`,{children:`Run in Supabase SQL Editor (also saved at supabase/schema.sql):`},void 0,!1,{fileName:O,lineNumber:468,columnNumber:17},void 0),(0,D.jsxDEV)(`button`,{type:`button`,onClick:()=>{navigator.clipboard?.writeText(w),Q(!0),setTimeout(()=>Q(!1),2500)},className:`px-2 py-1 rounded bg-white/10 hover:bg-white/15 text-white font-medium flex items-center gap-1`,children:Z?(0,D.jsxDEV)(D.Fragment,{children:[(0,D.jsxDEV)(s,{className:`w-3 h-3 text-emerald-400`},void 0,!1,{fileName:O,lineNumber:476,columnNumber:23},void 0),(0,D.jsxDEV)(`span`,{children:`Copied`},void 0,!1,{fileName:O,lineNumber:477,columnNumber:23},void 0)]},void 0,!0,{fileName:O,lineNumber:475,columnNumber:21},void 0):(0,D.jsxDEV)(D.Fragment,{children:[(0,D.jsxDEV)(d,{className:`w-3 h-3`},void 0,!1,{fileName:O,lineNumber:481,columnNumber:23},void 0),(0,D.jsxDEV)(`span`,{children:`Copy SQL`},void 0,!1,{fileName:O,lineNumber:482,columnNumber:23},void 0)]},void 0,!0,{fileName:O,lineNumber:480,columnNumber:21},void 0)},void 0,!1,{fileName:O,lineNumber:469,columnNumber:17},void 0)]},void 0,!0,{fileName:O,lineNumber:467,columnNumber:15},void 0),(0,D.jsxDEV)(`pre`,{className:`max-h-36 overflow-y-auto p-2.5 rounded-lg bg-black/80 border border-white/10 text-[10px] font-mono text-slate-300 whitespace-pre`,children:`-- CineMax Phase 3: Persistent Auth, Watchlist, History, Episodes & Profile Schema
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
CREATE POLICY "Users can delete own avatar in own folder" ON storage.objects FOR DELETE TO authenticated USING (bucket_id = 'avatars' AND (storage.foldername(name))[1] = auth.uid()::text);`},void 0,!1,{fileName:O,lineNumber:487,columnNumber:15},void 0)]},void 0,!0,{fileName:O,lineNumber:466,columnNumber:13},void 0)]},void 0,!0,{fileName:O,lineNumber:449,columnNumber:9},void 0)]},void 0,!0,{fileName:O,lineNumber:177,columnNumber:7},void 0)]},void 0,!0,{fileName:O,lineNumber:174,columnNumber:5},void 0):null};export{k as AuthModal};