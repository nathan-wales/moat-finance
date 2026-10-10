ALTER TABLE "UserSettings"
ADD COLUMN "extensionMetadata" JSONB;

UPDATE "UserSettings" us
SET "extensionMetadata" = jsonb_build_object(
    'retailSyncTourCompletedAt',
    to_char((NOW() AT TIME ZONE 'utc'), 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'),
    'retailSyncTourVersion',
    1
)
WHERE EXISTS (
    SELECT 1
    FROM "RetailConnection" rc
    WHERE rc."userId" = us."userId"
)
OR EXISTS (
    SELECT 1
    FROM "RetailOrder" ro
    WHERE ro."userId" = us."userId"
);

INSERT INTO "UserSettings" (
    "id",
    "userId",
    "extensionMetadata",
    "createdAt",
    "updatedAt"
)
SELECT
    gen_random_uuid()::text,
    u."id",
    jsonb_build_object(
        'retailSyncTourCompletedAt',
        to_char((NOW() AT TIME ZONE 'utc'), 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'),
        'retailSyncTourVersion',
        1
    ),
    NOW(),
    NOW()
FROM "User" u
WHERE (
    EXISTS (
        SELECT 1
        FROM "RetailConnection" rc
        WHERE rc."userId" = u."id"
    )
    OR EXISTS (
        SELECT 1
        FROM "RetailOrder" ro
        WHERE ro."userId" = u."id"
    )
)
AND NOT EXISTS (
    SELECT 1
    FROM "UserSettings" us
    WHERE us."userId" = u."id"
);
