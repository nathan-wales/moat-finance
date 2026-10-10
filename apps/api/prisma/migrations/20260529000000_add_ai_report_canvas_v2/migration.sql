-- Add V2 Canvas fields to AiReport
ALTER TABLE "AiReport" ADD COLUMN "document" JSONB;
ALTER TABLE "AiReport" ADD COLUMN "createdBy" TEXT NOT NULL DEFAULT 'AGENT';

-- Update AiReportVersion to include title, description, and V2 document
ALTER TABLE "AiReportVersion" ADD COLUMN "title" TEXT NOT NULL DEFAULT '';
ALTER TABLE "AiReportVersion" ADD COLUMN "description" TEXT;
ALTER TABLE "AiReportVersion" ADD COLUMN "document" JSONB;

-- Create the AiReportCreatedBy enum (Postgres)
-- NOTE: Prisma uses string enum stored as TEXT for this field

-- Create the AiReportShare table for V2 share snapshots
CREATE TABLE "AiReportShare" (
    "id"            TEXT NOT NULL,
    "reportId"      TEXT NOT NULL,
    "userId"        TEXT NOT NULL,
    "shareSlug"     TEXT NOT NULL,
    "title"         TEXT NOT NULL,
    "description"   TEXT,
    "document"      JSONB,
    "sanitizedHtml" TEXT NOT NULL DEFAULT '',
    "sanitizedCss"  TEXT NOT NULL DEFAULT '',
    "isEnabled"     BOOLEAN NOT NULL DEFAULT true,
    "createdAt"     TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"     TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "revokedAt"     TIMESTAMP(3),

    CONSTRAINT "AiReportShare_pkey" PRIMARY KEY ("id")
);

-- AiReportShare unique + indexes
CREATE UNIQUE INDEX "AiReportShare_shareSlug_key" ON "AiReportShare"("shareSlug");
CREATE INDEX "AiReportShare_reportId_idx" ON "AiReportShare"("reportId");
CREATE INDEX "AiReportShare_userId_idx" ON "AiReportShare"("userId");
CREATE INDEX "AiReportShare_shareSlug_idx" ON "AiReportShare"("shareSlug");

-- Foreign keys
ALTER TABLE "AiReportShare" ADD CONSTRAINT "AiReportShare_reportId_fkey"
    FOREIGN KEY ("reportId") REFERENCES "AiReport"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "AiReportShare" ADD CONSTRAINT "AiReportShare_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
