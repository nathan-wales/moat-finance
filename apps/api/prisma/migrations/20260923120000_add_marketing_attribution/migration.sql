-- CreateTable
CREATE TABLE "MarketingAttribution" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "firstChannel" TEXT NOT NULL,
    "firstPath" TEXT NOT NULL,
    "firstTouchedAt" TIMESTAMP(3) NOT NULL,
    "firstUtmSource" TEXT,
    "firstUtmMedium" TEXT,
    "firstUtmCampaign" TEXT,
    "firstUtmTerm" TEXT,
    "firstUtmContent" TEXT,
    "latestChannel" TEXT NOT NULL,
    "latestPath" TEXT NOT NULL,
    "latestTouchedAt" TIMESTAMP(3) NOT NULL,
    "latestUtmSource" TEXT,
    "latestUtmMedium" TEXT,
    "latestUtmCampaign" TEXT,
    "latestUtmTerm" TEXT,
    "latestUtmContent" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MarketingAttribution_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "MarketingAttribution_userId_key" ON "MarketingAttribution"("userId");

-- AddForeignKey
ALTER TABLE "MarketingAttribution" ADD CONSTRAINT "MarketingAttribution_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- RLS
ALTER TABLE "MarketingAttribution" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "MarketingAttribution" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS marketingattribution_tenant_access ON "MarketingAttribution";
CREATE POLICY marketingattribution_tenant_access ON "MarketingAttribution"
  FOR ALL
  USING (moat_is_service_actor() OR ("userId" = moat_app_user_id()) OR ("userId" = moat_actor_user_id()))
  WITH CHECK (moat_is_service_actor() OR ("userId" = moat_app_user_id()) OR ("userId" = moat_actor_user_id()));
