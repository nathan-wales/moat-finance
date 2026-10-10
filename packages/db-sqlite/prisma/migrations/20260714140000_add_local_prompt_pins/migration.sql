CREATE TABLE IF NOT EXISTS "LocalPromptPin" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "source" TEXT NOT NULL,
    "promptId" TEXT NOT NULL,
    "pinnedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE UNIQUE INDEX IF NOT EXISTS "LocalPromptPin_source_promptId_key"
ON "LocalPromptPin" ("source", "promptId");

CREATE INDEX IF NOT EXISTS "LocalPromptPin_source_pinnedAt_idx"
ON "LocalPromptPin" ("source", "pinnedAt");
