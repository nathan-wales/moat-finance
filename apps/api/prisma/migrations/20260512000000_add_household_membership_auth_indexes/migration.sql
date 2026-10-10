CREATE INDEX IF NOT EXISTS "HouseholdMembership_ownerUserId_status_idx"
ON "HouseholdMembership"("ownerUserId", "status");

CREATE INDEX IF NOT EXISTS "HouseholdMembership_memberUserId_status_idx"
ON "HouseholdMembership"("memberUserId", "status");
