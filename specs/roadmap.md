# Moat Finance — Roadmap

Current priorities, ordered by urgency and in-flight status.

---

## In progress

### Electron desktop app — local-first financial context OS for AI agents

Phase 4 ships the v1 beta (SQLite, IPC, import, packaging). Phase 5 adds the local agent gateway (MCP server, permissions, financial ontology) so any agent can connect — Moat Finance is the context layer, not an LLM provider.

→ [specs/features/desktop-electron-app/roadmap.md](features/desktop-electron-app/roadmap.md)
→ [specs/features/desktop-electron-app/phase-5-agent-gateway.spec.md](features/desktop-electron-app/phase-5-agent-gateway.spec.md)

---

## Up next

### Goals feature
First-class financial goal tracking (house, vacation, car, emergency fund, etc.) with cash-flow impact and forecast integration.

→ [specs/features/goals/spec.md](features/goals/spec.md)

---

## Planned

### Taxes — system of record for the user’s tax life
First-class Taxes destination (web/desktop shared UI + native iOS) built on canonical `TaxFact`s, document ingestion, readiness, and MCP tools. Not a tax-prep UI.

→ [specs/features/taxes/spec.md](features/taxes/spec.md)

Follow-up (after v1 ships): 1040 math, form catalog, state/depreciation/equity engines, CPA package, e-file providers. Phase 0 is a v1 accuracy review.

→ [specs/features/taxes-v2/spec.md](features/taxes-v2/spec.md)

### Retail sync extension improvements
After initial launch: multi-retailer sync UX polish, improved error states, sync history view.

→ [specs/features/retail-sync-extension/spec.md](features/retail-sync-extension/spec.md)

---

## Shipped (keep green)

### Plaid Golden Ledger
Headless Golden + reconnect (`pnpm test`) and Playwright Golden (web + desktop, manual `workflow_dispatch` workflows) run against the local Plaid mock server and need no secrets. Manual 1-minute real-bank connect before desktop/web releases. Remaining: `rulesApplied` counts and a production audit log.

→ [specs/features/plaid-integration-e2e-tests/spec.md](features/plaid-integration-e2e-tests/spec.md)

## Backlog

See [specs/backlog/](backlog/) for unstructured ideas and rough explorations not yet prioritized.
