# Route Command Menu

## Status

Draft. Created 2026-07-11 after reviewing shared UI (`packages/ui`), web dashboard layout, and desktop App shell navigation.

## Goal

Add a keyboard-first route navigator (`Cmd+K` / `Ctrl+K`) that lets users jump between main app pages from anywhere in the authenticated web and desktop shells.

Success means:

- Opening the menu from any dashboard page with `Cmd+K` (macOS) or `Ctrl+K` (Windows/Linux)
- Filtering routes immediately as the user types
- Keyboard navigation (arrow keys + Enter) with the first match auto-selected on open and on query change
- Shared modal UI/logic consumed by both web and desktop

## Product Context

Users frequently hop between Dashboard, Budget, Transactions, AI Access, and related pages. A command menu reduces sidebar hunting and matches the keyboard-driven workflow power users expect from tools like ChatGPT and Linear.

## Current Repo Context

| Asset | Location | Notes |
|-------|----------|-------|
| Shared dialog primitives | `packages/ui/src/primitives/dialog.tsx` | Reuse for centered modal |
| Shared UI package | `packages/ui` | Already depended on by web + desktop |
| Web sidebar routes | `apps/web/src/components/layout/sidebar.tsx` | Source of route labels/hrefs |
| Web dashboard shell | `apps/web/src/app/(dashboard)/layout.tsx` | Mount point for authenticated pages |
| Desktop sidebar routes | `apps/desktop/src/renderer/src/components/sidebar.tsx` | Parallel route labels |
| Desktop page router | `apps/desktop/src/renderer/src/App.tsx` | In-memory `Page` state + `routePages` map |
| Shared navigation contract | `packages/features/src/navigation-context.tsx` | Used by feature pages, not required for shell routing |

### Existing building blocks to reuse

| Asset | Location | Notes |
|-------|----------|-------|
| `Dialog` / `DialogContent` | `@moat/ui` | Centered overlay modal |
| Fuzzy-ish scoring pattern | `packages/ui/src/primitives/hashtag-combobox.tsx` | Similar immediate filter UX |
| `KbdShortcut` | `packages/ui/src/primitives/kbd-shortcut.tsx` | Optional hint for `⌘K` / `Ctrl K` |

## Target Experience

1. User presses `Cmd+K` / `Ctrl+K` anywhere in the authenticated app shell.
2. A sleek centered modal opens with placeholder copy like `Search pages...`.
3. The first route in the filtered list is highlighted immediately.
4. Typing filters the list instantly (client-side only).
5. Arrow Up/Down moves the highlight; Enter navigates and closes; Escape closes.
6. Clicking a row also navigates and closes.

Empty state copy: `No pages found.`

### V1 route set

Shared destinations (labels may match sidebar copy):

- Dashboard
- Financial Profile
- Reports
- Prompts
- AI Access
- Insights
- Budget
- Transactions
- Rules
- Categories
- What If
- Investments
- Scenarios
- Settings

Desktop-only:

- Import

## Architecture / Data Model

No API, schema, or IPC changes.

```text
packages/ui/src/command-menu/route-command-menu.tsx
  ← shared modal + filter + keyboard behavior

apps/web/.../route-command-menu.tsx
  ← web route list + useRouter().push

apps/desktop/.../App.tsx (or thin wrapper)
  ← desktop route list + setPage / nav.push
```

Shared component props (conceptual):

- `routes: { id: string; label: string; href: string; icon?: LucideIcon; keywords?: string[] }[]`
- `open: boolean`
- `onOpenChange: (open: boolean) => void`
- `onSelectRoute: (route) => void`

Route metadata stays app-owned so web (`/mcp-settings`) and desktop (`mcp` page / `/mcp`) can diverge without forcing a shared path contract.

## Implementation Plan

### Phase 1 — Shared UI + shell wiring

1. Add `RouteCommandMenu` to `@moat/ui` with dialog, filter, and keyboard handling.
2. Mount a thin client wrapper in the web dashboard layout.
3. Mount the same shared component in the desktop App shell.
4. Keep sidebar route lists as the source of labels; optionally dedupe lightly if drift risk is high, but avoid a large nav refactor.

**Acceptance criteria:** see below.

## Acceptance Criteria

- [ ] `Cmd+K` / `Ctrl+K` opens the menu in web and desktop authenticated shells
- [ ] First filtered result is auto-selected on open and whenever the query changes
- [ ] Arrow keys move selection; Enter navigates; Escape closes
- [ ] Filtering is immediate and client-side only
- [ ] Selecting a route navigates to that page and closes the menu
- [ ] Shared UI lives in `@moat/ui`; web/desktop only supply routes + navigate callbacks
- [ ] No search over chats, transactions, budgets, or other data in this pass

## Non-Goals

- Searching chats, transactions, merchants, budgets, or reports content
- Recent pages / history ranking
- Actions beyond navigation (create rule, open dialogs, etc.)
- Unifying web and desktop sidebar components
- Mobile-specific gesture entry points beyond the keyboard shortcut

## Open Questions

- None for v1; desktop Import is included because it is a real desktop destination.

## Related Specs

- None

## Suggested Commit Message

```text
feat: adds shared route command menu
```
