-- CreateTable
CREATE TABLE "MileageTrip" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "startedAt" TIMESTAMP(3) NOT NULL,
    "endedAt" TIMESTAMP(3) NOT NULL,
    "distanceMeters" DOUBLE PRECISION NOT NULL,
    "trackedDurationSeconds" INTEGER NOT NULL,
    "startLatitude" DOUBLE PRECISION NOT NULL,
    "startLongitude" DOUBLE PRECISION NOT NULL,
    "endLatitude" DOUBLE PRECISION NOT NULL,
    "endLongitude" DOUBLE PRECISION NOT NULL,
    "encodedPolylines" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "businessPurpose" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MileageTrip_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "MileageTrip_userId_startedAt_idx" ON "MileageTrip"("userId", "startedAt");

-- AddForeignKey
ALTER TABLE "MileageTrip" ADD CONSTRAINT "MileageTrip_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- RLS
ALTER TABLE "MileageTrip" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "MileageTrip" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS mileagetrip_tenant_access ON "MileageTrip";
CREATE POLICY mileagetrip_tenant_access ON "MileageTrip"
  FOR ALL
  USING (moat_is_service_actor() OR ("userId" = moat_app_user_id()) OR ("userId" = moat_actor_user_id()))
  WITH CHECK (moat_is_service_actor() OR ("userId" = moat_app_user_id()) OR ("userId" = moat_actor_user_id()));
