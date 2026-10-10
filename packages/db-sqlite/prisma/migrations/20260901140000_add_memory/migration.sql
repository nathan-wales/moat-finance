-- CreateTable
CREATE TABLE IF NOT EXISTS "Memory" (
    "id"        TEXT     NOT NULL PRIMARY KEY,
    "userId"    TEXT     NOT NULL,
    "title"     TEXT     NOT NULL,
    "content"   TEXT     NOT NULL,
    "category"  TEXT,
    "source"    TEXT     NOT NULL DEFAULT 'manual',
    "metadata"  TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deletedAt" DATETIME,
    CONSTRAINT "Memory_userId_fkey" FOREIGN KEY ("userId") REFERENCES "LocalUser" ("id") ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS "Memory_userId_idx" ON "Memory" ("userId");
CREATE INDEX IF NOT EXISTS "Memory_userId_category_idx" ON "Memory" ("userId", "category");
CREATE INDEX IF NOT EXISTS "Memory_userId_deletedAt_idx" ON "Memory" ("userId", "deletedAt");
