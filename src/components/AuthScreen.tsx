import React, { useState, useEffect } from 'react';
import {
  ensureSupabaseClient,
  formatAuthErrorMessage,
  requestPasswordResetEmail,
  signInWithEmail,
  signUpWithEmail,
  SUPABASE_SCHEMA_SQL,
} from '../services/supabaseClient';
import { MEDIA_ITEMS } from '../data/mediaData';
import { MediaPoster } from './MediaPoster';
import { LiquidTabBubble, useLiquidTabBubble } from './LiquidTabBubble';
import {
  Film,
  Mail,
  Lock,
  User as UserIcon,
  AlertCircle,
  CheckCircle2,
  Loader2,
  Eye,
  EyeOff,
  ShieldCheck,
  Database,
  Copy,
  Check,
  RefreshCw,
  Bookmark,
  Tv,
  Compass,
  KeyRound,
  ArrowLeft,
} from 'lucide-react';

export type AuthScreenMode = 'signin' | 'signup' | 'forgot_password';

interface AuthScreenProps {
  supabaseConfigured: boolean;
  securityWarning?: string | null;
  initialMode?: AuthScreenMode;
  initialEmail?: string;
  initialSuccessNotice?: string | null;
  onSupabaseReconnected?: (configured: boolean, warning: string | null) => void;
  onAuthSuccess?: () => void;
}

const SHOWCASE_TITLES = MEDIA_ITEMS.slice(0, 3);

export const AuthScreen: React.FC<AuthScreenProps> = ({
  supabaseConfigured,
  securityWarning,
  initialMode = 'signin',
  initialEmail = '',
  initialSuccessNotice = null,
  onSupabaseReconnected,
  onAuthSuccess,
}) => {
  const [mode, setMode] = useState<AuthScreenMode>(initialMode);
  const modeBubble = useLiquidTabBubble<'signin' | 'signup'>(
    mode === 'signin' || mode === 'signup' ? mode : null,
    [mode]
  );
  const [displayName, setDisplayName] = useState('');
  const [email, setEmail] = useState(initialEmail);
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [retryingConnection, setRetryingConnection] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(
    initialSuccessNotice
  );
  const [showSqlHelper, setShowSqlHelper] = useState(false);
  const [copiedSql, setCopiedSql] = useState(false);

  useEffect(() => {
    setMode(initialMode);
    setErrorMsg(null);
    setSuccessMsg(initialSuccessNotice || null);
  }, [initialMode, initialSuccessNotice]);

  useEffect(() => {
    if (initialEmail) {
      setEmail(initialEmail);
    }
  }, [initialEmail]);

  const handleCopySql = () => {
    navigator.clipboard?.writeText(SUPABASE_SCHEMA_SQL);
    setCopiedSql(true);
    setTimeout(() => setCopiedSql(false), 2500);
  };

  const handleRetryConnection = async () => {
    setRetryingConnection(true);
    setErrorMsg(null);
    try {
      const { configured, securityWarning: secWarn } = await ensureSupabaseClient();
      onSupabaseReconnected?.(configured, secWarn);
      if (!configured) {
        setErrorMsg(
          secWarn ||
            'Could not connect to Supabase yet. Ensure the backend service is awake or VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY are configured.'
        );
      }
    } finally {
      setRetryingConnection(false);
    }
  };

  const handleModeSwitch = (nextMode: AuthScreenMode) => {
    setMode(nextMode);
    setErrorMsg(null);
    setSuccessMsg(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (loading) return;
    setErrorMsg(null);
    setSuccessMsg(null);

    const cleanEmail = email.trim();
    if (!cleanEmail) {
      setErrorMsg('Please enter your email address.');
      return;
    }

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail)) {
      setErrorMsg('Please enter a valid email address (for example, name@example.com).');
      return;
    }

    if (mode !== 'forgot_password') {
      if (!password) {
        setErrorMsg('Please enter your password.');
        return;
      }

      if (password.length < 6) {
        setErrorMsg('Password must be at least 6 characters long.');
        return;
      }

      if (mode === 'signup' && displayName.trim().length > 80) {
        setErrorMsg('Display name must be 80 characters or fewer.');
        return;
      }
    }

    setLoading(true);
    try {
      if (!supabaseConfigured) {
        const recheck = await ensureSupabaseClient();
        onSupabaseReconnected?.(recheck.configured, recheck.securityWarning);
        if (!recheck.configured) {
          setErrorMsg(
            recheck.securityWarning ||
              'Supabase authentication is not configured yet. Please check your connection or configure VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY.'
          );
          setLoading(false);
          return;
        }
      }

      if (mode === 'forgot_password') {
        const { error } = await requestPasswordResetEmail(cleanEmail);
        if (error) {
          setErrorMsg(error);
        } else {
          setSuccessMsg(
            `If an account exists for ${cleanEmail}, we've sent a password reset link. Please check your inbox and spam folder.`
          );
        }
      } else if (mode === 'signup') {
        const { user, session, error } = await signUpWithEmail(
          cleanEmail,
          password,
          displayName
        );
        if (error) {
          setErrorMsg(error);
        } else if (user && !session) {
          // Confirmed choice: switch to Sign In with email pre-filled and show confirmation banner
          setMode('signin');
          setEmail(cleanEmail);
          setPassword('');
          setSuccessMsg(
            `Account created for ${cleanEmail}! Please check your email inbox to confirm your address, then sign in below.`
          );
        } else if (session) {
          setPassword('');
          onAuthSuccess?.();
        }
      } else {
        const { session, error } = await signInWithEmail(cleanEmail, password);
        if (error) {
          setErrorMsg(error);
        } else if (session) {
          setPassword('');
          onAuthSuccess?.();
        }
      }
    } catch (err: any) {
      setErrorMsg(formatAuthErrorMessage(err?.message));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#0A0D12] text-slate-100 flex flex-col justify-between font-['Plus_Jakarta_Sans'] relative overflow-x-hidden">
      {/* Subtle Ambient Cinema Spotlight Background */}
      <div
        aria-hidden="true"
        className="pointer-events-none fixed inset-0 overflow-hidden z-0"
      >
        <div className="absolute -top-40 left-1/2 -translate-x-1/2 w-[780px] h-[440px] rounded-full bg-amber-500/[0.08] blur-[130px]" />
        <div className="absolute bottom-0 left-1/4 w-[520px] h-[340px] rounded-full bg-amber-600/[0.05] blur-[140px]" />
      </div>

      {/* Top Bar (Inset Rounded Liquid Glass Panel) */}
      <header className="sticky top-0 z-30 w-full pt-2 sm:pt-2.5 px-3 sm:px-6 lg:px-8">
        <div className="max-w-[1440px] mx-auto cm-glass-nav rounded-[20px] md:rounded-[22px] px-4 sm:px-6 h-14 md:h-16 flex items-center justify-between gap-4">
          <div className="flex items-center gap-2.5 shrink-0">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-amber-400 to-amber-600 flex items-center justify-center text-slate-950 shadow-md shadow-amber-500/20">
              <Film className="w-4 h-4 stroke-[2.5]" />
            </div>
            <span className="font-['Plus_Jakarta_Sans'] text-xl font-extrabold tracking-tight text-white whitespace-nowrap">
              Cine<span className="text-amber-400">Max</span>
            </span>
          </div>

          <div className="flex items-center gap-3 shrink-0">
            <button
              type="button"
              onClick={() =>
                handleModeSwitch(mode === 'signin' ? 'signup' : 'signin')
              }
              className="px-4 py-2 min-h-[38px] text-xs font-semibold text-slate-200 hover:text-white cm-glass-control rounded-xl whitespace-nowrap shrink-0"
            >
              {mode === 'signin' ? 'Create Account' : 'Sign In'}
            </button>
          </div>
        </div>
      </header>

      {/* Main Split Content Container */}
      <main className="relative z-10 flex-1 flex items-center py-8 sm:py-12 px-4 sm:px-6 lg:px-8">
        <div className="max-w-6xl w-full mx-auto grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12 items-center">
          {/* Left Column: Brand Value & Curated Cinema Showcase */}
          <div className="lg:col-span-7 space-y-6 order-2 lg:order-1">
            <div className="space-y-3">
              <p className="text-xs font-semibold text-amber-400 tracking-wide">
                Cinema &amp; Television Discovery Platform
              </p>
              <h1
                className="font-['Outfit'] text-3xl sm:text-4xl lg:text-[2.75rem] font-extrabold text-white tracking-tight leading-[1.12]"
                style={{ textWrap: 'balance' }}
              >
                Your Personal Cinema Universe, Synced Everywhere.
              </h1>
              <p className="text-sm sm:text-base text-slate-300 max-w-xl leading-relaxed">
                Sign in or create your CineMax account to unlock live movie and series search, mood-driven recommendations, episode-by-episode TV progress, and a cloud-synced viewing journal across Web and Android.
              </p>
            </div>

            {/* Key Capabilities List */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-1">
              <div className="p-4 rounded-xl cm-glass-surface space-y-1.5">
                <div className="flex items-center gap-2 text-amber-400 text-xs font-semibold">
                  <Compass className="w-4 h-4 shrink-0" />
                  <span>Live Discovery</span>
                </div>
                <p className="text-xs text-slate-400 leading-relaxed">
                  Explore trending cinema, regional classics, and mood-curated collections.
                </p>
              </div>

              <div className="p-4 rounded-xl cm-glass-surface space-y-1.5">
                <div className="flex items-center gap-2 text-amber-400 text-xs font-semibold">
                  <Bookmark className="w-4 h-4 shrink-0" />
                  <span>Cloud Watchlist</span>
                </div>
                <p className="text-xs text-slate-400 leading-relaxed">
                  Save titles, rate films out of 10, and keep personal review notes in sync.
                </p>
              </div>

              <div className="p-4 rounded-xl cm-glass-surface space-y-1.5">
                <div className="flex items-center gap-2 text-amber-400 text-xs font-semibold">
                  <Tv className="w-4 h-4 shrink-0" />
                  <span>Episode Tracker</span>
                </div>
                <p className="text-xs text-slate-400 leading-relaxed">
                  Track every season and episode watched with automatic series completion.
                </p>
              </div>
            </div>

            {/* Featured Titles Preview Strip */}
            <div className="pt-2 space-y-3">
              <div className="text-xs text-slate-400 font-medium">
                Featured in the CineMax Catalogue
              </div>
              <div className="grid grid-cols-3 gap-3 sm:gap-4 max-w-lg">
                {SHOWCASE_TITLES.map((item) => (
                  <div
                    key={item.id}
                    className="rounded-xl overflow-hidden border border-white/10 bg-[#10141d] flex flex-col"
                  >
                    <div className="aspect-[2/3] w-full relative overflow-hidden">
                      <MediaPoster
                        media={item}
                        className="w-full h-full object-cover"
                      />
                    </div>
                    <div className="p-2.5 space-y-0.5">
                      <p className="text-xs font-semibold text-white truncate">
                        {item.title}
                      </p>
                      <p className="text-[11px] text-slate-400 truncate tabular-nums">
                        {item.year} · ★ {item.rating}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Right Column: Authentication Card */}
          <div className="lg:col-span-5 order-1 lg:order-2">
            <div className="w-full max-w-md mx-auto cm-glass-panel rounded-2xl overflow-hidden">
              {/* Card Header */}
              <div className="px-6 pt-6 pb-4 border-b border-white/[0.07] cm-glass-subbar">
                <h2 className="font-['Outfit'] text-xl sm:text-2xl font-bold text-white tracking-tight flex items-center gap-2">
                  {mode === 'forgot_password' && (
                    <KeyRound className="w-5 h-5 text-amber-400 shrink-0" />
                  )}
                  <span>
                    {mode === 'signin'
                      ? 'Sign In to CineMax'
                      : mode === 'signup'
                      ? 'Create Your CineMax Account'
                      : 'Reset Your Password'}
                  </span>
                </h2>
                <p className="text-xs text-slate-400 mt-1">
                  {mode === 'signin'
                    ? 'Enter your email and password to open your home feed and watchlist.'
                    : mode === 'signup'
                    ? 'Register in seconds to start building your personal cinema library.'
                    : 'Enter your account email and we will send you a secure password recovery link.'}
                </p>
              </div>

              {/* Segmented Mode Switcher (44px+ touch targets) */}
              {mode !== 'forgot_password' ? (
                <div className="px-6 pt-5">
                  <div
                    ref={modeBubble.containerRef}
                    className="relative grid grid-cols-2 gap-1.5 p-1 cm-glass-segmented rounded-xl overflow-hidden"
                  >
                    <LiquidTabBubble
                      controller={modeBubble}
                      variant="amber"
                      className="top-1 bottom-1 rounded-lg"
                    />
                    <button
                      ref={modeBubble.registerTab('signin')}
                      type="button"
                      onClick={() => handleModeSwitch('signin')}
                      className={`relative z-10 min-h-[44px] py-2.5 px-3 text-xs font-bold rounded-lg transition-colors whitespace-nowrap ${
                        mode === 'signin'
                          ? modeBubble.ready
                            ? 'text-slate-950'
                            : 'bg-amber-500 text-slate-950 shadow-sm'
                          : 'text-slate-400 hover:text-white'
                      }`}
                    >
                      Sign In
                    </button>
                    <button
                      ref={modeBubble.registerTab('signup')}
                      type="button"
                      onClick={() => handleModeSwitch('signup')}
                      className={`relative z-10 min-h-[44px] py-2.5 px-3 text-xs font-bold rounded-lg transition-colors whitespace-nowrap ${
                        mode === 'signup'
                          ? modeBubble.ready
                            ? 'text-slate-950'
                            : 'bg-amber-500 text-slate-950 shadow-sm'
                          : 'text-slate-400 hover:text-white'
                      }`}
                    >
                      Sign Up
                    </button>
                  </div>
                </div>
              ) : (
                <div className="px-6 pt-4">
                  <button
                    type="button"
                    onClick={() => handleModeSwitch('signin')}
                    className="inline-flex items-center gap-1.5 text-xs font-semibold text-amber-400 hover:text-amber-300 transition-colors py-1"
                  >
                    <ArrowLeft className="w-3.5 h-3.5" />
                    <span>Back to Sign In</span>
                  </button>
                </div>
              )}

              {/* Configuration / Connection Notice */}
              {!supabaseConfigured && (
                <div className="mx-6 mt-4 p-3.5 rounded-xl bg-amber-500/10 border border-amber-500/30 text-xs text-amber-200 space-y-2.5">
                  <div className="flex items-start gap-2">
                    <AlertCircle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                    <div className="space-y-1">
                      <p className="font-semibold text-amber-300">
                        {securityWarning
                          ? 'Security Configuration Notice'
                          : 'Connecting to Authentication Service'}
                      </p>
                      <p className="text-amber-200/80 leading-relaxed">
                        {securityWarning ||
                          'If the cloud backend is waking up from idle, click Reconnect below or submit your credentials to retry automatically.'}
                      </p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={handleRetryConnection}
                    disabled={retryingConnection}
                    className="w-full min-h-[40px] py-2 px-3 rounded-lg bg-amber-500/20 hover:bg-amber-500/30 border border-amber-500/40 text-amber-200 font-semibold text-xs flex items-center justify-center gap-1.5 transition-colors disabled:opacity-50"
                  >
                    <RefreshCw
                      className={`w-3.5 h-3.5 ${retryingConnection ? 'animate-spin' : ''}`}
                    />
                    <span>
                      {retryingConnection ? 'Checking Connection...' : 'Reconnect Service'}
                    </span>
                  </button>
                </div>
              )}

              {/* Form Body */}
              <form onSubmit={handleSubmit} className="p-6 space-y-4" noValidate>
                {errorMsg && (
                  <div
                    role="alert"
                    className="p-3.5 rounded-xl bg-red-500/10 border border-red-500/30 text-xs text-red-200 flex items-start gap-2.5"
                  >
                    <AlertCircle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
                    <span className="leading-relaxed">{errorMsg}</span>
                  </div>
                )}

                {successMsg && (
                  <div
                    role="status"
                    className="p-3.5 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-xs text-emerald-200 flex items-start gap-2.5"
                  >
                    <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                    <span className="leading-relaxed">{successMsg}</span>
                  </div>
                )}

                {mode === 'signup' && (
                  <div className="space-y-1.5">
                    <label
                      htmlFor="auth-display-name"
                      className="block text-xs font-medium text-slate-300"
                    >
                      Display Name
                    </label>
                    <div className="relative">
                      <UserIcon className="w-4 h-4 text-slate-500 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                      <input
                        id="auth-display-name"
                        type="text"
                        autoComplete="name"
                        value={displayName}
                        onChange={(e) => setDisplayName(e.target.value)}
                        placeholder="Alex Rivera"
                        maxLength={80}
                        className="w-full min-h-[46px] pl-10 pr-3.5 py-2.5 text-sm cm-glass-input rounded-xl text-white placeholder:text-slate-500 focus:outline-none"
                      />
                    </div>
                  </div>
                )}

                <div className="space-y-1.5">
                  <label
                    htmlFor="auth-email"
                    className="block text-xs font-medium text-slate-300"
                  >
                    Email Address
                  </label>
                  <div className="relative">
                    <Mail className="w-4 h-4 text-slate-500 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                    <input
                      id="auth-email"
                      type="email"
                      required
                      autoComplete="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="you@example.com"
                      className="w-full min-h-[46px] pl-10 pr-3.5 py-2.5 text-sm cm-glass-input rounded-xl text-white placeholder:text-slate-500 focus:outline-none"
                    />
                  </div>
                </div>

                {mode !== 'forgot_password' && (
                  <div className="space-y-1.5">
                    <label
                      htmlFor="auth-password"
                      className="block text-xs font-medium text-slate-300"
                    >
                      Password
                    </label>
                    <div className="relative">
                      <Lock className="w-4 h-4 text-slate-500 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                      <input
                        id="auth-password"
                        type={showPassword ? 'text' : 'password'}
                        required
                        minLength={6}
                        autoComplete={mode === 'signin' ? 'current-password' : 'new-password'}
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        placeholder="At least 6 characters"
                        className="w-full min-h-[46px] pl-10 pr-11 py-2.5 text-sm cm-glass-input rounded-xl text-white placeholder:text-slate-500 focus:outline-none"
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword((prev) => !prev)}
                        aria-label={showPassword ? 'Hide password' : 'Show password'}
                        className="absolute right-1 top-1/2 -translate-y-1/2 min-h-[40px] min-w-[40px] flex items-center justify-center text-slate-400 hover:text-white rounded-lg transition-colors"
                      >
                        {showPassword ? (
                          <EyeOff className="w-4 h-4" />
                        ) : (
                          <Eye className="w-4 h-4" />
                        )}
                      </button>
                    </div>
                    <div className="flex items-center justify-between gap-2 pt-0.5">
                      <p className="text-[11px] text-slate-500">
                        Secured by Supabase Auth.
                      </p>
                      {mode === 'signin' && (
                        <button
                          type="button"
                          onClick={() => handleModeSwitch('forgot_password')}
                          className="ml-auto text-xs font-semibold text-amber-400 hover:text-amber-300 transition-colors focus:outline-none focus-visible:underline whitespace-nowrap py-0.5"
                        >
                          Forgot password?
                        </button>
                      )}
                    </div>
                  </div>
                )}

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full min-h-[48px] py-3 px-4 rounded-xl bg-gradient-to-r from-amber-400 to-amber-500 hover:from-amber-300 hover:to-amber-400 disabled:opacity-50 text-slate-950 font-bold text-sm shadow-lg shadow-amber-500/20 transition-all flex items-center justify-center gap-2 whitespace-nowrap"
                >
                  {loading ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>
                        {mode === 'signin'
                          ? 'Signing In...'
                          : mode === 'signup'
                          ? 'Creating Account...'
                          : 'Sending Recovery Link...'}
                      </span>
                    </>
                  ) : (
                    <span>
                      {mode === 'signin'
                        ? 'Sign In to CineMax'
                        : mode === 'signup'
                        ? 'Create CineMax Account'
                        : 'Send Password Reset Link'}
                    </span>
                  )}
                </button>

                <div className="pt-1 text-center">
                  {mode === 'forgot_password' ? (
                    <button
                      type="button"
                      onClick={() => handleModeSwitch('signin')}
                      className="text-xs text-slate-400 hover:text-amber-300 transition-colors py-1"
                    >
                      Remembered your password?{' '}
                      <span className="font-semibold text-amber-400">
                        Return to Sign In
                      </span>
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={() =>
                        handleModeSwitch(mode === 'signin' ? 'signup' : 'signin')
                      }
                      className="text-xs text-slate-400 hover:text-amber-300 transition-colors py-1"
                    >
                      {mode === 'signin' ? (
                        <>
                          New to CineMax?{' '}
                          <span className="font-semibold text-amber-400">
                            Create an account
                          </span>
                        </>
                      ) : (
                        <>
                          Already have an account?{' '}
                          <span className="font-semibold text-amber-400">Sign in</span>
                        </>
                      )}
                    </button>
                  )}
                </div>
              </form>

              {/* Card Footer: RLS & Optional Schema Helper */}
              <div className="px-6 py-4 bg-black/40 border-t border-white/[0.06] space-y-3">
                <div className="flex items-center justify-between text-xs text-slate-400">
                  <span className="flex items-center gap-1.5">
                    <ShieldCheck className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                    <span>Protected by PostgreSQL Row Level Security</span>
                  </span>
                  <button
                    type="button"
                    onClick={() => setShowSqlHelper((prev) => !prev)}
                    className="text-amber-400 hover:text-amber-300 font-medium flex items-center gap-1 whitespace-nowrap shrink-0"
                  >
                    <Database className="w-3 h-3" />
                    <span>{showSqlHelper ? 'Hide SQL' : 'SQL Schema'}</span>
                  </button>
                </div>

                {showSqlHelper && (
                  <div className="space-y-2 pt-1">
                    <div className="flex items-center justify-between text-[11px] text-slate-400">
                      <span>Run in Supabase SQL Editor if setting up a new database:</span>
                      <button
                        type="button"
                        onClick={handleCopySql}
                        className="px-2 py-1 rounded bg-white/10 hover:bg-white/15 text-white font-medium flex items-center gap-1 whitespace-nowrap"
                      >
                        {copiedSql ? (
                          <>
                            <Check className="w-3 h-3 text-emerald-400" />
                            <span>Copied</span>
                          </>
                        ) : (
                          <>
                            <Copy className="w-3 h-3" />
                            <span>Copy SQL</span>
                          </>
                        )}
                      </button>
                    </div>
                    <pre className="max-h-36 overflow-y-auto p-2.5 rounded-lg bg-black/80 border border-white/10 text-[10px] font-mono text-slate-300 whitespace-pre">
                      {SUPABASE_SCHEMA_SQL}
                    </pre>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </main>

      {/* Minimal Footer */}
      <footer className="relative z-10 border-t border-white/[0.06] bg-[#07090E] py-5 px-4 sm:px-6 lg:px-8">
        <div className="max-w-6xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-slate-500">
          <div className="flex items-center gap-2">
            <span className="font-bold text-slate-300">CineMax</span>
            <span>·</span>
            <span>Cinema &amp; Television Discovery</span>
          </div>
          <div className="font-mono text-[11px] text-slate-600 tabular-nums">
            © {new Date().getFullYear()} CineMax. All rights reserved.
          </div>
        </div>
      </footer>
    </div>
  );
};
