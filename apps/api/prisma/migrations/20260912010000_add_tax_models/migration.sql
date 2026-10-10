-- CreateTable
CREATE TABLE "TaxDocument" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "taxYear" INTEGER NOT NULL,
    "documentCategory" TEXT NOT NULL,
    "formType" TEXT,
    "issuer" TEXT,
    "recipient" TEXT,
    "source" TEXT NOT NULL,
    "originalFilename" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "uploadedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "processingState" TEXT NOT NULL,
    "parserProvider" TEXT,
    "parserVersion" TEXT,
    "extractionConfidence" DOUBLE PRECISION,
    "originalStorageKey" TEXT NOT NULL,
    "parsedStorageKey" TEXT,
    "reviewStatus" TEXT NOT NULL,
    "userConfirmed" BOOLEAN NOT NULL DEFAULT false,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TaxDocument_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TaxFact" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "taxYear" INTEGER NOT NULL,
    "category" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "value" JSONB NOT NULL,
    "valueType" TEXT NOT NULL,
    "unit" TEXT,
    "currency" TEXT,
    "sourceType" TEXT NOT NULL,
    "sourceDocumentId" TEXT,
    "sourceTransactionId" TEXT,
    "sourceAccountId" TEXT,
    "sourceHoldingId" TEXT,
    "sourceManualEntryId" TEXT,
    "sourceRealEstateId" TEXT,
    "sourceForm" TEXT,
    "sourceBox" TEXT,
    "sourcePage" INTEGER,
    "sourceText" TEXT,
    "confidence" DOUBLE PRECISION NOT NULL,
    "extractionMethod" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "userConfirmed" BOOLEAN NOT NULL DEFAULT false,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TaxFact_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TaxFormExtraction" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "documentId" TEXT NOT NULL,
    "formType" TEXT NOT NULL,
    "schemaVersion" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TaxFormExtraction_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TaxFactConflict" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "taxYear" INTEGER NOT NULL,
    "factKey" TEXT NOT NULL,
    "factIds" TEXT[],
    "preferredFactId" TEXT,
    "resolutionState" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TaxFactConflict_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "TaxDocument_userId_taxYear_idx" ON "TaxDocument"("userId", "taxYear");

-- CreateIndex
CREATE INDEX "TaxDocument_userId_processingState_idx" ON "TaxDocument"("userId", "processingState");

-- CreateIndex
CREATE INDEX "TaxFact_userId_taxYear_idx" ON "TaxFact"("userId", "taxYear");

-- CreateIndex
CREATE INDEX "TaxFact_userId_taxYear_key_idx" ON "TaxFact"("userId", "taxYear", "key");

-- CreateIndex
CREATE INDEX "TaxFact_sourceDocumentId_idx" ON "TaxFact"("sourceDocumentId");

-- CreateIndex
CREATE INDEX "TaxFormExtraction_userId_documentId_idx" ON "TaxFormExtraction"("userId", "documentId");

-- CreateIndex
CREATE INDEX "TaxFactConflict_userId_taxYear_idx" ON "TaxFactConflict"("userId", "taxYear");

-- CreateIndex
CREATE UNIQUE INDEX "TaxFactConflict_userId_taxYear_factKey_key" ON "TaxFactConflict"("userId", "taxYear", "factKey");

-- AddForeignKey
ALTER TABLE "TaxDocument" ADD CONSTRAINT "TaxDocument_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TaxFact" ADD CONSTRAINT "TaxFact_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TaxFact" ADD CONSTRAINT "TaxFact_sourceDocumentId_fkey" FOREIGN KEY ("sourceDocumentId") REFERENCES "TaxDocument"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TaxFormExtraction" ADD CONSTRAINT "TaxFormExtraction_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TaxFormExtraction" ADD CONSTRAINT "TaxFormExtraction_documentId_fkey" FOREIGN KEY ("documentId") REFERENCES "TaxDocument"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TaxFactConflict" ADD CONSTRAINT "TaxFactConflict_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- RLS
ALTER TABLE "TaxDocument" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "TaxDocument" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS taxdocument_tenant_access ON "TaxDocument";
CREATE POLICY taxdocument_tenant_access ON "TaxDocument"
  FOR ALL
  USING (moat_is_service_actor() OR ("userId" = moat_app_user_id()) OR ("userId" = moat_actor_user_id()))
  WITH CHECK (moat_is_service_actor() OR ("userId" = moat_app_user_id()) OR ("userId" = moat_actor_user_id()));

ALTER TABLE "TaxFact" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "TaxFact" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS taxfact_tenant_access ON "TaxFact";
CREATE POLICY taxfact_tenant_access ON "TaxFact"
  FOR ALL
  USING (moat_is_service_actor() OR ("userId" = moat_app_user_id()) OR ("userId" = moat_actor_user_id()))
  WITH CHECK (moat_is_service_actor() OR ("userId" = moat_app_user_id()) OR ("userId" = moat_actor_user_id()));

ALTER TABLE "TaxFormExtraction" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "TaxFormExtraction" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS taxformextraction_tenant_access ON "TaxFormExtraction";
CREATE POLICY taxformextraction_tenant_access ON "TaxFormExtraction"
  FOR ALL
  USING (moat_is_service_actor() OR ("userId" = moat_app_user_id()) OR ("userId" = moat_actor_user_id()))
  WITH CHECK (moat_is_service_actor() OR ("userId" = moat_app_user_id()) OR ("userId" = moat_actor_user_id()));

ALTER TABLE "TaxFactConflict" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "TaxFactConflict" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS taxfactconflict_tenant_access ON "TaxFactConflict";
CREATE POLICY taxfactconflict_tenant_access ON "TaxFactConflict"
  FOR ALL
  USING (moat_is_service_actor() OR ("userId" = moat_app_user_id()) OR ("userId" = moat_actor_user_id()))
  WITH CHECK (moat_is_service_actor() OR ("userId" = moat_app_user_id()) OR ("userId" = moat_actor_user_id()));
