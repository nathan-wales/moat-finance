-- CreateTable
CREATE TABLE "ImportMappingTemplate" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "accountId" TEXT,
    "mapping" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ImportMappingTemplate_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ImportMappingTemplate_userId_idx" ON "ImportMappingTemplate"("userId");

-- AddForeignKey
ALTER TABLE "ImportMappingTemplate" ADD CONSTRAINT "ImportMappingTemplate_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- RLS
ALTER TABLE "ImportMappingTemplate" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "ImportMappingTemplate" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS importmappingtemplate_tenant_access ON "ImportMappingTemplate";
CREATE POLICY importmappingtemplate_tenant_access ON "ImportMappingTemplate"
  FOR ALL
  USING (moat_is_service_actor() OR ("userId" = moat_app_user_id()) OR ("userId" = moat_actor_user_id()))
  WITH CHECK (moat_is_service_actor() OR ("userId" = moat_app_user_id()) OR ("userId" = moat_actor_user_id()));
