-- SQLite: recreate LocalUserPrompt to allow null categorySlug
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_LocalUserPrompt" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "body" TEXT NOT NULL,
    "categorySlug" TEXT,
    "tags" TEXT NOT NULL DEFAULT '[]',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);
INSERT INTO "new_LocalUserPrompt" ("id", "title", "description", "body", "categorySlug", "tags", "createdAt", "updatedAt")
SELECT "id", "title", "description", "body", "categorySlug", "tags", "createdAt", "updatedAt" FROM "LocalUserPrompt";
DROP TABLE "LocalUserPrompt";
ALTER TABLE "new_LocalUserPrompt" RENAME TO "LocalUserPrompt";
PRAGMA foreign_keys=ON;
