PRAGMA foreign_keys=OFF;
CREATE TABLE "new_PlaidItem" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "plaidItemId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "institutionId" TEXT,
    "institutionName" TEXT NOT NULL,
    "accessTokenEncrypted" BLOB,
    "accessRevokedAt" DATETIME,
    "cursor" TEXT,
    "requiresReconnect" BOOLEAN NOT NULL DEFAULT false,
    "lastErrorCode" TEXT,
    "lastErrorMessage" TEXT,
    "lastSyncAt" DATETIME,
    "lastSuccessfulSyncAt" DATETIME,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "PlaidItem_userId_fkey" FOREIGN KEY ("userId") REFERENCES "LocalUser" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_PlaidItem" (
    "id", "plaidItemId", "userId", "institutionId", "institutionName",
    "accessTokenEncrypted", "cursor", "requiresReconnect", "lastErrorCode",
    "lastErrorMessage", "lastSyncAt", "lastSuccessfulSyncAt", "sortOrder",
    "createdAt", "updatedAt"
)
SELECT
    "id", "plaidItemId", "userId", "institutionId", "institutionName",
    "accessTokenEncrypted", "cursor", "requiresReconnect", "lastErrorCode",
    "lastErrorMessage", "lastSyncAt", "lastSuccessfulSyncAt", "sortOrder",
    "createdAt", "updatedAt"
FROM "PlaidItem";
DROP TABLE "PlaidItem";
ALTER TABLE "new_PlaidItem" RENAME TO "PlaidItem";
CREATE UNIQUE INDEX "PlaidItem_plaidItemId_key" ON "PlaidItem"("plaidItemId");
PRAGMA foreign_keys=ON;
