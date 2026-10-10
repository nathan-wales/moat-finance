-- AlterTable
ALTER TABLE "ProfileLink"
ADD COLUMN "includeInOwnerNetWorth" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE "HouseholdInviteProfileAccess" (
    "id" TEXT NOT NULL,
    "inviteId" TEXT NOT NULL,
    "profileLinkId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "HouseholdInviteProfileAccess_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "HouseholdProfileAccess" (
    "id" TEXT NOT NULL,
    "membershipId" TEXT NOT NULL,
    "profileLinkId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "HouseholdProfileAccess_pkey" PRIMARY KEY ("id")
);

-- Indexes
CREATE UNIQUE INDEX "HouseholdInviteProfileAccess_inviteId_profileLinkId_key"
    ON "HouseholdInviteProfileAccess"("inviteId", "profileLinkId");
CREATE INDEX "HouseholdInviteProfileAccess_inviteId_idx"
    ON "HouseholdInviteProfileAccess"("inviteId");
CREATE INDEX "HouseholdInviteProfileAccess_profileLinkId_idx"
    ON "HouseholdInviteProfileAccess"("profileLinkId");

CREATE UNIQUE INDEX "HouseholdProfileAccess_membershipId_profileLinkId_key"
    ON "HouseholdProfileAccess"("membershipId", "profileLinkId");
CREATE INDEX "HouseholdProfileAccess_membershipId_idx"
    ON "HouseholdProfileAccess"("membershipId");
CREATE INDEX "HouseholdProfileAccess_profileLinkId_idx"
    ON "HouseholdProfileAccess"("profileLinkId");

-- ForeignKeys
ALTER TABLE "HouseholdInviteProfileAccess"
    ADD CONSTRAINT "HouseholdInviteProfileAccess_inviteId_fkey"
    FOREIGN KEY ("inviteId") REFERENCES "HouseholdInvite"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "HouseholdInviteProfileAccess"
    ADD CONSTRAINT "HouseholdInviteProfileAccess_profileLinkId_fkey"
    FOREIGN KEY ("profileLinkId") REFERENCES "ProfileLink"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "HouseholdProfileAccess"
    ADD CONSTRAINT "HouseholdProfileAccess_membershipId_fkey"
    FOREIGN KEY ("membershipId") REFERENCES "HouseholdMembership"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "HouseholdProfileAccess"
    ADD CONSTRAINT "HouseholdProfileAccess_profileLinkId_fkey"
    FOREIGN KEY ("profileLinkId") REFERENCES "ProfileLink"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Backfill: existing active members get access to the owner's Personal profile
INSERT INTO "HouseholdProfileAccess" ("id", "membershipId", "profileLinkId", "createdAt")
SELECT
    'hpa_' || hm."id",
    hm."id",
    pl."id",
    CURRENT_TIMESTAMP
FROM "HouseholdMembership" hm
INNER JOIN "ProfileLink" pl
    ON pl."ownerUserId" = hm."ownerUserId"
   AND pl."profileUserId" = hm."ownerUserId"
   AND pl."archivedAt" IS NULL
WHERE hm."status" = 'ACTIVE'
  AND NOT EXISTS (
      SELECT 1
      FROM "HouseholdProfileAccess" existing
      WHERE existing."membershipId" = hm."id"
  );

-- Backfill: pending invites created before grants existed default to Personal
INSERT INTO "HouseholdInviteProfileAccess" ("id", "inviteId", "profileLinkId", "createdAt")
SELECT
    'hipa_' || hi."id",
    hi."id",
    pl."id",
    CURRENT_TIMESTAMP
FROM "HouseholdInvite" hi
INNER JOIN "ProfileLink" pl
    ON pl."ownerUserId" = hi."ownerUserId"
   AND pl."profileUserId" = hi."ownerUserId"
   AND pl."archivedAt" IS NULL
WHERE hi."status" = 'PENDING'
  AND NOT EXISTS (
      SELECT 1
      FROM "HouseholdInviteProfileAccess" existing
      WHERE existing."inviteId" = hi."id"
  );

-- RLS for grant tables
ALTER TABLE "HouseholdInviteProfileAccess" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "HouseholdInviteProfileAccess" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS householdinviteprofileaccess_access ON "HouseholdInviteProfileAccess";
CREATE POLICY householdinviteprofileaccess_access ON "HouseholdInviteProfileAccess"
  FOR ALL
  USING (
    moat_is_service_actor()
    OR EXISTS (
      SELECT 1
      FROM "HouseholdInvite" hi
      WHERE hi."id" = "HouseholdInviteProfileAccess"."inviteId"
        AND (
          hi."ownerUserId" = moat_actor_user_id()
          OR hi."ownerUserId" = moat_app_user_id()
        )
    )
  )
  WITH CHECK (
    moat_is_service_actor()
    OR EXISTS (
      SELECT 1
      FROM "HouseholdInvite" hi
      WHERE hi."id" = "HouseholdInviteProfileAccess"."inviteId"
        AND hi."ownerUserId" = moat_actor_user_id()
    )
  );

ALTER TABLE "HouseholdProfileAccess" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "HouseholdProfileAccess" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS householdprofileaccess_access ON "HouseholdProfileAccess";
CREATE POLICY householdprofileaccess_access ON "HouseholdProfileAccess"
  FOR ALL
  USING (
    moat_is_service_actor()
    OR EXISTS (
      SELECT 1
      FROM "HouseholdMembership" hm
      WHERE hm."id" = "HouseholdProfileAccess"."membershipId"
        AND (
          hm."ownerUserId" = moat_actor_user_id()
          OR hm."memberUserId" = moat_actor_user_id()
          OR hm."ownerUserId" = moat_app_user_id()
        )
    )
  )
  WITH CHECK (
    moat_is_service_actor()
    OR EXISTS (
      SELECT 1
      FROM "HouseholdMembership" hm
      WHERE hm."id" = "HouseholdProfileAccess"."membershipId"
        AND hm."ownerUserId" = moat_actor_user_id()
    )
  );

-- Expand ProfileLink access so household members can read/update granted profiles
DROP POLICY IF EXISTS profilelink_access ON "ProfileLink";
CREATE POLICY profilelink_access ON "ProfileLink"
  FOR ALL
  USING (
    moat_is_service_actor()
    OR "ownerUserId" = moat_actor_user_id()
    OR "ownerUserId" = moat_app_user_id()
    OR "profileUserId" = moat_app_user_id()
    OR EXISTS (
      SELECT 1
      FROM "HouseholdProfileAccess" hpa
      INNER JOIN "HouseholdMembership" hm ON hm."id" = hpa."membershipId"
      WHERE hpa."profileLinkId" = "ProfileLink"."id"
        AND hm."memberUserId" = moat_actor_user_id()
        AND hm."status" = 'ACTIVE'
    )
  )
  WITH CHECK (
    moat_is_service_actor()
    OR "ownerUserId" = moat_actor_user_id()
    OR EXISTS (
      SELECT 1
      FROM "HouseholdProfileAccess" hpa
      INNER JOIN "HouseholdMembership" hm ON hm."id" = hpa."membershipId"
      WHERE hpa."profileLinkId" = "ProfileLink"."id"
        AND hm."memberUserId" = moat_actor_user_id()
        AND hm."status" = 'ACTIVE'
    )
  );
