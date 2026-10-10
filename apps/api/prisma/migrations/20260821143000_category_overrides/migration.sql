-- CreateTable
CREATE TABLE "CategoryOverride" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "categoryId" TEXT NOT NULL,
    "name" TEXT,
    "icon" TEXT,
    "isHidden" BOOLEAN,
    "isRemoved" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CategoryOverride_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "CategoryOverride_userId_categoryId_key" ON "CategoryOverride"("userId", "categoryId");

-- CreateIndex
CREATE INDEX "CategoryOverride_userId_idx" ON "CategoryOverride"("userId");

-- CreateIndex
CREATE INDEX "CategoryOverride_categoryId_idx" ON "CategoryOverride"("categoryId");

-- AddForeignKey
ALTER TABLE "CategoryOverride" ADD CONSTRAINT "CategoryOverride_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CategoryOverride" ADD CONSTRAINT "CategoryOverride_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "Category"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Prior hide-on-default wrote Category.isHidden on the shared catalog row.
-- Per-user visibility now lives on CategoryOverride; restore globals.
UPDATE "Category"
SET "isHidden" = false
WHERE "userId" IS NULL AND "isHidden" = true;

-- RLS
ALTER TABLE "CategoryOverride" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "CategoryOverride" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS categoryoverride_tenant_access ON "CategoryOverride";
CREATE POLICY categoryoverride_tenant_access ON "CategoryOverride"
  FOR ALL
  USING (moat_is_service_actor() OR ("userId" = moat_app_user_id()) OR ("userId" = moat_actor_user_id()))
  WITH CHECK (moat_is_service_actor() OR ("userId" = moat_app_user_id()) OR ("userId" = moat_actor_user_id()));
