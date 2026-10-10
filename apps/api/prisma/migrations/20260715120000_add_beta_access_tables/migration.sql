-- CreateEnum
CREATE TYPE "BetaAllowlistSource" AS ENUM ('SEED', 'MANUAL');

-- CreateEnum
CREATE TYPE "BetaAccessRequestStatus" AS ENUM ('PENDING', 'REVIEWED');

-- CreateTable
CREATE TABLE "BetaAllowlist" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "source" "BetaAllowlistSource" NOT NULL DEFAULT 'MANUAL',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BetaAllowlist_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BetaAccessRequest" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "userId" TEXT,
    "status" "BetaAccessRequestStatus" NOT NULL DEFAULT 'PENDING',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BetaAccessRequest_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "BetaAllowlist_email_key" ON "BetaAllowlist"("email");

-- CreateIndex
CREATE INDEX "BetaAllowlist_email_idx" ON "BetaAllowlist"("email");

-- CreateIndex
CREATE UNIQUE INDEX "BetaAccessRequest_email_key" ON "BetaAccessRequest"("email");

-- CreateIndex
CREATE INDEX "BetaAccessRequest_email_idx" ON "BetaAccessRequest"("email");

-- CreateIndex
CREATE INDEX "BetaAccessRequest_status_idx" ON "BetaAccessRequest"("status");

-- AddForeignKey
ALTER TABLE "BetaAccessRequest" ADD CONSTRAINT "BetaAccessRequest_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
