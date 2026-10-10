-- Cross-tenant RLS verification for the restricted runtime role.
-- Prerequisites:
--   * migrations through 20260926150000_scope_financial_rls_to_active_profile applied
--   * moat_app role created and granted (setup-moat-app-role.sql)
--   * connected AS moat_app (not the table owner)
--
-- Every phase runs in its own explicit transaction. `set_config(..., true)` is
-- transaction-local, so a bare statement outside BEGIN/COMMIT would discard the
-- actor before the next statement runs and silently test nothing.
--
-- This script creates ephemeral fixtures, asserts isolation, then deletes them.
-- Safe for staging. Do not run against production with real customer traffic
-- unless you understand the temporary rows it inserts.

\set ON_ERROR_STOP on

BEGIN;

SELECT set_config('app.actor_type', 'service', true);
SELECT set_config('app.user_id', '', true);

INSERT INTO "User" ("id", "email", "name")
VALUES
  ('rls_user_a', 'rls-user-a@example.invalid', 'RLS User A'),
  ('rls_user_b', 'rls-user-b@example.invalid', 'RLS User B')
ON CONFLICT ("id") DO NOTHING;

INSERT INTO "Transaction" (
  "id", "userId", "date", "amount", "type", "category", "description", "updatedAt"
)
VALUES
  ('rls_tx_a', 'rls_user_a', NOW(), 10.00, 'EXPENSE', 'OTHER', 'user-a-only', NOW()),
  ('rls_tx_b', 'rls_user_b', NOW(), 20.00, 'EXPENSE', 'OTHER', 'user-b-only', NOW())
ON CONFLICT ("id") DO NOTHING;

INSERT INTO "Hashtag" ("id", "userId", "name", "normalizedName", "updatedAt")
VALUES
  ('rls_tag_a', 'rls_user_a', 'alpha', 'alpha', NOW()),
  ('rls_tag_b', 'rls_user_b', 'bravo', 'bravo', NOW())
ON CONFLICT ("id") DO NOTHING;

COMMIT;

-- No identity context: must see zero protected rows.
BEGIN;
SELECT CASE
  WHEN COUNT(*) = 0 THEN 'PASS deny-without-context'
  ELSE 'FAIL deny-without-context'
END AS result
FROM "Transaction"
WHERE "id" IN ('rls_tx_a', 'rls_tx_b');
COMMIT;

-- Correct user context: only own rows.
BEGIN;
SELECT set_config('app.actor_type', 'user', true);
SELECT set_config('app.user_id', 'rls_user_a', true);
SELECT set_config('app.actor_user_id', 'rls_user_a', true);

SELECT CASE
  WHEN COUNT(*) = 1 AND MIN("id") = 'rls_tx_a' THEN 'PASS user-a-read-own'
  ELSE 'FAIL user-a-read-own'
END AS result
FROM "Transaction"
WHERE "id" IN ('rls_tx_a', 'rls_tx_b');
COMMIT;

-- Wrong user context: cannot update peer rows (0-row update under RLS).
BEGIN;
SELECT set_config('app.actor_type', 'user', true);
SELECT set_config('app.user_id', 'rls_user_a', true);
SELECT set_config('app.actor_user_id', 'rls_user_a', true);

UPDATE "Transaction"
SET "description" = 'should-not-write'
WHERE "id" = 'rls_tx_b';
COMMIT;

BEGIN;
SELECT set_config('app.actor_type', 'service', true);
SELECT CASE
  WHEN "description" = 'user-b-only' THEN 'PASS user-a-cannot-update-b'
  ELSE 'FAIL user-a-cannot-update-b'
END AS result
FROM "Transaction"
WHERE "id" = 'rls_tx_b';
COMMIT;

-- Insert with mismatched ownership must fail under user actor.
DO $$
BEGIN
  PERFORM set_config('app.actor_type', 'user', true);
  PERFORM set_config('app.user_id', 'rls_user_a', true);
  PERFORM set_config('app.actor_user_id', 'rls_user_a', true);
  BEGIN
    INSERT INTO "Transaction" (
      "id", "userId", "date", "amount", "type", "category", "description", "updatedAt"
    ) VALUES (
      'rls_tx_mismatch', 'rls_user_b', NOW(), 1.00, 'EXPENSE', 'OTHER', 'mismatch', NOW()
    );
    RAISE EXCEPTION 'FAIL insert-mismatched-ownership';
  EXCEPTION
    WHEN insufficient_privilege THEN
      RAISE NOTICE 'PASS insert-mismatched-ownership';
    WHEN others THEN
      IF SQLERRM LIKE '%row-level security%' THEN
        RAISE NOTICE 'PASS insert-mismatched-ownership';
      ELSE
        RAISE;
      END IF;
  END;
END
$$;

-- Cross-user hashtag attach must fail.
DO $$
BEGIN
  PERFORM set_config('app.actor_type', 'user', true);
  PERFORM set_config('app.user_id', 'rls_user_a', true);
  PERFORM set_config('app.actor_user_id', 'rls_user_a', true);
  BEGIN
    INSERT INTO "TransactionHashtag" ("transactionId", "hashtagId")
    VALUES ('rls_tx_a', 'rls_tag_b');
    RAISE EXCEPTION 'FAIL cross-user-hashtag-attach';
  EXCEPTION
    WHEN insufficient_privilege THEN
      RAISE NOTICE 'PASS cross-user-hashtag-attach';
    WHEN others THEN
      IF SQLERRM LIKE '%row-level security%' THEN
        RAISE NOTICE 'PASS cross-user-hashtag-attach';
      ELSE
        RAISE;
      END IF;
  END;
END
$$;

-- Active profile is user A while the signed-in actor is user B.
-- Financial rows follow the profile, so B's transactions stay hidden.
BEGIN;
SELECT set_config('app.actor_type', 'user', true);
SELECT set_config('app.user_id', 'rls_user_a', true);
SELECT set_config('app.actor_user_id', 'rls_user_b', true);

SELECT CASE
  WHEN COUNT(*) = 1 AND MIN("id") = 'rls_tx_a' THEN 'PASS profile-does-not-include-actor-ledger'
  ELSE 'FAIL profile-does-not-include-actor-ledger'
END AS result
FROM "Transaction"
WHERE "id" IN ('rls_tx_a', 'rls_tx_b');
COMMIT;

-- Service actor can read across tenants when explicitly elevated.
BEGIN;
SELECT set_config('app.actor_type', 'service', true);
SELECT set_config('app.user_id', '', true);

SELECT CASE
  WHEN COUNT(*) = 2 THEN 'PASS service-can-read-fixtures'
  ELSE 'FAIL service-can-read-fixtures'
END AS result
FROM "Transaction"
WHERE "id" IN ('rls_tx_a', 'rls_tx_b');
COMMIT;

-- Every public table must have RLS enabled and forced.
SELECT CASE
  WHEN COUNT(*) = 0 THEN 'PASS all-tables-force-rls'
  ELSE 'FAIL all-tables-force-rls: ' || string_agg(relname, ', ')
END AS result
FROM pg_class c
JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname = 'public'
  AND c.relkind = 'r'
  AND c.relname NOT LIKE '\_prisma%'
  AND (c.relrowsecurity IS FALSE OR c.relforcerowsecurity IS FALSE);

-- Every RLS-enabled table must have at least one policy, or it denies all.
SELECT CASE
  WHEN COUNT(*) = 0 THEN 'PASS all-tables-have-policies'
  ELSE 'FAIL all-tables-have-policies: ' || string_agg(relname, ', ')
END AS result
FROM pg_class c
JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname = 'public'
  AND c.relkind = 'r'
  AND c.relrowsecurity
  AND NOT EXISTS (SELECT 1 FROM pg_policy p WHERE p.polrelid = c.oid);

-- Cleanup as service.
BEGIN;
SELECT set_config('app.actor_type', 'service', true);
DELETE FROM "TransactionHashtag"
WHERE "transactionId" IN ('rls_tx_a', 'rls_tx_b');
DELETE FROM "Transaction"
WHERE "id" IN ('rls_tx_a', 'rls_tx_b', 'rls_tx_mismatch');
DELETE FROM "Hashtag"
WHERE "id" IN ('rls_tag_a', 'rls_tag_b');
DELETE FROM "User"
WHERE "id" IN ('rls_user_a', 'rls_user_b');
COMMIT;
