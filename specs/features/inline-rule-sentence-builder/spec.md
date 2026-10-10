# Inline Rule Sentence Builder

## Status

Implemented 2026-07-26 across `packages/ui`, `apps/web`, `apps/desktop`, and `apps/ios`. Created after reviewing `apps/web/src/app/(dashboard)/rules/rule-builder-dialog.tsx`, `apps/desktop/src/renderer/src/pages/rules.tsx`, `apps/ios/Moat/Features/Rules/Views/rule-editor-sheet.swift`, and the `@moat/ui` primitive set.

## Goal

Replace the fixed-width, box-style condition and action controls in the rule creator with a compact inline sentence builder that reads like editable prose on web, desktop, and iOS.

Success means:

- A condition or action row renders as one wrapping sentence, not a row of equal-width dropdowns.
- Every interactive segment sizes to its own content and wraps onto the next line when the container is narrow.
- Dropdown labels ("does not contain", "greater than or equal", "Set description") are never truncated by a fixed column width.
- Rule schema, validation, API payloads, and execution semantics are unchanged.

## Product Context

Rules are the highest-leverage automation surface in Moat: one rule silently cleans up hundreds of transactions. The current builder presents that as a database query form — three equal columns of boxed selects. On mobile web and on an iPhone the operator column truncates ("does not con…"), and the whole panel reads as configuration rather than an instruction the user is writing.

An inline sentence ("Description contains my529") is self-documenting: the user reads back exactly what the rule will do, and the interactive parts are discoverable through a shared visual grammar rather than through boxes.

## Current Repo Context

The premise that web and desktop already share a rule-creator component is not accurate today:

| App | Rule creator | Notes |
|-----|--------------|-------|
| `apps/web` | `src/app/(dashboard)/rules/rule-builder-dialog.tsx` | The full-featured builder: conditions, actions, historical preview, save/update. ~1300 lines, inline `ConditionRowUI` / `ActionRowUI` / `CategoryInput`. |
| `apps/desktop` | `src/renderer/src/pages/rules.tsx` (`RuleForm`) | A separate, simpler card form with its own condition/action rows. Imports `@moat/ui` primitives directly. |
| `packages/features` | `src/transactions/rule-builder-adapter.ts` | Types + a `renderRuleBuilder` injection slot only — no rule UI. Desktop does not pass a renderer. |
| `apps/ios` | `Moat/Features/Rules/Views/rule-editor-sheet.swift` | `RuleConditionEditorRow` / `RuleActionEditorRow` as `private struct`s, `HStack` + `Menu` pickers with `.frame(maxWidth: .infinity)`. |
| stale extraction | `apps/web/src/app/(dashboard)/rules/rule-builder-dialog/*` | An abandoned partial extraction that was not imported anywhere. Rewritten and adopted as the live module for the web rows rather than left to rot beside a second copy. |

Because there is no shared row component, the shared layer for this change is the **design system**, not a shared rule component: new inline-token primitives land in `packages/ui` and both web and desktop consume them. Unifying the two rule builders into one component is a separate, larger refactor.

### Existing building blocks to reuse

| Asset | Location | Notes |
|-------|----------|-------|
| `Select` (Radix) | `packages/ui/src/primitives/select.tsx` | Keyboard nav, roles, portal menu — reuse the primitive parts for the inline dropdown trigger. |
| `formatNumericValue` | `packages/ui/src/primitives/numeric-input.tsx` | Comma grouping for amount conditions; must keep working inline. |
| `cn` | `packages/ui/src/cn.ts` | Tailwind class merge. |
| `lucide-react` | already a dependency of `@moat/ui` | `ChevronsUpDown` is the compact combined selector icon. |
| `FlowLayout` | duplicated privately in three iOS views | Promote one copy to `Core/DesignSystem/Layout/flow-layout.swift`. |
| `MoatTheme` tokens | `apps/ios/Moat/Core/DesignSystem/Tokens/moat-theme.swift` | Spacing / color tokens for the iOS inline tokens. |

## Target Experience

One visual grammar, on all three platforms:

| Treatment | Meaning |
|-----------|---------|
| Dotted underline + up/down chevron | Choose from options |
| Dotted underline, no chevron | Freeform editable text |
| No underline | Static connector word (`to`, `and`) |

Wide:

```text
IF — ALL CONDITIONS MATCH
Description ⌃⌄ contains ⌃⌄ my529
and
Merchant ⌃⌄ equals ⌃⌄ Fidelity
+ Add condition

THEN — APPLY THESE ACTIONS
Set description ⌃⌄ to monthly 529 contribution
Set category ⌃⌄ to Investments ⌃⌄
Add hashtag ⌃⌄ tax-deductible
```

Narrow:

```text
Set category ⌃⌄ to
Investments ⌃⌄
```

Empty states keep the underline so they stay discoverable: `Choose field ⌃⌄`, `Select category ⌃⌄`, `enter text`.

The remove control sits in a fixed trailing area outside the wrapping flow, so it can never push the sentence back into columns.

## Architecture / Data Model

No data-model changes. Presentation and interaction only.

New shared primitives — `packages/ui/src/primitives/inline-rule/`:

| Component | Purpose |
|-----------|---------|
| `InlineRuleSentence` | Wrapping flex container (`flex-wrap`, baseline alignment) plus an optional fixed trailing slot for the remove control. |
| `InlineRuleDropdown` | Radix `Select` trigger rendered as inline text: dotted underline on the words, `ChevronsUpDown` beside them, no border or fill. |
| `InlineRuleTextInput` | Auto-sizing inline text token; grid-stacked sizer means no JS measurement and long values wrap instead of clipping. |
| `InlineRuleSuggestInput` | `InlineRuleTextInput` plus an ARIA combobox suggestion list (category, hashtag). |
| `InlineRuleStaticText` | Non-underlined connector words. |
| `InlineRuleRemoveButton` | Shared trailing remove affordance. |

New iOS components — `apps/ios/Moat/Core/DesignSystem/Components/`:

| Component | Purpose |
|-----------|---------|
| `MoatFlowLayout` | Shared `Layout` that flows tokens left to right, wraps, and aligns each row on its first text baseline. |
| `InlineRuleSentence` | `MoatFlowLayout` wrapper with a fixed trailing slot for the remove control. |
| `InlineRuleTokenLabel` | The shared visible label — words, dotted underline, optional `chevron.up.chevron.down`, 40pt minimum tap height. |
| `InlineRulePickerToken` / `InlineRuleSheetToken` | Menu-backed and sheet-backed pickers wearing that label. |
| `InlineRuleTextToken` | Inline `TextField` sized by a mirrored hidden `Text`, dotted underline, no chevron. |
| `InlineRuleDateToken` | Date value as a picker token; a compact `DatePicker` would draw its own box, so it opens the native graphical picker in a sheet. |
| `InlineRuleStaticText` | Plain connector text. |
| `InlineRuleRemoveButton` | Shared trailing remove affordance. |
| `moatDottedUnderline()` | Reusable `ViewModifier` drawing a dashed line under the text only. |

The rule-editor sheet's private `FlowLayout` copy was replaced by `MoatFlowLayout`. The remaining copies in `transactions-view.swift` and `prompt-detail-view.swift` are untouched — consolidating them is an unrelated refactor.

## Acceptance Criteria

- [x] Condition and action rows render as wrapping inline sentences on web, desktop, and iOS.
- [x] No interactive segment uses a fixed width, `flex: 1`, or an equal grid column.
- [x] Picker tokens show a compact up/down chevron; freeform tokens do not.
- [x] Both show a dotted underline; connector words do not.
- [x] Placeholders remain visible and tappable when a value is empty.
- [x] Tap/click targets are at least ~44px/44pt tall even though the visible token is compact.
- [x] Keyboard navigation and visible focus states are preserved on web/desktop.
- [x] Existing add, remove, validation, preview, save, and delete behavior is unchanged.
- [x] Light and dark mode both render correctly.
- [x] Rule schema, API payloads, and rule evaluation are untouched.

## Non-Goals

- Unifying `apps/web` and `apps/desktop` onto a single shared rule builder component.
- Removing the dead `apps/web/src/app/(dashboard)/rules/rule-builder-dialog/` extraction.
- Wiring `renderRuleBuilder` into the desktop transactions page.
- Any change to rule evaluation, condition semantics (`all`/`any`), or the preview endpoint.

## Open Questions

- Should the category token eventually become a true picker (sheet/menu) on web the way it already is on iOS? Today it stays a typed combobox with suggestions, which is why it keeps the chevron but also accepts free text.

## Platform Differences

- Web and desktop accent the open dropdown token through Radix's `data-[state=open]`. SwiftUI's `Menu` exposes no open state, so the iOS menu token relies on the system's own press highlight; the sheet-backed tokens (category, date) do accent while presented.
- iOS date values open a graphical `DatePicker` in a sheet instead of editing inline, because the inline `DatePicker` styles draw their own container.

## Related Specs

- [specs/features/ios-category-picker-sheet](../ios-category-picker-sheet) — the category picker the iOS rule editor presents.

## Suggested Commit Message

```text
docs: adds inline rule sentence builder spec
```
