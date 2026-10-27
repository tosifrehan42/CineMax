import React, { useState, useEffect } from 'react';
import {
  changeSignedInUserPassword,
  validatePasswordPolicy,
} from '../services/supabaseClient';
import {
  X,
  Lock,
  KeyRound,
  Eye,
  EyeOff,
  AlertCircle,
  CheckCircle2,
  Loader2,
  ShieldCheck,
} from 'lucide-react';

interface ChangePasswordModalProps {
  isOpen: boolean;
  onClose: () => void;
  userEmail?: string | null;
}

export const ChangePasswordModal: React.FC<ChangePasswordModalProps> = ({
  isOpen,
  onClose,
  userEmail,
}) => {
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      setShowCurrentPassword(false);
      setShowNewPassword(false);
      setShowConfirmPassword(false);
      setErrorMsg(null);
      setSuccessMsg(null);
    }
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !submitting) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, submitting, onClose]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (submitting) return;
    setErrorMsg(null);
    setSuccessMsg(null);

    if (!currentPassword) {
      setErrorMsg('Please enter your current password.');
      return;
    }

    const policy = validatePasswordPolicy(newPassword, confirmPassword);
    if (!policy.valid) {
      setErrorMsg(policy.error);
      return;
    }

    if (currentPassword === newPassword) {
      setErrorMsg(
        'Your new password must be different from your current password.'
      );
      return;
    }

    if (!userEmail) {
      setErrorMsg(
        'Unable to verify your account email address. Please sign out and sign in again.'
      );
      return;
    }

    setSubmitting(true);
    try {
      const { error } = await changeSignedInUserPassword(
        userEmail,
        currentPassword,
        newPassword,
        confirmPassword
      );
      if (error) {
        setErrorMsg(error);
      } else {
        setCurrentPassword('');
        setNewPassword('');
        setConfirmPassword('');
        setSuccessMsg(
          'Your password has been updated securely. Your active session remains signed in.'
        );
      }
    } catch (err: any) {
      setErrorMsg(
        err?.message || 'Failed to update password. Please try again.'
      );
    } finally {
      setSubmitting(false);
    }
  };

  const minLengthMet = newPassword.length >= 6;
  const strongLengthMet = newPassword.length >= 8;
  const passwordsMatch =
    newPassword.length > 0 &&
    confirmPassword.length > 0 &&
    newPassword === confirmPassword;

  return (
    <div className="cm-glass-backdrop fixed inset-0 z-50 overflow-y-auto flex items-center justify-center p-4 animate-in fade-in duration-200">
      <div
        className="fixed inset-0"
        onClick={() => {
          if (!submitting) onClose();
        }}
      />

      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="change-password-modal-title"
        className="cm-glass-panel relative z-10 w-full max-w-md rounded-2xl overflow-hidden my-auto"
      >
        {/* Header */}
        <div className="cm-glass-subbar px-6 py-4 flex items-center justify-between border-b border-white/[0.07]">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-amber-500/15 border border-amber-500/30 flex items-center justify-center text-amber-400">
              <KeyRound className="w-4 h-4" />
            </div>
            <div>
              <h3
                id="change-password-modal-title"
                className="font-['Outfit'] text-base sm:text-lg font-bold text-white"
              >
                Change Account Password
              </h3>
              {userEmail && (
                <p className="text-[11px] text-slate-400 truncate max-w-[240px]">
                  {userEmail}
                </p>
              )}
            </div>
          </div>

          <button
            type="button"
            disabled={submitting}
            onClick={onClose}
            aria-label="Close change password modal"
            className="cm-glass-control p-2 text-slate-400 hover:text-white rounded-lg disabled:opacity-50"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

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

          {/* Current Password */}
          <div className="space-y-1.5">
            <label
              htmlFor="change-current-password"
              className="block text-xs font-medium text-slate-300"
            >
              Current Password
            </label>
            <div className="relative">
              <Lock className="w-4 h-4 text-slate-500 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                id="change-current-password"
                type={showCurrentPassword ? 'text' : 'password'}
                required
                autoComplete="current-password"
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                placeholder="Enter current password"
                className="cm-glass-input w-full min-h-[44px] pl-10 pr-11 py-2 text-sm rounded-xl text-white placeholder:text-slate-500 focus:outline-none"
              />
              <button
                type="button"
                onClick={() => setShowCurrentPassword((prev) => !prev)}
                aria-label={
                  showCurrentPassword
                    ? 'Hide current password'
                    : 'Show current password'
                }
                className="absolute right-1 top-1/2 -translate-y-1/2 min-h-[38px] min-w-[38px] flex items-center justify-center text-slate-400 hover:text-white rounded-lg transition-colors"
              >
                {showCurrentPassword ? (
                  <EyeOff className="w-4 h-4" />
                ) : (
                  <Eye className="w-4 h-4" />
                )}
              </button>
            </div>
          </div>

          {/* New Password */}
          <div className="space-y-1.5">
            <label
              htmlFor="change-new-password"
              className="block text-xs font-medium text-slate-300"
            >
              New Password
            </label>
            <div className="relative">
              <Lock className="w-4 h-4 text-slate-500 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                id="change-new-password"
                type={showNewPassword ? 'text' : 'password'}
                required
                minLength={6}
                maxLength={72}
                autoComplete="new-password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="At least 6 characters"
                className="cm-glass-input w-full min-h-[44px] pl-10 pr-11 py-2 text-sm rounded-xl text-white placeholder:text-slate-500 focus:outline-none"
              />
              <button
                type="button"
                onClick={() => setShowNewPassword((prev) => !prev)}
                aria-label={
                  showNewPassword ? 'Hide new password' : 'Show new password'
                }
                className="absolute right-1 top-1/2 -translate-y-1/2 min-h-[38px] min-w-[38px] flex items-center justify-center text-slate-400 hover:text-white rounded-lg transition-colors"
              >
                {showNewPassword ? (
                  <EyeOff className="w-4 h-4" />
                ) : (
                  <Eye className="w-4 h-4" />
                )}
              </button>
            </div>
          </div>

          {/* Confirm New Password */}
          <div className="space-y-1.5">
            <label
              htmlFor="change-confirm-password"
              className="block text-xs font-medium text-slate-300"
            >
              Confirm New Password
            </label>
            <div className="relative">
              <Lock className="w-4 h-4 text-slate-500 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                id="change-confirm-password"
                type={showConfirmPassword ? 'text' : 'password'}
                required
                minLength={6}
                maxLength={72}
                autoComplete="new-password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Re-enter new password"
                className="cm-glass-input w-full min-h-[44px] pl-10 pr-11 py-2 text-sm rounded-xl text-white placeholder:text-slate-500 focus:outline-none"
              />
              <button
                type="button"
                onClick={() => setShowConfirmPassword((prev) => !prev)}
                aria-label={
                  showConfirmPassword
                    ? 'Hide confirmation password'
                    : 'Show confirmation password'
                }
                className="absolute right-1 top-1/2 -translate-y-1/2 min-h-[38px] min-w-[38px] flex items-center justify-center text-slate-400 hover:text-white rounded-lg transition-colors"
              >
                {showConfirmPassword ? (
                  <EyeOff className="w-4 h-4" />
                ) : (
                  <Eye className="w-4 h-4" />
                )}
              </button>
            </div>
          </div>

          {/* Password Policy Indicators */}
          <div className="cm-glass-surface p-3 rounded-xl space-y-1 text-[11px]">
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
                  ? 'Strong ✓'
                  : minLengthMet
                  ? 'Met ✓'
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

          <div className="pt-2 flex items-center justify-end gap-2.5">
            <button
              type="button"
              disabled={submitting}
              onClick={onClose}
              className="cm-glass-control min-h-[42px] px-4 py-2 rounded-xl text-xs font-semibold text-slate-300 hover:text-white disabled:opacity-50"
            >
              {successMsg ? 'Close' : 'Cancel'}
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="min-h-[42px] px-5 py-2 rounded-xl bg-gradient-to-r from-amber-400 to-amber-500 hover:from-amber-300 hover:to-amber-400 disabled:opacity-50 text-slate-950 font-bold text-xs shadow-md shadow-amber-500/20 flex items-center gap-1.5"
            >
              {submitting ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  <span>Updating…</span>
                </>
              ) : (
                <span>Update Password</span>
              )}
            </button>
          </div>
        </form>

        {/* Footer */}
        <div className="px-6 py-3.5 bg-black/40 border-t border-white/[0.06] flex items-center justify-between text-[11px] text-slate-400">
          <span className="flex items-center gap-1.5">
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
            <span>Current password verified via Supabase Auth</span>
          </span>
        </div>
      </div>
    </div>
  );
};
