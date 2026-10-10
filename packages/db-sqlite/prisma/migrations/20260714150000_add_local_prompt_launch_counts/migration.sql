CREATE TABLE IF NOT EXISTS "LocalPromptLaunchStat" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "source" TEXT NOT NULL,
    "promptId" TEXT NOT NULL,
    "launchCount" INTEGER NOT NULL DEFAULT 0
);

CREATE UNIQUE INDEX IF NOT EXISTS "LocalPromptLaunchStat_source_promptId_key"
ON "LocalPromptLaunchStat" ("source", "promptId");

CREATE INDEX IF NOT EXISTS "LocalPromptLaunchStat_source_launchCount_idx"
ON "LocalPromptLaunchStat" ("source", "launchCount");

CREATE TABLE IF NOT EXISTS "LocalPromptLaunchDaily" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "source" TEXT NOT NULL,
    "promptId" TEXT NOT NULL,
    "launchDate" DATETIME NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS "LocalPromptLaunchDaily_source_promptId_launchDate_key"
ON "LocalPromptLaunchDaily" ("source", "promptId", "launchDate");

CREATE INDEX IF NOT EXISTS "LocalPromptLaunchDaily_source_launchDate_idx"
ON "LocalPromptLaunchDaily" ("source", "launchDate");
