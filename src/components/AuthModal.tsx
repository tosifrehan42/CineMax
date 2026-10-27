import React, { useState, useEffect } from 'react';
import {
  formatAuthErrorMessage,
  requestPasswordResetEmail,
  signInWithEmail,
  signUpWithEmail,
  SUPABASE_SCHEMA_SQL,
} from '../services/supabaseClient';
import { LiquidTabBubble, useLiquidTabBubble } from './LiquidTabBubble';
import {
  X,
  Film,
  Mail,
  Lock,
  User as UserIcon,
  AlertCircle,
  CheckCircle2,
  Loader2,
  Copy,
  Check,
  Database,
  ShieldCheck,
  Eye,
  EyeOff,
  ArrowLeft,
} from 'lucide-react';

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  supabaseConfigured: boolean;
  securityWarning?: string | null;
  initialMode?: 'signin' | 'signup' | 'forgot_password';
  onAuthSuccess?: () => void;
}

export const AuthModal: React.FC<AuthModalProps> = ({
  isOpen,
  onClose,
  supabaseConfigured,
  securityWarning,
  initialMode = 'signin',
  onAuthSuccess,
}) => {
  const [mode, setMode] = useState<'signin' | 'signup' | 'forgot_password'>(
    initialMode
  );
  const modeBubble = useLiquidTabBubble<'signin' | 'signup'>(
    isOpen && (mode === 'signin' || mode === 'signup') ? mode : null,
    [isOpen, mode]
  );
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [displayName, setDisplayName] = useState('');
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [showSqlHelper, setShowSqlHelper] = useState(false);
  const [copiedSql, setCopiedSql] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setMode(initialMode);
      setErrorMsg(null);
      setSuccessMsg(null);
    }
  }, [isOpen, initialMode]);

  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const handleCopySql = () => {
    navigator.clipboard?.writeText(SUPABASE_SCHEMA_SQL);
    setCopiedSql(true);
    setTimeout(() => setCopiedSql(false), 2500);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (loading) return;
    setErrorMsg(null);
    setSuccessMsg(null);

    if (!supabaseConfigured) {
      setErrorMsg(
        securityWarning ||
          'Supabase credentials are not configured yet. Add VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY in AI Studio Secrets.'
      );
      return;
    }

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
    }

    setLoading(true);
    try {
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
          setMode('signin');
          setEmail(cleanEmail);
          setPassword('');
          setSuccessMsg(
            `Account created for ${cleanEmail}! Please check your email inbox to confirm your address, then sign in below.`
          );
        } else if (session) {
          setPassword('');
          onAuthSuccess?.();
          onClose();
        }
      } else {
        const { session, error } = await signInWithEmail(cleanEmail, password);
        if (error) {
          setErrorMsg(error);
        } else if (session) {
          setPassword('');
          onAuthSuccess?.();
          onClose();
        }
      }
    } catch (err: any) {
      setErrorMsg(formatAuthErrorMessage(err?.message));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto cm-glass-backdrop flex items-center justify-center p-4 animate-in fade-in duration-200">
      <div className="fixed inset-0" onClick={onClose} />

      <div className="relative z-10 w-full max-w-md cm-glass-panel rounded-2xl overflow-hidden my-auto">
        {/* Top Header */}
        <div className="px-6 pt-6 pb-4 border-b border-white/[0.07] cm-glass-subbar flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-amber-400 to-amber-600 flex items-center justify-center text-black shadow-md shadow-amber-500/20">
              <Film className="w-4 h-4 stroke-[2.5]" />
            </div>
            <div>
              <h2 className="font-['Outfit'] text-lg font-bold text-white tracking-tight">
                {mode === 'signin'
                  ? 'Sign In to CineMax'
                  : mode === 'signup'
                  ? 'Create Cinephile Account'
                  : 'Reset Your Password'}
              </h2>
              <p className="text-xs text-slate-400">
                {mode === 'forgot_password'
                  ? 'Receive a secure password recovery link via email'
                  : 'Cloud-synced watchlist, favourites & viewing journal'}
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            aria-label="Close authentication modal"
            className="p-2 rounded-lg text-slate-400 hover:text-white cm-glass-control"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Mode Switcher Tabs */}
        {mode !== 'forgot_password' ? (
          <div className="px-6 pt-4">
            <div
              ref={modeBubble.containerRef}
              className="relative grid grid-cols-2 gap-1 p-1 cm-glass-segmented rounded-xl overflow-hidden"
            >
              <LiquidTabBubble
                controller={modeBubble}
                variant="amber"
                className="top-1 bottom-1 rounded-lg"
              />
              <button
                ref={modeBubble.registerTab('signin')}
                type="button"
                onClick={() => {
                  setMode('signin');
                  setErrorMsg(null);
                  setSuccessMsg(null);
                }}
                className={`relative z-10 py-2 text-xs font-semibold rounded-lg transition-colors ${
                  mode === 'signin'
                    ? modeBubble.ready
                      ? 'text-slate-950 font-bold'
                      : 'bg-amber-500 text-slate-950 font-bold'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                Sign In
              </button>
              <button
                ref={modeBubble.registerTab('signup')}
                type="button"
                onClick={() => {
                  setMode('signup');
                  setErrorMsg(null);
                  setSuccessMsg(null);
                }}
                className={`relative z-10 py-2 text-xs font-semibold rounded-lg transition-colors ${
                  mode === 'signup'
                    ? modeBubble.ready
                      ? 'text-slate-950 font-bold'
                      : 'bg-amber-500 text-slate-950 font-bold'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                Create Account
              </button>
            </div>
          </div>
        ) : (
          <div className="px-6 pt-4">
            <button
              type="button"
              onClick={() => {
                setMode('signin');
                setErrorMsg(null);
                setSuccessMsg(null);
              }}
              className="inline-flex items-center gap-1.5 text-xs font-semibold text-amber-400 hover:text-amber-300 transition-colors py-1"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>Back to Sign In</span>
            </button>
          </div>
        )}

        {/* Configuration Notice if Supabase Env Vars Are Missing */}
        {!supabaseConfigured && (
          <div className="mx-6 mt-4 p-3.5 rounded-xl bg-amber-500/10 border border-amber-500/30 text-xs text-amber-200 space-y-2">
            <div className="flex items-start gap-2">
              <AlertCircle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
              <div className="space-y-1">
                <p className="font-semibold text-amber-300">
                  {securityWarning ? 'Security Warning' : 'Supabase Connection Not Configured'}
                </p>
                <p className="text-amber-200/80 leading-relaxed">
                  {securityWarning ||
                    'To enable live cloud authentication and PostgreSQL persistence, add VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY in AI Studio Secrets.'}
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4" noValidate>
          {errorMsg && (
            <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/30 text-xs text-red-300 flex items-start gap-2">
              <AlertCircle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
              <span>{errorMsg}</span>
            </div>
          )}

          {successMsg && (
            <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-xs text-emerald-300 flex items-start gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
              <span>{successMsg}</span>
            </div>
          )}

          {mode === 'signup' && (
            <div className="space-y-1.5">
              <label className="block text-xs font-medium text-slate-300">
                Display Name
              </label>
              <div className="relative">
                <UserIcon className="w-4 h-4 text-slate-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  placeholder="Alex Rivera"
                  maxLength={80}
                  className="w-full pl-10 pr-3.5 py-2.5 text-sm cm-glass-input rounded-xl text-white placeholder:text-slate-500 focus:outline-none"
                />
              </div>
            </div>
          )}

          <div className="space-y-1.5">
            <label className="block text-xs font-medium text-slate-300">
              Email Address
            </label>
            <div className="relative">
              <Mail className="w-4 h-4 text-slate-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="email"
                required
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                className="w-full pl-10 pr-3.5 py-2.5 text-sm cm-glass-input rounded-xl text-white placeholder:text-slate-500 focus:outline-none"
              />
            </div>
          </div>

          {mode !== 'forgot_password' && (
            <div className="space-y-1.5">
              <label className="block text-xs font-medium text-slate-300">
                Password
              </label>
              <div className="relative">
                <Lock className="w-4 h-4 text-slate-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type={showPassword ? 'text' : 'password'}
                  required
                  minLength={6}
                  autoComplete={mode === 'signin' ? 'current-password' : 'new-password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full pl-10 pr-11 py-2.5 text-sm cm-glass-input rounded-xl text-white placeholder:text-slate-500 focus:outline-none"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((prev) => !prev)}
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                  className="absolute right-1 top-1/2 -translate-y-1/2 min-h-[38px] min-w-[38px] flex items-center justify-center text-slate-400 hover:text-white rounded-lg transition-colors"
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
                  Managed securely by Supabase Auth.
                </p>
                {mode === 'signin' && (
                  <button
                    type="button"
                    onClick={() => {
                      setMode('forgot_password');
                      setErrorMsg(null);
                      setSuccessMsg(null);
                    }}
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
            className="w-full py-2.5 px-4 rounded-xl bg-gradient-to-r from-amber-400 to-amber-500 hover:from-amber-300 hover:to-amber-400 disabled:opacity-50 text-slate-950 font-bold text-sm shadow-md shadow-amber-500/20 transition-all flex items-center justify-center gap-2"
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
                  ? 'Sign In'
                  : mode === 'signup'
                  ? 'Create Account'
                  : 'Send Password Reset Link'}
              </span>
            )}
          </button>
        </form>

        {/* Footer with SQL Schema & RLS Helper */}
        <div className="px-6 py-4 bg-black/40 border-t border-white/5 space-y-3">
          <div className="flex items-center justify-between text-xs text-slate-400">
            <span className="flex items-center gap-1.5">
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
              <span>Protected by PostgreSQL Row Level Security</span>
            </span>
            <button
              type="button"
              onClick={() => setShowSqlHelper((prev) => !prev)}
              className="text-amber-400 hover:text-amber-300 font-medium flex items-center gap-1"
            >
              <Database className="w-3 h-3" />
              <span>{showSqlHelper ? 'Hide SQL' : 'SQL Schema'}</span>
            </button>
          </div>

          {showSqlHelper && (
            <div className="space-y-2 pt-1">
              <div className="flex items-center justify-between text-[11px] text-slate-400">
                <span>Run in Supabase SQL Editor (also saved at supabase/schema.sql):</span>
                <button
                  type="button"
                  onClick={handleCopySql}
                  className="px-2 py-1 rounded bg-white/10 hover:bg-white/15 text-white font-medium flex items-center gap-1"
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
  );
};
