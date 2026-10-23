import { createClient, SupabaseClient } from '@supabase/supabase-js';

export const ADMIN_UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export const ALLOWED_BAN_DURATIONS: Record<string, string> = {
  '24h': '24h',
  '7d': '168h',
  '168h': '168h',
  '30d': '720h',
  '720h': '720h',
  indefinite: '876000h',
  '876000h': '876000h',
};

export interface SanitizedAdminUserSummary {
  id: string;
  email: string | null;
  createdAt: string | null;
  lastSignInAt: string | null;
  emailConfirmedAt: string | null;
  isEmailConfirmed: boolean;
  bannedUntil: string | null;
  isSuspended: boolean;
  isAdmin: boolean;
  displayName: string;
  username: string | null;
  avatarUrl: string | null;
}

export interface AdminOverviewStats {
  totalUsers: number;
  confirmedUsers: number;
  unconfirmedUsers: number;
  recentRegistrations7d: number;
  suspendedUsers: number;
}

export function parseAdminAllowlist(rawAllowlist: string | undefined): Set<string> {
  if (!rawAllowlist) return new Set();
  return new Set(
    rawAllowlist
      .split(',')
      .map((id) => id.trim().toLowerCase())
      .filter((id) => ADMIN_UUID_REGEX.test(id))
  );
}

export function isUserCurrentlySuspended(bannedUntil?: string | null): boolean {
  if (!bannedUntil) return false;
  const ts = new Date(bannedUntil).getTime();
  return Number.isFinite(ts) && ts > Date.now();
}

export function sanitizeAuthUserRecord(
  u: any,
  profileMap: Map<string, any>,
  adminAllowlist: Set<string>
): SanitizedAdminUserSummary {
  const prof = profileMap.get(u.id);
  const bannedUntil = u.banned_until || null;
  const isSuspended = isUserCurrentlySuspended(bannedUntil);
  return {
    id: u.id,
    email: u.email || null,
    createdAt: u.created_at || null,
    lastSignInAt: u.last_sign_in_at || null,
    emailConfirmedAt: u.email_confirmed_at || u.confirmed_at || null,
    isEmailConfirmed: Boolean(u.email_confirmed_at || u.confirmed_at),
    bannedUntil: isSuspended ? bannedUntil : null,
    isSuspended,
    isAdmin: adminAllowlist.has(String(u.id || '').toLowerCase()),
    displayName:
      prof?.display_name ||
      u.user_metadata?.display_name ||
      (u.email ? String(u.email).split('@')[0] : 'User'),
    username: prof?.username || null,
    avatarUrl: prof?.avatar_url || null,
  };
}

export function filterAndPaginateAdminUsers(params: {
  allUsers: SanitizedAdminUserSummary[];
  page?: number;
  perPage?: number;
  searchQuery?: string;
  statusFilter?: string;
}): {
  overview: AdminOverviewStats;
  users: SanitizedAdminUserSummary[];
  page: number;
  perPage: number;
  totalPages: number;
  totalResults: number;
} {
  const requestedPage = Math.max(1, Math.floor(params.page || 1));
  const requestedPerPage = Math.min(50, Math.max(1, Math.floor(params.perPage || 15)));
  const searchQuery = (params.searchQuery || '').trim().toLowerCase();
  const statusFilter = (params.statusFilter || 'all').trim();

  const sevenDaysAgoMs = Date.now() - 7 * 24 * 60 * 60 * 1000;
  const all = params.allUsers;

  const overview: AdminOverviewStats = {
    totalUsers: all.length,
    confirmedUsers: all.filter((u) => u.isEmailConfirmed).length,
    unconfirmedUsers: all.filter((u) => !u.isEmailConfirmed).length,
    recentRegistrations7d: all.filter((u) => {
      if (!u.createdAt) return false;
      const ts = new Date(u.createdAt).getTime();
      return Number.isFinite(ts) && ts >= sevenDaysAgoMs;
    }).length,
    suspendedUsers: all.filter((u) => u.isSuspended).length,
  };

  const filtered = all.filter((u) => {
    if (statusFilter === 'confirmed' && !u.isEmailConfirmed) return false;
    if (statusFilter === 'unconfirmed' && u.isEmailConfirmed) return false;
    if (statusFilter === 'suspended' && !u.isSuspended) return false;

    if (!searchQuery) return true;
    const emailMatch = (u.email || '').toLowerCase().includes(searchQuery);
    const idMatch = (u.id || '').toLowerCase().includes(searchQuery);
    const nameMatch = (u.displayName || '').toLowerCase().includes(searchQuery);
    const userMatch = (u.username || '').toLowerCase().includes(searchQuery);
    return emailMatch || idMatch || nameMatch || userMatch;
  });

  filtered.sort((a, b) => {
    const tA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
    const tB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
    return tB - tA;
  });

  const totalResults = filtered.length;
  const totalPages = Math.max(1, Math.ceil(totalResults / requestedPerPage));
  const safePage = Math.min(requestedPage, totalPages);
  const startIdx = (safePage - 1) * requestedPerPage;
  const pagedUsers = filtered.slice(startIdx, startIdx + requestedPerPage);

  return {
    overview,
    users: pagedUsers,
    page: safePage,
    perPage: requestedPerPage,
    totalPages,
    totalResults,
  };
}

export interface AdminRequestContext {
  authHeader?: string;
  body: Record<string, any>;
  env: {
    supabaseUrl?: string;
    supabaseAnonKey?: string;
    serviceRoleKey?: string;
    adminUserIdsRaw?: string;
  };
  /** Optional dependency injection for unit/security testing */
  clientsOverride?: {
    verifyTokenUser?: (
      token: string
    ) => Promise<{ user: { id: string; email?: string } | null; error: string | null }>;
    adminClient?: any;
    anonClient?: any;
  };
}

export interface AdminResponsePayload {
  status: number;
  body: Record<string, any>;
}

/**
 * Core server-side admin request processor shared by local Express `/api/admin/users`
 * and matching the exact behavior of `supabase/functions/admin-users/index.ts`.
 */
export async function processAdminRequest(
  ctx: AdminRequestContext
): Promise<AdminResponsePayload> {
  const supabaseUrl = (ctx.env.supabaseUrl || '').trim();
  const supabaseAnonKey = (ctx.env.supabaseAnonKey || '').trim();
  const serviceRoleKey = (ctx.env.serviceRoleKey || '').trim();
  const adminAllowlist = parseAdminAllowlist(ctx.env.adminUserIdsRaw);

  if (!ctx.clientsOverride && (!supabaseUrl || !supabaseAnonKey || !serviceRoleKey)) {
    return {
      status: 503,
      body: {
        error:
          'Server admin credentials (SUPABASE_SERVICE_ROLE_KEY / CINEMAX_ADMIN_USER_ID) are not configured on this host. Deploy the Supabase Edge Function `admin-users` or configure server secrets.',
        code: 'EDGE_FUNCTION_OR_SECRETS_NEEDED',
      },
    };
  }

  // 1. Verify Bearer token
  const authHeader = ctx.authHeader || '';
  const token = authHeader.replace(/^Bearer\s+/i, '').trim();
  if (!token) {
    return {
      status: 401,
      body: {
        error: 'Authentication required. Missing Bearer access token.',
        code: 'UNAUTHENTICATED',
      },
    };
  }

  let callerUser: { id: string; email?: string } | null = null;
  let anonClient: SupabaseClient | any = ctx.clientsOverride?.anonClient;

  if (ctx.clientsOverride?.verifyTokenUser) {
    const verified = await ctx.clientsOverride.verifyTokenUser(token);
    if (verified.error || !verified.user) {
      return {
        status: 401,
        body: {
          error:
            verified.error ||
            'Invalid or expired authentication session. Please sign in again.',
          code: 'UNAUTHENTICATED',
        },
      };
    }
    callerUser = verified.user;
  } else {
    anonClient = createClient(supabaseUrl, supabaseAnonKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const {
      data: { user },
      error: callerError,
    } = await anonClient.auth.getUser(token);
    if (callerError || !user) {
      return {
        status: 401,
        body: {
          error: 'Invalid or expired authentication session. Please sign in again.',
          code: 'UNAUTHENTICATED',
        },
      };
    }
    callerUser = { id: user.id, email: user.email };
  }

  // 2. Independently verify caller's UUID against CINEMAX_ADMIN_USER_ID allowlist
  if (adminAllowlist.size === 0) {
    return {
      status: 403,
      body: {
        error:
          'Administrator allowlist secret CINEMAX_ADMIN_USER_ID is not configured on the server.',
        code: 'ADMIN_SECRET_NOT_CONFIGURED',
      },
    };
  }

  const callerIdLower = callerUser.id.toLowerCase();
  if (!adminAllowlist.has(callerIdLower)) {
    return {
      status: 403,
      body: {
        error:
          'Forbidden: Your account is not authorized to access the CineMax Admin Dashboard.',
        code: 'FORBIDDEN_NOT_ADMIN',
      },
    };
  }

  const action = String(ctx.body?.action || '').trim();

  if (action === 'check_access') {
    return {
      status: 200,
      body: {
        isAdmin: true,
        adminUserId: callerUser.id,
        adminEmail: callerUser.email || null,
      },
    };
  }

  const adminClient: SupabaseClient | any =
    ctx.clientsOverride?.adminClient ||
    createClient(supabaseUrl, serviceRoleKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

  async function recordAuditLog(params: {
    targetUserId: string;
    targetEmail?: string | null;
    auditAction:
      | 'suspend_user'
      | 'restore_user'
      | 'delete_user'
      | 'confirm_email'
      | 'send_password_reset';
    details?: Record<string, unknown>;
  }) {
    try {
      await adminClient.from('admin_audit_logs').insert({
        admin_user_id: callerUser!.id,
        admin_email: callerUser!.email || null,
        target_user_id: params.targetUserId,
        target_email: params.targetEmail || null,
        action: params.auditAction,
        details: params.details || {},
      });
    } catch {
      // Non-fatal if audit table hasn't been created yet
    }
  }

  if (action === 'list_users') {
    const { data: listData, error: listError } =
      await adminClient.auth.admin.listUsers({
        page: 1,
        perPage: 1000,
      });

    if (listError) {
      return {
        status: 500,
        body: { error: `Failed to list Auth users: ${listError.message}` },
      };
    }

    const rawUsers = listData?.users || [];
    const userIds = rawUsers.map((u: any) => u.id);

    const profileMap = new Map<string, any>();
    if (userIds.length > 0) {
      const { data: profilesData } = await adminClient
        .from('profiles')
        .select('id, display_name, username, avatar_url')
        .in('id', userIds.slice(0, 500));
      for (const p of profilesData || []) {
        profileMap.set(p.id, p);
      }
    }

    const allSanitized = rawUsers.map((u: any) =>
      sanitizeAuthUserRecord(u, profileMap, adminAllowlist)
    );

    const result = filterAndPaginateAdminUsers({
      allUsers: allSanitized,
      page: Number(ctx.body.page || 1),
      perPage: Math.min(50, Math.max(1, Number(ctx.body.perPage || 15))),
      searchQuery: String(ctx.body.searchQuery || ctx.body.search || ''),
      statusFilter: String(ctx.body.statusFilter || ctx.body.filter || 'all'),
    });

    let recentAuditLogs: any[] = [];
    try {
      const { data: logs } = await adminClient
        .from('admin_audit_logs')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(15);
      if (Array.isArray(logs)) {
        recentAuditLogs = logs;
      }
    } catch {
      // Ignore if audit table not yet migrated
    }

    return {
      status: 200,
      body: {
        ...result,
        adminUserId: callerUser.id,
        recentAuditLogs,
      },
    };
  }

  if (action === 'get_user_detail') {
    const targetUserId = String(ctx.body.targetUserId || '').trim();
    if (!ADMIN_UUID_REGEX.test(targetUserId)) {
      return {
        status: 400,
        body: { error: 'Valid targetUserId UUID is required.' },
      };
    }

    const { data: userRes, error: userErr } =
      await adminClient.auth.admin.getUserById(targetUserId);

    if (userErr || !userRes?.user) {
      return {
        status: 404,
        body: { error: `User not found: ${userErr?.message || 'Unknown user'}` },
      };
    }

    const authUser = userRes.user;

    const [
      profileRes,
      watchlistCountRes,
      favouritesCountRes,
      historyCountRes,
      episodesCountRes,
      auditLogsRes,
    ] = await Promise.all([
      adminClient
        .from('profiles')
        .select(
          'id, display_name, username, avatar_url, favorite_genres, created_at, updated_at'
        )
        .eq('id', targetUserId)
        .maybeSingle(),
      adminClient
        .from('watchlist_items')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', targetUserId),
      adminClient
        .from('watchlist_items')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', targetUserId)
        .eq('is_favourite', true),
      adminClient
        .from('watch_history')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', targetUserId),
      adminClient
        .from('watched_episodes')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', targetUserId),
      adminClient
        .from('admin_audit_logs')
        .select('*')
        .eq('target_user_id', targetUserId)
        .order('created_at', { ascending: false })
        .limit(10),
    ]);

    const prof = profileRes.data;
    const profileMap = new Map<string, any>();
    if (prof) profileMap.set(targetUserId, prof);

    return {
      status: 200,
      body: {
        user: sanitizeAuthUserRecord(authUser, profileMap, adminAllowlist),
        profile: prof
          ? {
              displayName: prof.display_name || null,
              username: prof.username || null,
              avatarUrl: prof.avatar_url || null,
              favoriteGenres: Array.isArray(prof.favorite_genres)
                ? prof.favorite_genres
                : [],
              createdAt: prof.created_at || null,
              updatedAt: prof.updated_at || null,
            }
          : null,
        stats: {
          watchlistCount: watchlistCountRes.count ?? 0,
          favouritesCount: favouritesCountRes.count ?? 0,
          watchedHistoryCount: historyCountRes.count ?? 0,
          watchedEpisodesCount: episodesCountRes.count ?? 0,
        },
        auditLogs: Array.isArray(auditLogsRes.data) ? auditLogsRes.data : [],
      },
    };
  }

  if (action === 'confirm_email') {
    const targetUserId = String(ctx.body.targetUserId || '').trim();
    if (!ADMIN_UUID_REGEX.test(targetUserId)) {
      return {
        status: 400,
        body: { error: 'Valid targetUserId UUID is required.' },
      };
    }

    const { data: updated, error: updateErr } =
      await adminClient.auth.admin.updateUserById(targetUserId, {
        email_confirm: true,
      });

    if (updateErr || !updated?.user) {
      return {
        status: 500,
        body: {
          error: `Failed to confirm user email: ${
            updateErr?.message || 'Unknown error'
          }`,
        },
      };
    }

    await recordAuditLog({
      targetUserId,
      targetEmail: updated.user.email || null,
      auditAction: 'confirm_email',
      details: { confirmedByAdmin: true },
    });

    return {
      status: 200,
      body: {
        success: true,
        message: `Email confirmed for ${updated.user.email || targetUserId}.`,
      },
    };
  }

  if (action === 'send_password_reset') {
    const targetUserId = String(ctx.body.targetUserId || '').trim();
    const redirectTo = String(ctx.body.redirectTo || '').trim() || undefined;
    if (!ADMIN_UUID_REGEX.test(targetUserId)) {
      return {
        status: 400,
        body: { error: 'Valid targetUserId UUID is required.' },
      };
    }

    const { data: userRes, error: userErr } =
      await adminClient.auth.admin.getUserById(targetUserId);

    if (userErr || !userRes?.user?.email) {
      return {
        status: 400,
        body: {
          error:
            userErr?.message ||
            'Target user does not have a valid email address for password reset.',
        },
      };
    }

    const targetEmail = userRes.user.email;
    const { error: resetErr } = await anonClient.auth.resetPasswordForEmail(
      targetEmail,
      redirectTo ? { redirectTo } : undefined
    );

    if (resetErr) {
      return {
        status: 500,
        body: { error: `Failed to send password reset email: ${resetErr.message}` },
      };
    }

    await recordAuditLog({
      targetUserId,
      targetEmail,
      auditAction: 'send_password_reset',
      details: { emailSent: true },
    });

    return {
      status: 200,
      body: {
        success: true,
        message: `Password reset email dispatched to ${targetEmail}.`,
      },
    };
  }

  if (action === 'suspend_user') {
    const targetUserId = String(ctx.body.targetUserId || '').trim();
    const durationKey = String(ctx.body.duration || '24h').trim();

    if (!ADMIN_UUID_REGEX.test(targetUserId)) {
      return {
        status: 400,
        body: { error: 'Valid targetUserId UUID is required.' },
      };
    }

    if (
      targetUserId.toLowerCase() === callerIdLower ||
      adminAllowlist.has(targetUserId.toLowerCase())
    ) {
      return {
        status: 400,
        body: {
          error:
            'Self-protection rule: Administrator accounts cannot be suspended.',
          code: 'ADMIN_SELF_PROTECTION',
        },
      };
    }

    const banDuration = ALLOWED_BAN_DURATIONS[durationKey];
    if (!banDuration) {
      return {
        status: 400,
        body: {
          error:
            'Invalid suspension duration. Allowed values: 24h, 7d, 30d, indefinite.',
        },
      };
    }

    const { data: updated, error: updateErr } =
      await adminClient.auth.admin.updateUserById(targetUserId, {
        ban_duration: banDuration,
      });

    if (updateErr || !updated?.user) {
      return {
        status: 500,
        body: {
          error: `Failed to suspend user account: ${
            updateErr?.message || 'Unknown error'
          }`,
        },
      };
    }

    await recordAuditLog({
      targetUserId,
      targetEmail: updated.user.email || null,
      auditAction: 'suspend_user',
      details: {
        durationKey,
        banDuration,
        bannedUntil: updated.user.banned_until || null,
      },
    });

    return {
      status: 200,
      body: {
        success: true,
        bannedUntil: updated.user.banned_until || null,
        message: `Account suspended (${durationKey}). New sign-ins and token refreshes are blocked immediately; any active short-lived JWT remains valid until its natural expiry.`,
      },
    };
  }

  if (action === 'restore_user') {
    const targetUserId = String(ctx.body.targetUserId || '').trim();
    if (!ADMIN_UUID_REGEX.test(targetUserId)) {
      return {
        status: 400,
        body: { error: 'Valid targetUserId UUID is required.' },
      };
    }

    const { data: updated, error: updateErr } =
      await adminClient.auth.admin.updateUserById(targetUserId, {
        ban_duration: 'none',
      });

    if (updateErr || !updated?.user) {
      return {
        status: 500,
        body: {
          error: `Failed to restore user account: ${
            updateErr?.message || 'Unknown error'
          }`,
        },
      };
    }

    await recordAuditLog({
      targetUserId,
      targetEmail: updated.user.email || null,
      auditAction: 'restore_user',
      details: { restored: true },
    });

    return {
      status: 200,
      body: {
        success: true,
        message: `Account access restored for ${updated.user.email || targetUserId}.`,
      },
    };
  }

  if (action === 'delete_user') {
    const targetUserId = String(ctx.body.targetUserId || '').trim();
    const confirmDelete = Boolean(ctx.body.confirmDelete);

    if (!ADMIN_UUID_REGEX.test(targetUserId)) {
      return {
        status: 400,
        body: { error: 'Valid targetUserId UUID is required.' },
      };
    }

    if (!confirmDelete) {
      return {
        status: 400,
        body: { error: 'Explicit confirmation (confirmDelete: true) is required.' },
      };
    }

    if (
      targetUserId.toLowerCase() === callerIdLower ||
      adminAllowlist.has(targetUserId.toLowerCase())
    ) {
      return {
        status: 400,
        body: {
          error:
            'Self-protection rule: Administrator accounts cannot be deleted.',
          code: 'ADMIN_SELF_PROTECTION',
        },
      };
    }

    const { data: existingUser } =
      await adminClient.auth.admin.getUserById(targetUserId);
    const targetEmail = existingUser?.user?.email || null;

    try {
      const { data: files } = await adminClient.storage
        .from('avatars')
        .list(targetUserId);
      if (Array.isArray(files) && files.length > 0) {
        const paths = files.map((f: any) => `${targetUserId}/${f.name}`);
        await adminClient.storage.from('avatars').remove(paths);
      }
    } catch {
      // Ignore storage cleanup error if user had no avatars
    }

    const { error: deleteErr } =
      await adminClient.auth.admin.deleteUser(targetUserId);

    if (deleteErr) {
      return {
        status: 500,
        body: { error: `Failed to delete user account: ${deleteErr.message}` },
      };
    }

    await recordAuditLog({
      targetUserId,
      targetEmail,
      auditAction: 'delete_user',
      details: { cascadeDeleted: true },
    });

    return {
      status: 200,
      body: {
        success: true,
        message: `User account ${targetEmail || targetUserId} permanently deleted along with cascaded profile and library records.`,
      },
    };
  }

  return {
    status: 400,
    body: { error: `Unsupported admin action: ${action}` },
  };
}
