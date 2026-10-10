---
name: debug-error
description: Investigates errors from Axiom URLs, pasted logs, stack traces, or screenshots of a log stream; maps each distinct failure to source code; applies a clear root-cause fix or adds targeted logging. Use when the user pastes an Axiom link, error log, exception, a picture of Axiom/console logs, Sentry dump, or asks to debug a production failure.
---

# Debug Error

Drive each error to the strongest justified outcome: a narrow root-cause fix, or targeted logging that will distinguish the remaining hypotheses. Process multiple errors **one at a time**.

## Operating rules

- Treat the input as evidence, not proof of root cause.
- Continue autonomously through investigation, easy fixes, and targeted logging. Ask only when access or a product decision blocks progress.
- Never log, commit, or echo secrets, tokens, emails, account numbers, routing numbers, raw transaction descriptions, or full sensitive payloads.
- Do not claim a fix is verified unless a check exercised the failure mechanism.
- Do not claim production resolution until production evidence confirms it.
- Never automatically commit. Leave reviewed, uncommitted changes.

## 1. Normalize the input

Classify every piece of evidence the user provided. Valid intakes:

| Input | What to do |
|-------|------------|
| Axiom URL | Fetch via Axiom MCP only. See [axiom.md](axiom.md). |
| Pasted log / stack / JSON | Parse as-is. Keep every structured field (`event`, `eventName`, `feature`, `buildNumber`, metadata). Do not invent missing fields. |
| Screenshot / image | Read every attached image. A crop of Axiom/console (table of `_time` + raw rows) is a full intake — extract every visible row, including truncated fields. Do not invent hidden text. |
| Mixed (URL + paste + image) | Merge, then fingerprint into distinct **failures**, not one queue item per row. |

If an Axiom URL is present and the Axiom MCP is missing:

1. Tell the user to add the official Axiom MCP (`https://mcp.axiom.co/mcp`) and authenticate.
2. Do not open Axiom in a browser, `curl`, or any substitute unless the user explicitly instructs that method.
3. Continue from any pasted logs or images already in the thread.

Summarize sensitive values. Do not copy PII into the workspace or the final report.

## 2. Split into a queue, then go one by one

A screenshot of a log stream is many **rows**, not many **failures**. Group first, then queue.

**Same queue item** when rows share a session/request and are one flow or one failure chain, for example:

- Plaid Link `OPEN` / `SELECT_INSTITUTION` / `OPEN_OAUTH` / `EXIT` / `TRANSITION_VIEW` for one `sessionId`
- API `handler.failed` + service `logError` + iOS `API HTTP error` for the same path and second

**Separate queue items** when they are different days, users/sessions, routes, or error codes (auth refresh 500 vs FinanceKit `P2002` vs Plaid Link).

Fingerprint a queue item by `event` (or route) + `errorCode`/`errorMessage` + session/request. Use `eventName` to understand a flow, not to explode one Link session into ten items.

`level == "error"` is not proof of a bug. Client telemetry is sometimes ingested at error by default (iOS `AppLogger.logRemote` without a level). Classify before treating a row as a failure.

1. List the queue up front: short label, timestamp, apps involved. Mention grouped row count (e.g. "FinanceKit bulk import P2002 — 3 rows, api + ios").
2. Work **strictly one queue item at a time** through locate → decide → fix or instrument → report.
3. Start the next item only after the current one has an outcome.
4. If a later item shares the same root cause, say so after proving it on the first; do not mix unrelated edits in one pass.
5. Truncated screenshot fields (`errorMessage` cut off, ellipsis) are partial evidence — search the repo and, if Axiom MCP is available, fetch the full event. Never guess the missing characters.

## 3. Locate the origin

For the current error:

1. Map `app`, `source`, route, job, and stack frames to the repo:

   | `app` | Start here |
   |-------|------------|
   | `api` | `apps/api/` |
   | `web` | `apps/web/` |
   | `desktop` | `apps/desktop/` |
   | `ios` | `apps/ios/` |
   | `mcp` | `apps/mcp/` |

   Client logs may ingest through the API (`POST /api/client-log` or `/api/v1/clientLog/ingest`) even when `app` is `web`, `ios`, or `desktop`. Trust `app` / `platform`, not the ingest path.

2. Search for exact error text, `event` ids, logger calls, exception types, route names, distinctive stack functions, and extra payload keys (`eventName`, `operation`).
3. Trace backward from the logging site to where bad state was introduced — not merely where it was reported.
4. Check recent relevant git history when timing lines up with a deploy or merge. Use `version` / `buildNumber` when present.
5. Keep a short ranked hypothesis list with confirming and contradicting evidence.

Thin events (no `stack` / `errorMessage`, generic `message` like "Plaid Link event") are expected. Do not stall. Query nearby logs for the same `sessionId`, `requestId`, `userId`, `event`, or time window, and read the logging call to see which metadata was omitted. See [axiom.md](axiom.md).

## 4. Choose the next action

Use this order:

1. **Easy, clear cause:** Implement the smallest root-cause fix when the evidence explains the failure path and expected behavior is unambiguous.
2. **Testable cause:** Write the cheapest faithful reproduction or focused test, then fix only after it confirms the hypothesis.
3. **Unclear cause:** Do not guess at a behavioral fix. Add targeted logging and report remaining hypotheses.

Easy means the failure mechanism is visible in code (null access on a known path, wrong field, missing `await`, swallowed catch, inverted condition, obvious off-by-one, or a log that always uses `error` for expected lifecycle events). Not easy: races, production-only data/config, third-party behavior, competing hypotheses, or a product decision.

If the log is expected product telemetry (user EXIT/cancel, loaded, handoff) and the only problem is severity or missing fields, do not invent a behavioral bug. Relevel or add metadata if that is independently correct.

Do not replace an unexplained exception with swallowing, a broad retry, a fallback, or a quieter log level unless that behavior is independently correct.

## 5. Fix when it is easy

1. Add a regression test that fails for the observed mechanism when practical.
2. Fix at the point where invalid state enters or should be handled — not only at the log site.
3. Run the focused test and the smallest meaningful checks for that app (`pnpm --filter … run check` / `typecheck` for JS; Xcode test/build for iOS).
4. Inspect the diff for unrelated edits, noisy logging, and PII.

Classify verification:

- **Verified:** A local check exercised the failure mechanism and passed after the fix.
- **Partially verified:** Tests passed, but production-only infrastructure, data, timing, or concurrency was not reproduced.
- **Unverified:** The failure mechanism could not be exercised locally.

If verification is partial or missing, add safe diagnostics alongside the fix when they can confirm the production path.

## 6. Add logging when the cause is unclear

For each leading hypothesis, name the observation that would confirm or reject it. Add only the fields needed to get those observations.

Use the app's existing logger — never `console.*`:

| Surface | Logger |
|---------|--------|
| API / services | `import { logger } from "~/lib/logger"` then `logger.logError` / `logger.error` / `logger.warn` |
| Web server | `~/lib/logger` |
| Web browser | `clientLogger` from `~/lib/client-logger` |
| MCP | `apps/mcp/src/lib/logger.ts` |
| iOS | `AppLogger` / `RemoteLogger` in `apps/ios/Moat/Core/Logging/` — pass an explicit `RemoteLogLevel`; do not use the no-level `logRemote` overload (it defaults to `.error`) |
| Desktop (cloud/online) | existing remote logger path; never embed `AXIOM_TOKEN` |

Logging rules:

- One high-quality log at the failure boundary, not a trail of duplicates.
- Structured fields with stable names: `event`, `feature`, `operation`, plus safe correlation (`userId`, `requestId`, `errorMessage`, `errorCode`).
- Prefer `logger.logError(message, error, context)` so `errorMessage` is normalized.
- `event` is snake_case (or dotted snake_case already used nearby).
- Log booleans, counts, enums, hashes, redacted ids — never raw payloads.
- Place logs before information is discarded and at state boundaries.
- Preserve the original exception.
- Choose `warn` for recoverable issues, `error` for failed operations.
- State the Axiom query to run on recurrence and what each result implies.

Validate that the diagnostic path typechecks. See [docs/patterns/error-handling.md](../../../docs/patterns/error-handling.md).

## Report each error, then a queue summary

Lead each error with one outcome:

- **Fixed and verified locally**
- **Fix implemented; verification partial**
- **Cause unclear; targeted logging added**
- **Cause identified; needs a product/decision or larger change**
- **Not a failure; telemetry or log-level issue**
- **Blocked** (missing Axiom MCP, missing source, missing access)

Then, concisely:

1. What happened and where it originated
2. Evidence and confidence
3. Files changed and why
4. Checks run and results
5. Remaining uncertainty or production follow-up
6. Axiom query or identifiers for recurrence

After the last error, list the queue with each outcome. Use exact paths. Label inference. Never imply a commit, PR, or production change unless it actually happened.
