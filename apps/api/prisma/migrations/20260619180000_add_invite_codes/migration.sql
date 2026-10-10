-- CreateTable
CREATE TABLE "InviteCode" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "description" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "maxRedemptions" INTEGER,
    "redemptionCount" INTEGER NOT NULL DEFAULT 0,
    "expiresAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "InviteCode_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InviteCodeRedemption" (
    "id" TEXT NOT NULL,
    "inviteCodeId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "redeemedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "InviteCodeRedemption_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InviteCodeAttempt" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "guess" TEXT NOT NULL,
    "wasValid" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "InviteCodeAttempt_pkey" PRIMARY KEY ("id")
);

-- AlterTable
ALTER TABLE "UserSettings" ADD COLUMN "inviteCodeGatePassedAt" TIMESTAMP(3);

-- CreateIndex
CREATE UNIQUE INDEX "InviteCode_code_key" ON "InviteCode"("code");

-- CreateIndex
CREATE UNIQUE INDEX "InviteCodeRedemption_userId_key" ON "InviteCodeRedemption"("userId");

-- CreateIndex
CREATE INDEX "InviteCodeRedemption_inviteCodeId_idx" ON "InviteCodeRedemption"("inviteCodeId");

-- CreateIndex
CREATE INDEX "InviteCodeAttempt_userId_createdAt_idx" ON "InviteCodeAttempt"("userId", "createdAt");

-- AddForeignKey
ALTER TABLE "InviteCodeRedemption" ADD CONSTRAINT "InviteCodeRedemption_inviteCodeId_fkey" FOREIGN KEY ("inviteCodeId") REFERENCES "InviteCode"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InviteCodeRedemption" ADD CONSTRAINT "InviteCodeRedemption_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InviteCodeAttempt" ADD CONSTRAINT "InviteCodeAttempt_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
