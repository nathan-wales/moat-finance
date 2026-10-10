-- CreateTable
CREATE TABLE "McpPersonalAccessToken" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "tokenPrefix" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "scopes" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "clientName" TEXT,
    "expiresAt" TIMESTAMP(3),
    "revokedAt" TIMESTAMP(3),
    "lastUsedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "McpPersonalAccessToken_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "McpOAuthClient" (
    "id" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "clientSecretHash" TEXT,
    "name" TEXT NOT NULL,
    "clientProfile" TEXT NOT NULL,
    "redirectUris" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "scopes" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "grants" TEXT[] DEFAULT ARRAY['authorization_code', 'refresh_token']::TEXT[],
    "requestsPerMinute" INTEGER NOT NULL DEFAULT 60,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "revokedAt" TIMESTAMP(3),

    CONSTRAINT "McpOAuthClient_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "McpOAuthAuthorizationCode" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "oauthClientId" TEXT NOT NULL,
    "codeHash" TEXT NOT NULL,
    "codeChallenge" TEXT NOT NULL,
    "codeChallengeMethod" TEXT NOT NULL,
    "redirectUri" TEXT NOT NULL,
    "scopes" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "consumedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "ipAddress" TEXT,
    "userAgent" TEXT,

    CONSTRAINT "McpOAuthAuthorizationCode_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "McpOAuthAccessToken" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "oauthClientId" TEXT NOT NULL,
    "tokenPrefix" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "refreshTokenHash" TEXT,
    "refreshTokenExpiresAt" TIMESTAMP(3),
    "scopes" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "revokedAt" TIMESTAMP(3),
    "lastUsedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "McpOAuthAccessToken_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "McpToolCall" (
    "id" TEXT NOT NULL,
    "userId" TEXT,
    "householdId" TEXT,
    "personalAccessTokenId" TEXT,
    "oauthAccessTokenId" TEXT,
    "oauthClientId" TEXT,
    "clientName" TEXT,
    "clientProfile" TEXT,
    "toolName" TEXT NOT NULL,
    "requiredScopes" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "grantedScopes" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "inputHash" TEXT,
    "inputSummary" JSONB,
    "outputSummary" JSONB,
    "status" TEXT NOT NULL,
    "durationMs" INTEGER NOT NULL,
    "errorCode" TEXT,
    "rateLimited" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "McpToolCall_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "McpPersonalAccessToken_tokenHash_key" ON "McpPersonalAccessToken"("tokenHash");
CREATE INDEX "McpPersonalAccessToken_userId_idx" ON "McpPersonalAccessToken"("userId");
CREATE INDEX "McpPersonalAccessToken_userId_revokedAt_idx" ON "McpPersonalAccessToken"("userId", "revokedAt");
CREATE INDEX "McpPersonalAccessToken_expiresAt_idx" ON "McpPersonalAccessToken"("expiresAt");
CREATE INDEX "McpPersonalAccessToken_tokenHash_idx" ON "McpPersonalAccessToken"("tokenHash");

-- CreateIndex
CREATE UNIQUE INDEX "McpOAuthClient_clientId_key" ON "McpOAuthClient"("clientId");
CREATE INDEX "McpOAuthClient_clientProfile_idx" ON "McpOAuthClient"("clientProfile");
CREATE INDEX "McpOAuthClient_revokedAt_idx" ON "McpOAuthClient"("revokedAt");

-- CreateIndex
CREATE UNIQUE INDEX "McpOAuthAuthorizationCode_codeHash_key" ON "McpOAuthAuthorizationCode"("codeHash");
CREATE INDEX "McpOAuthAuthorizationCode_userId_idx" ON "McpOAuthAuthorizationCode"("userId");
CREATE INDEX "McpOAuthAuthorizationCode_oauthClientId_idx" ON "McpOAuthAuthorizationCode"("oauthClientId");
CREATE INDEX "McpOAuthAuthorizationCode_expiresAt_idx" ON "McpOAuthAuthorizationCode"("expiresAt");
CREATE INDEX "McpOAuthAuthorizationCode_consumedAt_idx" ON "McpOAuthAuthorizationCode"("consumedAt");

-- CreateIndex
CREATE UNIQUE INDEX "McpOAuthAccessToken_tokenHash_key" ON "McpOAuthAccessToken"("tokenHash");
CREATE UNIQUE INDEX "McpOAuthAccessToken_refreshTokenHash_key" ON "McpOAuthAccessToken"("refreshTokenHash");
CREATE INDEX "McpOAuthAccessToken_userId_idx" ON "McpOAuthAccessToken"("userId");
CREATE INDEX "McpOAuthAccessToken_oauthClientId_idx" ON "McpOAuthAccessToken"("oauthClientId");
CREATE INDEX "McpOAuthAccessToken_userId_revokedAt_idx" ON "McpOAuthAccessToken"("userId", "revokedAt");
CREATE INDEX "McpOAuthAccessToken_expiresAt_idx" ON "McpOAuthAccessToken"("expiresAt");
CREATE INDEX "McpOAuthAccessToken_refreshTokenExpiresAt_idx" ON "McpOAuthAccessToken"("refreshTokenExpiresAt");
CREATE INDEX "McpOAuthAccessToken_tokenHash_idx" ON "McpOAuthAccessToken"("tokenHash");

-- CreateIndex
CREATE INDEX "McpToolCall_userId_createdAt_idx" ON "McpToolCall"("userId", "createdAt");
CREATE INDEX "McpToolCall_personalAccessTokenId_createdAt_idx" ON "McpToolCall"("personalAccessTokenId", "createdAt");
CREATE INDEX "McpToolCall_oauthAccessTokenId_createdAt_idx" ON "McpToolCall"("oauthAccessTokenId", "createdAt");
CREATE INDEX "McpToolCall_oauthClientId_createdAt_idx" ON "McpToolCall"("oauthClientId", "createdAt");
CREATE INDEX "McpToolCall_toolName_createdAt_idx" ON "McpToolCall"("toolName", "createdAt");
CREATE INDEX "McpToolCall_status_createdAt_idx" ON "McpToolCall"("status", "createdAt");

-- AddForeignKey
ALTER TABLE "McpPersonalAccessToken" ADD CONSTRAINT "McpPersonalAccessToken_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "McpOAuthAuthorizationCode" ADD CONSTRAINT "McpOAuthAuthorizationCode_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "McpOAuthAuthorizationCode" ADD CONSTRAINT "McpOAuthAuthorizationCode_oauthClientId_fkey" FOREIGN KEY ("oauthClientId") REFERENCES "McpOAuthClient"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "McpOAuthAccessToken" ADD CONSTRAINT "McpOAuthAccessToken_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "McpOAuthAccessToken" ADD CONSTRAINT "McpOAuthAccessToken_oauthClientId_fkey" FOREIGN KEY ("oauthClientId") REFERENCES "McpOAuthClient"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "McpToolCall" ADD CONSTRAINT "McpToolCall_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "McpToolCall" ADD CONSTRAINT "McpToolCall_personalAccessTokenId_fkey" FOREIGN KEY ("personalAccessTokenId") REFERENCES "McpPersonalAccessToken"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "McpToolCall" ADD CONSTRAINT "McpToolCall_oauthAccessTokenId_fkey" FOREIGN KEY ("oauthAccessTokenId") REFERENCES "McpOAuthAccessToken"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "McpToolCall" ADD CONSTRAINT "McpToolCall_oauthClientId_fkey" FOREIGN KEY ("oauthClientId") REFERENCES "McpOAuthClient"("id") ON DELETE SET NULL ON UPDATE CASCADE;
