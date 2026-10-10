-- Safe Neon / PostgreSQL diagnostics for Moat RLS readiness.
-- Run against staging with a read-capable role. Do not paste connection
-- strings or role passwords into tickets, commits, or logs.
--
-- Example:
--   psql "$DIRECT_URL" -f apps/api/scripts/inspect-rls-roles.sql

\echo '=== Current session identity ==='
SELECT current_user, session_user, current_database();

\echo '=== Role privileges (no passwords) ==='
SELECT
  rolname,
  rolsuper,
  rolbypassrls,
  rolcanlogin,
  rolcreaterole,
  rolcreatedb
FROM pg_roles
WHERE rolname IN (current_user, 'moat_app', 'neondb_owner')
   OR rolname = session_user
ORDER BY rolname;

\echo '=== Current role memberships ==='
SELECT
  r.rolname AS role_name,
  m.rolname AS member_of
FROM pg_auth_members am
JOIN pg_roles r ON r.oid = am.member
JOIN pg_roles m ON m.oid = am.roleid
WHERE r.rolname = current_user
ORDER BY member_of;

\echo '=== Table ownership and RLS flags (public) ==='
-- pg_tables exposes rowsecurity but not force; FORCE lives on pg_class.
SELECT
  n.nspname AS schemaname,
  c.relname AS tablename,
  pg_get_userbyid(c.relowner) AS tableowner,
  c.relrowsecurity AS rls_enabled,
  c.relforcerowsecurity AS force_rls
FROM pg_class c
JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname = 'public'
  AND c.relkind IN ('r', 'p')
ORDER BY c.relname;

\echo '=== Existing RLS policies ==='
SELECT
  schemaname,
  tablename,
  policyname,
  permissive,
  roles,
  cmd,
  qual,
  with_check
FROM pg_policies
WHERE schemaname = 'public'
ORDER BY tablename, policyname;

\echo '=== Schema / table privileges for moat_app (if present) ==='
SELECT
  grantee,
  table_schema,
  table_name,
  privilege_type
FROM information_schema.role_table_grants
WHERE grantee = 'moat_app'
  AND table_schema = 'public'
ORDER BY table_name, privilege_type;

\echo '=== Helper functions ==='
SELECT
  n.nspname AS schema_name,
  p.proname AS function_name
FROM pg_proc p
JOIN pg_namespace n ON n.oid = p.pronamespace
WHERE p.proname LIKE 'moat_%'
ORDER BY p.proname;
