Absolutely. Here’s the implementation plan/spec I’d give your coding agent.

This should be built as a **shared feedback system in `packages/`**, with thin adapters inside `apps/web` and `apps/desktop`.

---

# Moat Finance Feedback System Implementation Plan

## Goal

Add a reusable feedback submission flow to Moat Finance that works in both:

* `apps/web`
* `apps/desktop`

The shared UI, types, hooks, and core logic should live in `packages/` and be consumed by both apps.

The feedback flow should closely mirror the provided ChatGPT feedback dialog screenshot:

* Modal title: “What happened?”
* Large textarea
* Character count
* Privacy/help text
* “Include screenshot in report” toggle
* Screenshot preview card
* Bottom-right “Send” button
* Top-right close button

This will be built in phases.

Phase 1 focuses on:

1. Shared feedback UI
2. Shared feedback types and validation
3. Database persistence
4. Optional screenshot capture/upload
5. Web and desktop integration points
6. MCP feedback tool support as a DB-backed feedback submission path

GitHub Issues automation and coding-agent issue workflow should be prepared for but not fully implemented unless explicitly requested later.

---

# Architecture

## Shared package location

Create a shared package for feedback logic.

Recommended:

```txt
packages/feedback
```

Alternative if the repo already has shared UI conventions:

```txt
packages/shared/feedback
```

The package should contain:

```txt
packages/feedback/
  src/
    components/
      FeedbackDialog.tsx
      FeedbackMenuItem.tsx
      ScreenshotPreview.tsx
    hooks/
      useFeedbackDialog.ts
      useScreenshotCapture.ts
      useSubmitFeedback.ts
    types.ts
    schema.ts
    constants.ts
    index.ts
```

If the monorepo already has a shared UI package, place only the UI components there and keep feedback domain logic in `packages/feedback`.

---

# Product behavior

## Entry point

Add a “Give feedback” option to the user profile/account menu in the bottom-left nav area.

This should be added to:

```txt
apps/web
apps/desktop
```

The exact menu location should match the current user profile dropdown/menu pattern.

When the user clicks **Give feedback**, open the shared `FeedbackDialog`.

---

# Feedback dialog UI

The dialog should mirror the provided screenshot as closely as possible while using Moat Finance’s design system.

## Dialog layout

Title:

```txt
What happened?
```

Textarea:

* Large textarea
* Placeholder:

```txt
Tell us what happened or what you expected.
```

* Max length: `2000`
* Character counter:

```txt
{count} / 2000 characters used
```

Privacy/helper text:

```txt
Any information you share may be reviewed to help improve Moat Finance. Screenshots may include financial information, so review before sending.
```

Screenshot toggle:

```txt
Include screenshot in report
```

When enabled:

* Capture screenshot if possible.
* Show screenshot preview card below the toggle.
* Allow removing the screenshot.

Submit button:

```txt
Send
```

Button placement:

* Bottom-right
* Use the preferred/default primary button variant from Moat Finance’s shadcn/ui setup.

Close button:

* Top-right `X`

## States

The dialog must support:

* Empty state
* Text entered
* Screenshot included
* Screenshot removed
* Loading/submitting
* Successful submission
* Failed submission

## Validation

Rules:

* Feedback message is required.
* Trim whitespace.
* Max 2000 characters.
* Screenshot is optional.
* Disable submit while submitting.
* Disable submit if message is empty.

---

# Screenshot behavior

Screenshot capture should be adapter-based because web and desktop may need different implementations.

Create a shared interface:

```ts
export type FeedbackScreenshot = {
  blob: Blob;
  previewUrl: string;
  filename: string;
  mimeType: "image/png" | "image/jpeg" | "image/webp";
};

export type ScreenshotCaptureAdapter = {
  captureScreenshot: () => Promise<FeedbackScreenshot | null>;
};
```

## Web screenshot adapter

For `apps/web`, implement a browser-safe adapter.

Preferred Phase 1 behavior:

* Capture the current app viewport using a DOM screenshot approach if the project already has or approves a dependency like `html2canvas`.
* If no screenshot dependency exists, add `html2canvas` only if acceptable in this repo.
* Avoid capturing the feedback modal itself if possible.
* If excluding the modal is too complex for Phase 1, capture before opening the modal or temporarily hide the modal during capture.

Important:

* Do not capture screenshots automatically without user action/toggle.
* User must opt in via “Include screenshot in report.”

## Desktop screenshot adapter

For `apps/desktop`, implement a separate adapter.

Because desktop architecture may vary, use the existing desktop shell’s screenshot mechanism if one exists.

If none exists:

* Create a placeholder adapter that returns `null`.
* Keep the UI working without screenshots.
* Add a TODO for native screenshot capture.

Do not block feedback submission if screenshot capture fails.

---

# Data model

Add feedback persistence to Prisma.

Recommended schema:

```prisma
model Feedback {
  id                String              @id @default(cuid())
  userId            String?
  householdId        String?
  type              FeedbackType        @default(GENERAL)
  source            FeedbackSource
  status            FeedbackStatus      @default(NEW)

  message           String
  route             String?
  appVersion        String?
  platform          String?
  userAgent         String?
  metadata          Json?

  screenshotUrl     String?
  screenshotPath    String?
  screenshotMimeType String?

  githubIssueNumber Int?
  githubIssueUrl    String?
  githubSyncStatus  GitHubSyncStatus?
  githubSyncError   String?

  createdAt         DateTime            @default(now())
  updatedAt         DateTime            @updatedAt

  @@index([userId])
  @@index([householdId])
  @@index([source])
  @@index([status])
  @@index([createdAt])
}

enum FeedbackType {
  GENERAL
  BUG
  FEATURE_REQUEST
  UX_FEEDBACK
  MCP_TOOL_ISSUE
  INCORRECT_RESULT
  OTHER
}

enum FeedbackSource {
  WEB_APP
  DESKTOP_APP
  MCP
}

enum FeedbackStatus {
  NEW
  REVIEWED
  PLANNED
  IN_PROGRESS
  RESOLVED
  CLOSED
}

enum GitHubSyncStatus {
  NOT_SYNCED
  SYNCED
  FAILED
}
```

If the project uses strict tenant/household scoping, make `householdId` required where appropriate.

If desktop local SQLite has its own schema generation path, mirror this model there as well.

---

# API/server behavior

Create a feedback submission endpoint/server action that both apps can call.

Suggested web API route:

```txt
POST /api/feedback
```

Request shape:

```ts
export type CreateFeedbackInput = {
  type?: FeedbackType;
  source: FeedbackSource;
  message: string;
  route?: string;
  appVersion?: string;
  platform?: string;
  userAgent?: string;
  metadata?: Record<string, unknown>;
  screenshot?: {
    url?: string;
    path?: string;
    mimeType?: string;
  };
};
```

Response:

```ts
export type CreateFeedbackResponse = {
  feedbackId: string;
  status: "created";
};
```

For web/cloud:

* Upload screenshot first if present.
* Store the uploaded screenshot URL on the feedback record.
* Use Vercel Blob if the app already uses Vercel Blob or if no upload abstraction exists.

For desktop:

* Save feedback locally first.
* If the desktop app supports cloud sync, sync later.
* If no sync exists, persist locally and expose future migration point.

---

# Screenshot upload

Create a storage abstraction rather than wiring Vercel Blob directly into the UI.

```ts
export type FeedbackUploadAdapter = {
  uploadScreenshot: (file: Blob, filename: string) => Promise<{
    url?: string;
    path?: string;
    mimeType: string;
  }>;
};
```

Web implementation:

* Use Vercel Blob server-side upload flow.
* Do not expose storage credentials client-side.

Desktop implementation:

* Store locally or return no-op depending on current desktop architecture.

---

# Shared client hook

Create:

```ts
useSubmitFeedback()
```

Responsibilities:

1. Validate message.
2. Upload screenshot if included.
3. Submit feedback payload.
4. Return loading/success/error state.
5. Reset dialog on success.

The shared hook should accept adapters:

```ts
type UseSubmitFeedbackOptions = {
  source: FeedbackSource;
  uploadAdapter?: FeedbackUploadAdapter;
  submitAdapter: FeedbackSubmitAdapter;
  getContext?: () => FeedbackContext;
};
```

This allows web and desktop to use the same UI while implementing app-specific submission behavior.

---

# MCP feedback tool

Add an MCP tool for submitting feedback.

Tool name:

```txt
moat.submitFeedback
```

Purpose:

Allow a user’s personal agent to submit feedback when:

* An MCP tool fails (auto-submit as `MCP_TOOL_ISSUE`)
* A result is incorrect (after user confirms)
* A desired Moat Finance capability is missing (offer once; submit only if the user approves)
* The user explicitly asks the agent to send feedback
* The agent suggests feedback and the user approves

Agent behavior (also returned as MCP server `instructions`):

* On a missing capability: offer a feature request **once**. Do not ask on every turn of normal MCP usage.
* On an MCP tool or endpoint failure: automatically submit `MCP_TOOL_ISSUE` with `relatedToolName` and a short error summary. Do not ask first. Report each distinct failure once.
* Never include balances, account numbers, emails, tokens, or raw transaction descriptions.

Approval rules:

* `FEATURE_REQUEST`, `BUG`, `GENERAL`, and `INCORRECT_RESULT` require `userApproved: true`.
* `MCP_TOOL_ISSUE` may omit `userApproved` (auto path for tool failures).

Tool input schema:

```ts
{
  type: "BUG" | "FEATURE_REQUEST" | "GENERAL" | "MCP_TOOL_ISSUE" | "INCORRECT_RESULT";
  message: string;
  relatedToolName?: string;
  severity?: "LOW" | "MEDIUM" | "HIGH";
  userApproved?: true; // required except for MCP_TOOL_ISSUE
  metadata?: Record<string, unknown>;
}
```

Rules:

* If `type !== "MCP_TOOL_ISSUE"` and `userApproved !== true`, do not create feedback.
* Return a helpful message explaining that user approval is required when missing.
* Do not include raw sensitive financial data unless the user explicitly included it.
* Do not attach screenshots through MCP in Phase 1.
* Store MCP feedback with `source = MCP`.
* Recommended PAT defaults include `mcp:feedback:write` so new tokens can submit feedback without a custom scope preset.

The MCP-created feedback should use the same database model as UI-submitted feedback.

---

# Security and privacy requirements

Because Moat Finance handles sensitive financial data, this feature must be privacy-first.

Requirements:

1. Screenshot inclusion must be opt-in.
2. UI must warn that screenshots may include financial information.
3. Screenshots must never be captured silently.
4. GitHub issue creation must not be part of Phase 1 unless explicitly enabled.
5. Never send screenshots directly to GitHub from the client.
6. GitHub token must never be exposed to the client.
7. Do not include user email, name, account balances, transaction data, or private metadata in future GitHub Issues unless intentionally configured.
8. Feedback records should be scoped to the authenticated user/household.
9. Unauthenticated feedback should be rejected unless there is already an anonymous feedback pattern.
10. Screenshot URLs should not be public by default unless the existing storage layer requires it. Prefer signed/private access if available.

---

# Web integration

In `apps/web`:

1. Import shared feedback package.
2. Add “Give feedback” menu item to the bottom-left user profile menu.
3. Wire `FeedbackDialog`.
4. Provide web adapters:

   * `submitFeedback`
   * `uploadFeedbackScreenshot`
   * `captureScreenshot`
   * `getFeedbackContext`

Context should include:

```ts
{
  route: window.location.pathname,
  userAgent: navigator.userAgent,
  platform: "web",
  appVersion: process.env.NEXT_PUBLIC_APP_VERSION
}
```

---

# Desktop integration

In `apps/desktop`:

1. Import the same shared feedback dialog.
2. Add “Give feedback” to the bottom-left user profile menu.
3. Provide desktop adapters:

   * local submit adapter
   * local or no-op screenshot upload adapter
   * desktop screenshot capture adapter if available
   * desktop context provider

Context should include:

```ts
{
  route: currentRouteOrScreen,
  platform: "desktop",
  appVersion: desktopAppVersion,
  userAgent: desktopRuntimeInfo
}
```

Desktop should not depend on web-only APIs.

Guard all browser-specific calls behind adapters.

---

# Future Phase 2: GitHub Issues integration

Prepare the schema for this but do not implement unless requested.

Future behavior:

1. Feedback is submitted.
2. DB row is created.
3. Screenshot is uploaded to Moat Finance-controlled storage.
4. Server creates a GitHub issue.
5. DB row is updated with:

   * `githubIssueNumber`
   * `githubIssueUrl`
   * `githubSyncStatus`

Future env vars:

```txt
GITHUB_FEEDBACK_ENABLED=true
GITHUB_FEEDBACK_REPO_OWNER=
GITHUB_FEEDBACK_REPO_NAME=
GITHUB_FEEDBACK_TOKEN=
GITHUB_FEEDBACK_LABELS=feedback,from-fin
```

If GitHub creation fails:

* Keep feedback saved.
* Set `githubSyncStatus = FAILED`.
* Store error message in `githubSyncError`.
* Do not show a fatal error to the user if feedback was saved successfully.

---

# Future Phase 3: Coding-agent workflow

Prepare but do not implement.

Future workflow:

A coding agent can be given:

```txt
GitHub issue URL:
Additional implementation instructions:
Constraints:
```

The agent should:

1. Fetch the issue.
2. Read linked feedback metadata.
3. Inspect relevant app/package code.
4. Propose implementation plan.
5. Make the code change.
6. Add tests.
7. Open a PR.
8. Link PR back to the issue.

---

# Testing requirements

Add tests where the project currently supports them.

Minimum tests:

## Shared package

* Dialog renders correctly.
* Submit disabled with empty message.
* Character count updates.
* Screenshot toggle calls screenshot adapter.
* Screenshot preview appears.
* Remove screenshot works.
* Submit calls submit adapter with expected payload.
* Submit handles errors.

## API/server

* Authenticated user can create feedback.
* Empty message rejected.
* Message over 2000 characters rejected.
* Feedback stores route/platform/source metadata.
* Screenshot metadata stored when provided.

## MCP

* Rejects non-`MCP_TOOL_ISSUE` feedback when `userApproved` is not true.
* Allows `MCP_TOOL_ISSUE` without `userApproved` for automatic tool-failure reports.
* Creates feedback when approved (or auto for tool issues).
* Stores `source = MCP`.
* Stores related tool metadata.
* Recommended PAT defaults include `mcp:feedback:write`.
* MCP server `instructions` describe feature-request and auto-issue behavior.

---

# Acceptance criteria

The feature is complete when:

1. Web users can open the profile menu and click “Give feedback.”
2. Desktop users can open the profile menu and click “Give feedback.”
3. Both apps use the shared feedback dialog from `packages/`.
4. Users can submit text feedback.
5. Users can optionally include a screenshot where supported.
6. Screenshot preview and removal work.
7. Feedback is persisted in the database.
8. MCP agents can submit approved feedback through a shared backend path.
9. The implementation does not expose GitHub tokens, storage credentials, or private user data.
10. The schema is ready for GitHub issue linking in a future phase.

---

# Out of scope for Phase 1

Do not implement yet unless explicitly requested:

* Automatic GitHub issue creation
* Coding-agent issue solver
* Auto-redaction of screenshots
* Admin feedback dashboard
* Public feedback portal
* Screenshot annotation tools
* Multi-image attachments
* Anonymous unauthenticated feedback
* Email notifications

---

My one strong recommendation: **make the prompt tell the agent to inspect the existing desktop architecture first before assuming Electron/Tauri/browser APIs.** That will prevent it from hardcoding browser-only screenshot logic into the shared package.

Bonus points if we can automatically create a github issue.