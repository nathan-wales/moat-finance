# iOS rule editor — hashtag keyboard suggestions

## Problem

When creating or editing a rule on iOS and adding an **Add hashtag** action, the user types a freeform hashtag with no discovery of tags they already use. Existing hashtags are only surfaced in the transactions editor as inline chips under the field — not in the rule creator.

## Goal

Show a horizontal hashtag suggestion bar in the keyboard accessory (above the system keyboard) while the rule editor’s hashtag field is focused. Keep the existing keyboard-dismiss chevron pinned on the right. Do not try to replace Apple’s predictive-text row.

## Current context

| Piece | Path |
|-------|------|
| Rule editor sheet | `apps/ios/Moat/Features/Rules/Views/rule-editor-sheet.swift` |
| Add-hashtag action token | `apps/ios/Moat/Features/Rules/Views/rule-action-sentence.swift` → `InlineRuleTextToken` |
| Keyboard dismiss accessory | `apps/ios/Moat/Core/DesignSystem/Components/moat-keyboard-dismiss.swift` (already on `MoatGlassSheet`) |
| Existing fuzzy matcher (transactions only) | private helpers in `transactions-view.swift` |
| Hashtag list API | `GET /api/v1/hashtag/list` → `HashtagSummary` |

## Behavior

1. While an **Add hashtag** text token is focused, query the user’s hashtags (from the parent-provided cache / rules load).
2. Rank **prefix matches first**, then fuzzy subsequence matches (same scoring as the transactions hashtag editor).
3. Render up to **8** chips in a horizontally scrolling keyboard accessory; dismiss chevron stays on the right.
4. Tap a chip → replace the current hashtag field text with that name.
5. Debounce ranking by **~150ms** while typing.
6. Hide chips (keep dismiss only) when there are no useful matches (including when the typed value already exactly matches the only candidate).
7. Exclude hashtags already used by other add-hashtag actions in the same draft.

## Non-goals

- Customizing Apple’s predictive-text suggestions
- Changing web/desktop rule builders
- Persisting a separate hashtag search API (use the existing list cache)

## Acceptance criteria

- [x] Focusing the hashtag action field shows matching chips above the keyboard when matches exist
- [x] Dismiss-keyboard control remains available on the right
- [x] Selecting a chip fills the action text
- [x] Rules tab and transaction-originated rule sheets both receive hashtag data
- [x] Matching logic is shared (not duplicated) and covered by unit tests
