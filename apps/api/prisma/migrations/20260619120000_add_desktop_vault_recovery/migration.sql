-- CreateTable
CREATE TABLE "DesktopVaultRecoveryRegistration" (
    "id" TEXT NOT NULL,
    "recoveryDeviceId" TEXT NOT NULL,
    "emailHash" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DesktopVaultRecoveryRegistration_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DesktopVaultRecoveryCode" (
    "id" TEXT NOT NULL,
    "recoveryDeviceId" TEXT NOT NULL,
    "codeHash" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "attemptCount" INTEGER NOT NULL DEFAULT 0,
    "consumedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DesktopVaultRecoveryCode_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DesktopVaultRecoveryToken" (
    "id" TEXT NOT NULL,
    "recoveryDeviceId" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "consumedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DesktopVaultRecoveryToken_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "DesktopVaultRecoveryRegistration_recoveryDeviceId_key" ON "DesktopVaultRecoveryRegistration"("recoveryDeviceId");

-- CreateIndex
CREATE INDEX "DesktopVaultRecoveryRegistration_emailHash_idx" ON "DesktopVaultRecoveryRegistration"("emailHash");

-- CreateIndex
CREATE INDEX "DesktopVaultRecoveryCode_recoveryDeviceId_expiresAt_idx" ON "DesktopVaultRecoveryCode"("recoveryDeviceId", "expiresAt");

-- CreateIndex
CREATE UNIQUE INDEX "DesktopVaultRecoveryToken_tokenHash_key" ON "DesktopVaultRecoveryToken"("tokenHash");

-- CreateIndex
CREATE INDEX "DesktopVaultRecoveryToken_recoveryDeviceId_expiresAt_idx" ON "DesktopVaultRecoveryToken"("recoveryDeviceId", "expiresAt");
