-- CreateTable
CREATE TABLE "DemoOverlaySession" (
    "id" TEXT NOT NULL,
    "sessionKey" TEXT NOT NULL,
    "userId" TEXT,
    "demoUserId" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "investmentsJson" JSONB,
    "propertiesJson" JSONB,
    "scenariosJson" JSONB,
    "uiStateJson" JSONB,

    CONSTRAINT "DemoOverlaySession_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "DemoOverlaySession_sessionKey_key" ON "DemoOverlaySession"("sessionKey");

-- CreateIndex
CREATE INDEX "DemoOverlaySession_userId_idx" ON "DemoOverlaySession"("userId");

-- CreateIndex
CREATE INDEX "DemoOverlaySession_expiresAt_idx" ON "DemoOverlaySession"("expiresAt");

-- AddForeignKey
ALTER TABLE "DemoOverlaySession" ADD CONSTRAINT "DemoOverlaySession_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
