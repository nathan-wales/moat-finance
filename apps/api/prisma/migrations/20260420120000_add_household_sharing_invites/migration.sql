CREATE TYPE "HouseholdInviteStatus" AS ENUM ('PENDING', 'ACCEPTED', 'REVOKED', 'EXPIRED');
CREATE TYPE "HouseholdMembershipStatus" AS ENUM ('ACTIVE', 'REMOVED');

CREATE TABLE "HouseholdInvite" (
    "id" TEXT NOT NULL,
    "ownerUserId" TEXT NOT NULL,
    "inviteeName" TEXT NOT NULL,
    "inviteeEmail" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "status" "HouseholdInviteStatus" NOT NULL DEFAULT 'PENDING',
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "sentAt" TIMESTAMP(3),
    "acceptedAt" TIMESTAMP(3),
    "revokedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "HouseholdInvite_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "HouseholdMembership" (
    "id" TEXT NOT NULL,
    "ownerUserId" TEXT NOT NULL,
    "memberUserId" TEXT NOT NULL,
    "status" "HouseholdMembershipStatus" NOT NULL DEFAULT 'ACTIVE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "removedAt" TIMESTAMP(3),

    CONSTRAINT "HouseholdMembership_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "HouseholdInvite_tokenHash_key" ON "HouseholdInvite"("tokenHash");
CREATE INDEX "HouseholdInvite_ownerUserId_idx" ON "HouseholdInvite"("ownerUserId");
CREATE INDEX "HouseholdInvite_inviteeEmail_idx" ON "HouseholdInvite"("inviteeEmail");

CREATE UNIQUE INDEX "HouseholdMembership_ownerUserId_memberUserId_key"
    ON "HouseholdMembership"("ownerUserId", "memberUserId");
CREATE INDEX "HouseholdMembership_ownerUserId_idx" ON "HouseholdMembership"("ownerUserId");
CREATE INDEX "HouseholdMembership_memberUserId_idx" ON "HouseholdMembership"("memberUserId");

ALTER TABLE "HouseholdInvite"
    ADD CONSTRAINT "HouseholdInvite_ownerUserId_fkey"
    FOREIGN KEY ("ownerUserId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "HouseholdMembership"
    ADD CONSTRAINT "HouseholdMembership_ownerUserId_fkey"
    FOREIGN KEY ("ownerUserId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "HouseholdMembership"
    ADD CONSTRAINT "HouseholdMembership_memberUserId_fkey"
    FOREIGN KEY ("memberUserId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
