# Specs — How Moat Finance Does Spec-Driven Development

This folder is the **shared agreement layer** before non-trivial code changes. Agents and humans should read this file first when asked to write, update, or implement from a spec.

---

## Why specs exist

Specs answer three questions before anyone writes code:

1. **What problem are we solving?** (product intent)
2. **What already exists in the repo?** (current context — file paths, APIs, patterns to reuse)
3. **What does done look like?** (acceptance criteria, non-goals, open questions)

A good spec prevents agents from guessing at architecture, re-inventing existing components, or shipping behavior that conflicts with Moat conventions in [AGENTS.md](../AGENTS.md).

**Write a spec when:**

- The feature touches multiple files, apps, or layers (UI + API + schema)
- UX or data model decisions need alignment before implementation
- You are replacing or significantly redesigning existing behavior
- The user explicitly asks for a spec

**Skip a spec when:**

- The change is a one-line bug fix or typo with obvious intent
- You are following an existing spec's implementation plan verbatim
- The user only asked a question (no build requested)

---

## Folder layout

```text
specs/
├── README.md              ← you are here
├── mission.md             ← product north star — read before writing specs
├── roadmap.md             ← current priorities — check if the feature is in scope
├── tech-stack.md          ← canonical stack — don't guess libraries
├── features/              ← active specs for work in flight or up next
│   └── [feature-name]/
│       └── spec.md
├── complete/              ← shipped or superseded specs (historical reference)
└── backlog/               ← rough ideas, no formatting required
    └── README.md
```

| Location | When to use |
|----------|-------------|
| `specs/backlog/` | Brain dump. Bullets and half-formed ideas only. |
| `specs/features/[name]/spec.md` | Prioritized work ready for review and implementation. |
| `specs/complete/` | Feature shipped or spec replaced. Move here when done. |

**Naming:** Use kebab-case directories (`ios-onboarding-connect-accounts/`) and `spec.md` inside. Some older specs use flat `*.spec.md` files in `complete/` — follow the directory pattern for new work.

---

## Agent workflow

When asked to **write a spec**:

1. Read [mission.md](mission.md) and [roadmap.md](roadmap.md) for product fit.
2. Read [tech-stack.md](tech-stack.md) if the feature involves stack choices.
3. **Explore the codebase** — find the files, APIs, and patterns the feature will touch. Specs must cite real paths, not hypothetical ones.
4. Check for related specs in `features/`, `complete/`, and `backlog/` to link and avoid duplication.
5. Write `specs/features/[feature-name]/spec.md` using the template below.
6. End with a suggested commit message in a code block.

When asked to **implement a feature**:

1. Find or read the spec in `specs/features/[name]/spec.md`.
2. If no spec exists and the work is non-trivial, write one first (or confirm with the user).
3. Follow [AGENTS.md](../AGENTS.md) conventions during implementation.
4. Prefer **existing patterns** named in the spec's "Current Repo Context" section.

When asked to **update a spec**:

- Change the **Status** line (date + what triggered the update).
- Resolve or add **Open Questions** explicitly.
- Do not delete acceptance criteria without noting why.

---

## Spec template

Copy this skeleton for new feature specs. Delete sections that genuinely do not apply, but err on including them — empty "Non-Goals" and "Open Questions" sections prevent scope creep.

```markdown
# [Feature Name]

## Status

Draft. Created [date] after reviewing [specific files, flows, or related specs].

## Goal

[One paragraph: what we are building and why now.]

Success means:

- [Measurable outcome 1]
- [Measurable outcome 2]
- [Measurable outcome 3]

## Product Context

[Why this matters to users. What job does this screen/feature do?]
[Reference mission/roadmap themes when relevant.]

## Current Repo Context

[What exists today — tables of files, APIs, models, known problems.]
[This section is mandatory for agent-useful specs.]

### Existing building blocks to reuse

| Asset | Location | Notes |
|-------|----------|-------|
| ... | ... | ... |

## Target Experience

[Wireframes in ASCII, step tables, copy examples, state machines.]
[Be specific: exact UI copy, row formats, empty states, error states.]

## Architecture / Data Model

[Only when the feature changes APIs, schema, IPC, or cross-app contracts.]
[Include endpoint tables, Prisma sketches, IPC channel names, file layout.]

## Implementation Plan

[Optional for small features. Use phased plan for larger work.]

### Phase 1 — ...
1. ...
**Acceptance criteria:** ...

## Acceptance Criteria

- [ ] [Testable checkbox items]

## Non-Goals

- [Explicit out-of-scope items]

## Open Questions

- [Decisions deferred to product review]

## Related Specs

- [Link to parent, sibling, or superseded specs]

## Suggested Commit Message

\`\`\`text
docs (area): short description
\`\`\`
```

---

## What makes a spec good (for agents)

### Do

- **Cite real file paths** — `apps/ios/Moat/Features/Onboarding/Views/onboarding-view.swift`, not "the onboarding view."
- **Name existing APIs and handlers** — `GET /api/v1/plaid/getConnectedInstitutions`, `DashboardService.fetchPortfolioAllocation()`.
- **List reuse candidates** — components, services, and patterns already in the repo that implementers should extend, not duplicate.
- **Show exact copy** — button labels, empty states, row formats (`Robinhood · 3 accounts connected`).
- **Define states** — empty, loading, populated, error; especially for async data (sync, webhooks, polling).
- **Separate goal from implementation** — "user can connect multiple institutions" vs "add `@Published var institutions`."
- **Include non-goals** — prevents agents from expanding scope (e.g., "no disconnect on onboarding step").
- **Link related specs** — parent features, shared onboarding direction, logo.dev integration, etc.
- **Flag open questions** — don't silently decide product tradeoffs.

### Avoid

- Vague goals ("improve onboarding") without success criteria.
- Specs that only describe ideal UX with no repo archaeology.
- Duplicating [AGENTS.md](../AGENTS.md) rules (auth server-side, no PII in logs, kebab-case files) — link instead.
- Implementation details with no user-visible outcome (unless an architecture spec).
- Fake code for code's sake — include snippets only when they clarify contracts (IPC schemas, API shapes).

---

## Section guide

| Section | Required? | Purpose |
|---------|-----------|---------|
| Status | Yes | Draft / In review / Approved / Superseded + provenance |
| Goal | Yes | Outcomes, not tasks |
| Product Context | Yes | User job-to-be-done |
| Current Repo Context | Yes for features | Ground truth for implementers |
| Target Experience | Yes for UI features | Layout, copy, states |
| Architecture | When APIs/schema change | Contracts and boundaries |
| Implementation Plan | Large features | Phased delivery + per-phase acceptance |
| Acceptance Criteria | Yes | Checkbox list for "done" |
| Non-Goals | Strongly recommended | Scope fence |
| Open Questions | When unresolved | Explicit product decisions |
| Related Specs | When applicable | Navigation between specs |
| Suggested Commit Message | Yes | One-line conventional commit for the spec PR |

---

## Status lifecycle

```text
backlog (rough idea)
    ↓ prioritized
features/[name]/spec.md  (Status: Draft)
    ↓ reviewed / agreed
features/[name]/spec.md  (Status: Approved)
    ↓ implemented & shipped
complete/[name]/spec.md  (Status: Complete — optional move)
```

Update the **Status** section when the spec changes meaningfully. Include the date and trigger ("Created … after reviewing X", "Updated … after PR #123 feedback").

---

## Good examples to read

| Spec | Why it's useful |
|------|-----------------|
| [features/ios-onboarding-connect-accounts/spec.md](features/ios-onboarding-connect-accounts/spec.md) | UI redesign with repo context, reuse table, ASCII layout, copy rules |
| [features/desktop-vault-recovery/spec.md](features/desktop-vault-recovery/spec.md) | Security feature with threat model, IPC contracts, phased plan |
| [complete/shared-onboarding/spec.md](complete/shared-onboarding/spec.md) | Cross-platform feature with layout diagrams and package boundaries |
| [features/third-party-app-data-layer/spec.md](features/third-party-app-data-layer/spec.md) | Platform/API feature with architecture decision and repo map |

Smaller or task-specific specs (e.g. [community-tips.spec.md](features/community-tips.spec.md)) can use a lighter template when scope is narrow — but still include Goal, Current Context, and Acceptance Criteria.

---

## Relationship to other docs

| Doc | Role |
|-----|------|
| [specs/mission.md](mission.md) | Why Moat exists — inform Product Context |
| [specs/roadmap.md](roadmap.md) | What's prioritized — check before starting |
| [specs/tech-stack.md](tech-stack.md) | Canonical tools — don't invent stack |
| [AGENTS.md](../AGENTS.md) | Engineering non-negotiables during implementation |
| [docs/patterns/](../docs/patterns/) | Deep dives on auth, API, state, etc. — link from Architecture sections |
| App `AGENTS.md` files | Platform-specific rules (`apps/ios/AGENTS.md`, etc.) |

Specs describe **what and why**. Pattern docs and AGENTS.md describe **how**.

---

## Promoting from backlog

When an idea in `specs/backlog/` is ready:

1. Create `specs/features/[kebab-case-name]/spec.md` using the template.
2. Pull any useful bullets from the backlog file into the new spec.
3. Link the new spec from [roadmap.md](roadmap.md) if it becomes a priority.
4. Leave or trim the backlog note — backlog stays low-friction.

---

## Commit messages for spec-only PRs

Format:

```text
docs ([area]): adds [feature] spec
docs ([area]): updates [feature] spec
```

Examples:

```text
docs (ios): adds onboarding connect accounts spec
docs (desktop): updates vault recovery spec
```

Area tag matches where the feature lives: `web`, `api`, `ios`, `desktop`, `mcp`, or omit for cross-cutting specs.
