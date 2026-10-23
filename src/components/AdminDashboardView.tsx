import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  AdminAccessState,
  adminConfirmUserEmail,
  adminDeleteUser,
  AdminListUsersResponse,
  adminRestoreUser,
  adminSendPasswordReset,
  adminSuspendUser,
  AdminUserDetailResponse,
  fetchAdminUserDetail,
  fetchAdminUsersList,
  SanitizedAdminUserSummary,
  SUPABASE_ADMIN_AUDIT_SQL,
} from '../services/adminApi';
import {
  ShieldAlert,
  ShieldCheck,
  Users,
  UserCheck,
  UserX,
  UserPlus,
  Search,
  RefreshCw,
  ChevronLeft,
  ChevronRight,
  MailCheck,
  KeyRound,
  Ban,
  Unlock,
  Trash2,
  AlertTriangle,
  Check,
  Copy,
  X,
  Loader2,
  Terminal,
  Database,
  Clock,
  Lock,
  Activity,
  Bookmark,
  Heart,
  BookOpen,
  Tv,
  LogIn,
  ArrowLeft,
} from 'lucide-react';

interface AdminDashboardViewProps {
  isAuthenticated: boolean;
  isAuthInitializing?: boolean;
  adminAccessState?: AdminAccessState;
  adminCheckError?: string | null;
  currentUserId?: string | null;
  currentUserEmail?: string | null;
  onOpenAuthModal?: (mode?: 'signin' | 'signup') => void;
  onExitAdmin?: () => void;
  onRetryAdminAccess?: () => Promise<void> | void;
  onAdminVerified?: (adminUserId: string) => void;
  onAdminExplicitlyDenied?: () => void;
}

type StatusFilter = 'all' | 'confirmed' | 'unconfirmed' | 'suspended';
type SuspendDuration = '24h' | '7d' | '30d' | 'indefinite';

export const AdminDashboardView: React.FC<AdminDashboardViewProps> = ({
  isAuthenticated,
  isAuthInitializing = false,
  adminAccessState = 'loading',
  adminCheckError = null,
  currentUserId,
  currentUserEmail,
  onOpenAuthModal,
  onExitAdmin,
  onRetryAdminAccess,
  onAdminVerified,
  onAdminExplicitlyDenied,
}) => {
  // List & Pagination State
  const [listData, setListData] = useState<AdminListUsersResponse | null>(null);
  const [isLoadingList, setIsLoadingList] = useState<boolean>(false);
  const [listError, setListError] = useState<string | null>(null);
  const [httpStatus, setHttpStatus] = useState<number>(200);
  const [edgeDeploymentNeeded, setEdgeDeploymentNeeded] = useState<boolean>(false);
  const [isExplicitDenial, setIsExplicitDenial] = useState<boolean>(false);
  const [isTransientError, setIsTransientError] = useState<boolean>(false);
  const [retryAttemptsCount, setRetryAttemptsCount] = useState<number>(0);

  const [page, setPage] = useState<number>(1);
  const [perPage] = useState<number>(12);
  const [searchInput, setSearchInput] = useState<string>('');
  const [debouncedSearch, setDebouncedSearch] = useState<string>('');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');

  // Selected User Detail Panel State
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
  const [userDetail, setUserDetail] = useState<AdminUserDetailResponse | null>(null);
  const [isLoadingDetail, setIsLoadingDetail] = useState<boolean>(false);
  const [detailError, setDetailError] = useState<string | null>(null);

  // Action Execution & Feedback State
  const [actionInFlight, setActionInFlight] = useState<string | null>(null);
  const [actionBanner, setActionBanner] = useState<{
    type: 'success' | 'error';
    message: string;
  } | null>(null);

  // Confirmation Modals (Suspend & Delete)
  const [suspendModalUser, setSuspendModalUser] =
    useState<SanitizedAdminUserSummary | null>(null);
  const [selectedSuspendDuration, setSelectedSuspendDuration] =
    useState<SuspendDuration>('24h');
  const [deleteModalUser, setDeleteModalUser] =
    useState<SanitizedAdminUserSummary | null>(null);
  const [deleteConfirmInput, setDeleteConfirmInput] = useState<string>('');

  // Setup Guide Drawer & Clipboard State
  const [showSetupGuide, setShowSetupGuide] = useState<boolean>(false);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  const lastUserIdRef = useRef<string | null | undefined>(currentUserId);
  const onAdminVerifiedRef = useRef(onAdminVerified);
  onAdminVerifiedRef.current = onAdminVerified;
  const onAdminExplicitlyDeniedRef = useRef(onAdminExplicitlyDenied);
  onAdminExplicitlyDeniedRef.current = onAdminExplicitlyDenied;

  // Clear stale listData immediately if the authenticated user changes or signs out
  useEffect(() => {
    if (lastUserIdRef.current !== currentUserId) {
      lastUserIdRef.current = currentUserId;
      setListData(null);
      setSelectedUserId(null);
      setUserDetail(null);
      setListError(null);
      setIsExplicitDenial(false);
      setIsTransientError(false);
    }
  }, [currentUserId]);

  // Debounce search input
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(searchInput.trim());
      setPage(1);
    }, 260);
    return () => clearTimeout(timer);
  }, [searchInput]);

  const loadUsers = useCallback(async () => {
    // Wait until initial Supabase session restoration completes before deciding auth status
    if (isAuthInitializing) {
      return;
    }

    if (!isAuthenticated || !currentUserId) {
      setListData(null);
      setHttpStatus(401);
      setIsExplicitDenial(false);
      setIsTransientError(false);
      setListError('Authentication required. Sign in with your administrator account.');
      return;
    }

    setIsLoadingList(true);
    setListError(null);

    const res = await fetchAdminUsersList({
      page,
      perPage,
      searchQuery: debouncedSearch,
      statusFilter,
    });

    setIsLoadingList(false);
    setHttpStatus(res.status);
    setEdgeDeploymentNeeded(Boolean(res.edgeDeploymentNeeded));
    setIsExplicitDenial(Boolean(res.isExplicitDenial));
    setIsTransientError(Boolean(res.isTransientError));
    setRetryAttemptsCount(res.retryAttempts || 0);

    if (res.error || !res.data) {
      // Only wipe out existing listData if the server returned 401 or an explicit 403 denial
      if (res.status === 401 || res.isExplicitDenial) {
        setListData(null);
      }
      if (res.isExplicitDenial) {
        onAdminExplicitlyDeniedRef.current?.();
      }
      setListError(res.error || 'Failed to load administrator user list.');
      return;
    }

    setListData(res.data);
    onAdminVerifiedRef.current?.(res.data.adminUserId || currentUserId);
  }, [
    isAuthInitializing,
    isAuthenticated,
    currentUserId,
    page,
    perPage,
    debouncedSearch,
    statusFilter,
  ]);

  useEffect(() => {
    if (!isAuthInitializing) {
      loadUsers();
    }
  }, [isAuthInitializing, loadUsers]);

  const handleManualRetry = async () => {
    await onRetryAdminAccess?.();
    await loadUsers();
  };

  const loadSelectedUserDetail = useCallback(async (targetId: string) => {
    setIsLoadingDetail(true);
    setDetailError(null);
    const res = await fetchAdminUserDetail(targetId);
    setIsLoadingDetail(false);

    if (res.error || !res.data) {
      setDetailError(res.error || 'Could not load user detail.');
      return;
    }
    setUserDetail(res.data);
  }, []);

  useEffect(() => {
    if (selectedUserId && httpStatus === 200) {
      loadSelectedUserDetail(selectedUserId);
    } else {
      setUserDetail(null);
    }
  }, [selectedUserId, httpStatus, loadSelectedUserDetail]);

  const handleCopyText = (key: string, text: string) => {
    navigator.clipboard?.writeText(text);
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(null), 2200);
  };

  // Account Management Handlers
  const handleConfirmEmail = async (targetUser: SanitizedAdminUserSummary) => {
    if (actionInFlight) return;
    setActionInFlight(`confirm-${targetUser.id}`);
    setActionBanner(null);

    const res = await adminConfirmUserEmail(targetUser.id);
    setActionInFlight(null);

    if (res.error || !res.data?.success) {
      setActionBanner({
        type: 'error',
        message: res.error || 'Failed to confirm user email.',
      });
      return;
    }

    setActionBanner({
      type: 'success',
      message: res.data.message,
    });
    await loadUsers();
    if (selectedUserId === targetUser.id) {
      await loadSelectedUserDetail(targetUser.id);
    }
  };

  const handleSendPasswordReset = async (targetUser: SanitizedAdminUserSummary) => {
    if (actionInFlight) return;
    setActionInFlight(`reset-${targetUser.id}`);
    setActionBanner(null);

    const res = await adminSendPasswordReset(targetUser.id);
    setActionInFlight(null);

    if (res.error || !res.data?.success) {
      setActionBanner({
        type: 'error',
        message: res.error || 'Failed to send password reset email.',
      });
      return;
    }

    setActionBanner({
      type: 'success',
      message: res.data.message,
    });
    if (selectedUserId === targetUser.id) {
      await loadSelectedUserDetail(targetUser.id);
    }
  };

  const handleExecuteSuspend = async () => {
    if (!suspendModalUser || actionInFlight) return;
    const target = suspendModalUser;
    setActionInFlight(`suspend-${target.id}`);
    setActionBanner(null);

    const res = await adminSuspendUser(target.id, selectedSuspendDuration);
    setActionInFlight(null);

    if (res.error || !res.data?.success) {
      setActionBanner({
        type: 'error',
        message: res.error || 'Failed to suspend user account.',
      });
      return;
    }

    setSuspendModalUser(null);
    setActionBanner({
      type: 'success',
      message: res.data.message,
    });
    await loadUsers();
    if (selectedUserId === target.id) {
      await loadSelectedUserDetail(target.id);
    }
  };

  const handleRestoreUser = async (targetUser: SanitizedAdminUserSummary) => {
    if (actionInFlight) return;
    setActionInFlight(`restore-${targetUser.id}`);
    setActionBanner(null);

    const res = await adminRestoreUser(targetUser.id);
    setActionInFlight(null);

    if (res.error || !res.data?.success) {
      setActionBanner({
        type: 'error',
        message: res.error || 'Failed to restore user account.',
      });
      return;
    }

    setActionBanner({
      type: 'success',
      message: res.data.message,
    });
    await loadUsers();
    if (selectedUserId === targetUser.id) {
      await loadSelectedUserDetail(targetUser.id);
    }
  };

  const handleExecuteDelete = async () => {
    if (!deleteModalUser || actionInFlight) return;
    const target = deleteModalUser;
    setActionInFlight(`delete-${target.id}`);
    setActionBanner(null);

    const res = await adminDeleteUser(target.id);
    setActionInFlight(null);

    if (res.error || !res.data?.success) {
      setActionBanner({
        type: 'error',
        message: res.error || 'Failed to delete user account.',
      });
      return;
    }

    setDeleteModalUser(null);
    setDeleteConfirmInput('');
    if (selectedUserId === target.id) {
      setSelectedUserId(null);
      setUserDetail(null);
    }
    setActionBanner({
      type: 'success',
      message: res.data.message,
    });
    await loadUsers();
  };

  const formatDateTime = (iso: string | null | undefined) => {
    if (!iso) return 'Never';
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return '—';
    return d.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  const cliSecretsCmd = `supabase secrets set CINEMAX_ADMIN_USER_ID="${
    currentUserId || '<YOUR_SUPABASE_AUTH_USER_UUID>'
  }"\nsupabase functions deploy admin-users`;

  // ==========================================================================
  // STATE 0: INITIALIZING / RESTORING SUPABASE SESSION
  // ==========================================================================
  if (isAuthInitializing || (isAuthenticated && isLoadingList && !listData && !listError)) {
    return (
      <div className="pt-28 pb-20 max-w-3xl mx-auto px-4 sm:px-6">
        <div className="rounded-2xl bg-[#0d0e14] border border-white/10 p-8 text-center space-y-4 shadow-2xl">
          <div className="w-14 h-14 rounded-2xl bg-amber-500/15 border border-amber-500/30 flex items-center justify-center mx-auto text-amber-400">
            <Loader2 className="w-7 h-7 animate-spin" />
          </div>
          <div className="space-y-1.5">
            <span className="text-xs font-mono uppercase tracking-widest text-amber-400">
              {isAuthInitializing
                ? 'Restoring Session'
                : 'Verifying Administrator Access'}
            </span>
            <h1 className="font-['Outfit'] text-2xl sm:text-3xl font-extrabold text-white">
              {isAuthInitializing
                ? 'Restoring Your CineMax Session...'
                : 'Loading Administrator Console...'}
            </h1>
            <p className="text-xs sm:text-sm text-slate-400 max-w-md mx-auto leading-relaxed">
              Validating your authenticated session and allowlist permissions with the server.
            </p>
          </div>
        </div>
      </div>
    );
  }

  // ==========================================================================
  // STATE 1: UNAUTHENTICATED (401)
  // ==========================================================================
  if (!isAuthenticated) {
    return (
      <div className="pt-28 pb-20 max-w-3xl mx-auto px-4 sm:px-6">
        <div className="rounded-2xl bg-[#0d0e14] border border-amber-500/30 p-8 text-center space-y-5 shadow-2xl">
          <div className="w-14 h-14 rounded-2xl bg-amber-500/15 border border-amber-500/30 flex items-center justify-center mx-auto text-amber-400">
            <Lock className="w-7 h-7" />
          </div>
          <div className="space-y-2">
            <span className="text-xs font-mono uppercase tracking-widest text-amber-400">
              HTTP 401 · Authentication Required
            </span>
            <h1 className="font-['Outfit'] text-2xl sm:text-3xl font-extrabold text-white">
              CineMax Administrator Sign-In Required
            </h1>
            <p className="text-sm text-slate-400 max-w-lg mx-auto leading-relaxed">
              The <code className="text-slate-200 font-mono">/admin</code> console is restricted to the allowlisted administrator UUID configured in <code className="text-amber-300 font-mono">CINEMAX_ADMIN_USER_ID</code>. Please sign in to verify your session.
            </p>
          </div>
          <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
            <button
              type="button"
              onClick={() => onOpenAuthModal?.('signin')}
              className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-amber-400 to-amber-500 hover:from-amber-300 hover:to-amber-400 text-slate-950 font-bold text-xs flex items-center gap-2 shadow-lg shadow-amber-500/20"
            >
              <LogIn className="w-4 h-4" />
              <span>Sign In as Administrator</span>
            </button>
            {onExitAdmin && (
              <button
                type="button"
                onClick={onExitAdmin}
                className="px-4 py-2.5 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-xs font-semibold text-slate-300 flex items-center gap-1.5"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                <span>Return to CineMax</span>
              </button>
            )}
          </div>
        </div>
      </div>
    );
  }

  // ==========================================================================
  // STATE 2A: TRANSIENT NETWORK OR SERVER ERROR (WITH VISIBLE RETRY)
  // ==========================================================================
  if (
    !isLoadingList &&
    !listData &&
    !isExplicitDenial &&
    !edgeDeploymentNeeded &&
    (isTransientError || httpStatus >= 500 || httpStatus === 401 || Boolean(listError))
  ) {
    return (
      <div className="pt-28 pb-20 max-w-3xl mx-auto px-4 sm:px-6">
        <div className="rounded-2xl bg-[#0d0e14] border border-amber-500/35 p-6 sm:p-8 space-y-5 shadow-2xl">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-5 border-b border-white/10">
            <div className="flex items-start gap-4">
              <div className="p-3 rounded-2xl bg-amber-500/15 border border-amber-500/30 text-amber-400 shrink-0">
                <AlertTriangle className="w-7 h-7" />
              </div>
              <div>
                <span className="text-xs font-mono uppercase tracking-widest text-amber-400">
                  Temporary Connection Issue · HTTP {httpStatus || 502}
                  {retryAttemptsCount > 0
                    ? ` · Retried ${retryAttemptsCount}x`
                    : ''}
                </span>
                <h1 className="font-['Outfit'] text-2xl sm:text-3xl font-extrabold text-white mt-0.5">
                  Could Not Reach Admin Service
                </h1>
                <p className="text-xs sm:text-sm text-slate-300 mt-1 leading-relaxed">
                  {listError ||
                    adminCheckError ||
                    'A temporary network or Edge Function timeout occurred while verifying your session.'}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              <button
                type="button"
                disabled={isLoadingList}
                onClick={handleManualRetry}
                className="px-4 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs flex items-center gap-1.5 transition-colors disabled:opacity-50"
              >
                <RefreshCw
                  className={`w-3.5 h-3.5 ${isLoadingList ? 'animate-spin' : ''}`}
                />
                <span>Retry Verification</span>
              </button>
              {onExitAdmin && (
                <button
                  type="button"
                  onClick={onExitAdmin}
                  className="px-3.5 py-2.5 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-xs font-semibold text-slate-200 flex items-center gap-1.5"
                >
                  <ArrowLeft className="w-3.5 h-3.5" />
                  <span>Exit</span>
                </button>
              )}
            </div>
          </div>

          <p className="text-xs text-slate-400 leading-relaxed">
            Your administrator session was not revoked—this error is temporary (such as a brief network interruption or Edge Function cold start). Click <strong>Retry Verification</strong> above to reconnect.
          </p>
        </div>
      </div>
    );
  }

  // ==========================================================================
  // STATE 2B: EXPLICIT FORBIDDEN NON-ADMIN (403) OR SETUP REQUIRED (503)
  // ==========================================================================
  if (
    !isLoadingList &&
    !listData &&
    (isExplicitDenial || adminAccessState === 'denied' || edgeDeploymentNeeded)
  ) {
    const isForbiddenUser =
      (isExplicitDenial || (httpStatus === 403 && !edgeDeploymentNeeded)) &&
      !edgeDeploymentNeeded;
    return (
      <div className="pt-28 pb-20 max-w-4xl mx-auto px-4 sm:px-6 space-y-6">
        <div
          className={`rounded-2xl bg-[#0d0e14] border p-6 sm:p-8 space-y-5 shadow-2xl ${
            isForbiddenUser ? 'border-rose-500/35' : 'border-amber-500/35'
          }`}
        >
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-5 border-b border-white/10">
            <div className="flex items-start gap-4">
              <div
                className={`p-3 rounded-2xl border shrink-0 ${
                  isForbiddenUser
                    ? 'bg-rose-500/15 border-rose-500/30 text-rose-400'
                    : 'bg-amber-500/15 border-amber-500/30 text-amber-400'
                }`}
              >
                <ShieldAlert className="w-7 h-7" />
              </div>
              <div>
                <span
                  className={`text-xs font-mono uppercase tracking-widest ${
                    isForbiddenUser ? 'text-rose-400' : 'text-amber-400'
                  }`}
                >
                  {isForbiddenUser
                    ? 'HTTP 403 · Forbidden — Non-Admin Account'
                    : 'Server-Side Admin Function Setup Required'}
                </span>
                <h1 className="font-['Outfit'] text-2xl sm:text-3xl font-extrabold text-white mt-0.5">
                  {isForbiddenUser
                    ? 'Access Denied: Administrator Privileges Required'
                    : 'Deploy `admin-users` Edge Function & Configure Admin UUID'}
                </h1>
                <p className="text-xs sm:text-sm text-slate-300 mt-1 leading-relaxed">
                  {listError || adminCheckError}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              <button
                type="button"
                onClick={handleManualRetry}
                className="px-3.5 py-2 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-xs font-semibold text-white flex items-center gap-1.5"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                <span>Retry Verification</span>
              </button>
              {onExitAdmin && (
                <button
                  type="button"
                  onClick={onExitAdmin}
                  className="px-3.5 py-2 rounded-xl bg-amber-500 text-slate-950 font-bold text-xs flex items-center gap-1.5"
                >
                  <ArrowLeft className="w-3.5 h-3.5" />
                  <span>Exit</span>
                </button>
              )}
            </div>
          </div>

          {/* Current Authenticated Identity Box (Helpful for copying your UUID into CINEMAX_ADMIN_USER_ID) */}
          <div className="rounded-xl bg-black/50 border border-white/10 p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="space-y-0.5">
              <div className="text-[11px] font-mono uppercase tracking-wider text-slate-400">
                Your Signed-In Supabase Auth User UUID
              </div>
              <div className="text-xs sm:text-sm font-mono font-bold text-amber-300 break-all">
                {currentUserId || 'Unknown'}
              </div>
              {currentUserEmail && (
                <div className="text-xs text-slate-400">{currentUserEmail}</div>
              )}
            </div>
            {currentUserId && (
              <button
                type="button"
                onClick={() => handleCopyText('my-uuid', currentUserId)}
                className="self-start sm:self-center px-3 py-1.5 rounded-lg bg-white/10 hover:bg-white/15 text-xs font-semibold text-white flex items-center gap-1.5 shrink-0"
              >
                {copiedKey === 'my-uuid' ? (
                  <>
                    <Check className="w-3.5 h-3.5 text-emerald-400" />
                    <span>UUID Copied</span>
                  </>
                ) : (
                  <>
                    <Copy className="w-3.5 h-3.5" />
                    <span>Copy My UUID</span>
                  </>
                )}
              </button>
            )}
          </div>

          {/* Step-by-Step Deployment & Secret Configuration Instructions */}
          <div className="space-y-4 pt-2">
            <h2 className="font-['Outfit'] text-base font-bold text-white flex items-center gap-2">
              <Terminal className="w-4 h-4 text-amber-400" />
              <span>How to Configure &amp; Deploy Server-Side Admin Operations</span>
            </h2>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Step 1: Edge Function & Secret */}
              <div className="p-4 rounded-xl bg-black/40 border border-white/10 space-y-2.5">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-white">
                    1. Set `CINEMAX_ADMIN_USER_ID` &amp; Deploy Edge Function
                  </span>
                  <button
                    type="button"
                    onClick={() => handleCopyText('cli-cmd', cliSecretsCmd)}
                    className="text-[11px] font-mono text-amber-400 hover:text-amber-300 flex items-center gap-1"
                  >
                    {copiedKey === 'cli-cmd' ? (
                      <>
                        <Check className="w-3 h-3 text-emerald-400" />
                        <span>Copied</span>
                      </>
                    ) : (
                      <>
                        <Copy className="w-3 h-3" />
                        <span>Copy CLI</span>
                      </>
                    )}
                  </button>
                </div>
                <pre className="p-3 rounded-lg bg-black/70 border border-white/5 text-[11px] font-mono text-amber-200 overflow-x-auto">
                  {cliSecretsCmd}
                </pre>
                <p className="text-[11px] text-slate-400 leading-relaxed">
                  Or in <strong>Supabase Dashboard → Edge Functions → Secrets</strong>, add{' '}
                  <code className="text-slate-200 font-mono">CINEMAX_ADMIN_USER_ID</code> set to your Auth User UUID above. Never place <code className="text-rose-300 font-mono">SUPABASE_SERVICE_ROLE_KEY</code> in <code className="text-slate-200 font-mono">VITE_</code> variables.
                </p>
              </div>

              {/* Step 2: Audit Log SQL Migration */}
              <div className="p-4 rounded-xl bg-black/40 border border-white/10 space-y-2.5">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-white">
                    2. Run Audit Log Table Migration (`public.admin_audit_logs`)
                  </span>
                  <button
                    type="button"
                    onClick={() =>
                      handleCopyText('audit-sql', SUPABASE_ADMIN_AUDIT_SQL)
                    }
                    className="text-[11px] font-mono text-amber-400 hover:text-amber-300 flex items-center gap-1"
                  >
                    {copiedKey === 'audit-sql' ? (
                      <>
                        <Check className="w-3 h-3 text-emerald-400" />
                        <span>SQL Copied</span>
                      </>
                    ) : (
                      <>
                        <Copy className="w-3 h-3" />
                        <span>Copy SQL</span>
                      </>
                    )}
                  </button>
                </div>
                <p className="text-[11px] text-slate-400 leading-relaxed">
                  Run <code className="text-slate-200 font-mono">supabase/admin_audit_logs_migration.sql</code> in your <strong>Supabase SQL Editor</strong> to create the RLS-protected audit log table for recording suspensions, restorations, password resets, and deletions.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  const overview = listData?.overview || {
    totalUsers: 0,
    confirmedUsers: 0,
    unconfirmedUsers: 0,
    recentRegistrations7d: 0,
    suspendedUsers: 0,
  };
  const users = listData?.users || [];
  const auditLogs = listData?.recentAuditLogs || [];

  // ==========================================================================
  // STATE 3: VERIFIED ADMINISTRATOR DASHBOARD (/admin)
  // ==========================================================================
  return (
    <div className="pt-24 sm:pt-28 pb-20 max-w-[1440px] mx-auto px-4 sm:px-8 space-y-8">
      {/* Studio Header Banner */}
      <div className="relative rounded-2xl bg-gradient-to-br from-[#12141f] via-[#0d0e15] to-[#090a0f] border border-amber-500/30 p-6 sm:p-8 shadow-2xl overflow-hidden">
        <div
          className="absolute -top-24 -right-24 w-96 h-96 rounded-full bg-amber-500/10 blur-3xl pointer-events-none"
          aria-hidden="true"
        />
        <div className="relative z-10 flex flex-col lg:flex-row lg:items-center justify-between gap-6">
          <div className="space-y-1.5">
            <div className="inline-flex items-center gap-2 text-xs font-mono uppercase tracking-widest text-emerald-400">
              <ShieldCheck className="w-4 h-4" />
              <span>Verified Administrator Session · Server-Side Allowlist Active</span>
            </div>
            <h1 className="font-['Outfit'] text-2xl sm:text-4xl font-extrabold text-white tracking-tight">
              CineMax Admin Dashboard
            </h1>
            <p className="text-xs sm:text-sm text-slate-400 font-mono">
              Route: <span className="text-amber-300">/admin</span> · Admin UUID:{' '}
              <span className="text-slate-200">
                {listData?.adminUserId || currentUserId}
              </span>
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2.5 shrink-0">
            <button
              type="button"
              onClick={() => setShowSetupGuide((prev) => !prev)}
              className="px-3.5 py-2 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-xs font-semibold text-slate-200 flex items-center gap-1.5 transition-colors"
            >
              <Database className="w-3.5 h-3.5 text-amber-400" />
              <span>{showSetupGuide ? 'Hide Setup & SQL' : 'Edge Function & SQL Guide'}</span>
            </button>

            <button
              type="button"
              disabled={isLoadingList}
              onClick={loadUsers}
              className="px-3.5 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs flex items-center gap-1.5 transition-colors disabled:opacity-50"
            >
              <RefreshCw
                className={`w-3.5 h-3.5 ${isLoadingList ? 'animate-spin' : ''}`}
              />
              <span>Refresh Users</span>
            </button>
          </div>
        </div>

        {/* Collapsible Setup & SQL Reference Drawer */}
        {showSetupGuide && (
          <div className="mt-6 pt-6 border-t border-white/10 grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
            <div className="p-4 rounded-xl bg-black/50 border border-white/10 space-y-2">
              <div className="flex items-center justify-between">
                <span className="font-bold text-white">
                  Supabase Edge Function Deployment
                </span>
                <button
                  type="button"
                  onClick={() => handleCopyText('guide-cli', cliSecretsCmd)}
                  className="text-amber-400 hover:text-amber-300 font-mono text-[11px] flex items-center gap-1"
                >
                  {copiedKey === 'guide-cli' ? (
                    <>
                      <Check className="w-3 h-3 text-emerald-400" />
                      <span>Copied</span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-3 h-3" />
                      <span>Copy Commands</span>
                    </>
                  )}
                </button>
              </div>
              <pre className="p-2.5 rounded bg-black/70 text-[11px] font-mono text-amber-200 overflow-x-auto">
                {cliSecretsCmd}
              </pre>
            </div>

            <div className="p-4 rounded-xl bg-black/50 border border-white/10 space-y-2">
              <div className="flex items-center justify-between">
                <span className="font-bold text-white">
                  Audit Log SQL Migration (`public.admin_audit_logs`)
                </span>
                <button
                  type="button"
                  onClick={() =>
                    handleCopyText('guide-sql', SUPABASE_ADMIN_AUDIT_SQL)
                  }
                  className="text-amber-400 hover:text-amber-300 font-mono text-[11px] flex items-center gap-1"
                >
                  {copiedKey === 'guide-sql' ? (
                    <>
                      <Check className="w-3 h-3 text-emerald-400" />
                      <span>SQL Copied</span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-3 h-3" />
                      <span>Copy SQL Script</span>
                    </>
                  )}
                </button>
              </div>
              <p className="text-slate-400 leading-relaxed">
                Creates <code className="text-slate-200 font-mono">public.admin_audit_logs</code> with strict Row-Level Security so only the server-side admin function can read or write audit records.
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Transient Error Banner when listData is already loaded */}
      {(listError || adminAccessState === 'error') && listData && (
        <div className="p-4 rounded-2xl border border-amber-500/35 bg-amber-500/10 text-amber-100 text-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0" />
            <span>
              <strong>Temporary connection issue:</strong>{' '}
              {listError ||
                adminCheckError ||
                'Background refresh encountered a temporary error. Showing your most recent user directory snapshot.'}
            </span>
          </div>
          <button
            type="button"
            disabled={isLoadingList}
            onClick={handleManualRetry}
            className="px-3.5 py-1.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs flex items-center gap-1.5 shrink-0 self-start sm:self-center"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isLoadingList ? 'animate-spin' : ''}`} />
            <span>Retry Now</span>
          </button>
        </div>
      )}

      {/* Action Feedback Banner */}
      {actionBanner && (
        <div
          className={`p-4 rounded-2xl border text-xs flex items-center justify-between gap-3 ${
            actionBanner.type === 'success'
              ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-200'
              : 'bg-rose-500/10 border-rose-500/30 text-rose-200'
          }`}
        >
          <div className="flex items-center gap-2.5">
            {actionBanner.type === 'success' ? (
              <Check className="w-4 h-4 text-emerald-400 shrink-0" />
            ) : (
              <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0" />
            )}
            <span className="font-medium">{actionBanner.message}</span>
          </div>
          <button
            type="button"
            onClick={() => setActionBanner(null)}
            className="p-1 opacity-75 hover:opacity-100"
            aria-label="Dismiss notification"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* 1. OVERVIEW KPI CARDS */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="rounded-2xl bg-[#0d0e14] border border-white/10 p-5 space-y-2">
          <div className="flex items-center justify-between text-xs text-slate-400">
            <span className="uppercase tracking-wider font-semibold">Total Users</span>
            <Users className="w-4 h-4 text-amber-400" />
          </div>
          <div className="font-mono text-3xl font-extrabold text-white tabular-nums">
            {overview.totalUsers.toLocaleString()}
          </div>
          <div className="text-[11px] text-slate-500 font-mono">
            {overview.suspendedUsers} currently suspended
          </div>
        </div>

        <div className="rounded-2xl bg-[#0d0e14] border border-white/10 p-5 space-y-2">
          <div className="flex items-center justify-between text-xs text-slate-400">
            <span className="uppercase tracking-wider font-semibold">
              Confirmed Users
            </span>
            <UserCheck className="w-4 h-4 text-emerald-400" />
          </div>
          <div className="font-mono text-3xl font-extrabold text-emerald-400 tabular-nums">
            {overview.confirmedUsers.toLocaleString()}
          </div>
          <div className="text-[11px] text-slate-500 font-mono">
            Verified email addresses
          </div>
        </div>

        <div className="rounded-2xl bg-[#0d0e14] border border-white/10 p-5 space-y-2">
          <div className="flex items-center justify-between text-xs text-slate-400">
            <span className="uppercase tracking-wider font-semibold">
              Unconfirmed Users
            </span>
            <UserX className="w-4 h-4 text-amber-400" />
          </div>
          <div className="font-mono text-3xl font-extrabold text-amber-300 tabular-nums">
            {overview.unconfirmedUsers.toLocaleString()}
          </div>
          <div className="text-[11px] text-slate-500 font-mono">
            Pending email verification
          </div>
        </div>

        <div className="rounded-2xl bg-[#0d0e14] border border-white/10 p-5 space-y-2">
          <div className="flex items-center justify-between text-xs text-slate-400">
            <span className="uppercase tracking-wider font-semibold">
              Recent (Last 7d)
            </span>
            <UserPlus className="w-4 h-4 text-sky-400" />
          </div>
          <div className="font-mono text-3xl font-extrabold text-sky-400 tabular-nums">
            {overview.recentRegistrations7d.toLocaleString()}
          </div>
          <div className="text-[11px] text-slate-500 font-mono">
            New sign-ups in past 7 days
          </div>
        </div>
      </div>

      {/* 2. MAIN WORKSPACE: SEARCHABLE PAGINATED USER TABLE (7 Cols) + USER DETAIL PANEL (5 Cols) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        {/* Left: User Directory Table */}
        <div className="lg:col-span-7 rounded-2xl bg-[#0d0e14] border border-white/10 p-5 sm:p-6 space-y-5">
          {/* Search & Status Filters */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="relative flex-1">
              <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                type="text"
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                placeholder="Search by email, user UUID, or username..."
                aria-label="Search users"
                className="w-full pl-10 pr-9 py-2 bg-black/50 border border-white/15 rounded-xl text-xs sm:text-sm text-white placeholder:text-slate-500 focus:outline-none focus:border-amber-400"
              />
              {searchInput && (
                <button
                  type="button"
                  onClick={() => setSearchInput('')}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0">
              {(
                [
                  { id: 'all', label: 'All' },
                  { id: 'confirmed', label: 'Confirmed' },
                  { id: 'unconfirmed', label: 'Unconfirmed' },
                  { id: 'suspended', label: 'Suspended' },
                ] as const
              ).map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => {
                    setStatusFilter(tab.id);
                    setPage(1);
                  }}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors whitespace-nowrap ${
                    statusFilter === tab.id
                      ? 'bg-amber-500 text-slate-950'
                      : 'bg-black/40 text-slate-400 hover:text-white border border-white/10'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>
          </div>

          {/* Table or Loading/Empty State */}
          {isLoadingList ? (
            <div className="py-16 text-center space-y-2">
              <Loader2 className="w-6 h-6 text-amber-400 animate-spin mx-auto" />
              <p className="text-xs text-slate-400">
                Loading authenticated user directory...
              </p>
            </div>
          ) : users.length === 0 ? (
            <div className="py-14 text-center rounded-xl bg-black/30 border border-white/5 space-y-2">
              <Users className="w-7 h-7 text-slate-600 mx-auto" />
              <p className="text-sm font-semibold text-white">No Matching Users Found</p>
              <p className="text-xs text-slate-400">
                Try clearing your search query or switching the confirmation filter.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-white/10 text-[11px] font-mono uppercase tracking-wider text-slate-400">
                    <th className="py-3 pr-3">User / Email</th>
                    <th className="py-3 px-3">Status</th>
                    <th className="py-3 px-3 hidden sm:table-cell">Created</th>
                    <th className="py-3 px-3 hidden md:table-cell">Last Sign-In</th>
                    <th className="py-3 pl-3 text-right">Inspect</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5 text-xs">
                  {users.map((u) => {
                    const isSelected = selectedUserId === u.id;
                    const initials = (u.displayName || u.email || 'U')
                      .slice(0, 2)
                      .toUpperCase();

                    return (
                      <tr
                        key={u.id}
                        onClick={() => setSelectedUserId(u.id)}
                        className={`cursor-pointer transition-colors ${
                          isSelected
                            ? 'bg-amber-500/10 hover:bg-amber-500/15'
                            : 'hover:bg-white/[0.03]'
                        }`}
                      >
                        <td className="py-3.5 pr-3">
                          <div className="flex items-center gap-2.5">
                            {u.avatarUrl ? (
                              <img
                                src={u.avatarUrl}
                                alt={u.displayName}
                                className="w-8 h-8 rounded-full object-cover border border-white/15 shrink-0"
                              />
                            ) : (
                              <div className="w-8 h-8 rounded-full bg-amber-500/15 border border-amber-500/30 text-amber-300 font-mono text-[11px] font-bold flex items-center justify-center shrink-0">
                                {initials}
                              </div>
                            )}
                            <div className="min-w-0">
                              <div className="flex items-center gap-1.5">
                                <span className="font-semibold text-white truncate max-w-[160px] sm:max-w-[200px]">
                                  {u.email || 'No Email'}
                                </span>
                                {u.isAdmin && (
                                  <span className="px-1.5 py-0.5 rounded bg-amber-500 text-slate-950 font-mono text-[10px] font-bold">
                                    ADMIN
                                  </span>
                                )}
                              </div>
                              <div className="text-[11px] font-mono text-slate-500 truncate max-w-[190px]">
                                {u.id}
                              </div>
                            </div>
                          </div>
                        </td>

                        <td className="py-3.5 px-3">
                          <div className="flex flex-col gap-1 items-start">
                            {u.isSuspended ? (
                              <span className="px-2 py-0.5 rounded bg-rose-500/15 border border-rose-500/30 text-rose-300 font-mono text-[10px] font-semibold">
                                Suspended
                              </span>
                            ) : u.isEmailConfirmed ? (
                              <span className="px-2 py-0.5 rounded bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 font-mono text-[10px] font-semibold">
                                Confirmed
                              </span>
                            ) : (
                              <span className="px-2 py-0.5 rounded bg-amber-500/15 border border-amber-500/30 text-amber-300 font-mono text-[10px] font-semibold">
                                Unconfirmed
                              </span>
                            )}
                          </div>
                        </td>

                        <td className="py-3.5 px-3 font-mono text-slate-400 hidden sm:table-cell whitespace-nowrap">
                          {formatDateTime(u.createdAt)}
                        </td>

                        <td className="py-3.5 px-3 font-mono text-slate-400 hidden md:table-cell whitespace-nowrap">
                          {formatDateTime(u.lastSignInAt)}
                        </td>

                        <td className="py-3.5 pl-3 text-right">
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setSelectedUserId(u.id);
                            }}
                            className="px-2.5 py-1 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 text-amber-400 font-semibold text-[11px]"
                          >
                            {isSelected ? 'Viewing' : 'Manage →'}
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}

          {/* Pagination Footer */}
          {listData && listData.totalPages > 1 && (
            <div className="pt-3 border-t border-white/10 flex items-center justify-between text-xs text-slate-400">
              <span className="font-mono">
                Page {listData.page} of {listData.totalPages} ({listData.totalResults}{' '}
                users)
              </span>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  disabled={page <= 1 || isLoadingList}
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  className="p-1.5 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 text-white disabled:opacity-30"
                  aria-label="Previous page"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <button
                  type="button"
                  disabled={page >= listData.totalPages || isLoadingList}
                  onClick={() => setPage((p) => Math.min(listData.totalPages, p + 1))}
                  className="p-1.5 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 text-white disabled:opacity-30"
                  aria-label="Next page"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Right: User Detail & Account Management Panel */}
        <div className="lg:col-span-5 rounded-2xl bg-[#0d0e14] border border-white/10 p-5 sm:p-6 space-y-5 lg:sticky lg:top-24">
          {!selectedUserId ? (
            <div className="py-16 text-center space-y-2.5">
              <ShieldCheck className="w-8 h-8 text-amber-400/60 mx-auto" />
              <h2 className="font-['Outfit'] text-base font-bold text-white">
                Select a User to Inspect &amp; Manage
              </h2>
              <p className="text-xs text-slate-400 max-w-xs mx-auto leading-relaxed">
                Click any user row in the directory to view permitted profile fields, aggregate library statistics, and account actions.
              </p>
            </div>
          ) : isLoadingDetail ? (
            <div className="py-16 text-center space-y-2">
              <Loader2 className="w-6 h-6 text-amber-400 animate-spin mx-auto" />
              <p className="text-xs text-slate-400">Loading account details...</p>
            </div>
          ) : detailError || !userDetail ? (
            <div className="p-4 rounded-xl bg-rose-500/10 border border-rose-500/30 text-xs text-rose-200 space-y-2">
              <div className="font-semibold">Could not load user detail</div>
              <p>{detailError}</p>
            </div>
          ) : (
            <>
              {/* Selected User Identity Header */}
              <div className="flex items-start justify-between gap-3 pb-4 border-b border-white/10">
                <div className="flex items-center gap-3 min-w-0">
                  {userDetail.user.avatarUrl ? (
                    <img
                      src={userDetail.user.avatarUrl}
                      alt={userDetail.user.displayName}
                      className="w-12 h-12 rounded-xl object-cover border border-amber-400/40 shrink-0"
                    />
                  ) : (
                    <div className="w-12 h-12 rounded-xl bg-amber-500/15 border border-amber-500/30 text-amber-400 font-['Outfit'] text-lg font-extrabold flex items-center justify-center shrink-0">
                      {(userDetail.user.displayName || 'U').slice(0, 2).toUpperCase()}
                    </div>
                  )}
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h2 className="font-['Outfit'] text-lg font-bold text-white truncate">
                        {userDetail.user.displayName}
                      </h2>
                      {userDetail.user.isAdmin && (
                        <span className="px-2 py-0.5 rounded bg-amber-500 text-slate-950 font-mono text-[10px] font-bold">
                          ADMINISTRATOR
                        </span>
                      )}
                    </div>
                    <div className="text-xs text-slate-300 truncate">
                      {userDetail.user.email || 'No email'}
                    </div>
                    {userDetail.profile?.username && (
                      <div className="text-[11px] font-mono text-amber-300/90">
                        @{userDetail.profile.username}
                      </div>
                    )}
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => setSelectedUserId(null)}
                  className="p-1.5 text-slate-400 hover:text-white rounded-lg"
                  aria-label="Close user detail panel"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Metadata Grid */}
              <div className="rounded-xl bg-black/40 border border-white/5 p-3.5 space-y-2 text-xs">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-slate-400">User UUID:</span>
                  <div className="flex items-center gap-1.5 min-w-0">
                    <span className="font-mono text-slate-200 truncate max-w-[180px]">
                      {userDetail.user.id}
                    </span>
                    <button
                      type="button"
                      onClick={() => handleCopyText('detail-uuid', userDetail.user.id)}
                      className="text-amber-400 hover:text-amber-300"
                      title="Copy UUID"
                    >
                      {copiedKey === 'detail-uuid' ? (
                        <Check className="w-3.5 h-3.5 text-emerald-400" />
                      ) : (
                        <Copy className="w-3.5 h-3.5" />
                      )}
                    </button>
                  </div>
                </div>

                <div className="flex items-center justify-between">
                  <span className="text-slate-400">Registered:</span>
                  <span className="font-mono text-slate-200">
                    {formatDateTime(userDetail.user.createdAt)}
                  </span>
                </div>

                <div className="flex items-center justify-between">
                  <span className="text-slate-400">Last Sign-In:</span>
                  <span className="font-mono text-slate-200">
                    {formatDateTime(userDetail.user.lastSignInAt)}
                  </span>
                </div>

                <div className="flex items-center justify-between">
                  <span className="text-slate-400">Email Status:</span>
                  <span
                    className={`font-mono font-semibold ${
                      userDetail.user.isEmailConfirmed
                        ? 'text-emerald-400'
                        : 'text-amber-300'
                    }`}
                  >
                    {userDetail.user.isEmailConfirmed
                      ? `Confirmed (${formatDateTime(userDetail.user.emailConfirmedAt)})`
                      : 'Unconfirmed'}
                  </span>
                </div>

                <div className="flex items-center justify-between">
                  <span className="text-slate-400">Account Access:</span>
                  <span
                    className={`font-mono font-semibold ${
                      userDetail.user.isSuspended
                        ? 'text-rose-400'
                        : 'text-emerald-400'
                    }`}
                  >
                    {userDetail.user.isSuspended
                      ? `Suspended until ${formatDateTime(userDetail.user.bannedUntil)}`
                      : 'Active'}
                  </span>
                </div>
              </div>

              {/* Privacy-Safe Aggregate Account Statistics */}
              <div className="space-y-2">
                <div className="flex items-center justify-between text-xs">
                  <span className="uppercase tracking-wider text-slate-400 font-semibold">
                    Aggregate Account Activity (Privacy-Safe)
                  </span>
                  <span className="text-[10px] font-mono text-slate-500">
                    Counts only · No private notes exposed
                  </span>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  <div className="p-2.5 rounded-xl bg-black/30 border border-white/5 text-center">
                    <Bookmark className="w-3.5 h-3.5 text-amber-400 mx-auto mb-1" />
                    <div className="font-mono text-base font-bold text-white tabular-nums">
                      {userDetail.stats.watchlistCount}
                    </div>
                    <div className="text-[10px] text-slate-400">Watchlist</div>
                  </div>
                  <div className="p-2.5 rounded-xl bg-black/30 border border-white/5 text-center">
                    <Heart className="w-3.5 h-3.5 text-rose-400 mx-auto mb-1" />
                    <div className="font-mono text-base font-bold text-white tabular-nums">
                      {userDetail.stats.favouritesCount}
                    </div>
                    <div className="text-[10px] text-slate-400">Favourites</div>
                  </div>
                  <div className="p-2.5 rounded-xl bg-black/30 border border-white/5 text-center">
                    <BookOpen className="w-3.5 h-3.5 text-emerald-400 mx-auto mb-1" />
                    <div className="font-mono text-base font-bold text-white tabular-nums">
                      {userDetail.stats.watchedHistoryCount}
                    </div>
                    <div className="text-[10px] text-slate-400">Journal Logs</div>
                  </div>
                  <div className="p-2.5 rounded-xl bg-black/30 border border-white/5 text-center">
                    <Tv className="w-3.5 h-3.5 text-sky-400 mx-auto mb-1" />
                    <div className="font-mono text-base font-bold text-white tabular-nums">
                      {userDetail.stats.watchedEpisodesCount}
                    </div>
                    <div className="text-[10px] text-slate-400">Episodes</div>
                  </div>
                </div>
              </div>

              {/* Privileged Account Management Controls */}
              <div className="space-y-2.5 pt-2 border-t border-white/10">
                <span className="text-xs uppercase tracking-wider text-slate-400 font-semibold block">
                  Account Management Actions
                </span>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {/* Confirm Email Button */}
                  {!userDetail.user.isEmailConfirmed && (
                    <button
                      type="button"
                      disabled={Boolean(actionInFlight)}
                      onClick={() => handleConfirmEmail(userDetail.user)}
                      className="py-2 px-3 rounded-xl bg-emerald-500/15 hover:bg-emerald-500/25 border border-emerald-500/30 text-emerald-300 font-semibold text-xs flex items-center justify-center gap-1.5 disabled:opacity-40"
                    >
                      {actionInFlight === `confirm-${userDetail.user.id}` ? (
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      ) : (
                        <MailCheck className="w-3.5 h-3.5" />
                      )}
                      <span>Confirm Email</span>
                    </button>
                  )}

                  {/* Send Password Reset Email Button */}
                  <button
                    type="button"
                    disabled={Boolean(actionInFlight) || !userDetail.user.email}
                    onClick={() => handleSendPasswordReset(userDetail.user)}
                    className="py-2 px-3 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-slate-200 font-semibold text-xs flex items-center justify-center gap-1.5 disabled:opacity-40"
                  >
                    {actionInFlight === `reset-${userDetail.user.id}` ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <KeyRound className="w-3.5 h-3.5 text-amber-400" />
                    )}
                    <span>Send Password Reset</span>
                  </button>

                  {/* Suspend or Restore Button (Blocked on Admin Self Account) */}
                  {userDetail.user.isAdmin ? (
                    <div className="sm:col-span-2 p-2.5 rounded-xl bg-amber-500/10 border border-amber-500/25 text-[11px] text-amber-300 flex items-center gap-2">
                      <ShieldCheck className="w-4 h-4 shrink-0 text-amber-400" />
                      <span>
                        Protected Administrator Account — Self-suspension and self-deletion are disabled.
                      </span>
                    </div>
                  ) : (
                    <>
                      {userDetail.user.isSuspended ? (
                        <button
                          type="button"
                          disabled={Boolean(actionInFlight)}
                          onClick={() => handleRestoreUser(userDetail.user)}
                          className="py-2 px-3 rounded-xl bg-sky-500/15 hover:bg-sky-500/25 border border-sky-500/30 text-sky-300 font-semibold text-xs flex items-center justify-center gap-1.5 disabled:opacity-40"
                        >
                          {actionInFlight === `restore-${userDetail.user.id}` ? (
                            <Loader2 className="w-3.5 h-3.5 animate-spin" />
                          ) : (
                            <Unlock className="w-3.5 h-3.5" />
                          )}
                          <span>Restore Access</span>
                        </button>
                      ) : (
                        <button
                          type="button"
                          disabled={Boolean(actionInFlight)}
                          onClick={() => {
                            setSelectedSuspendDuration('24h');
                            setSuspendModalUser(userDetail.user);
                          }}
                          className="py-2 px-3 rounded-xl bg-amber-500/15 hover:bg-amber-500/25 border border-amber-500/30 text-amber-300 font-semibold text-xs flex items-center justify-center gap-1.5 disabled:opacity-40"
                        >
                          <Ban className="w-3.5 h-3.5" />
                          <span>Suspend Account...</span>
                        </button>
                      )}

                      {/* Delete Account Button */}
                      <button
                        type="button"
                        disabled={Boolean(actionInFlight)}
                        onClick={() => {
                          setDeleteConfirmInput('');
                          setDeleteModalUser(userDetail.user);
                        }}
                        className="py-2 px-3 rounded-xl bg-rose-500/15 hover:bg-rose-500/25 border border-rose-500/30 text-rose-300 font-semibold text-xs flex items-center justify-center gap-1.5 disabled:opacity-40"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                        <span>Delete Account...</span>
                      </button>
                    </>
                  )}
                </div>
              </div>
            </>
          )}
        </div>
      </div>

      {/* 3. RECENT ADMIN AUDIT LOG PANEL */}
      <div className="rounded-2xl bg-[#0d0e14] border border-white/10 p-5 sm:p-6 space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="font-['Outfit'] text-base sm:text-lg font-bold text-white flex items-center gap-2">
              <Activity className="w-4 h-4 text-amber-400" />
              <span>Recent Administrator Audit Log (`public.admin_audit_logs`)</span>
            </h2>
            <p className="text-xs text-slate-400">
              Server-recorded log of account suspensions, restorations, email confirmations, password resets, and deletions.
            </p>
          </div>
        </div>

        {auditLogs.length === 0 ? (
          <div className="py-8 text-center rounded-xl bg-black/30 border border-white/5 text-xs text-slate-500">
            No administrative actions recorded yet (or run the Audit Log SQL migration above to enable persistent audit logging).
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-white/10 text-[11px] font-mono uppercase tracking-wider text-slate-400">
                  <th className="py-2.5 pr-3">Timestamp</th>
                  <th className="py-2.5 px-3">Action</th>
                  <th className="py-2.5 px-3">Target Account</th>
                  <th className="py-2.5 pl-3">Details</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5 font-mono">
                {auditLogs.map((log) => (
                  <tr key={log.id} className="hover:bg-white/[0.02]">
                    <td className="py-2.5 pr-3 text-slate-400 whitespace-nowrap">
                      {new Date(log.created_at).toLocaleString()}
                    </td>
                    <td className="py-2.5 px-3">
                      <span className="px-2 py-0.5 rounded bg-white/5 border border-white/10 text-amber-300">
                        {log.action}
                      </span>
                    </td>
                    <td className="py-2.5 px-3 text-slate-200">
                      {log.target_email || log.target_user_id}
                    </td>
                    <td className="py-2.5 pl-3 text-slate-400 text-[11px]">
                      {JSON.stringify(log.details || {})}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ==================================================================== */}
      {/* MODAL A: SUSPEND ACCOUNT CONFIRMATION & DURATION SELECTOR            */}
      {/* ==================================================================== */}
      {suspendModalUser && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-black/85 backdrop-blur-md flex items-center justify-center p-4">
          <div
            className="fixed inset-0"
            onClick={() => {
              if (!actionInFlight) setSuspendModalUser(null);
            }}
          />
          <div className="relative z-10 w-full max-w-md bg-[#0d0e14] border border-amber-500/30 rounded-2xl shadow-2xl p-6 space-y-5">
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-xl bg-amber-500/15 text-amber-400">
                  <Clock className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-['Outfit'] text-lg font-bold text-white">
                    Suspend Account Access
                  </h3>
                  <p className="text-xs text-slate-400 font-mono">
                    {suspendModalUser.email || suspendModalUser.id}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setSuspendModalUser(null)}
                className="p-1 text-slate-400 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-2">
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400">
                Select Suspension Duration (`ban_duration`)
              </label>
              <div className="grid grid-cols-2 gap-2">
                {(
                  [
                    { id: '24h', label: '24 Hours' },
                    { id: '7d', label: '7 Days (168h)' },
                    { id: '30d', label: '30 Days (720h)' },
                    { id: 'indefinite', label: 'Indefinite (~100y)' },
                  ] as const
                ).map((opt) => (
                  <button
                    key={opt.id}
                    type="button"
                    onClick={() => setSelectedSuspendDuration(opt.id)}
                    className={`py-2.5 px-3 rounded-xl border text-xs font-semibold transition-all ${
                      selectedSuspendDuration === opt.id
                        ? 'bg-amber-500 text-slate-950 border-amber-400 font-bold'
                        : 'bg-black/40 border-white/10 text-slate-300 hover:border-white/25'
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Honest Token Behavior Disclosure */}
            <div className="p-3.5 rounded-xl bg-amber-500/10 border border-amber-500/25 text-xs text-amber-200/90 leading-relaxed space-y-1">
              <div className="font-semibold text-amber-300">
                Supabase Auth Suspension Behavior
              </div>
              <p>
                Setting <code className="font-mono">ban_duration</code> immediately blocks new sign-ins and prevents refresh tokens from minting new sessions. Any already-issued short-lived access JWT will remain valid until its natural expiration (typically up to 1 hour).
              </p>
            </div>

            <div className="flex items-center justify-end gap-2.5 pt-1">
              <button
                type="button"
                disabled={Boolean(actionInFlight)}
                onClick={() => setSuspendModalUser(null)}
                className="px-4 py-2 rounded-xl text-xs font-medium text-slate-400 hover:text-white"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={Boolean(actionInFlight)}
                onClick={handleExecuteSuspend}
                className="px-5 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs flex items-center gap-1.5"
              >
                {actionInFlight === `suspend-${suspendModalUser.id}` ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    <span>Suspending...</span>
                  </>
                ) : (
                  <>
                    <Ban className="w-3.5 h-3.5" />
                    <span>Confirm Suspension</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ==================================================================== */}
      {/* MODAL B: DESTRUCTIVE DELETE ACCOUNT CONFIRMATION                     */}
      {/* ==================================================================== */}
      {deleteModalUser && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-black/85 backdrop-blur-md flex items-center justify-center p-4">
          <div
            className="fixed inset-0"
            onClick={() => {
              if (!actionInFlight) setDeleteModalUser(null);
            }}
          />
          <div className="relative z-10 w-full max-w-md bg-[#0d0e14] border border-rose-500/40 rounded-2xl shadow-2xl p-6 space-y-5">
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-xl bg-rose-500/15 text-rose-400">
                  <AlertTriangle className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-['Outfit'] text-lg font-bold text-white">
                    Permanently Delete User Account
                  </h3>
                  <p className="text-xs text-slate-400 font-mono">
                    {deleteModalUser.email || deleteModalUser.id}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setDeleteModalUser(null)}
                className="p-1 text-slate-400 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-3.5 rounded-xl bg-rose-500/10 border border-rose-500/30 text-xs text-rose-200 leading-relaxed space-y-1.5">
              <div className="font-semibold text-rose-300">
                Irreversible Cascade Deletion Warning
              </div>
              <p>
                Deleting this user removes their <code className="font-mono">auth.users</code> record and automatically deletes their <code className="font-mono">public.profiles</code> row, watchlist items, viewing journal history, episode progress, and uploaded avatar files via <code className="font-mono">ON DELETE CASCADE</code>.
              </p>
            </div>

            <div className="space-y-1.5">
              <label className="block text-xs text-slate-300">
                Type <span className="font-mono font-bold text-rose-400">DELETE</span> to confirm permanent removal:
              </label>
              <input
                type="text"
                value={deleteConfirmInput}
                onChange={(e) => setDeleteConfirmInput(e.target.value)}
                placeholder="DELETE"
                className="w-full px-3.5 py-2 bg-black/60 border border-white/15 rounded-xl text-sm font-mono text-white focus:outline-none focus:border-rose-400"
              />
            </div>

            <div className="flex items-center justify-end gap-2.5 pt-1">
              <button
                type="button"
                disabled={Boolean(actionInFlight)}
                onClick={() => setDeleteModalUser(null)}
                className="px-4 py-2 rounded-xl text-xs font-medium text-slate-400 hover:text-white"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={
                  Boolean(actionInFlight) || deleteConfirmInput.trim() !== 'DELETE'
                }
                onClick={handleExecuteDelete}
                className="px-5 py-2 rounded-xl bg-rose-500 hover:bg-rose-400 text-slate-950 font-bold text-xs flex items-center gap-1.5 disabled:opacity-40"
              >
                {actionInFlight === `delete-${deleteModalUser.id}` ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    <span>Deleting...</span>
                  </>
                ) : (
                  <>
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>Delete User Permanently</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
