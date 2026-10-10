-- CreateEnum
CREATE TYPE "ProfileKind" AS ENUM ('PERSONAL', 'FAMILY', 'BUSINESS');

-- CreateTable
CREATE TABLE "ProfileLink" (
    "id" TEXT NOT NULL,
    "ownerUserId" TEXT NOT NULL,
    "profileUserId" TEXT NOT NULL,
    "kind" "ProfileKind" NOT NULL,
    "displayName" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "archivedAt" TIMESTAMP(3),

    CONSTRAINT "ProfileLink_pkey" PRIMARY KEY ("id")
);

-- Indexes
CREATE UNIQUE INDEX "ProfileLink_ownerUserId_profileUserId_key"
    ON "ProfileLink"("ownerUserId", "profileUserId");
CREATE INDEX "ProfileLink_ownerUserId_idx" ON "ProfileLink"("ownerUserId");
CREATE INDEX "ProfileLink_ownerUserId_archivedAt_idx"
    ON "ProfileLink"("ownerUserId", "archivedAt");

-- ForeignKeys
ALTER TABLE "ProfileLink"
    ADD CONSTRAINT "ProfileLink_ownerUserId_fkey"
    FOREIGN KEY ("ownerUserId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ProfileLink"
    ADD CONSTRAINT "ProfileLink_profileUserId_fkey"
    FOREIGN KEY ("profileUserId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Backfill PERSONAL profile for every existing user (including demo)
INSERT INTO "ProfileLink" ("id", "ownerUserId", "profileUserId", "kind", "displayName", "createdAt")
SELECT
    'pf_' || u."id",
    u."id",
    u."id",
    'PERSONAL',
    COALESCE(NULLIF(TRIM(u."name"), ''), NULLIF(TRIM(u."email"), ''), 'Personal'),
    CURRENT_TIMESTAMP
FROM "User" u
WHERE NOT EXISTS (
    SELECT 1
    FROM "ProfileLink" p
    WHERE p."ownerUserId" = u."id"
      AND p."profileUserId" = u."id"
);

-- RLS
ALTER TABLE "ProfileLink" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "ProfileLink" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS profilelink_access ON "ProfileLink";
CREATE POLICY profilelink_access ON "ProfileLink"
  FOR ALL
  USING (
    moat_is_service_actor()
    OR "ownerUserId" = moat_actor_user_id()
    OR "ownerUserId" = moat_app_user_id()
    OR "profileUserId" = moat_app_user_id()
  )
  WITH CHECK (
    moat_is_service_actor()
    OR "ownerUserId" = moat_actor_user_id()
  );
