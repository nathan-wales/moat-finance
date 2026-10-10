-- SQLite: rule condition groups (mirrored in packages/db-sqlite/src/migrations.ts for runtime)

ALTER TABLE "TransactionRule" ADD COLUMN "match" TEXT NOT NULL DEFAULT 'ALL';

CREATE TABLE IF NOT EXISTS "RuleConditionGroup" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "ruleId" TEXT NOT NULL,
    "match" TEXT NOT NULL DEFAULT 'ALL',
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "RuleConditionGroup_ruleId_fkey" FOREIGN KEY ("ruleId") REFERENCES "TransactionRule" ("id") ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS "RuleConditionGroup_ruleId_sortOrder_idx" ON "RuleConditionGroup" ("ruleId", "sortOrder");

-- One ALL group per existing rule so every legacy condition has a parent.
INSERT OR IGNORE INTO "RuleConditionGroup" ("id", "ruleId", "match", "sortOrder", "createdAt", "updatedAt")
SELECT 'rcg_' || "id", "id", 'ALL', 0, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP FROM "TransactionRule";

-- Rebuild RuleCondition to add the required groupId column (SQLite cannot ALTER COLUMN).
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_RuleCondition" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "ruleId" TEXT NOT NULL,
    "groupId" TEXT NOT NULL,
    "field" TEXT NOT NULL,
    "operator" TEXT NOT NULL,
    "valueText" TEXT,
    "valueNumber" REAL,
    "valueDate" DATETIME,
    "secondValueNumber" REAL,
    "secondValueDate" DATETIME,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "RuleCondition_ruleId_fkey" FOREIGN KEY ("ruleId") REFERENCES "TransactionRule" ("id") ON DELETE CASCADE,
    CONSTRAINT "RuleCondition_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "RuleConditionGroup" ("id") ON DELETE CASCADE
);
INSERT INTO "new_RuleCondition" (
    "id", "ruleId", "groupId", "field", "operator",
    "valueText", "valueNumber", "valueDate",
    "secondValueNumber", "secondValueDate",
    "sortOrder", "createdAt", "updatedAt"
)
SELECT
    "id", "ruleId", 'rcg_' || "ruleId", "field", "operator",
    "valueText", "valueNumber", "valueDate",
    "secondValueNumber", "secondValueDate",
    "sortOrder", "createdAt", "updatedAt"
FROM "RuleCondition";
DROP TABLE "RuleCondition";
ALTER TABLE "new_RuleCondition" RENAME TO "RuleCondition";
CREATE INDEX "RuleCondition_groupId_sortOrder_idx" ON "RuleCondition" ("groupId", "sortOrder");
PRAGMA foreign_keys=ON;
