-- CreateTable
CREATE TABLE "WindowsWaitlist" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "ipAddress" TEXT,
    "userAgent" TEXT,

    CONSTRAINT "WindowsWaitlist_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "WindowsWaitlist_email_key" ON "WindowsWaitlist"("email");

-- CreateIndex
CREATE INDEX "WindowsWaitlist_email_idx" ON "WindowsWaitlist"("email");
