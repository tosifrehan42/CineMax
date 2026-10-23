// ============================================================================
// CineMax Secure Admin API — Supabase Edge Function (`admin-users`)
// Runtime: Supabase Edge Functions (Deno)
//
// Required Server-Side Secrets:
// - SUPABASE_URL (auto-injected by Supabase Edge runtime)
// - SUPABASE_ANON_KEY (auto-injected by Supabase Edge runtime)
// - SUPABASE_SERVICE_ROLE_KEY (auto-injected by Supabase Edge runtime; NEVER exposed to client)
// - CINEMAX_ADMIN_USER_ID (set via `supabase secrets set CINEMAX_ADMIN_USER_ID="<your-auth-uuid>"`)
// ============================================================================

import { createClient } from 'npm:@supabase/supabase-js@2';

const CORS_HEADERS: Record<string, string> = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const ALLOWED_BAN_DURATIONS: Record<string, string> = {
  '24h': '24h',
  '7d': '168h',
  '168h': '168h',
  '30d': '720h',
  '720h': '720h',
  indefinite: '876000h', // ~100 years
  '876000h': '876000h',
};

function jsonResponse(body: Record<string, unknown>, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...CORS_HEADERS,
      'Content-Type': 'application/json',
    },
  });
}

function parseAdminAllowlist(rawAllowlist: string | undefined): Set<string> {
  if (!rawAllowlist) return new Set();
  return new Set(
    rawAllowlist
      .split(',')
      .map((id) => id.trim().toLowerCase())
      .filter((id) => UUID_REGEX.test(id))
  );
}

function isUserCurrentlySuspended(bannedUntil?: string | null): boolean {
  if (!bannedUntil) return false;
  const ts = new Date(bannedUntil).getTime();
  return Number.isFinite(ts) && ts > Date.now();
}

function sanitizeAuthUser(
  u: any,
  profileMap: Map<string, any>,
  adminAllowlist: Set<string>
) {
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

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: CORS_HEADERS });
  }

  if (req.method !== 'POST') {
    return jsonResponse({ error: 'Method not allowed. Use POST.' }, 405);
  }

  const supabaseUrl = (Deno.env.get('SUPABASE_URL') || '').trim();
  const supabaseAnonKey = (Deno.env.get('SUPABASE_ANON_KEY') || '').trim();
  const serviceRoleKey = (Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '').trim();
  const adminAllowlistRaw = Deno.env.get('CINEMAX_ADMIN_USER_ID') || '';
  const adminAllowlist = parseAdminAllowlist(adminAllowlistRaw);

  if (!supabaseUrl || !supabaseAnonKey || !serviceRoleKey) {
    return jsonResponse(
      {
        error:
          'Server configuration incomplete: SUPABASE_URL, SUPABASE_ANON_KEY, and SUPABASE_SERVICE_ROLE_KEY are required on the Edge Function.',
        code: 'SERVER_CONFIG_MISSING',
      },
      500
    );
  }

  // 1. Extract and verify caller's Bearer JWT
  const authHeader = req.headers.get('Authorization') || '';
  const token = authHeader.replace(/^Bearer\s+/i, '').trim();
  if (!token) {
    return jsonResponse(
      {
        error: 'Authentication required. Missing Bearer access token.',
        code: 'UNAUTHENTICATED',
      },
      401
    );
  }

  const anonClient = createClient(supabaseUrl, supabaseAnonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const {
    data: { user: callerUser },
    error: callerError,
  } = await anonClient.auth.getUser(token);

  if (callerError || !callerUser) {
    return jsonResponse(
      {
        error: 'Invalid or expired authentication session. Please sign in again.',
        code: 'UNAUTHENTICATED',
      },
      401
    );
  }

  // 2. Verify CINEMAX_ADMIN_USER_ID allowlist on EVERY request
  if (adminAllowlist.size === 0) {
    return jsonResponse(
      {
        error:
          'Administrator allowlist secret CINEMAX_ADMIN_USER_ID is not configured on the Edge Function.',
        code: 'ADMIN_SECRET_NOT_CONFIGURED',
      },
      403
    );
  }

  const callerIdLower = callerUser.id.toLowerCase();
  if (!adminAllowlist.has(callerIdLower)) {
    return jsonResponse(
      {
        error:
          'Forbidden: Your account is not authorized to access the CineMax Admin Dashboard.',
        code: 'FORBIDDEN_NOT_ADMIN',
      },
      403
    );
  }

  // 3. Parse request body
  let body: Record<string, any> = {};
  try {
    body = await req.json();
  } catch {
    return jsonResponse({ error: 'Invalid JSON request body.' }, 400);
  }

  const action = String(body.action || '').trim();

  // Lightweight access check
  if (action === 'check_access') {
    return jsonResponse({
      isAdmin: true,
      adminUserId: callerUser.id,
      adminEmail: callerUser.email || null,
    });
  }

  // Create privileged service-role client ONLY after caller is verified as admin
  const adminClient = createClient(supabaseUrl, serviceRoleKey, {
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
      // Non-fatal if admin_audit_logs migration hasn't been executed yet
    }
  }

  // ==========================================================================
  // ACTION: list_users
  // ==========================================================================
  if (action === 'list_users') {
    const requestedPage = Math.max(1, parseInt(String(body.page || '1'), 10) || 1);
    const requestedPerPage = Math.min(
      50,
      Math.max(5, parseInt(String(body.perPage || '15'), 10) || 15)
    );
    const searchQuery = String(body.searchQuery || '')
      .trim()
      .toLowerCase();
    const statusFilter = String(body.statusFilter || 'all').trim();

    // Fetch up to 1,000 Auth users so we can compute accurate overview KPIs & search across email/UUID/username
    const { data: listData, error: listError } =
      await adminClient.auth.admin.listUsers({
        page: 1,
        perPage: 1000,
      });

    if (listError) {
      return jsonResponse(
        { error: `Failed to list Auth users: ${listError.message}` },
        500
      );
    }

    const rawUsers = listData?.users || [];
    const userIds = rawUsers.map((u: any) => u.id);

    // Fetch basic profile fields for display_name & username matching
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
      sanitizeAuthUser(u, profileMap, adminAllowlist)
    );

    // Compute overview KPIs across all users
    const sevenDaysAgoMs = Date.now() - 7 * 24 * 60 * 60 * 1000;
    const overview = {
      totalUsers: allSanitized.length,
      confirmedUsers: allSanitized.filter((u) => u.isEmailConfirmed).length,
      unconfirmedUsers: allSanitized.filter((u) => !u.isEmailConfirmed).length,
      recentRegistrations7d: allSanitized.filter((u) => {
        if (!u.createdAt) return false;
        const ts = new Date(u.createdAt).getTime();
        return Number.isFinite(ts) && ts >= sevenDaysAgoMs;
      }).length,
      suspendedUsers: allSanitized.filter((u) => u.isSuspended).length,
    };

    // Filter by status & search query
    const filtered = allSanitized.filter((u) => {
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

    // Sort newest registrations first
    filtered.sort((a, b) => {
      const tA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
      const tB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
      return tB - tA;
    });

    const totalFiltered = filtered.length;
    const totalPages = Math.max(1, Math.ceil(totalFiltered / requestedPerPage));
    const safePage = Math.min(requestedPage, totalPages);
    const startIdx = (safePage - 1) * requestedPerPage;
    const pagedUsers = filtered.slice(startIdx, startIdx + requestedPerPage);

    // Fetch latest 15 audit log entries if table exists
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
      // Ignore if audit table not yet created
    }

    return jsonResponse({
      overview,
      users: pagedUsers,
      page: safePage,
      perPage: requestedPerPage,
      totalPages,
      totalResults: totalFiltered,
      adminUserId: callerUser.id,
      recentAuditLogs,
    });
  }

  // ==========================================================================
  // ACTION: get_user_detail
  // ==========================================================================
  if (action === 'get_user_detail') {
    const targetUserId = String(body.targetUserId || '').trim();
    if (!UUID_REGEX.test(targetUserId)) {
      return jsonResponse({ error: 'Valid targetUserId UUID is required.' }, 400);
    }

    const { data: userRes, error: userErr } =
      await adminClient.auth.admin.getUserById(targetUserId);

    if (userErr || !userRes?.user) {
      return jsonResponse(
        { error: `User not found: ${userErr?.message || 'Unknown user'}` },
        404
      );
    }

    const authUser = userRes.user;

    // Fetch permitted profile fields + privacy-safe aggregate counts only
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

    return jsonResponse({
      user: sanitizeAuthUser(authUser, profileMap, adminAllowlist),
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
    });
  }

  // ==========================================================================
  // ACTION: confirm_email
  // ==========================================================================
  if (action === 'confirm_email') {
    const targetUserId = String(body.targetUserId || '').trim();
    if (!UUID_REGEX.test(targetUserId)) {
      return jsonResponse({ error: 'Valid targetUserId UUID is required.' }, 400);
    }

    const { data: updated, error: updateErr } =
      await adminClient.auth.admin.updateUserById(targetUserId, {
        email_confirm: true,
      });

    if (updateErr || !updated?.user) {
      return jsonResponse(
        {
          error: `Failed to confirm user email: ${
            updateErr?.message || 'Unknown error'
          }`,
        },
        500
      );
    }

    await recordAuditLog({
      targetUserId,
      targetEmail: updated.user.email || null,
      auditAction: 'confirm_email',
      details: { confirmedByAdmin: true },
    });

    return jsonResponse({
      success: true,
      message: `Email confirmed for ${updated.user.email || targetUserId}.`,
    });
  }

  // ==========================================================================
  // ACTION: send_password_reset
  // ==========================================================================
  if (action === 'send_password_reset') {
    const targetUserId = String(body.targetUserId || '').trim();
    const redirectTo = String(body.redirectTo || '').trim() || undefined;
    if (!UUID_REGEX.test(targetUserId)) {
      return jsonResponse({ error: 'Valid targetUserId UUID is required.' }, 400);
    }

    const { data: userRes, error: userErr } =
      await adminClient.auth.admin.getUserById(targetUserId);

    if (userErr || !userRes?.user?.email) {
      return jsonResponse(
        {
          error:
            userErr?.message ||
            'Target user does not have a valid email address for password reset.',
        },
        400
      );
    }

    const targetEmail = userRes.user.email;
    const { error: resetErr } = await anonClient.auth.resetPasswordForEmail(
      targetEmail,
      redirectTo ? { redirectTo } : undefined
    );

    if (resetErr) {
      return jsonResponse(
        { error: `Failed to send password reset email: ${resetErr.message}` },
        500
      );
    }

    await recordAuditLog({
      targetUserId,
      targetEmail,
      auditAction: 'send_password_reset',
      details: { emailSent: true },
    });

    return jsonResponse({
      success: true,
      message: `Password reset email dispatched to ${targetEmail}.`,
    });
  }

  // ==========================================================================
  // ACTION: suspend_user
  // ==========================================================================
  if (action === 'suspend_user') {
    const targetUserId = String(body.targetUserId || '').trim();
    const durationKey = String(body.duration || '24h').trim();

    if (!UUID_REGEX.test(targetUserId)) {
      return jsonResponse({ error: 'Valid targetUserId UUID is required.' }, 400);
    }

    // Protect administrator from suspending their own account
    if (
      targetUserId.toLowerCase() === callerIdLower ||
      adminAllowlist.has(targetUserId.toLowerCase())
    ) {
      return jsonResponse(
        {
          error:
            'Self-protection rule: Administrator accounts cannot be suspended.',
          code: 'ADMIN_SELF_PROTECTION',
        },
        400
      );
    }

    const banDuration = ALLOWED_BAN_DURATIONS[durationKey];
    if (!banDuration) {
      return jsonResponse(
        {
          error:
            'Invalid suspension duration. Allowed values: 24h, 7d, 30d, indefinite.',
        },
        400
      );
    }

    const { data: updated, error: updateErr } =
      await adminClient.auth.admin.updateUserById(targetUserId, {
        ban_duration: banDuration,
      });

    if (updateErr || !updated?.user) {
      return jsonResponse(
        {
          error: `Failed to suspend user account: ${
            updateErr?.message || 'Unknown error'
          }`,
        },
        500
      );
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

    return jsonResponse({
      success: true,
      bannedUntil: updated.user.banned_until || null,
      message: `Account suspended (${durationKey}). New sign-ins and token refreshes are blocked immediately; any active short-lived JWT remains valid until its natural expiry.`,
    });
  }

  // ==========================================================================
  // ACTION: restore_user
  // ==========================================================================
  if (action === 'restore_user') {
    const targetUserId = String(body.targetUserId || '').trim();
    if (!UUID_REGEX.test(targetUserId)) {
      return jsonResponse({ error: 'Valid targetUserId UUID is required.' }, 400);
    }

    const { data: updated, error: updateErr } =
      await adminClient.auth.admin.updateUserById(targetUserId, {
        ban_duration: 'none',
      });

    if (updateErr || !updated?.user) {
      return jsonResponse(
        {
          error: `Failed to restore user account: ${
            updateErr?.message || 'Unknown error'
          }`,
        },
        500
      );
    }

    await recordAuditLog({
      targetUserId,
      targetEmail: updated.user.email || null,
      auditAction: 'restore_user',
      details: { restored: true },
    });

    return jsonResponse({
      success: true,
      message: `Account access restored for ${updated.user.email || targetUserId}.`,
    });
  }

  // ==========================================================================
  // ACTION: delete_user
  // ==========================================================================
  if (action === 'delete_user') {
    const targetUserId = String(body.targetUserId || '').trim();
    const confirmDelete = Boolean(body.confirmDelete);

    if (!UUID_REGEX.test(targetUserId)) {
      return jsonResponse({ error: 'Valid targetUserId UUID is required.' }, 400);
    }

    if (!confirmDelete) {
      return jsonResponse(
        { error: 'Explicit confirmation (confirmDelete: true) is required.' },
        400
      );
    }

    // Protect administrator from deleting their own account
    if (
      targetUserId.toLowerCase() === callerIdLower ||
      adminAllowlist.has(targetUserId.toLowerCase())
    ) {
      return jsonResponse(
        {
          error:
            'Self-protection rule: Administrator accounts cannot be deleted.',
          code: 'ADMIN_SELF_PROTECTION',
        },
        400
      );
    }

    // Look up email for audit log before deletion
    const { data: existingUser } =
      await adminClient.auth.admin.getUserById(targetUserId);
    const targetEmail = existingUser?.user?.email || null;

    // Best-effort cleanup of user's avatar files inside `avatars/<targetUserId>/`
    try {
      const { data: files } = await adminClient.storage
        .from('avatars')
        .list(targetUserId);
      if (Array.isArray(files) && files.length > 0) {
        const paths = files.map((f: any) => `${targetUserId}/${f.name}`);
        await adminClient.storage.from('avatars').remove(paths);
      }
    } catch {
      // Continue with Auth user deletion even if no storage folder exists
    }

    const { error: deleteErr } =
      await adminClient.auth.admin.deleteUser(targetUserId);

    if (deleteErr) {
      return jsonResponse(
        { error: `Failed to delete user account: ${deleteErr.message}` },
        500
      );
    }

    await recordAuditLog({
      targetUserId,
      targetEmail,
      auditAction: 'delete_user',
      details: { cascadeDeleted: true },
    });

    return jsonResponse({
      success: true,
      message: `User account ${targetEmail || targetUserId} permanently deleted along with cascaded profile and library records.`,
    });
  }

  return jsonResponse({ error: `Unsupported admin action: ${action}` }, 400);
});
