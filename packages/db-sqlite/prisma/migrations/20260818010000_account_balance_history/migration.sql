-- CreateTable
CREATE TABLE "AccountBalanceHistory" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "date" DATETIME NOT NULL,
    "source" TEXT NOT NULL,
    "sourceId" TEXT NOT NULL,
    "balance" REAL NOT NULL,
    CONSTRAINT "AccountBalanceHistory_userId_fkey" FOREIGN KEY ("userId") REFERENCES "LocalUser" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "AccountBalanceHistory_userId_source_sourceId_date_idx" ON "AccountBalanceHistory"("userId", "source", "sourceId", "date");

-- CreateIndex
CREATE UNIQUE INDEX "AccountBalanceHistory_userId_date_source_sourceId_key" ON "AccountBalanceHistory"("userId", "date", "source", "sourceId");
