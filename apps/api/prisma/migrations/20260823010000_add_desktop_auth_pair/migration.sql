-- CreateTable
CREATE TABLE "DesktopAuthPair" (
    "id" TEXT NOT NULL,
    "pairId" TEXT NOT NULL,
    "codeChallenge" TEXT NOT NULL,
    "userId" TEXT,
    "deviceInfo" TEXT,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "claimedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DesktopAuthPair_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "DesktopAuthPair_pairId_key" ON "DesktopAuthPair"("pairId");

-- CreateIndex
CREATE INDEX "DesktopAuthPair_expiresAt_idx" ON "DesktopAuthPair"("expiresAt");

-- CreateIndex
CREATE INDEX "DesktopAuthPair_userId_idx" ON "DesktopAuthPair"("userId");

-- AddForeignKey
ALTER TABLE "DesktopAuthPair" ADD CONSTRAINT "DesktopAuthPair_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- RLS: pair rows are opaque capabilities resolved by public handlers under the service actor
ALTER TABLE "DesktopAuthPair" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "DesktopAuthPair" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS desktopauthpair_service_access ON "DesktopAuthPair";
CREATE POLICY desktopauthpair_service_access ON "DesktopAuthPair"
  FOR ALL
  USING (moat_is_service_actor())
  WITH CHECK (moat_is_service_actor());
