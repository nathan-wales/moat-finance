-- CreateEnum
CREATE TYPE "ReportVisibility" AS ENUM ('PRIVATE', 'SHARE_LINK', 'PUBLIC');

-- CreateTable
CREATE TABLE "AiReport" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "sanitizedHtml" TEXT NOT NULL,
    "sanitizedCss" TEXT NOT NULL,
    "visibility" "ReportVisibility" NOT NULL DEFAULT 'PRIVATE',
    "shareSlug" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "AiReport_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AiReportVersion" (
    "id" TEXT NOT NULL,
    "reportId" TEXT NOT NULL,
    "sanitizedHtml" TEXT NOT NULL,
    "sanitizedCss" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AiReportVersion_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "AiReport_shareSlug_key" ON "AiReport"("shareSlug");

-- CreateIndex
CREATE INDEX "AiReport_userId_idx" ON "AiReport"("userId");

-- CreateIndex
CREATE INDEX "AiReport_visibility_idx" ON "AiReport"("visibility");

-- CreateIndex
CREATE INDEX "AiReport_shareSlug_idx" ON "AiReport"("shareSlug");

-- CreateIndex
CREATE INDEX "AiReport_userId_deletedAt_idx" ON "AiReport"("userId", "deletedAt");

-- CreateIndex
CREATE INDEX "AiReportVersion_reportId_idx" ON "AiReportVersion"("reportId");

-- AddForeignKey
ALTER TABLE "AiReport" ADD CONSTRAINT "AiReport_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AiReportVersion" ADD CONSTRAINT "AiReportVersion_reportId_fkey" FOREIGN KEY ("reportId") REFERENCES "AiReport"("id") ON DELETE CASCADE ON UPDATE CASCADE;
