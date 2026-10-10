-- AlterTable
ALTER TABLE "PlaidItem" ADD COLUMN "accessRevokedAt" TIMESTAMP(3),
ALTER COLUMN "accessTokenEncrypted" DROP NOT NULL;

-- CreateIndex
CREATE INDEX "PlaidItem_accessRevokedAt_idx" ON "PlaidItem"("accessRevokedAt");
