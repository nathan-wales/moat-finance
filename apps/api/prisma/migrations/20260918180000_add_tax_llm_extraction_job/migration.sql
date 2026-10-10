-- CreateTable
CREATE TABLE "TaxLlmExtractionJob" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "documentId" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "attemptCount" INTEGER NOT NULL DEFAULT 0,
    "maxAttempts" INTEGER NOT NULL DEFAULT 5,
    "documentType" TEXT NOT NULL,
    "schemaVersion" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "model" TEXT NOT NULL,
    "modelRevision" TEXT,
    "inferenceServer" TEXT,
    "vllmVersion" TEXT,
    "lastErrorCode" TEXT,
    "lastErrorMessage" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "startedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TaxLlmExtractionJob_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "TaxLlmExtractionJob_userId_status_idx" ON "TaxLlmExtractionJob"("userId", "status");

-- CreateIndex
CREATE INDEX "TaxLlmExtractionJob_documentId_status_idx" ON "TaxLlmExtractionJob"("documentId", "status");

-- CreateIndex
CREATE INDEX "TaxLlmExtractionJob_status_createdAt_idx" ON "TaxLlmExtractionJob"("status", "createdAt");

-- AddForeignKey
ALTER TABLE "TaxLlmExtractionJob" ADD CONSTRAINT "TaxLlmExtractionJob_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TaxLlmExtractionJob" ADD CONSTRAINT "TaxLlmExtractionJob_documentId_fkey" FOREIGN KEY ("documentId") REFERENCES "TaxDocument"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- RLS
ALTER TABLE "TaxLlmExtractionJob" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "TaxLlmExtractionJob" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS taxllmextractionjob_tenant_access ON "TaxLlmExtractionJob";
CREATE POLICY taxllmextractionjob_tenant_access ON "TaxLlmExtractionJob"
  FOR ALL
  USING (moat_is_service_actor() OR ("userId" = moat_app_user_id()) OR ("userId" = moat_actor_user_id()))
  WITH CHECK (moat_is_service_actor() OR ("userId" = moat_app_user_id()) OR ("userId" = moat_actor_user_id()));
