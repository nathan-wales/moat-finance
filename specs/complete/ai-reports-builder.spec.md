I’d build it as a **Report Builder / Report Vault** inside your AI section, where the agent can generate “safe static documents” but never execute code.

The big principle: **the MCP server should submit report content; your app should sanitize, store, render, permission, and share it.** Do not trust the agent’s HTML/CSS just because it came through MCP.

## Product shape

Add a new AI tab:

**AI → Reports**

Each report has:

```ts
type AiReport = {
  id: string
  userId: string
  title: string
  description?: string
  html: string
  css: string
  sanitizedHtml: string
  sanitizedCss: string
  visibility: "private" | "share_link" | "public"
  shareSlug?: string
  createdAt: Date
  updatedAt: Date
  deletedAt?: Date | null
}
```

The agent generates:

```json
{
  "title": "2026 Retirement Readiness Report",
  "description": "A personalized breakdown of projected retirement savings, spending, risks, and next actions.",
  "html": "<main>...</main>",
  "css": "body { font-family: system-ui; } ..."
}
```

Your app turns that into a safe report and gives back a URL.

---

## The safest architecture

### 1. MCP tool: `create_financial_report`

Your personal agent MCP server exposes a tool like:

```ts
create_financial_report({
  title,
  description,
  html,
  css,
  visibility?: "private" | "share_link"
})
```

The tool does **not** directly publish raw HTML. It calls your app/backend:

```ts
POST /api/ai/reports
```

Your app then:

1. Authenticates the user.
2. Validates title/description/html/css size limits.
3. Sanitizes HTML.
4. Sanitizes CSS.
5. Stores both original and sanitized versions, or only sanitized if you want less risk.
6. Returns:

```json
{
  "reportId": "rep_123",
  "url": "https://app.yourdomain.com/ai/reports/rep_123"
}
```

I’d store the original only if you need editing/versioning. For a privacy-first finance app, I’d lean toward storing **sanitized only** unless there is a strong product reason.

---

## 2. Render reports in a sandboxed iframe

Do **not** render the agent HTML directly into your React page with `dangerouslySetInnerHTML`.

Instead, render it inside an iframe:

```tsx
<iframe
  sandbox=""
  srcDoc={reportDocument}
  className="h-full w-full rounded-xl border"
/>
```

The important part is `sandbox=""`.

That means: no scripts, no forms, no same-origin privileges, no popups, no top navigation. MDN documents that iframe sandboxing restricts behavior unless specific permissions like `allow-scripts` or `allow-same-origin` are added. For your use case, do **not** add those permissions. ([MDN Web Docs][1])

The rendered `srcDoc` can be one generated document:

```ts
const reportDocument = `
<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <meta
      http-equiv="Content-Security-Policy"
      content="default-src 'none'; img-src data: https:; style-src 'unsafe-inline'; base-uri 'none'; form-action 'none'; frame-ancestors 'none';"
    />
    <style>${sanitizedCss}</style>
  </head>
  <body>
    ${sanitizedHtml}
  </body>
</html>
`
```

Even though you are already using iframe sandboxing, I’d also use a strict CSP. MDN notes that the CSP `sandbox` directive applies restrictions similar to the iframe sandbox attribute, and CSP also lets you control things like framing and resource loading. ([MDN Web Docs][2])

---

## 3. Sanitize HTML aggressively

OWASP recommends HTML sanitization for cases where you need to accept HTML, and specifically points to DOMPurify as a sanitizer. ([OWASP Cheat Sheet Series][3]) DOMPurify is designed to sanitize HTML, SVG, and MathML, but for your case I would **not** allow SVG or MathML unless you truly need them. ([GitHub][4])

For a finance report, allow a small HTML subset:

```ts
const ALLOWED_TAGS = [
  "html",
  "body",
  "main",
  "section",
  "article",
  "header",
  "footer",
  "h1",
  "h2",
  "h3",
  "h4",
  "p",
  "span",
  "div",
  "strong",
  "em",
  "b",
  "i",
  "u",
  "ul",
  "ol",
  "li",
  "table",
  "thead",
  "tbody",
  "tr",
  "th",
  "td",
  "blockquote",
  "hr",
  "br"
]
```

I would **not** allow:

```ts
[
  "script",
  "iframe",
  "object",
  "embed",
  "form",
  "input",
  "button",
  "textarea",
  "select",
  "link",
  "meta",
  "base",
  "svg",
  "math",
  "video",
  "audio",
  "canvas"
]
```

Also strip all event handlers:

```html
onclick
onload
onerror
onmouseover
```

And strip risky attributes:

```html
srcdoc
href with javascript:
style if you are storing CSS separately
```

My recommendation: **do not allow inline `style` attributes at all.** Make the agent put all styles in the separate CSS field.

---

## 4. Sanitize CSS separately

CSS can also be abused, so don’t blindly save arbitrary CSS.

For v1, I’d allow CSS, but block:

```css
@import
url(...)
expression(...)
behavior
-moz-binding
position: fixed
position: sticky
z-index: extremely high values
```

Also consider blocking external fonts/images from CSS. In a privacy-first finance app, you do not want a public report secretly loading tracking pixels or external assets.

Simpler and safer v1: allow only a design-token-based styling system instead of arbitrary CSS.

For example, the MCP tool receives:

```json
{
  "theme": "classic",
  "accentColor": "blue",
  "sections": [...]
}
```

Then your app generates the HTML/CSS itself.

But if you want maximum flexibility, arbitrary HTML + sanitized CSS is doable. Just sandbox it hard.

---

## 5. Database model

For Prisma-style schema:

```prisma
model AiReport {
  id              String   @id @default(cuid())
  userId          String
  title           String
  description     String?
  sanitizedHtml   String
  sanitizedCss    String
  visibility      ReportVisibility @default(PRIVATE)
  shareSlug       String? @unique
  createdAt       DateTime @default(now())
  updatedAt       DateTime @updatedAt
  deletedAt       DateTime?

  user User @relation(fields: [userId], references: [id])

  @@index([userId])
  @@index([visibility])
  @@index([shareSlug])
}

enum ReportVisibility {
  PRIVATE
  SHARE_LINK
  PUBLIC
}
```

Optional, but useful:

```prisma
model AiReportVersion {
  id            String   @id @default(cuid())
  reportId      String
  sanitizedHtml String
  sanitizedCss  String
  createdAt     DateTime @default(now())

  report AiReport @relation(fields: [reportId], references: [id])

  @@index([reportId])
}
```

Versioning is nice because an AI agent could accidentally overwrite a good report.

---

## 6. API routes

In your Next.js app router, I’d create:

```txt
/app/api/ai/reports/route.ts
/app/api/ai/reports/[reportId]/route.ts
/app/api/ai/reports/[reportId]/share/route.ts
/app/api/public/reports/[shareSlug]/route.ts
```

Core operations:

```ts
POST   /api/ai/reports
GET    /api/ai/reports
GET    /api/ai/reports/:id
PATCH  /api/ai/reports/:id
DELETE /api/ai/reports/:id

POST   /api/ai/reports/:id/share
DELETE /api/ai/reports/:id/share

GET    /r/:shareSlug
```

For public sharing, I’d prefer URLs like:

```txt
https://yourdomain.com/r/abc123
```

Private reports stay under:

```txt
https://yourdomain.com/app/ai/reports/rep_123
```

---

## 7. UI

The AI section could have:

```txt
AI
  Chat
  Reports
  Settings
```

Reports page:

```txt
Reports
------------------------------------------------
[Create from AI] [Search reports]

Retirement Readiness Report
Personalized breakdown of retirement projections.
Private
[View] [Rename] [Share] [Delete]

Tax Strategy Report
A report about realized gains and estimated taxes.
Share link enabled
[View] [Copy link] [Unshare] [Delete]
```

Report viewer:

```txt
Title
Description

[Edit title/description] [Share] [Delete] [Export PDF]

------------------------------------------------
iframe report preview
------------------------------------------------
```

For v1, I would **not** build HTML editing yet. Let the agent regenerate reports. Editing HTML/CSS in the UI adds a lot of complexity around validation, undo, preview, autosave, and support burden.

Better v1 flow:

```txt
“Ask AI to revise this report”
```

Example:

```txt
Make the report shorter, add a table at the top, and make the risk section more prominent.
```

Then the agent calls:

```ts
update_financial_report({
  reportId,
  title,
  description,
  html,
  css
})
```

That’s a much better AI-native UX than hand-editing raw HTML.

---

## 8. MCP tools I’d expose

Minimum:

```ts
create_report
update_report
list_reports
get_report
delete_report
share_report
unshare_report
```

Example MCP tool shape:

```ts
{
  name: "create_report",
  description: "Create a static HTML/CSS financial report for the authenticated user.",
  inputSchema: {
    type: "object",
    properties: {
      title: { type: "string", maxLength: 120 },
      description: { type: "string", maxLength: 500 },
      html: { type: "string", maxLength: 200000 },
      css: { type: "string", maxLength: 50000 },
      visibility: {
        type: "string",
        enum: ["private", "share_link"]
      }
    },
    required: ["title", "html", "css"]
  }
}
```

The MCP server should not accept arbitrary user IDs from the agent. It should infer the user from the auth/session context.

---

## 9. Security rules I’d make non-negotiable

This feature touches private financial data, so I’d make these hard rules:

1. **No JavaScript.**
2. **No unsandboxed rendering.**
3. **No raw HTML in the main app DOM.**
4. **No external scripts.**
5. **No external CSS imports.**
6. **No forms.**
7. **No iframes inside reports.**
8. **No same-origin iframe permission.**
9. **No public sharing by default.**
10. **Clear warning before sharing: “Anyone with this link can view this report.”**
11. **Report sharing should be revocable.**
12. **Deleted reports should be soft-deleted first, then hard-deleted later if needed.**
13. **Audit log report creation, sharing, unsharing, and deletion.**
14. **Rate-limit report generation and updates.**
15. **Max file size limits for HTML/CSS.**

The biggest trap would be thinking “no `<script>` tags” is enough. It is not. You want sanitization, iframe sandboxing, and CSP together.

---

## 10. My recommended v1

I would ship this in three phases.

### Phase 1: Generated reports only

Build:

```txt
AI Reports tab
Create report via MCP
View report
Rename report
Delete report
Private/share-link visibility
Sandboxed iframe rendering
```

No manual HTML editor yet.

### Phase 2: AI revision

Add:

```txt
“Revise with AI”
“Make shorter”
“Add charts”
“Change tone”
“Add summary section”
```

The agent updates the report through MCP.

### Phase 3: Power-user editor

Add raw HTML/CSS editing only after the feature proves useful.

If you do add it, make it a split pane:

```txt
Left: HTML/CSS editor
Right: sandboxed preview
Top: validation errors
Bottom: save button
```

But I’d hide it behind an “advanced” toggle.

---

## 11. Suggested implementation detail for Next.js

Use a separate component for the report renderer:

```tsx
type ReportPreviewProps = {
  html: string
  css: string
}

export function ReportPreview({ html, css }: ReportPreviewProps) {
  const srcDoc = `
<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <meta
      http-equiv="Content-Security-Policy"
      content="default-src 'none'; img-src data: https:; style-src 'unsafe-inline'; base-uri 'none'; form-action 'none';"
    />
    <style>${css}</style>
  </head>
  <body>${html}</body>
</html>
`

  return (
    <iframe
      sandbox=""
      srcDoc={srcDoc}
      className="h-[calc(100vh-220px)] w-full rounded-xl border bg-white"
      title="AI generated financial report"
    />
  )
}
```

Then make sure `html` and `css` passed into this component are already sanitized server-side.

---

## 12. Final recommendation

Yes, this is a strong feature for a privacy-first personal finance app. I’d frame it as:

> “Your personal finance agent can generate private, shareable financial reports from your own data.”

But technically, I’d be very strict:

```txt
Agent creates content.
App sanitizes content.
App stores content.
App renders content in a sandbox.
User controls sharing.
```

I would **not** let the MCP agent directly create public pages, execute JS, inject React components, or write arbitrary files. Keep it as static sanitized HTML/CSS, and this becomes both useful and defensible from a security/compliance standpoint.

[1]: https://developer.mozilla.org/en-US/docs/Web/HTML/Reference/Elements/iframe?utm_source=chatgpt.com "<iframe> HTML inline frame element - MDN Web Docs"
[2]: https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Headers/Content-Security-Policy/sandbox?utm_source=chatgpt.com "Content-Security-Policy: sandbox directive - MDN Web Docs"
[3]: https://cheatsheetseries.owasp.org/cheatsheets/Cross_Site_Scripting_Prevention_Cheat_Sheet.html?utm_source=chatgpt.com "Cross Site Scripting Prevention - OWASP Cheat Sheet Series"
[4]: https://github.com/cure53/DOMPurify?utm_source=chatgpt.com "DOMPurify - a DOM-only, super-fast, uber-tolerant XSS ..."
