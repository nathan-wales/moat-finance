-- Initial migration for packages/db-sqlite
-- This creates all tables required for the Fin desktop app local database.
-- Generated to match prisma/schema.prisma (provider = "sqlite")

CREATE TABLE IF NOT EXISTS "LocalUser" (
    "id"        TEXT     NOT NULL PRIMARY KEY,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

CREATE TABLE IF NOT EXISTS "Account" (
    "id"              TEXT     NOT NULL PRIMARY KEY,
    "userId"          TEXT     NOT NULL,
    "name"            TEXT     NOT NULL,
    "type"            TEXT     NOT NULL,
    "subtype"         TEXT,
    "institutionName" TEXT,
    "currentBalance"  REAL,
    "currency"        TEXT     NOT NULL DEFAULT 'USD',
    "mask"            TEXT,
    "isHidden"        INTEGER  NOT NULL DEFAULT 0,
    "isActive"        INTEGER  NOT NULL DEFAULT 1,
    "createdAt"       DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"       DATETIME NOT NULL,
    CONSTRAINT "Account_userId_fkey" FOREIGN KEY ("userId") REFERENCES "LocalUser" ("id") ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS "Category" (
    "id"        TEXT     NOT NULL PRIMARY KEY,
    "name"      TEXT     NOT NULL,
    "userId"    TEXT,
    "isHidden"  INTEGER  NOT NULL DEFAULT 0,
    "sortOrder" INTEGER  NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

CREATE TABLE IF NOT EXISTS "Transaction" (
    "id"           TEXT     NOT NULL PRIMARY KEY,
    "userId"       TEXT     NOT NULL,
    "accountId"    TEXT,
    "categoryId"   TEXT,
    "date"         DATETIME NOT NULL,
    "postedDate"   DATETIME,
    "amount"       REAL     NOT NULL,
    "merchantName" TEXT,
    "description"  TEXT,
    "type"         TEXT     NOT NULL DEFAULT 'EXPENSE',
    "pending"      INTEGER  NOT NULL DEFAULT 0,
    "hidden"       INTEGER  NOT NULL DEFAULT 0,
    "source"       TEXT     NOT NULL DEFAULT 'manual',
    "removedAt"    DATETIME,
    "createdAt"    DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"    DATETIME NOT NULL,
    CONSTRAINT "Transaction_userId_fkey"   FOREIGN KEY ("userId")   REFERENCES "LocalUser" ("id") ON DELETE CASCADE,
    CONSTRAINT "Transaction_accountId_fkey"  FOREIGN KEY ("accountId")  REFERENCES "Account"   ("id") ON DELETE SET NULL,
    CONSTRAINT "Transaction_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "Category"  ("id") ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS "CategoryBudget" (
    "id"          TEXT     NOT NULL PRIMARY KEY,
    "userId"      TEXT     NOT NULL,
    "categoryId"  TEXT     NOT NULL,
    "monthlyGoal" REAL     NOT NULL,
    "createdAt"   DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"   DATETIME NOT NULL,
    CONSTRAINT "CategoryBudget_userId_fkey"     FOREIGN KEY ("userId")     REFERENCES "LocalUser" ("id") ON DELETE CASCADE,
    CONSTRAINT "CategoryBudget_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "Category"  ("id") ON DELETE CASCADE
);

CREATE UNIQUE INDEX IF NOT EXISTS "CategoryBudget_userId_categoryId_key"
    ON "CategoryBudget" ("userId", "categoryId");

CREATE TABLE IF NOT EXISTS "Hashtag" (
    "id"             TEXT     NOT NULL PRIMARY KEY,
    "userId"         TEXT     NOT NULL,
    "name"           TEXT     NOT NULL,
    "normalizedName" TEXT     NOT NULL,
    "createdAt"      DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"      DATETIME NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS "Hashtag_userId_normalizedName_key"
    ON "Hashtag" ("userId", "normalizedName");

CREATE INDEX IF NOT EXISTS "Hashtag_userId_idx"
    ON "Hashtag" ("userId");

CREATE TABLE IF NOT EXISTS "TransactionHashtag" (
    "transactionId" TEXT     NOT NULL,
    "hashtagId"     TEXT     NOT NULL,
    "createdAt"     DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY ("transactionId", "hashtagId"),
    CONSTRAINT "TransactionHashtag_transactionId_fkey" FOREIGN KEY ("transactionId") REFERENCES "Transaction" ("id") ON DELETE CASCADE,
    CONSTRAINT "TransactionHashtag_hashtagId_fkey"     FOREIGN KEY ("hashtagId")     REFERENCES "Hashtag"     ("id") ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS "TransactionHashtag_hashtagId_idx"
    ON "TransactionHashtag" ("hashtagId");

CREATE TABLE IF NOT EXISTS "TransactionRule" (
    "id"        TEXT     NOT NULL PRIMARY KEY,
    "userId"    TEXT     NOT NULL,
    "name"      TEXT     NOT NULL,
    "isActive"  INTEGER  NOT NULL DEFAULT 1,
    "priority"  INTEGER  NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "TransactionRule_userId_fkey" FOREIGN KEY ("userId") REFERENCES "LocalUser" ("id") ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS "RuleCondition" (
    "id"                TEXT     NOT NULL PRIMARY KEY,
    "ruleId"            TEXT     NOT NULL,
    "field"             TEXT     NOT NULL,
    "operator"          TEXT     NOT NULL,
    "valueText"         TEXT,
    "valueNumber"       REAL,
    "valueDate"         DATETIME,
    "secondValueNumber" REAL,
    "secondValueDate"   DATETIME,
    "sortOrder"         INTEGER  NOT NULL DEFAULT 0,
    "createdAt"         DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"         DATETIME NOT NULL,
    CONSTRAINT "RuleCondition_ruleId_fkey" FOREIGN KEY ("ruleId") REFERENCES "TransactionRule" ("id") ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS "RuleAction" (
    "id"          TEXT     NOT NULL PRIMARY KEY,
    "ruleId"      TEXT     NOT NULL,
    "type"        TEXT     NOT NULL,
    "valueText"   TEXT,
    "hashtagId"   TEXT,
    "hashtagName" TEXT,
    "sortOrder"   INTEGER  NOT NULL DEFAULT 0,
    "createdAt"   DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"   DATETIME NOT NULL,
    CONSTRAINT "RuleAction_ruleId_fkey" FOREIGN KEY ("ruleId") REFERENCES "TransactionRule" ("id") ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS "ForecastScenario" (
    "id"                 TEXT     NOT NULL PRIMARY KEY,
    "userId"             TEXT     NOT NULL,
    "name"               TEXT     NOT NULL,
    "type"               TEXT     NOT NULL DEFAULT 'custom',
    "investmentReturn"   REAL     NOT NULL DEFAULT 0,
    "inflationRate"      REAL     NOT NULL DEFAULT 0,
    "salaryGrowth"       REAL     NOT NULL DEFAULT 0,
    "contributionChange" REAL     NOT NULL DEFAULT 0,
    "expenseGrowth"      REAL     NOT NULL DEFAULT 0,
    "isActive"           INTEGER  NOT NULL DEFAULT 1,
    "createdAt"          DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"          DATETIME NOT NULL,
    CONSTRAINT "ForecastScenario_userId_fkey" FOREIGN KEY ("userId") REFERENCES "LocalUser" ("id") ON DELETE CASCADE
);
