-- ============================================================================
-- CineMax Admin Dashboard — Audit Log Table Migration (`public.admin_audit_logs`)
-- Run this non-destructive script in your Supabase SQL Editor.
--
-- Security & Privacy Design:
-- 1. Row-Level Security (RLS) is enabled with NO client-facing policies.
--    Ordinary `anon` and `authenticated` clients cannot read, insert, update,
--    or delete rows in `public.admin_audit_logs`.
-- 2. Only the server-side `admin-users` Supabase Edge Function (after verifying
--    the caller's JWT and confirming `auth.uid()` is in `CINEMAX_ADMIN_USER_ID`)
--    writes and reads audit logs using its server-side client.
-- 3. Passwords, tokens, and secret keys are never stored in this table.
-- ============================================================================

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

-- Enable strict Row-Level Security (RLS) with zero anon/authenticated policies
ALTER TABLE public.admin_audit_logs ENABLE ROW LEVEL SECURITY;

-- Explicitly drop any accidental client policies if re-running
DROP POLICY IF EXISTS "Deny all client access to admin_audit_logs" ON public.admin_audit_logs;
