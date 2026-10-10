# iOS Transaction Swipe Actions

## Status

Active. Implementing Voice Memos–style swipe actions on the iOS Transactions list.

## Goal

Let users create a rule or hide a transaction with a smooth leading/trailing swipe on the Transactions tab, without opening the detail sheet first.

Success means:

- Swipe right reveals **Rule** (`wand.and.stars`) on the left
- Swipe left reveals **Hide** (`eye.slash`) on the right (or **Unhide** / `eye` when already hidden)
- Rule opens `RuleEditorSheet` directly with `Description contains {originalDescription}` and no THEN actions
- Hide calls the existing hide API immediately and may still show the post-hide rule prompt
- Swipes are disabled during bulk selection; tap and long-press still work

## Current Repo Context

| Piece | Location |
|-------|----------|
| Transactions list | `apps/ios/Moat/Features/Transactions/Views/transactions-view.swift` |
| Hide / rule prompt VM | `apps/ios/Moat/Features/Transactions/ViewModels/transactions-view-model.swift` |
| Rule editor sheet | `apps/ios/Moat/Features/Rules/Views/rule-editor-sheet.swift` |
| Existing swipeActions | Notifications list, Hidden Accounts sheet |

The list was a `ScrollView` + `LazyVStack`, so native `.swipeActions` required converting loaded content to a `List`.

## Non-goals

- Dashboard / Income Insights recent rows
- Web or desktop
- API or schema changes
- Changing the detail-sheet hide confirmation flow
