# Coding Agent Prompt: Refactor AI Reports into Moat Finance Canvas Design-System Architecture

## Context

We already have a V1 implementation of AI-generated reports in Moat Finance. The current implementation allows a user’s personal agent, through MCP, to generate a report that can be viewed in the app and shared through a URL.

We now want to evolve this feature into a safer, cleaner, Cursor Canvas–inspired architecture.

Cursor’s Canvas model uses local `.canvas.tsx` files rendered through a constrained design-system SDK and then creates cloud-backed shareable snapshots. We want to mirror the **user experience and artifact lifecycle**, but not execute arbitrary generated TSX in production.

Moat Finance is a personal finance intelligence platform with sensitive user financial data. Therefore, reports must be secure by default, rendered through trusted Moat Finance-owned components, and shareable through revocable hosted snapshots.

## Goal

Update the existing AI Reports infrastructure into a **Moat Finance Canvas Reports** system.

The new system should:

1. Use a shared Moat Finance report design system.
2. Store agent-generated reports as structured JSON documents.
3. Render those JSON documents through trusted React components.
4. Optionally support a `.canvas.json` file metaphor for local/desktop exports.
5. Avoid arbitrary JavaScript, arbitrary TSX execution, arbitrary HTML, and arbitrary CSS.
6. Support private report viewing.
7. Support shareable hosted report snapshots.
8. Allow users to revoke shared links.
9. Be reusable across web and desktop.
10. Preserve and migrate the useful parts of the existing V1 implementation.

Do **not** build a raw HTML/CSS report renderer. Do **not** render untrusted report content using `dangerouslySetInnerHTML`.

---

## Product Behavior

Add or update the existing AI Reports tab under the AI section.

User-facing section:

```txt
AI
  Chat
  Reports
  Memories
  MCP Connections
```

The Reports page should show all reports created by the user or their personal agent.

Each report should support:

* View report
* Rename title
* Edit description
* Delete report
* Share report
* Copy share link
* Revoke share link
* Update shared snapshot if the private source changed

Reports should render like Cursor Canvas artifacts: polished, structured, native, and design-system driven.

Reports should not look like arbitrary webpages. They should look like native Moat Finance report artifacts.

---

## Architecture Decision

Use this architecture:

```txt
Agent creates Moat Finance Canvas JSON document
→ Moat Finance validates the document
→ Moat Finance stores it as the editable report source
→ Moat Finance renders it through trusted React report components
→ User can share it
→ Share action creates a hosted immutable snapshot
→ Share URL points to the snapshot
```

Do **not** use this architecture:

```txt
Agent generates raw HTML/CSS
→ Moat Finance stores it
→ Moat Finance renders it directly
```

Do **not** use this architecture:

```txt
Agent generates arbitrary .tsx
→ Moat Finance compiles/runs it
```

The generated artifact should be declarative JSON, while the renderer is trusted application code.

---

## Naming

Use the internal concept name:

```txt
Moat Finance Canvas
```

Use the user-facing name:

```txt
Reports
```

Recommended package naming:

```txt
packages/reports
```

or, if the repo already has a better shared package convention, use the existing convention.

---

## Shared Package

Create or update a shared package for reports.

Suggested structure:

```txt
packages/reports
  src/
    schema/
      fin-report-document.schema.ts
      report-block.schema.ts
    renderer/
      FinReportRenderer.tsx
      blocks/
        BadgeRowBlock.tsx
        BarChartBlock.tsx
        CalloutBlock.tsx
        DividerBlock.tsx
        KeyValueListBlock.tsx
        LineChartBlock.tsx
        MarkdownBlock.tsx
        PieChartBlock.tsx
        SectionBlock.tsx
        StatGridBlock.tsx
        TableBlock.tsx
    components/
      ReportShell.tsx
      ReportCard.tsx
      ReportSection.tsx
      ReportStat.tsx
      ReportBadge.tsx
    validation/
      validateFinReportDocument.ts
    examples/
      microsoft-addin-cost-estimate.canvas.json.ts
      retirement-readiness.canvas.json.ts
    index.ts
```

The package should be usable by:

```txt
apps/web
apps/desktop
apps/api
packages/client-ts if needed
```

---

## Report Document Schema

Create a canonical Zod schema for Moat Finance Canvas report documents.

Top-level document:

```ts
export const FinReportDocumentSchema = z.object({
  schemaVersion: z.literal("1.0"),
  title: z.string().min(1).max(140),
  description: z.string().max(500).optional(),
  blocks: z.array(ReportBlockSchema).min(1).max(100),
})
```

Supported block types for V1/V2:

```ts
export const ReportBlockTypeSchema = z.enum([
  "markdown",
  "section",
  "statGrid",
  "table",
  "barChart",
  "lineChart",
  "pieChart",
  "callout",
  "divider",
  "badgeRow",
  "keyValueList",
])
```

Every block should have:

```ts
{
  id?: string
  type: string
}
```

Use generated stable IDs where helpful, but do not require the agent to provide IDs.

---

## Example Report JSON

The agent should be able to create reports like this:

```json
{
  "schemaVersion": "1.0",
  "title": "Microsoft Add-in Cost Estimate",
  "description": "Estimate for hosting a static Office taskpane backed by existing APIs.",
  "blocks": [
    {
      "type": "badgeRow",
      "badges": [
        { "label": "Static Vite React add-in", "tone": "info" },
        { "label": "Next.js API backend", "tone": "info" },
        { "label": "LLM cost dominates at scale", "tone": "warning" }
      ]
    },
    {
      "type": "statGrid",
      "items": [
        { "label": "Static hosting / month", "value": "$0-$25" },
        { "label": "Microsoft company account one-time", "value": "~$99" },
        { "label": "Typical Claude turn", "value": "$0.03-$0.08", "tone": "info" },
        { "label": "500 MAU monthly estimate", "value": "$750-$2.2k", "tone": "warning" }
      ]
    },
    {
      "type": "callout",
      "tone": "warning",
      "title": "Main production requirement",
      "body": "Move add-in auth grants and document session state to Postgres or Redis before running multiple instances."
    },
    {
      "type": "table",
      "title": "Monthly Cost Scenarios",
      "columns": ["Scenario", "Adoption", "Monthly agent turns", "LLM cost / turn", "Expected total"],
      "rows": [
        ["Pilot", "50 MAU / 10 DAU", "1,800 turns", "$0.03-$0.08", "$130-$400"],
        ["School or district", "500 MAU / 100 DAU", "18,000 turns", "$0.03-$0.08", "$750-$2,200"],
        ["Broad rollout", "5,000 MAU / 1,000 DAU", "180,000 turns", "$0.03-$0.08", "$6,500-$17,500"]
      ]
    },
    {
      "type": "barChart",
      "title": "Cost Shape",
      "description": "Midpoint scenario estimate in USD/month.",
      "categories": ["Pilot", "School", "Broad rollout"],
      "series": [
        { "name": "Infrastructure", "data": [160, 450, 2000] },
        { "name": "LLM", "data": [100, 990, 9900] }
      ]
    }
  ]
}
```

---

## Renderer Requirements

Implement:

```tsx
<FinReportRenderer document={report.document} />
```

The renderer must:

* Validate the document before rendering.
* Render only known block types.
* Ignore unknown block types safely.
* Never execute user/agent-provided code.
* Never render raw HTML.
* Use Moat Finance-owned report components.
* Use Moat Finance’s existing Tailwind/shadcn design language.
* Support light/dark mode if the rest of the app supports it.
* Render well on desktop and mobile widths.
* Render well in both private authenticated views and public shared views.

Block renderer example:

```tsx
function RenderBlock({ block }: { block: ReportBlock }) {
  switch (block.type) {
    case "statGrid":
      return <StatGridBlock block={block} />
    case "table":
      return <TableBlock block={block} />
    case "barChart":
      return <BarChartBlock block={block} />
    case "lineChart":
      return <LineChartBlock block={block} />
    case "pieChart":
      return <PieChartBlock block={block} />
    case "callout":
      return <CalloutBlock block={block} />
    case "badgeRow":
      return <BadgeRowBlock block={block} />
    case "keyValueList":
      return <KeyValueListBlock block={block} />
    case "markdown":
      return <MarkdownBlock block={block} />
    case "divider":
      return <DividerBlock block={block} />
    case "section":
      return <SectionBlock block={block} />
    default:
      return null
  }
}
```

Markdown should be plain safe markdown only. Do not allow raw HTML inside markdown.

---

## Charts

Use the project’s existing chart library if already standardized. The current stack includes Recharts, so prefer Recharts unless the repo has moved away from it.

Supported chart blocks:

```ts
barChart
lineChart
pieChart
```

Chart data should be limited and validated.

Examples:

```ts
categories: z.array(z.string().max(80)).max(50)

series: z.array(
  z.object({
    name: z.string().max(80),
    data: z.array(z.number()).max(50),
  })
).max(10)
```

Do not allow arbitrary chart functions, formatters, JS callbacks, or custom renderers from report documents.

---

## Database Schema

Update Prisma schema to support editable report sources and share snapshots.

Suggested models:

```prisma
model AiReport {
  id          String   @id @default(cuid())
  userId      String
  title       String
  description String?
  document    Json

  createdBy   AiReportCreatedBy @default(AGENT)

  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt
  deletedAt   DateTime?

  shares      AiReportShare[]
  versions    AiReportVersion[]

  user User @relation(fields: [userId], references: [id])

  @@index([userId])
  @@index([createdAt])
}

model AiReportShare {
  id          String   @id @default(cuid())
  reportId    String
  userId      String

  shareSlug   String   @unique

  title       String
  description String?
  document    Json

  isEnabled   Boolean  @default(true)

  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt
  revokedAt   DateTime?

  report AiReport @relation(fields: [reportId], references: [id])
  user   User     @relation(fields: [userId], references: [id])

  @@index([reportId])
  @@index([userId])
  @@index([shareSlug])
}

model AiReportVersion {
  id          String   @id @default(cuid())
  reportId    String
  title       String
  description String?
  document    Json

  createdAt   DateTime @default(now())

  report AiReport @relation(fields: [reportId], references: [id])

  @@index([reportId])
}

enum AiReportCreatedBy {
  AGENT
  USER
  SYSTEM
}
```

Adapt names if the existing V1 models already have report tables. Prefer migration over replacement where possible.

---

## Snapshot Sharing Model

Reports have two concepts:

### 1. Editable private source

Stored in:

```txt
AiReport
```

This is the current private version that the user and agent can update.

### 2. Shared hosted snapshot

Stored in:

```txt
AiReportShare
```

This is the copy that public share links render.

When the user clicks “Share”:

1. Generate a secure random `shareSlug`.
2. Copy the current title, description, and document from `AiReport`.
3. Store them in `AiReportShare`.
4. Return a public URL.

When the user edits the private report, the shared version should **not** silently change.

Add an explicit action:

```txt
Update shared snapshot
```

When clicked, copy the current private report into the existing share record.

This mirrors Cursor’s shared canvas behavior: local/private source first, hosted snapshot second.

---

## Routes

Update or add routes equivalent to:

```txt
/apps/web/app/(app)/ai/reports/page.tsx
/apps/web/app/(app)/ai/reports/[reportId]/page.tsx
/apps/web/app/r/[shareSlug]/page.tsx
```

If the app uses a different route grouping, follow the existing convention.

API routes should support:

```txt
GET    /api/ai/reports
POST   /api/ai/reports
GET    /api/ai/reports/:id
PATCH  /api/ai/reports/:id
DELETE /api/ai/reports/:id

POST   /api/ai/reports/:id/share
PATCH  /api/ai/reports/:id/share
DELETE /api/ai/reports/:id/share

GET    /api/public/reports/:shareSlug
```

If V1 already has API endpoints, update them rather than duplicating.

---

## MCP Tools

Update existing MCP report tools or add these if missing:

```txt
create_report
update_report
list_reports
get_report
delete_report
share_report
unshare_report
```

Important requirements:

* MCP tools must infer the user from the authenticated MCP token/session.
* MCP tools must not accept `userId` as an input.
* MCP-generated documents must be validated against `FinReportDocumentSchema`.
* Invalid documents should return a useful validation error to the agent.
* The `create_report` tool should return the private report URL.
* The `share_report` tool should return the share URL.
* The `update_report` tool should create a new `AiReportVersion` before overwriting the report.

Example MCP input for `create_report`:

```ts
{
  title: string
  description?: string
  document: FinReportDocument
}
```

Example response:

```ts
{
  reportId: string
  url: string
}
```

Example response for sharing:

```ts
{
  reportId: string
  shareUrl: string
}
```

---

## UI Requirements

### Reports list page

Show:

* Report title
* Description
* Created date
* Updated date
* Share status
* Actions:

  * View
  * Share
  * Delete

### Report detail page

Show:

* Title
* Description
* Rendered report
* Actions:

  * Edit title/description
  * Share
  * Copy share link
  * Revoke share link
  * Update shared snapshot
  * Delete

### Share modal

The share modal must clearly warn:

```txt
Anyone with this link can view this report. It may include sensitive financial information. You can disable this link at any time.
```

Supported share states for now:

```txt
Private
Anyone with link
```

Do not implement public/discoverable reports yet.

### Shared public report page

The public route should:

* Render only enabled share snapshots.
* Not require authentication.
* Show a clean public report shell.
* Not expose the user’s full app shell/sidebar.
* Not expose internal report IDs or user IDs.
* Return not found for revoked, disabled, missing, or deleted shares.

---

## Desktop / Local-First Considerations

The shared package should be compatible with the future/local desktop app.

Do not hard-code web-only assumptions into the renderer.

For local desktop, the conceptual model should support:

```txt
Local source:
retirement-readiness.canvas.json

Renderer:
FinReportRenderer

Optional cloud share:
upload snapshot to Moat Finance cloud when user explicitly enables sharing
```

Do not build the full desktop file watcher unless the existing desktop V1 already has that infrastructure. But keep the schema and package architecture friendly to local `.canvas.json` export/import later.

---

## Migration From Existing V1

Inspect the existing V1 implementation.

Preserve what works:

* Existing AI Reports tab if present.
* Existing MCP report creation flow if present.
* Existing report list/detail pages if present.
* Existing share URLs if present, if they can be migrated cleanly.
* Existing styling patterns where compatible.

Update or replace only what conflicts with the new architecture.

If V1 stores raw HTML/CSS:

1. Add new `document Json` field.
2. Create a migration path.
3. For old reports, either:

   * Convert to a fallback `markdown`/`legacyHtmlUnsupported` display state, or
   * Keep old reports viewable through the old sanitized iframe renderer temporarily, clearly marked as legacy.
4. New reports must use Moat Finance Canvas JSON only.

Prefer not to break existing user data.

---

## Security Requirements

Non-negotiable:

* No arbitrary JavaScript.
* No arbitrary TSX execution.
* No arbitrary HTML rendering.
* No arbitrary CSS.
* No external script loading.
* No report-controlled imports.
* No report-controlled network calls.
* No `dangerouslySetInnerHTML` for agent-provided report content.
* No report document field should accept executable callbacks or functions.
* Public share links must be high-entropy and unguessable.
* Public share links must be revocable.
* Public shared pages must render from snapshot data only.
* Deleted reports should not be accessible.
* Revoked shares should return not found.
* Rate-limit report creation/update/share endpoints if the project has rate-limit utilities.
* Add ownership checks to every private report API route.
* MCP tools must scope all operations to the authenticated user.

---

## Validation Requirements

Use Zod or the existing validation standard in the repo.

Validate:

* Top-level document
* Block count
* String lengths
* Table row/column sizes
* Chart data sizes
* Valid tone values
* Valid chart series lengths
* Valid markdown content length

Recommended limits:

```ts
title: max 140 chars
description: max 500 chars
blocks: max 100
markdown body: max 20_000 chars
table columns: max 12
table rows: max 200
chart categories: max 50
chart series: max 10
chart series data points: max 50
```

---

## Design System

Implement report primitives that make reports look native to Moat Finance.

Suggested components:

```tsx
<ReportShell />
<ReportSection />
<ReportCard />
<ReportStat />
<ReportBadge />
<ReportCallout />
<ReportTable />
<ReportChart />
```

Use existing shadcn/ui primitives where appropriate.

Tone values:

```ts
"default" | "muted" | "info" | "success" | "warning" | "danger"
```

The report design should be constrained, elegant, and consistent.

The agent should be able to choose layout blocks, but not arbitrary styling.

---

## TypeScript Requirements

* Use strict TypeScript.
* Export inferred types from Zod schemas.
* Avoid `any`.
* Make block rendering exhaustive where practical.
* Keep schemas and renderer types colocated or imported from the shared reports package.

---

## Tests

Add tests for:

1. Valid report documents pass validation.
2. Invalid/unknown block types fail or are ignored safely depending on chosen policy.
3. Oversized reports are rejected.
4. Private report APIs enforce ownership.
5. Share creation creates a snapshot copy.
6. Editing private report does not mutate the shared snapshot.
7. Updating shared snapshot copies the latest private report.
8. Revoked share links return not found.
9. Public share route does not expose private/user fields.
10. Renderer does not use `dangerouslySetInnerHTML` for report content.

---

## Acceptance Criteria

This feature is complete when:

* Existing V1 reports infrastructure has been refactored toward Moat Finance Canvas JSON.
* There is a shared report schema package.
* There is a trusted React renderer for Moat Finance Canvas documents.
* The AI Reports tab renders reports using the new renderer.
* MCP can create a validated report document.
* MCP can update a report document.
* Users can view, rename, describe, delete, and share reports.
* Share links render hosted snapshots.
* Revoking a share link disables public access.
* Editing a private report does not silently change an existing shared snapshot.
* The implementation avoids arbitrary HTML/CSS/JS execution.
* The system is compatible with future desktop/local `.canvas.json` source files.

---

## Final Implementation Guidance

The goal is to mirror Cursor Canvas at the product level:

```txt
Artifact-style report
Design-system components
Agent-generated source
Native renderer
Shareable hosted snapshot
Revocable public link
```

But for Moat Finance, the source format should be:

```txt
.canvas.json / FinReportDocument JSON
```

not executable:

```txt
.canvas.tsx
```

Use trusted TSX components internally to render the JSON document. The agent should generate data, not code.
