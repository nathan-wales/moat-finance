-- Desktop retirement plan, scenarios, levers, and spending category plans

CREATE TABLE IF NOT EXISTS "RetirementPlan" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL UNIQUE,
    "primaryBirthYear" INTEGER,
    "targetRetirementAge" INTEGER NOT NULL DEFAULT 65,
    "longevityAge" INTEGER NOT NULL DEFAULT 95,
    "socialSecurityClaimAge" INTEGER NOT NULL DEFAULT 67,
    "socialSecurityMonthlyAtFra" REAL,
    "hasSpouse" INTEGER NOT NULL DEFAULT 0,
    "spouseBirthYear" INTEGER,
    "spouseRetirementAge" INTEGER,
    "spouseLongevityAge" INTEGER,
    "spouseSocialSecurityClaimAge" INTEGER,
    "spouseSocialSecurityMonthlyAtFra" REAL,
    "confidenceTarget" REAL NOT NULL DEFAULT 0.85,
    "monteCarloTrials" INTEGER NOT NULL DEFAULT 1000,
    "spendingStages" TEXT NOT NULL DEFAULT '[]',
    "spendingOverrides" TEXT NOT NULL DEFAULT '{}',
    "timelinePreferences" TEXT NOT NULL DEFAULT '{}',
    "withdrawalOrder" TEXT NOT NULL DEFAULT '["taxable","taxDeferred","taxFree"]',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "RetirementPlan_userId_fkey" FOREIGN KEY ("userId") REFERENCES "LocalUser" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE TABLE IF NOT EXISTS "RetirementScenario" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "planId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "color" TEXT,
    "source" TEXT NOT NULL DEFAULT 'USER',
    "isPinned" INTEGER NOT NULL DEFAULT 0,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "RetirementScenario_userId_fkey" FOREIGN KEY ("userId") REFERENCES "LocalUser" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "RetirementScenario_planId_fkey" FOREIGN KEY ("planId") REFERENCES "RetirementPlan" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX IF NOT EXISTS "RetirementScenario_userId_idx" ON "RetirementScenario" ("userId");
CREATE INDEX IF NOT EXISTS "RetirementScenario_planId_sortOrder_idx" ON "RetirementScenario" ("planId", "sortOrder");

CREATE TABLE IF NOT EXISTS "RetirementScenarioLever" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "scenarioId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "params" TEXT NOT NULL,
    "enabled" INTEGER NOT NULL DEFAULT 1,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "RetirementScenarioLever_scenarioId_fkey" FOREIGN KEY ("scenarioId") REFERENCES "RetirementScenario" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX IF NOT EXISTS "RetirementScenarioLever_scenarioId_sortOrder_idx" ON "RetirementScenarioLever" ("scenarioId", "sortOrder");

CREATE TABLE IF NOT EXISTS "RetirementSpendingCategoryPlan" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "categoryId" TEXT NOT NULL,
    "treatment" TEXT NOT NULL,
    "essentiality" TEXT NOT NULL,
    "retirementMonthlyAmount" REAL,
    "isUserEdited" INTEGER NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "RetirementSpendingCategoryPlan_userId_fkey" FOREIGN KEY ("userId") REFERENCES "LocalUser" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE UNIQUE INDEX IF NOT EXISTS "RetirementSpendingCategoryPlan_userId_categoryId_key" ON "RetirementSpendingCategoryPlan" ("userId", "categoryId");
CREATE INDEX IF NOT EXISTS "RetirementSpendingCategoryPlan_userId_idx" ON "RetirementSpendingCategoryPlan" ("userId");
