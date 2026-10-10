-- CreateTable
CREATE TABLE "DesktopInviteCodeRedemption" (
    "id" TEXT NOT NULL,
    "inviteCodeId" TEXT NOT NULL,
    "desktopDeviceId" TEXT NOT NULL,
    "redeemedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DesktopInviteCodeRedemption_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DesktopInviteCodeAttempt" (
    "id" TEXT NOT NULL,
    "desktopDeviceId" TEXT NOT NULL,
    "wasValid" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DesktopInviteCodeAttempt_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "DesktopInviteCodeRedemption_desktopDeviceId_key" ON "DesktopInviteCodeRedemption"("desktopDeviceId");

-- CreateIndex
CREATE INDEX "DesktopInviteCodeRedemption_inviteCodeId_idx" ON "DesktopInviteCodeRedemption"("inviteCodeId");

-- CreateIndex
CREATE INDEX "DesktopInviteCodeAttempt_desktopDeviceId_createdAt_idx" ON "DesktopInviteCodeAttempt"("desktopDeviceId", "createdAt");

-- AddForeignKey
ALTER TABLE "DesktopInviteCodeRedemption" ADD CONSTRAINT "DesktopInviteCodeRedemption_inviteCodeId_fkey" FOREIGN KEY ("inviteCodeId") REFERENCES "InviteCode"("id") ON DELETE CASCADE ON UPDATE CASCADE;
