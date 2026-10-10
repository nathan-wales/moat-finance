# Axiom intake and queries

Use this file when the user supplied an Axiom URL or when nearby production logs would distinguish hypotheses.

## MCP

1. Discover Axiom MCP tools (`GetDynamicTools` with pattern `axiom|apl|dataset`) and read the schema before calling.
2. Typical tools: list datasets, get dataset schema, execute APL (`queryApl` or equivalent), search.
3. Prefer the MCP over any browser or HTTP client.
4. If the MCP is missing: ask the user to add Axiom MCP at `https://mcp.axiom.co/mcp` (Cursor: Settings → MCP → add that URL, then authenticate). Continue from pasted logs/images until it is available.

Do not put `AXIOM_TOKEN` in client, iOS, or desktop code. Server ingest already lives in `packages/logging`.

## Dataset and fields

Single dataset: `moat_finance`. Filter with structured fields.

| Field | Values |
|-------|--------|
| `app` | `web`, `api`, `desktop`, `ios`, `mcp` |
| `platform` | `nextjs`, `electron`, `ios` |
| `env` | `local`, `preview`, `production` |
| `level` | `info`, `warn`, `error` |
| `event` | snake_case event id |
| `message` | human-readable summary |
| `feature`, `operation`, `source`, `version`, `buildNumber` | when present |
| `userId`, `sessionId`, `requestId` | correlation; do not echo into chat |
| `errorMessage`, `errorCode`, `stack` | from `logger.logError` / `normalizeError` — often **absent** on client telemetry |
| extra keys (`eventName`, etc.) | flattened client metadata; treat as first-class evidence |

Ingest path is not origin: browser → `POST /api/client-log`; iOS/desktop → `POST /api/v1/clientLog/ingest`.

## Fetching a URL

Preserve the URL's time range, dataset, and selected event. From the linked event capture when present:

- timestamp, `level`, `message`, `event`, `app`, `platform`, `env`, `source`, `version`, `buildNumber`
- `errorMessage`, `errorCode`, `stack`, file/function/line (may be missing)
- extra metadata keys (`eventName`, `operation`, `feature`)
- `requestId`, `sessionId`, `userId` (keep internal; summarize in the report)

Then inspect a focused window around the timestamp. Pivot on `sessionId`, `requestId`, `event`, `app`, and `userId` rather than message text alone. For iOS client logs, `sessionId` is usually the better join than `requestId`.

## APL starters

```txt
['moat_finance'] | where level == "error" | where _time > ago(24h)

['moat_finance'] | where event == "the_event_id" | where _time > ago(7d)

['moat_finance'] | where app == "api" and level == "error"

['moat_finance'] | where requestId == "…"

['moat_finance'] | where feature == "plaid" and level == "error"

['moat_finance'] | where event == "plaid.link_event" and eventName == "EXIT"

['moat_finance'] | where sessionId == "…" | sort by _time asc
```

Tighten with the URL's time range. Limit rows. Never dump large result sets containing PII into the report.

After adding diagnostics, give the user a copy-pasteable APL query plus what each possible result means for the remaining hypotheses.
