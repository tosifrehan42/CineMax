import { ensureSupabaseClient } from './supabaseClient';
import type {
  AdminOverviewStats,
  SanitizedAdminUserSummary,
} from '../server/adminHandler';

export type { AdminOverviewStats, SanitizedAdminUserSummary };

export type AdminAccessState = 'loading' | 'allowed' | 'denied' | 'error';

export interface AdminAuditLogEntry {
  id: string;
  admin_user_id: string;
  admin_email?: string | null;
  target_user_id: string;
  target_email?: string | null;
  action:
    | 'suspend_user'
    | 'restore_user'
    | 'delete_user'
    | 'confirm_email'
    | 'send_password_reset';
  details?: Record<string, any>;
  created_at: string;
}

export interface AdminListUsersResponse {
  overview: AdminOverviewStats;
  users: SanitizedAdminUserSummary[];
  page: number;
  perPage: number;
  totalPages: number;
  totalResults: number;
  adminUserId: string;
  recentAuditLogs: AdminAuditLogEntry[];
}

export interface AdminUserDetailResponse {
  user: SanitizedAdminUserSummary;
  profile: {
    displayName: string | null;
    username: string | null;
    avatarUrl: string | null;
    favoriteGenres: string[];
    createdAt: string | null;
    updatedAt: string | null;
  } | null;
  stats: {
    watchlistCount: number;
    favouritesCount: number;
    watchedHistoryCount: number;
    watchedEpisodesCount: number;
  };
  auditLogs: AdminAuditLogEntry[];
}

export interface AdminApiCallResult<T> {
  data: T | null;
  status: number;
  code?: string;
  edgeDeploymentNeeded?: boolean;
  isExplicitDenial?: boolean;
  isTransientError?: boolean;
  retryAttempts?: number;
  error: string | null;
}

export const SUPABASE_ADMIN_AUDIT_SQL = `-- CineMax Admin Dashboard — Audit Log Table Migration (\`public.admin_audit_logs\`)
-- Run this non-destructive script in your Supabase SQL Editor.

CREATE TABLE IF NOT EXISTS public.admin_audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_user_id UUID NOT NULL,
  admin_email TEXT,
  target_user_id UUID NOT NULL,
  target_email TEXT,
  action TEXT NOT NULL CHECK (
    action IN (
      'suspend_user',
      'restore_user',
      'delete_user',
      'confirm_email',
      'send_password_reset'
    )
  ),
  details JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_admin_audit_logs_created_at
  ON public.admin_audit_logs (created_at DESC);

CREATE INDEX IF NOT EXISTS idx_admin_audit_logs_target_user
  ON public.admin_audit_logs (target_user_id, created_at DESC);

ALTER TABLE public.admin_audit_logs ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Deny all client access to admin_audit_logs" ON public.admin_audit_logs;`;

function resolveAdminApiBaseUrl(): string {
  const envUrl = (import.meta.env?.VITE_API_BASE_URL || '').trim().replace(/\/$/, '');
  if (envUrl && envUrl !== 'MY_APP_URL') return envUrl;
  if (typeof window !== 'undefined') {
    const isStaticOrCap =
      window.location.hostname.toLowerCase().endsWith('.github.io') ||
      Boolean((window as any).Capacitor?.isNativePlatform?.()) ||
      window.location.protocol === 'capacitor:' ||
      (window.location.hostname.toLowerCase() === 'localhost' &&
        !window.location.port &&
        window.location.protocol === 'https:');
    if (isStaticOrCap) {
      return 'https://cinemax-kxpv.onrender.com';
    }
  }
  return '';
}

const API_BASE_URL = resolveAdminApiBaseUrl();

const ADMIN_VERIFIED_SESSION_STORAGE_KEY = 'cinemax_verified_admin_uid_v1';

/**
 * Reads the cached verified admin user UUID from sessionStorage.
 * Used only to prevent Navbar/UI flicker during page reloads or transient network blips
 * while server-side verification runs in the background.
 */
export function getCachedVerifiedAdminUid(): string | null {
  if (typeof window === 'undefined') return null;
  try {
    const val = window.sessionStorage.getItem(ADMIN_VERIFIED_SESSION_STORAGE_KEY);
    return val ? val.trim() : null;
  } catch {
    return null;
  }
}

export function setCachedVerifiedAdminUid(userId: string): void {
  if (typeof window === 'undefined' || !userId) return;
  try {
    window.sessionStorage.setItem(ADMIN_VERIFIED_SESSION_STORAGE_KEY, userId.trim());
  } catch {
    // Ignore storage quota / privacy mode errors
  }
}

export function clearCachedVerifiedAdminUid(): void {
  if (typeof window === 'undefined') return;
  try {
    window.sessionStorage.removeItem(ADMIN_VERIFIED_SESSION_STORAGE_KEY);
  } catch {
    // Ignore storage errors
  }
}

export function isUserCachedAsVerifiedAdmin(userId: string | null | undefined): boolean {
  if (!userId) return false;
  const cached = getCachedVerifiedAdminUid();
  return Boolean(cached && cached.toLowerCase() === userId.trim().toLowerCase());
}

/**
 * Pure state-transition resolver for Admin Access State.
 * Ensures that:
 * - Explicit HTTP 403 (`FORBIDDEN_NOT_ADMIN`) transitions to `'denied'` and clears any cached state.
 * - HTTP 200 (`isAdmin: true`) transitions to `'allowed'` and caches the verified user ID.
 * - Transient network / 5xx / timeout errors transition to `'error'` without wiping out a previously
 *   verified `'allowed'` flag for the same user ID.
 */
export function deriveAdminStateFromCheckResult(params: {
  userId: string;
  checkResult: {
    isAdmin: boolean;
    status: number;
    code?: string;
    edgeDeploymentNeeded?: boolean;
    isExplicitDenial?: boolean;
    error: string | null;
  };
  previouslyVerifiedForUser: boolean;
}): {
  nextState: AdminAccessState;
  keepVerifiedForUser: boolean;
} {
  const { checkResult, previouslyVerifiedForUser } = params;

  if (checkResult.status === 200 && checkResult.isAdmin) {
    return {
      nextState: 'allowed',
      keepVerifiedForUser: true,
    };
  }

  // Only treat as an explicit non-admin denial when the server explicitly returned 403 FORBIDDEN_NOT_ADMIN
  const explicitDenial =
    checkResult.isExplicitDenial === true ||
    (checkResult.status === 403 &&
      !checkResult.edgeDeploymentNeeded &&
      checkResult.code !== 'ADMIN_SECRET_NOT_CONFIGURED');

  if (explicitDenial) {
    return {
      nextState: 'denied',
      keepVerifiedForUser: false,
    };
  }

  // Otherwise (network error, 5xx, cold start timeout, or unrefreshed 401):
  // Enter 'error' state, and preserve previouslyVerifiedForUser if the user was already verified in this session
  return {
    nextState: 'error',
    keepVerifiedForUser: previouslyVerifiedForUser,
  };
}

/**
 * Determines whether the Navbar Admin tab should be visible.
 * Visible when the user is authenticated AND either:
 * - `adminAccessState === 'allowed'`, OR
 * - `adminAccessState !== 'denied'` and this exact `userId` was already verified in the current session.
 */
export function shouldShowAdminTab(params: {
  isAuthenticated: boolean;
  userId: string | null | undefined;
  adminAccessState: AdminAccessState;
  verifiedAdminUserId: string | null;
}): boolean {
  if (!params.isAuthenticated || !params.userId) return false;
  if (params.adminAccessState === 'denied') return false;
  if (params.adminAccessState === 'allowed') return true;
  if (
    params.verifiedAdminUserId &&
    params.verifiedAdminUserId.toLowerCase() === params.userId.toLowerCase()
  ) {
    return true;
  }
  return false;
}

export const DEFAULT_RETRY_DELAYS_MS = [400, 1000, 2200];

function sleepMs(ms: number): Promise<void> {
  if (ms <= 0) return Promise.resolve();
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export interface AdminTransportDependencies<T> {
  getAccessToken: () => Promise<string | null>;
  refreshAccessToken: () => Promise<string | null>;
  executeSingleAttempt: (accessToken: string) => Promise<AdminApiCallResult<T>>;
  retryDelaysMs?: number[];
}

/**
 * Executes an admin backend call with:
 * 1. Automatic 1x session refresh + retry when HTTP 401 is encountered.
 * 2. Up to 3 automatic exponential-backoff retries (`400ms`, `1000ms`, `2200ms`) for transient network / 5xx errors.
 * 3. Immediate return (no retry) on HTTP 200, HTTP 400, or explicit HTTP 403 (`FORBIDDEN_NOT_ADMIN`).
 */
export async function executeAdminRequestWithResilience<T>(
  deps: AdminTransportDependencies<T>
): Promise<AdminApiCallResult<T>> {
  const retryDelays = deps.retryDelaysMs ?? DEFAULT_RETRY_DELAYS_MS;
  let accessToken = await deps.getAccessToken();

  if (!accessToken) {
    // Attempt one session refresh in case session restoration or token rotation was in flight
    accessToken = await deps.refreshAccessToken();
  }

  if (!accessToken) {
    return {
      data: null,
      status: 401,
      code: 'UNAUTHENTICATED',
      isExplicitDenial: false,
      isTransientError: false,
      retryAttempts: 0,
      error: 'Authentication required. Please sign in with your administrator account.',
    };
  }

  let hasRefreshedOn401 = false;
  let transientAttempt = 0;

  while (true) {
    const result = await deps.executeSingleAttempt(accessToken);

    // 1. Success -> return immediately
    if (result.status === 200 && result.data && !result.error) {
      return {
        ...result,
        retryAttempts: transientAttempt,
      };
    }

    // 2. Explicit 403 Forbidden or 400 Bad Request -> do not retry
    if (result.status === 403 || result.status === 400) {
      return {
        ...result,
        isExplicitDenial:
          result.status === 403 &&
          !result.edgeDeploymentNeeded &&
          result.code !== 'ADMIN_SECRET_NOT_CONFIGURED',
        isTransientError: false,
        retryAttempts: transientAttempt,
      };
    }

    // 3. HTTP 401 Unauthorized -> revalidate/refresh session once and retry immediately
    if (result.status === 401 && !hasRefreshedOn401) {
      hasRefreshedOn401 = true;
      const refreshedToken = await deps.refreshAccessToken();
      if (refreshedToken) {
        accessToken = refreshedToken;
        continue;
      }
      return {
        ...result,
        status: 401,
        code: result.code || 'UNAUTHENTICATED',
        isExplicitDenial: false,
        isTransientError: false,
        retryAttempts: transientAttempt,
      };
    }

    // 4. Configuration / Missing Deployment (503 with explicit setup code) -> do not spin retries
    if (result.edgeDeploymentNeeded && !result.isTransientError) {
      return {
        ...result,
        retryAttempts: transientAttempt,
      };
    }

    // 5. Transient network error, timeout, or 5xx response -> bounded exponential backoff (up to 3 retries)
    if (transientAttempt < retryDelays.length) {
      const delay = retryDelays[transientAttempt];
      transientAttempt += 1;
      await sleepMs(delay);
      continue;
    }

    return {
      ...result,
      isTransientError: true,
      retryAttempts: transientAttempt,
    };
  }
}

/**
 * Performs a single attempt against the `admin-users` Supabase Edge Function
 * (with fallback to local `/api/admin/users` when running locally).
 */
async function performSingleAdminBackendAttempt<T>(
  client: any,
  accessToken: string,
  payload: Record<string, unknown>
): Promise<AdminApiCallResult<T>> {
  let edgeNetworkOrServerError: string | null = null;
  let edgeHttpStatus = 0;

  // 1. Primary path: Supabase Edge Function `admin-users`
  try {
    const { data, error } = await client.functions.invoke('admin-users', {
      body: payload,
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    });

    if (!error && data && !data.error) {
      return {
        data: data as T,
        status: 200,
        error: null,
      };
    }

    if (error) {
      let errStatus = 500;
      let errBody: any = null;
      const isHttpError =
        'context' in error && error.context instanceof Response;

      if (isHttpError) {
        errStatus = error.context.status;
        edgeHttpStatus = errStatus;
        try {
          errBody = await error.context.clone().json();
        } catch {
          // Non-JSON error body
        }
      }

      // Explicit 401, 403, or 400 from the Edge Function
      if (errStatus === 401 || errStatus === 403 || errStatus === 400) {
        const isSecretMissing = errBody?.code === 'ADMIN_SECRET_NOT_CONFIGURED';
        return {
          data: null,
          status: errStatus,
          code:
            errBody?.code ||
            (errStatus === 403
              ? 'FORBIDDEN_NOT_ADMIN'
              : errStatus === 401
              ? 'UNAUTHENTICATED'
              : undefined),
          edgeDeploymentNeeded: isSecretMissing,
          isExplicitDenial: errStatus === 403 && !isSecretMissing,
          isTransientError: false,
          error:
            errBody?.error ||
            (errStatus === 403
              ? 'Forbidden: Your account is not in the CINEMAX_ADMIN_USER_ID allowlist.'
              : errStatus === 401
              ? 'Your authentication token expired or is invalid.'
              : 'Invalid admin request.'),
        };
      }

      // If Edge Function returned 5xx or a relay/fetch error (not 404 Function Not Found)
      if (errStatus !== 404) {
        edgeNetworkOrServerError =
          errBody?.error ||
          error.message ||
          `Temporary error communicating with admin-users Edge Function (HTTP ${errStatus}).`;
      } else {
        edgeHttpStatus = 404;
      }
    }
  } catch (err: any) {
    edgeNetworkOrServerError =
      err?.message || 'Network error while reaching the admin-users Edge Function.';
  }

  // 2. Fallback path: Local Express server `/api/admin/users` (when running server.ts locally)
  try {
    const res = await fetch(`${API_BASE_URL}/api/admin/users`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify(payload),
    });

    const contentType = res.headers.get('content-type') || '';
    if (contentType.includes('application/json')) {
      const json = await res.json();
      if (res.ok && !json.error) {
        return {
          data: json as T,
          status: res.status,
          error: null,
        };
      }

      const isDeploymentNeeded =
        res.status === 503 ||
        json.code === 'EDGE_FUNCTION_OR_SECRETS_NEEDED' ||
        json.code === 'ADMIN_SECRET_NOT_CONFIGURED';

      // If the Edge Function had a transient network/5xx error and local Express is unconfigured (503),
      // surface the transient Edge Function error so automatic retries can recover!
      if (isDeploymentNeeded && edgeNetworkOrServerError && edgeHttpStatus !== 404) {
        return {
          data: null,
          status: edgeHttpStatus >= 500 ? edgeHttpStatus : 502,
          code: 'TRANSIENT_ADMIN_ERROR',
          edgeDeploymentNeeded: false,
          isTransientError: true,
          error: edgeNetworkOrServerError,
        };
      }

      return {
        data: null,
        status: res.status,
        code: json.code,
        edgeDeploymentNeeded: isDeploymentNeeded,
        isExplicitDenial: res.status === 403 && !isDeploymentNeeded,
        isTransientError: res.status >= 500 && !isDeploymentNeeded,
        error:
          json.error ||
          'Admin backend returned an error. Ensure the `admin-users` Edge Function is deployed.',
      };
    }
  } catch {
    // Local `/api/admin/users` is unreachable (expected on GitHub Pages)
  }

  // If Edge Function failed due to a transient network/5xx error (not 404 missing function),
  // classify as a retryable transient error rather than claiming the Edge Function is not deployed!
  if (edgeNetworkOrServerError && edgeHttpStatus !== 404) {
    return {
      data: null,
      status: edgeHttpStatus >= 500 ? edgeHttpStatus : 502,
      code: 'TRANSIENT_ADMIN_ERROR',
      edgeDeploymentNeeded: false,
      isExplicitDenial: false,
      isTransientError: true,
      error: edgeNetworkOrServerError,
    };
  }

  return {
    data: null,
    status: 503,
    code: 'EDGE_FUNCTION_NOT_DEPLOYED',
    edgeDeploymentNeeded: true,
    isExplicitDenial: false,
    isTransientError: false,
    error:
      'The `admin-users` Supabase Edge Function could not be reached (HTTP 404). Verify it is deployed in your Supabase project.',
  };
}

/**
 * Invokes the privileged server-side `admin-users` Supabase Edge Function
 * (or local `/api/admin/users` server route) using the caller's live Supabase Auth session JWT.
 * Includes automatic 401 session revalidation and 3x exponential backoff for transient errors.
 */
async function invokeAdminBackend<T>(
  payload: Record<string, unknown>,
  options?: { retryDelaysMs?: number[] }
): Promise<AdminApiCallResult<T>> {
  const { client } = await ensureSupabaseClient();
  if (!client) {
    return {
      data: null,
      status: 503,
      code: 'SUPABASE_NOT_CONFIGURED',
      error:
        'Supabase is not configured. Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY to authenticate.',
    };
  }

  return executeAdminRequestWithResilience<T>({
    retryDelaysMs: options?.retryDelaysMs,
    getAccessToken: async () => {
      const { data: sessionData, error: sessionError } = await client.auth.getSession();
      const session = sessionData?.session;
      if (sessionError || !session?.access_token) {
        return null;
      }
      // If the token is expiring within the next 15 seconds, proactively refresh it
      const expiresAtMs = session.expires_at ? session.expires_at * 1000 : 0;
      if (expiresAtMs > 0 && expiresAtMs - Date.now() < 15_000) {
        const { data: refreshed } = await client.auth.refreshSession();
        if (refreshed?.session?.access_token) {
          return refreshed.session.access_token;
        }
      }
      return session.access_token;
    },
    refreshAccessToken: async () => {
      try {
        const { data: refreshed, error: refreshError } =
          await client.auth.refreshSession();
        if (!refreshError && refreshed?.session?.access_token) {
          return refreshed.session.access_token;
        }
        // Fallback: check getSession() again in case another tab/listener already refreshed it
        const { data: latest } = await client.auth.getSession();
        return latest?.session?.access_token || null;
      } catch {
        return null;
      }
    },
    executeSingleAttempt: (accessToken: string) =>
      performSingleAdminBackendAttempt<T>(client, accessToken, payload),
  });
}

export async function checkAdminAccess(options?: {
  retryDelaysMs?: number[];
}): Promise<{
  isAdmin: boolean;
  adminUserId?: string;
  status: number;
  code?: string;
  edgeDeploymentNeeded?: boolean;
  isExplicitDenial?: boolean;
  isTransientError?: boolean;
  retryAttempts?: number;
  error: string | null;
}> {
  const res = await invokeAdminBackend<{
    isAdmin: boolean;
    adminUserId: string;
    adminEmail: string | null;
  }>({ action: 'check_access' }, options);

  if (res.data?.isAdmin) {
    return {
      isAdmin: true,
      adminUserId: res.data.adminUserId,
      status: 200,
      retryAttempts: res.retryAttempts,
      error: null,
    };
  }

  return {
    isAdmin: false,
    status: res.status,
    code: res.code,
    edgeDeploymentNeeded: res.edgeDeploymentNeeded,
    isExplicitDenial: res.isExplicitDenial,
    isTransientError: res.isTransientError,
    retryAttempts: res.retryAttempts,
    error: res.error,
  };
}

export async function fetchAdminUsersList(params: {
  page?: number;
  perPage?: number;
  searchQuery?: string;
  statusFilter?: 'all' | 'confirmed' | 'unconfirmed' | 'suspended';
}): Promise<AdminApiCallResult<AdminListUsersResponse>> {
  return invokeAdminBackend<AdminListUsersResponse>({
    action: 'list_users',
    page: params.page || 1,
    perPage: params.perPage || 15,
    searchQuery: params.searchQuery || '',
    statusFilter: params.statusFilter || 'all',
  });
}

export async function fetchAdminUserDetail(
  targetUserId: string
): Promise<AdminApiCallResult<AdminUserDetailResponse>> {
  return invokeAdminBackend<AdminUserDetailResponse>({
    action: 'get_user_detail',
    targetUserId,
  });
}

export async function adminConfirmUserEmail(
  targetUserId: string
): Promise<AdminApiCallResult<{ success: boolean; message: string }>> {
  return invokeAdminBackend<{ success: boolean; message: string }>({
    action: 'confirm_email',
    targetUserId,
  });
}

export async function adminSendPasswordReset(
  targetUserId: string
): Promise<AdminApiCallResult<{ success: boolean; message: string }>> {
  const redirectTo =
    typeof window !== 'undefined'
      ? `${window.location.origin}${import.meta.env?.BASE_URL || '/'}`
      : undefined;
  return invokeAdminBackend<{ success: boolean; message: string }>({
    action: 'send_password_reset',
    targetUserId,
    redirectTo,
  });
}

export async function adminSuspendUser(
  targetUserId: string,
  duration: '24h' | '7d' | '30d' | 'indefinite'
): Promise<
  AdminApiCallResult<{
    success: boolean;
    bannedUntil: string | null;
    message: string;
  }>
> {
  return invokeAdminBackend<{
    success: boolean;
    bannedUntil: string | null;
    message: string;
  }>({
    action: 'suspend_user',
    targetUserId,
    duration,
  });
}

export async function adminRestoreUser(
  targetUserId: string
): Promise<AdminApiCallResult<{ success: boolean; message: string }>> {
  return invokeAdminBackend<{ success: boolean; message: string }>({
    action: 'restore_user',
    targetUserId,
  });
}

export async function adminDeleteUser(
  targetUserId: string
): Promise<AdminApiCallResult<{ success: boolean; message: string }>> {
  return invokeAdminBackend<{ success: boolean; message: string }>({
    action: 'delete_user',
    targetUserId,
    confirmDelete: true,
  });
}
