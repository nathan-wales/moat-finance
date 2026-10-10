We need to update the existing Moat Finance settings area to add a new tab called “MCP Settings”.

Context:
Moat Finance already has MCP infrastructure for:
- Personal Access Tokens
- OAuth connections
- MCP scopes
- MCP clients
- MCP server access

I attached a screenshot of the current MCP access UI. We want to reorganize and improve this into a dedicated settings tab.

Goal:
Create a new settings tab named “MCP Settings” that lets users manage and monitor MCP connections with their personal AI assistants.

Top-level page/tab copy:
Title: AI Access
Description: Manage and monitor your MCP connections with your personal AI assistants.

The page should contain three main sections:

1. OAuth connections
2. Personal Access Tokens
3. MCP logs

Layout:
- At the top of the tab, show the title and description.
- Below that, create a two-column layout on desktop:
  - Left column: OAuth connections
  - Right column: Personal Access Tokens
- Below both columns, full width: MCP logs
- On mobile, stack everything vertically:
  - OAuth connections
  - Personal Access Tokens
  - MCP logs

Important:
The OAuth connections should be on the top left.
The Personal Access Tokens component should be on the top right.
The MCP logs should be below both.

Design:
- Mirror the existing card-based visual style from our current MCP access screen.
- Use our existing design system components where possible.
- Reuse existing button, badge, card, table/list, empty state, dialog, and toast components where possible.
- Keep the UI clean and consistent with the rest of Moat Finance settings.
- Each section should be independently reusable as a component.

Suggested components:
- `McpSettingsTab`
- `OAuthConnectionsCard`
- `PersonalAccessTokensCard`
- `McpLogsCard`
- `McpLogRow`
- `McpLogDetailsDialog`

OAuth connections section:
- Display connected hosted MCP clients.
- Show client name, provider/client type if available, token prefix or connection id prefix, scopes, connected date, refresh expiration date, status, and revoke action.
- Status badges should support states like Active, Expired, Revoked.
- Reuse existing OAuth connection logic if it already exists.
- Revoked or expired connections should have disabled revoke buttons.
- Active connections should be revokable with confirmation.

Personal Access Tokens section:
- Display scoped tokens for local MCP clients.
- Show token name, token prefix, scopes, created date, last used date, expiration date, status, and revoke action.
- Keep or reuse the existing “Create token” flow.
- Create token button should live in the card header.
- Revoked tokens should be visibly disabled/muted.
- Active tokens should be revokable with confirmation.

MCP logs section:
We should already have data for MCP logs. First inspect the current codebase/schema for any existing MCP request log, audit log, API log, access log, tool call log, or similar model.

If MCP logs already exist:
- Reuse the existing data model.
- Add/extend the API route or tRPC router needed to fetch logs for the current user/workspace.
- Display them in the MCP logs section.

If MCP logs do not exist:
Add a database model for MCP logs and wire it into the MCP server request lifecycle.

Suggested Prisma model:

model McpLog {
  id             String   @id @default(cuid())
  userId         String?
  workspaceId    String?
  clientId       String?
  connectionId   String?
  tokenId        String?
  authType       McpAuthType
  clientName     String?
  method         String?
  toolName       String?
  resource       String?
  scopes         String[]
  status         McpLogStatus
  statusCode     Int?
  errorMessage   String?
  ipAddress      String?
  userAgent      String?
  requestId      String?
  durationMs     Int?
  metadata       Json?
  createdAt      DateTime @default(now())

  @@index([userId, createdAt])
  @@index([workspaceId, createdAt])
  @@index([clientId, createdAt])
  @@index([tokenId, createdAt])
  @@index([connectionId, createdAt])
  @@index([status, createdAt])
}

enum McpAuthType {
  PAT
  OAUTH
  UNKNOWN
}

enum McpLogStatus {
  SUCCESS
  ERROR
  DENIED
}

Adjust the names/types to match our existing schema conventions.

MCP log events to capture:
- Successful MCP requests
- Failed MCP requests
- Permission/scope denied requests
- OAuth connection usage
- PAT usage
- Tool calls
- Resource reads
- Memory reads/writes
- Reports writes
- Feedback writes
- Any MCP request that hits the MCP server

Each log should capture as much of this as safely possible:
- userId
- workspaceId/accountId if applicable
- clientId / connectionId / tokenId
- auth type: PAT or OAuth
- client name
- requested method
- tool name/resource name
- requested scopes or matched scopes
- success/error/denied status
- HTTP status code if applicable
- error message if applicable
- request id
- duration
- createdAt
- safe metadata

Security/privacy:
- Never store full access tokens.
- Never store refresh tokens.
- Never store raw sensitive payloads.
- Token display should only use a safe prefix like `moat_dev_0a7v...`.
- MCP logs should avoid storing financial transaction details or private raw data unless explicitly safe.
- Log metadata should be sanitized.

MCP logs UI:
- Display logs in a table or compact list.
- Columns should include:
  - Time
  - Client
  - Auth type
  - Action/tool/resource
  - Status
  - Duration
- Add status badges:
  - Success
  - Error
  - Denied
- Add simple filters:
  - Status
  - Auth type
  - Client
  - Search by tool/resource/client
- Add pagination or infinite loading if the logs can grow large.
- Add a details dialog/drawer when clicking a log row.
- Details view should show safe metadata, request id, scopes, status code, error message, created timestamp, and duration.

Backend/API:
- Add or extend a router for MCP settings data.
- Suggested endpoints:
  - `mcpSettings.getOAuthConnections`
  - `mcpSettings.getPersonalAccessTokens`
  - `mcpSettings.getLogs`
  - `mcpSettings.revokeOAuthConnection`
  - `mcpSettings.revokePersonalAccessToken`
  - reuse existing create-token endpoint if it already exists
- Use our existing auth/session helpers.
- Only return data for the authenticated user/workspace.
- Add authorization checks.
- Make sure revoked connections/tokens cannot be used.

Integration:
- Place this under the existing Settings navigation as a new tab: “MCP Settings”.
- Do not remove the existing MCP access functionality until this new tab is fully wired.
- If there is an older MCP access page, either migrate it into this new tab or route users to this new tab depending on the current app structure.
- Ensure this works in both the web app and desktop app if settings are shared.
- If this logic belongs in a shared package, place reusable UI and data-access logic there, following our existing package structure.

Acceptance criteria:
- A new “MCP Settings” tab appears in Settings.
- The tab has title: “MCP Settings”.
- The tab has description: “Manage and monitor your MCP connections with your personal AI assistants.”
- OAuth connections render in the top-left card.
- Personal Access Tokens render in the top-right card.
- MCP logs render below both cards.
- Existing PAT creation/revocation still works.
- Existing OAuth revoke behavior still works.
- MCP logs are displayed from real data.
- If logs did not previously exist, a new database model and logging pipeline are added.
- MCP logs are sanitized and do not leak token secrets or sensitive financial payloads.
- Empty states exist for OAuth connections, PATs, and logs.
- Loading and error states exist for all three sections.
- UI is responsive.
- TypeScript passes.
- Lint passes.
- Prisma migration is included if schema changes are needed.
- Add tests for core data fetching and revoke behavior if the repo already has testing patterns for settings/MCP.

Have infinite scroll on the MCP logs and show only the first 30

Also it looks like our OAuth connections is just a list of every single time a chat agent reaches out and connects to the MCP server. We instead don't want this to be a log, since that will be a different feature, but we want this to simply be a list of OAuth client connections. So it would just be one per, so one for ChatGPT as long as it stays connected. Then a user can disconnect that not just a single session query.

Also be sure to clean up the OAuth connections and Personal access tokens. From the account settings page after we have successfully moved it over to the new MCP settings page.