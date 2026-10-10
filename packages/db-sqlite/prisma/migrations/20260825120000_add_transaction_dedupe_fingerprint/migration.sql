-- Persist provider-compatible transaction fingerprints for CSV import dedupe
ALTER TABLE "Transaction" ADD COLUMN "dedupeFingerprint" TEXT;
CREATE INDEX IF NOT EXISTS "Transaction_userId_dedupeFingerprint_idx" ON "Transaction" ("userId", "dedupeFingerprint");
