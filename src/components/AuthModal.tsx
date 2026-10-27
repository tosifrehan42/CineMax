import React, { useState, useEffect } from 'react';
import {
  signInWithEmail,
  signUpWithEmail,
  SUPABASE_SCHEMA_SQL,
} from '../services/supabaseClient';
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
} from 'lucide-react';

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  supabaseConfigured: boolean;
  securityWarning?: string | null;
  initialMode?: 'signin' | 'signup';
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
  const [mode, setMode] = useState<'signin' | 'signup'>(initialMode);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
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
    if (!cleanEmail || !password) {
      setErrorMsg('Please enter both your email address and password.');
      return;
    }

    if (password.length < 6) {
      setErrorMsg('Password must be at least 6 characters long.');
      return;
    }

    setLoading(true);
    try {
      if (mode === 'signup') {
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
      setErrorMsg(err?.message || 'Authentication failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto cm-glass-backdrop flex items-center justify-center p-4 animate-in fade-in duration-200">
      <div className="fixed inset-0" onClick={onClose} />

      <div className="relative z-10 w-full max-w-md cm-glass-panel rounded-2xl overflow-hidden my-auto">
        {/* Top Header */}
        <div className="px-6 pt-6 pb-4 border-b border-white/[0.07] flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-amber-400 to-amber-600 flex items-center justify-center text-black shadow-md shadow-amber-500/20">
              <Film className="w-4 h-4 stroke-[2.5]" />
            </div>
            <div>
              <h2 className="font-['Outfit'] text-lg font-bold text-white tracking-tight">
                {mode === 'signin' ? 'Sign In to CineMax' : 'Create Cinephile Account'}
              </h2>
              <p className="text-xs text-slate-400">
                Cloud-synced watchlist, favourites & viewing journal
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
        <div className="px-6 pt-4">
          <div className="grid grid-cols-2 gap-1 p-1 cm-glass-segmented rounded-xl">
            <button
              type="button"
              onClick={() => {
                setMode('signin');
                setErrorMsg(null);
                setSuccessMsg(null);
              }}
              className={`py-2 text-xs font-semibold rounded-lg transition-colors ${
                mode === 'signin'
                  ? 'bg-amber-500 text-slate-950'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              Sign In
            </button>
            <button
              type="button"
              onClick={() => {
                setMode('signup');
                setErrorMsg(null);
                setSuccessMsg(null);
              }}
              className={`py-2 text-xs font-semibold rounded-lg transition-colors ${
                mode === 'signup'
                  ? 'bg-amber-500 text-slate-950'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              Create Account
            </button>
          </div>
        </div>

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
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
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

          <div className="space-y-1.5">
            <label className="block text-xs font-medium text-slate-300">
              Password
            </label>
            <div className="relative">
              <Lock className="w-4 h-4 text-slate-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="password"
                required
                minLength={6}
                autoComplete={mode === 'signin' ? 'current-password' : 'new-password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full pl-10 pr-3.5 py-2.5 text-sm cm-glass-input rounded-xl text-white placeholder:text-slate-500 focus:outline-none"
              />
            </div>
            <p className="text-[11px] text-slate-500">
              Managed securely by Supabase Auth. CineMax never stores raw passwords.
            </p>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full py-2.5 px-4 rounded-xl bg-gradient-to-r from-amber-400 to-amber-500 hover:from-amber-300 hover:to-amber-400 disabled:opacity-50 text-slate-950 font-bold text-sm shadow-md shadow-amber-500/20 transition-all flex items-center justify-center gap-2"
          >
            {loading ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>{mode === 'signin' ? 'Signing In...' : 'Creating Account...'}</span>
              </>
            ) : (
              <span>{mode === 'signin' ? 'Sign In' : 'Create Account'}</span>
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
