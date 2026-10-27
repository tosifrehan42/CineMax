import React, { useState, useEffect } from 'react';
import {
  buildAndroidDeepLinkFromCurrentUrl,
  clearPasswordRecoveryFlowState,
  completePasswordReset,
  exchangeRecoveryUrlForSession,
  getPasswordRecoveryError,
  isCapacitorNativePlatform,
  validatePasswordPolicy,
} from '../services/supabaseClient';
import {
  Film,
  Lock,
  Eye,
  EyeOff,
  AlertCircle,
  CheckCircle2,
  Loader2,
  KeyRound,
  ArrowLeft,
  ArrowRight,
  ShieldCheck,
  Smartphone,
  RefreshCw,
} from 'lucide-react';

interface ResetPasswordScreenProps {
  incomingRecoveryUrl?: string | null;
  userEmail?: string | null;
  onResetComplete: (email?: string) => void;
  onRequestNewResetLink: (prefillEmail?: string) => void;
  onCancelToSignIn: () => void;
}

export const ResetPasswordScreen: React.FC<ResetPasswordScreenProps> = ({
  incomingRecoveryUrl,
  userEmail,
  onResetComplete,
  onRequestNewResetLink,
  onCancelToSignIn,
}) => {
  const [verifyingSession, setVerifyingSession] = useState(true);
  const [sessionValid, setSessionValid] = useState(false);
  const [resolvedEmail, setResolvedEmail] = useState<string | null>(
    userEmail || null
  );
  const [linkError, setLinkError] = useState<string | null>(() =>
    getPasswordRecoveryError()
  );

  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [resetSucceeded, setResetSucceeded] = useState(false);
  const [androidDeepLinkHref] = useState<string>(() =>
    buildAndroidDeepLinkFromCurrentUrl()
  );

  const isNativeCap = isCapacitorNativePlatform();
  const isAndroidWebBrowser =
    !isNativeCap &&
    typeof navigator !== 'undefined' &&
    /android/i.test(navigator.userAgent || '');

  useEffect(() => {
    let active = true;
    setVerifyingSession(true);

    exchangeRecoveryUrlForSession(incomingRecoveryUrl || undefined)
      .then(({ session, error }) => {
        if (!active) return;
        if (error || !session) {
          setSessionValid(false);
          setLinkError(
            error ||
              'This password reset link is invalid, has expired, or has already been used. Please request a new password reset link.'
          );
        } else {
          setSessionValid(true);
          setLinkError(null);
          if (session.user?.email) {
            setResolvedEmail(session.user.email);
          }
        }
      })
      .catch((err: any) => {
        if (!active) return;
        setSessionValid(false);
        setLinkError(
          err?.message ||
            'Unable to verify your password recovery session. Please request a new link.'
        );
      })
      .finally(() => {
        if (active) {
          setVerifyingSession(false);
        }
      });

    return () => {
      active = false;
    };
  }, [incomingRecoveryUrl]);

  const handleFinishToSignIn = () => {
    clearPasswordRecoveryFlowState();
    onResetComplete(resolvedEmail || userEmail || undefined);
  };

  useEffect(() => {
    if (!resetSucceeded) return;
    const timer = window.setTimeout(() => {
      clearPasswordRecoveryFlowState();
      onResetComplete(resolvedEmail || userEmail || undefined);
    }, 2600);
    return () => window.clearTimeout(timer);
  }, [resetSucceeded, resolvedEmail, userEmail, onResetComplete]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (submitting || resetSucceeded) return;
    setFormError(null);

    const policy = validatePasswordPolicy(newPassword, confirmPassword);
    if (!policy.valid) {
      setFormError(policy.error);
      return;
    }

    setSubmitting(true);
    try {
      const { error } = await completePasswordReset(
        newPassword,
        confirmPassword
      );
      if (error) {
        setFormError(error);
      } else {
        setNewPassword('');
        setConfirmPassword('');
        setResetSucceeded(true);
      }
    } catch (err: any) {
      setFormError(
        err?.message || 'Could not update your password. Please try again.'
      );
    } finally {
      setSubmitting(false);
    }
  };

  const handleExitToForgotPassword = () => {
    clearPasswordRecoveryFlowState();
    onRequestNewResetLink(resolvedEmail || userEmail || undefined);
  };

  const handleExitToSignIn = () => {
    clearPasswordRecoveryFlowState();
    onCancelToSignIn();
  };

  const minLengthMet = newPassword.length >= 6;
  const strongLengthMet = newPassword.length >= 8;
  const passwordsMatch =
    newPassword.length > 0 &&
    confirmPassword.length > 0 &&
    newPassword === confirmPassword;

  return (
    <div className="min-h-screen bg-[#0A0D12] text-slate-100 flex flex-col justify-between font-['Plus_Jakarta_Sans'] relative overflow-x-hidden">
      {/* Subtle Ambient Cinema Spotlight Background */}
      <div
        aria-hidden="true"
        className="pointer-events-none fixed inset-0 overflow-hidden z-0"
      >
        <div className="absolute -top-40 left-1/2 -translate-x-1/2 w-[760px] h-[420px] rounded-full bg-amber-500/[0.08] blur-[130px]" />
        <div className="absolute bottom-0 right-1/4 w-[500px] h-[320px] rounded-full bg-amber-600/[0.05] blur-[140px]" />
      </div>

      {/* Top Navigation Header (Inset Rounded Liquid Glass Panel) */}
      <header className="sticky top-0 z-30 w-full pt-2 sm:pt-2.5 px-3 sm:px-6 lg:px-8">
        <div className="max-w-[1440px] mx-auto cm-glass-nav rounded-[20px] md:rounded-[22px] px-4 sm:px-6 h-14 md:h-16 flex items-center justify-between gap-4">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-amber-400 to-amber-600 flex items-center justify-center text-slate-950 shadow-md shadow-amber-500/20">
              <Film className="w-4 h-4 stroke-[2.5]" />
            </div>
            <span className="font-['Plus_Jakarta_Sans'] text-xl font-extrabold tracking-tight text-white">
              Cine<span className="text-amber-400">Max</span>
            </span>
          </div>

          <button
            type="button"
            onClick={handleExitToSignIn}
            className="cm-glass-control min-h-[38px] px-3.5 py-2 rounded-xl text-xs font-semibold text-slate-200 hover:text-white flex items-center gap-1.5"
          >
            <ArrowLeft className="w-3.5 h-3.5 text-amber-400" />
            <span>Back to Sign In</span>
          </button>
        </div>
      </header>

      {/* Main Content */}
      <main className="relative z-10 flex-1 flex items-center justify-center py-10 px-4 sm:px-6">
        <div className="w-full max-w-md cm-glass-panel rounded-2xl overflow-hidden">
          {/* Card Header */}
          <div className="px-6 pt-6 pb-4 border-b border-white/[0.07] cm-glass-subbar">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-amber-500/15 border border-amber-500/30 flex items-center justify-center text-amber-400 shrink-0">
                <KeyRound className="w-5 h-5" />
              </div>
              <div>
                <h1 className="font-['Outfit'] text-xl font-bold text-white tracking-tight">
                  Set New Password
                </h1>
                <p className="text-xs text-slate-400 mt-0.5">
                  {resolvedEmail
                    ? `Updating password for ${resolvedEmail}`
                    : 'Complete your CineMax account recovery'}
                </p>
              </div>
            </div>
          </div>

          {/* Optional Android App Deep-Link Handoff when opened in Android mobile browser */}
          {isAndroidWebBrowser && !resetSucceeded && (
            <div className="mx-6 mt-4 p-3 rounded-xl cm-glass-surface flex items-center justify-between gap-3">
              <div className="flex items-center gap-2.5 min-w-0">
                <Smartphone className="w-4 h-4 text-amber-400 shrink-0" />
                <span className="text-xs text-slate-300 truncate">
                  Have the CineMax Android app installed?
                </span>
              </div>
              <a
                href={androidDeepLinkHref}
                className="px-2.5 py-1.5 rounded-lg bg-amber-500/20 hover:bg-amber-500/30 border border-amber-500/40 text-amber-300 text-xs font-semibold whitespace-nowrap shrink-0 transition-colors"
              >
                Open in App
              </a>
            </div>
          )}

          {/* Body States */}
          <div className="p-6">
            {verifyingSession ? (
              <div className="py-10 text-center space-y-3">
                <Loader2 className="w-7 h-7 text-amber-400 animate-spin mx-auto" />
                <div className="space-y-1">
                  <p className="text-sm font-semibold text-white">
                    Verifying your recovery link…
                  </p>
                  <p className="text-xs text-slate-400">
                    Securing your temporary password reset session with Supabase Auth.
                  </p>
                </div>
              </div>
            ) : resetSucceeded ? (
              <div
                role="status"
                className="py-4 space-y-5 text-center"
              >
                <div className="w-12 h-12 rounded-2xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 flex items-center justify-center mx-auto">
                  <CheckCircle2 className="w-6 h-6" />
                </div>
                <div className="space-y-2">
                  <h2 className="font-['Outfit'] text-lg font-bold text-white">
                    Password Updated Successfully
                  </h2>
                  <p className="text-xs text-slate-300 leading-relaxed">
                    Your new CineMax password has been saved. You can now use your new password to sign in on either the{' '}
                    <span className="text-white font-semibold">CineMax website</span> or the{' '}
                    <span className="text-white font-semibold">Android app</span>.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={handleFinishToSignIn}
                  className="w-full min-h-[46px] py-2.5 px-4 rounded-xl bg-gradient-to-r from-amber-400 to-amber-500 hover:from-amber-300 hover:to-amber-400 text-slate-950 font-bold text-xs shadow-lg shadow-amber-500/20 transition-all flex items-center justify-center gap-2"
                >
                  <span>Continue to Sign In</span>
                  <ArrowRight className="w-4 h-4" />
                </button>
              </div>
            ) : !sessionValid || linkError ? (
              <div className="space-y-5">
                <div
                  role="alert"
                  className="p-4 rounded-xl bg-red-500/10 border border-red-500/30 text-xs text-red-200 space-y-2"
                >
                  <div className="flex items-start gap-2.5">
                    <AlertCircle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
                    <div className="space-y-1">
                      <p className="font-semibold text-red-200">
                        Recovery Link Expired or Invalid
                      </p>
                      <p className="text-red-200/85 leading-relaxed">
                        {linkError ||
                          'This password reset link has expired, is invalid, or has already been used. For your security, recovery links are single-use.'}
                      </p>
                    </div>
                  </div>
                </div>

                <div className="space-y-2.5">
                  <button
                    type="button"
                    onClick={handleExitToForgotPassword}
                    className="w-full min-h-[46px] py-2.5 px-4 rounded-xl bg-gradient-to-r from-amber-400 to-amber-500 hover:from-amber-300 hover:to-amber-400 text-slate-950 font-bold text-xs shadow-lg shadow-amber-500/20 transition-all flex items-center justify-center gap-2"
                  >
                    <RefreshCw className="w-4 h-4" />
                    <span>Request New Reset Link</span>
                  </button>

                  <button
                    type="button"
                    onClick={handleExitToSignIn}
                    className="w-full min-h-[44px] py-2.5 px-4 rounded-xl cm-glass-control text-xs font-semibold text-slate-300 hover:text-white flex items-center justify-center gap-1.5"
                  >
                    <ArrowLeft className="w-3.5 h-3.5" />
                    <span>Return to Sign In</span>
                  </button>
                </div>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="space-y-4" noValidate>
                {formError && (
                  <div
                    role="alert"
                    className="p-3.5 rounded-xl bg-red-500/10 border border-red-500/30 text-xs text-red-200 flex items-start gap-2.5"
                  >
                    <AlertCircle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
                    <span className="leading-relaxed">{formError}</span>
                  </div>
                )}

                <div className="space-y-1.5">
                  <label
                    htmlFor="reset-new-password"
                    className="block text-xs font-medium text-slate-300"
                  >
                    New Password
                  </label>
                  <div className="relative">
                    <Lock className="w-4 h-4 text-slate-500 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                    <input
                      id="reset-new-password"
                      type={showNewPassword ? 'text' : 'password'}
                      required
                      minLength={6}
                      maxLength={72}
                      autoComplete="new-password"
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      placeholder="At least 6 characters"
                      className="w-full min-h-[46px] pl-10 pr-11 py-2.5 text-sm cm-glass-input rounded-xl text-white placeholder:text-slate-500 focus:outline-none"
                    />
                    <button
                      type="button"
                      onClick={() => setShowNewPassword((prev) => !prev)}
                      aria-label={
                        showNewPassword ? 'Hide new password' : 'Show new password'
                      }
                      className="absolute right-1 top-1/2 -translate-y-1/2 min-h-[40px] min-w-[40px] flex items-center justify-center text-slate-400 hover:text-white rounded-lg transition-colors"
                    >
                      {showNewPassword ? (
                        <EyeOff className="w-4 h-4" />
                      ) : (
                        <Eye className="w-4 h-4" />
                      )}
                    </button>
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label
                    htmlFor="reset-confirm-password"
                    className="block text-xs font-medium text-slate-300"
                  >
                    Confirm New Password
                  </label>
                  <div className="relative">
                    <Lock className="w-4 h-4 text-slate-500 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                    <input
                      id="reset-confirm-password"
                      type={showConfirmPassword ? 'text' : 'password'}
                      required
                      minLength={6}
                      maxLength={72}
                      autoComplete="new-password"
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      placeholder="Re-enter new password"
                      className="w-full min-h-[46px] pl-10 pr-11 py-2.5 text-sm cm-glass-input rounded-xl text-white placeholder:text-slate-500 focus:outline-none"
                    />
                    <button
                      type="button"
                      onClick={() => setShowConfirmPassword((prev) => !prev)}
                      aria-label={
                        showConfirmPassword
                          ? 'Hide confirmation password'
                          : 'Show confirmation password'
                      }
                      className="absolute right-1 top-1/2 -translate-y-1/2 min-h-[40px] min-w-[40px] flex items-center justify-center text-slate-400 hover:text-white rounded-lg transition-colors"
                    >
                      {showConfirmPassword ? (
                        <EyeOff className="w-4 h-4" />
                      ) : (
                        <Eye className="w-4 h-4" />
                      )}
                    </button>
                  </div>
                </div>

                {/* Live Password Policy Checklist */}
                <div className="p-3 rounded-xl cm-glass-surface space-y-1.5 text-[11px]">
                  <div className="font-semibold text-slate-300">
                    Password Requirements
                  </div>
                  <div className="flex items-center justify-between text-slate-400">
                    <span>Minimum 6 characters (8+ recommended)</span>
                    <span
                      className={
                        minLengthMet
                          ? 'text-emerald-400 font-semibold'
                          : 'text-slate-500'
                      }
                    >
                      {strongLengthMet
                        ? 'Strong length ✓'
                        : minLengthMet
                        ? 'Minimum met ✓'
                        : `${newPassword.length}/6`}
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-slate-400">
                    <span>Confirmation matches new password</span>
                    <span
                      className={
                        passwordsMatch
                          ? 'text-emerald-400 font-semibold'
                          : 'text-slate-500'
                      }
                    >
                      {passwordsMatch ? 'Matched ✓' : 'Pending'}
                    </span>
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={submitting}
                  className="w-full min-h-[48px] py-3 px-4 rounded-xl bg-gradient-to-r from-amber-400 to-amber-500 hover:from-amber-300 hover:to-amber-400 disabled:opacity-50 text-slate-950 font-bold text-sm shadow-lg shadow-amber-500/20 transition-all flex items-center justify-center gap-2"
                >
                  {submitting ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>Updating Password…</span>
                    </>
                  ) : (
                    <span>Save New Password</span>
                  )}
                </button>
              </form>
            )}
          </div>

          {/* Card Footer */}
          <div className="px-6 py-4 bg-black/40 border-t border-white/[0.06] flex items-center justify-between text-xs text-slate-400">
            <span className="flex items-center gap-1.5">
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
              <span>Encrypted via Supabase Auth</span>
            </span>
            <span className="font-mono text-[11px] text-slate-500">
              Single-Use Recovery
            </span>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="relative z-10 border-t border-white/[0.06] bg-[#07090E] py-5 px-4 sm:px-6 lg:px-8">
        <div className="max-w-5xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-slate-500">
          <div className="flex items-center gap-2">
            <span className="font-bold text-slate-300">CineMax</span>
            <span>·</span>
            <span>Account Security &amp; Recovery</span>
          </div>
          <div className="font-mono text-[11px] text-slate-600 tabular-nums">
            © {new Date().getFullYear()} CineMax. All rights reserved.
          </div>
        </div>
      </footer>
    </div>
  );
};
