CREATE TYPE "BalanceSnapshotSource" AS ENUM ('PLAID', 'INVESTMENT', 'REAL_ESTATE');

CREATE TABLE "BalanceSnapshot" (
    "id"       TEXT NOT NULL,
    "userId"   TEXT NOT NULL,
    "date"     TIMESTAMP(3) NOT NULL,
    "source"   "BalanceSnapshotSource" NOT NULL,
    "sourceId" TEXT NOT NULL,
    "balance"  DOUBLE PRECISION NOT NULL,

    CONSTRAINT "BalanceSnapshot_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "BalanceSnapshot_userId_date_source_sourceId_key"
    ON "BalanceSnapshot"("userId", "date", "source", "sourceId");

CREATE INDEX "BalanceSnapshot_userId_date_idx"
    ON "BalanceSnapshot"("userId", "date");

CREATE INDEX "BalanceSnapshot_userId_source_sourceId_idx"
    ON "BalanceSnapshot"("userId", "source", "sourceId");

ALTER TABLE "BalanceSnapshot"
    ADD CONSTRAINT "BalanceSnapshot_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
