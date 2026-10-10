-- Manual Neon role setup for the restricted runtime role.
-- Run once per environment as the migration/owner role via DIRECT_URL.
-- Do NOT commit passwords. Set the password through the Neon console or:
--   ALTER ROLE moat_app PASSWORD '<generated-secret>';
--
-- After this script:
-- 1. Point runtime DATABASE_URL at moat_app (pooled).
-- 2. Keep DIRECT_URL / migration credentials on the owner role.
-- 3. Set MOAT_DATABASE_ACTOR_CONTEXT=true for API and MCP.
-- 4. Verify with apps/api/scripts/inspect-rls-roles.sql and
--    apps/api/scripts/verify-rls-isolation.sql.

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'moat_app') THEN
    CREATE ROLE moat_app
      LOGIN
      NOSUPERUSER
      NOCREATEDB
      NOCREATEROLE
      NOINHERIT
      NOBYPASSRLS;
  END IF;
END
$$;

GRANT USAGE ON SCHEMA public TO moat_app;

GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO moat_app;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO moat_app;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public TO moat_app;

ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO moat_app;
ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT USAGE, SELECT ON SEQUENCES TO moat_app;
ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT EXECUTE ON FUNCTIONS TO moat_app;

-- Confirm the role cannot bypass RLS.
SELECT rolname, rolsuper, rolbypassrls, rolcanlogin
FROM pg_roles
WHERE rolname = 'moat_app';
