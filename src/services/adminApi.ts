import { ensureSupabaseClient } from './supabaseClient';
import type {
  AdminOverviewStats,
  SanitizedAdminUserSummary,
} from '../server/adminHandler';

export type { AdminOverviewStats, SanitizedAdminUserSummary };

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

const API_BASE_URL = (import.meta.env?.VITE_API_BASE_URL || '').replace(/\/$/, '');

/**
 * Invokes the privileged server-side `admin-users` Supabase Edge Function
 * (or local `/api/admin/users` server route) using the caller's live Supabase Auth session JWT.
 * Never uses a service_role key on the client.
 */
async function invokeAdminBackend<T>(
  payload: Record<string, unknown>
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

  const { data: sessionData, error: sessionError } = await client.auth.getSession();
  const accessToken = sessionData?.session?.access_token;

  if (sessionError || !accessToken) {
    return {
      data: null,
      status: 401,
      code: 'UNAUTHENTICATED',
      error: 'Authentication required. Please sign in with your administrator account.',
    };
  }

  // 1. Primary path: Supabase Edge Function `admin-users` (works on GitHub Pages and everywhere)
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
      // Extract HTTP status code and JSON body from FunctionsHttpError if available
      let errStatus = 500;
      let errBody: any = null;
      if ('context' in error && error.context instanceof Response) {
        errStatus = error.context.status;
        try {
          errBody = await error.context.clone().json();
        } catch {
          // Non-JSON response body
        }
      }

      // If 401 or 403 was explicitly returned by the Edge Function, return it immediately!
      if (errStatus === 401 || errStatus === 403 || errStatus === 400) {
        return {
          data: null,
          status: errStatus,
          code: errBody?.code || (errStatus === 403 ? 'FORBIDDEN_NOT_ADMIN' : undefined),
          edgeDeploymentNeeded: errBody?.code === 'ADMIN_SECRET_NOT_CONFIGURED',
          error:
            errBody?.error ||
            (errStatus === 403
              ? 'Forbidden: Your account is not in the CINEMAX_ADMIN_USER_ID allowlist.'
              : 'Unauthorized request.'),
        };
      }
    }
  } catch {
    // Fall through to check local `/api/admin/users` server route
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

      return {
        data: null,
        status: res.status,
        code: json.code,
        edgeDeploymentNeeded: isDeploymentNeeded,
        error:
          json.error ||
          'Admin backend returned an error. Ensure the `admin-users` Edge Function is deployed.',
      };
    }
  } catch {
    // Both Edge Function and local server route were unreachable
  }

  return {
    data: null,
    status: 503,
    code: 'EDGE_FUNCTION_NOT_DEPLOYED',
    edgeDeploymentNeeded: true,
    error:
      'The `admin-users` Supabase Edge Function is not deployed yet (or CINEMAX_ADMIN_USER_ID is not set). Follow the deployment steps below to activate server-side admin operations.',
  };
}

export async function checkAdminAccess(): Promise<{
  isAdmin: boolean;
  adminUserId?: string;
  status: number;
  code?: string;
  edgeDeploymentNeeded?: boolean;
  error: string | null;
}> {
  const res = await invokeAdminBackend<{
    isAdmin: boolean;
    adminUserId: string;
    adminEmail: string | null;
  }>({ action: 'check_access' });

  if (res.data?.isAdmin) {
    return {
      isAdmin: true,
      adminUserId: res.data.adminUserId,
      status: 200,
      error: null,
    };
  }

  return {
    isAdmin: false,
    status: res.status,
    code: res.code,
    edgeDeploymentNeeded: res.edgeDeploymentNeeded,
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
