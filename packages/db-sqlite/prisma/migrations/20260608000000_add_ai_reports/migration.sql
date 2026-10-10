-- Add AI report tables for desktop local storage

CREATE TABLE IF NOT EXISTS "AiReport" (
    "id"            TEXT     NOT NULL PRIMARY KEY,
    "userId"        TEXT     NOT NULL,
    "title"         TEXT     NOT NULL,
    "description"   TEXT,
    "sanitizedHtml" TEXT     NOT NULL DEFAULT '',
    "sanitizedCss"  TEXT     NOT NULL DEFAULT '',
    "visibility"    TEXT     NOT NULL DEFAULT 'PRIVATE',
    "shareSlug"     TEXT,
    "document"      TEXT,
    "createdBy"     TEXT     NOT NULL DEFAULT 'AGENT',
    "createdAt"     DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"     DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deletedAt"     DATETIME
);

CREATE UNIQUE INDEX IF NOT EXISTS "AiReport_shareSlug_key" ON "AiReport" ("shareSlug");
CREATE INDEX IF NOT EXISTS "AiReport_userId_idx" ON "AiReport" ("userId");
CREATE INDEX IF NOT EXISTS "AiReport_userId_deletedAt_idx" ON "AiReport" ("userId", "deletedAt");
CREATE INDEX IF NOT EXISTS "AiReport_shareSlug_idx" ON "AiReport" ("shareSlug");

CREATE TABLE IF NOT EXISTS "AiReportShare" (
    "id"            TEXT     NOT NULL PRIMARY KEY,
    "reportId"      TEXT     NOT NULL,
    "userId"        TEXT     NOT NULL,
    "shareSlug"     TEXT     NOT NULL,
    "title"         TEXT     NOT NULL,
    "description"   TEXT,
    "document"      TEXT,
    "sanitizedHtml" TEXT     NOT NULL DEFAULT '',
    "sanitizedCss"  TEXT     NOT NULL DEFAULT '',
    "isEnabled"     INTEGER  NOT NULL DEFAULT 1,
    "createdAt"     DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"     DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "revokedAt"     DATETIME,
    CONSTRAINT "AiReportShare_reportId_fkey" FOREIGN KEY ("reportId") REFERENCES "AiReport" ("id") ON DELETE CASCADE
);

CREATE UNIQUE INDEX IF NOT EXISTS "AiReportShare_shareSlug_key" ON "AiReportShare" ("shareSlug");
CREATE INDEX IF NOT EXISTS "AiReportShare_reportId_idx" ON "AiReportShare" ("reportId");
CREATE INDEX IF NOT EXISTS "AiReportShare_userId_idx" ON "AiReportShare" ("userId");
CREATE INDEX IF NOT EXISTS "AiReportShare_shareSlug_idx" ON "AiReportShare" ("shareSlug");

CREATE TABLE IF NOT EXISTS "AiReportVersion" (
    "id"            TEXT     NOT NULL PRIMARY KEY,
    "reportId"      TEXT     NOT NULL,
    "title"         TEXT     NOT NULL,
    "description"   TEXT,
    "sanitizedHtml" TEXT     NOT NULL DEFAULT '',
    "sanitizedCss"  TEXT     NOT NULL DEFAULT '',
    "document"      TEXT,
    "createdAt"     DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "AiReportVersion_reportId_fkey" FOREIGN KEY ("reportId") REFERENCES "AiReport" ("id") ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS "AiReportVersion_reportId_idx" ON "AiReportVersion" ("reportId");
