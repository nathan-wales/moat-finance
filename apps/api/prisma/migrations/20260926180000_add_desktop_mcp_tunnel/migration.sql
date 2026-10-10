-- Remote MCP tunnel device registry and device-scoped OAuth tokens.
-- No financial columns.

ALTER TABLE "McpOAuthAuthorizationCode" ADD COLUMN "desktopPublicTunnelId" TEXT;

ALTER TABLE "McpOAuthAccessToken" ADD COLUMN "desktopPublicTunnelId" TEXT;

CREATE INDEX "McpOAuthAccessToken_desktopPublicTunnelId_idx" ON "McpOAuthAccessToken"("desktopPublicTunnelId");

CREATE TABLE "DesktopMcpTunnel" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "deviceId" TEXT NOT NULL,
    "publicTunnelId" TEXT NOT NULL,
    "label" TEXT,
    "revokedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DesktopMcpTunnel_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "DesktopMcpTunnel_publicTunnelId_key" ON "DesktopMcpTunnel"("publicTunnelId");

CREATE UNIQUE INDEX "DesktopMcpTunnel_userId_deviceId_key" ON "DesktopMcpTunnel"("userId", "deviceId");

CREATE INDEX "DesktopMcpTunnel_userId_idx" ON "DesktopMcpTunnel"("userId");

ALTER TABLE "DesktopMcpTunnel" ADD CONSTRAINT "DesktopMcpTunnel_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "DesktopMcpTunnel" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "DesktopMcpTunnel" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS desktopmcptunnel_tenant_access ON "DesktopMcpTunnel";
CREATE POLICY desktopmcptunnel_tenant_access ON "DesktopMcpTunnel"
  FOR ALL
  USING (moat_is_service_actor() OR ("userId" = moat_app_user_id()))
  WITH CHECK (moat_is_service_actor() OR ("userId" = moat_app_user_id()));
