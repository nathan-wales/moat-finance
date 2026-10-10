# Profile Switcher & Adder

## Status

Updated 2026-08-05 — renamed from workspace to **profile** (child / family / business profiles). Product UI may say “Add profile”; **code and schema use profile**. Distinct from **Financial Profile** (planning data page).

## Goal

Let a signed-in owner keep multiple full financial identities (personal, family, business) under one login and switch between them from the sidebar profile menu on web and desktop.

Success means:

- Owner can open the bottom-left profile menu, expand a chevron flyout, see their profiles, and switch without signing out
- Owner can add a Family or Business child profile; kind only changes the list icon/label
- Switching changes the entire data view (connections, transactions, rules, categories, investments, financial profile data) via the same `userId`-scoped stack
- Household invites remain a separate feature (invite another person into one profile)

## Product Context

Users need separate ledgers (e.g. household vs LLC) without juggling logins. Family/Business are presentation kinds, not different product engines. Naming the model **profile** matches “switch profiles / child profile / business profile.” Avoid confusion with the existing **Financial Profile** planning screen — that remains planning JSON on the active profile’s `userId`.

## Current Repo Context

| Asset | Location | Notes |
|-------|----------|-------|
| Web sidebar profile popover | `apps/web/src/components/layout/sidebar.tsx` | Avatar trigger; menu has feedback, settings, appearance, sign out |
| Desktop sidebar profile popover | `apps/desktop/src/renderer/src/components/sidebar.tsx` | Same shape; Lock app instead of sign out |
| Appearance flyout pattern | `packages/features/src/appearance/profile-appearance-menu-item.tsx` | `ChevronRight` hover/click submenu to reuse |
| Identity resolve | `apps/api/src/server/context/resolve-active-context.ts` | Demo user + household + active profile |
| Handler wrappers | `apps/api/src/server/handler-wrappers.ts` | Sets `ctx.userId = effectiveUserId` |
| Demo cookie | `activeAppContext=demo` | Precedent for client context switching |
| Household | `HouseholdMembership`, `HouseholdInvite` | Share one owner ledger; not a multi-profile switcher |
| Financial Profile | `FinancialProfileData`, `/financial-profile` | Planning data for the *active* profile — not the switcher entity |

### Existing building blocks to reuse

| Asset | Location | Notes |
|-------|----------|-------|
| `resolveRequestIdentity` | `apps/api/src/server/context/resolve-active-context.ts` | Profile + household chain |
| Demo header/cookie pattern | `@moat/client-ts`, demo-mode context | Mirror for `activeProfileId` |
| `@moat/ui` Popover / Dialog / Avatar | `packages/ui`, `~/components/ui` | Menu primitives |

## Target Experience

### Sidebar popover

1. User clicks bottom-left profile control → existing menu opens.
2. **Top row:** same avatar/name/email as the trigger, with a right chevron.
3. Chevron/hover opens a flyout listing profiles (kind icon + display name), checkmark on active, **Add profile** at bottom.
4. Choosing a profile switches active profile and refreshes the full app view.
5. **Add profile** opens a dialog: Family or Business (+ optional display name) → create + switch.
6. Below the top row: existing items (feedback, settings, appearance, sign out / lock).

### Copy

- Flyout CTA: `Add profile`
- Kinds in UI: `Personal`, `Family`, `Business`
- Dialog title: `Add profile`
- Kind descriptions (short): Family / Business only change how the profile appears in the list

### States

- Loading list: skeleton or disabled flyout items
- Empty beyond personal: only Personal + Add profile
- Error create/switch: toast / inline error; no silent failure
- Demo mode: switcher hidden or disabled (demo ignores profile cookie)

## Architecture / Data Model

### Prisma

```prisma
enum ProfileKind {
  PERSONAL
  FAMILY
  BUSINESS
}

model ProfileLink {
  id            String      @id @default(cuid())
  ownerUserId   String
  profileUserId String
  kind          ProfileKind
  displayName   String
  createdAt     DateTime    @default(now())
  archivedAt    DateTime?

  ownerUser   User @relation("ProfileLinkOwner", fields: [ownerUserId], references: [id], onDelete: Cascade)
  profileUser User @relation("ProfileLinkProfile", fields: [profileUserId], references: [id], onDelete: Cascade)

  @@unique([ownerUserId, profileUserId])
  @@index([ownerUserId])
}
```

- Personal profile: `profileUserId = ownerUserId`, kind `PERSONAL` (backfill for existing users).
- Child profile: new `User` with no login credentials + `ProfileLink` (`FAMILY` / `BUSINESS`).

### Identity resolution order

`demo` → `active profile` (if owned by actor) → `household` → `self`

- Cookie/header: `activeProfileId` / `x-active-profile-id`
- Auth, billing, 2FA stay on `ownerUserId`
- `ctx.userId` = effective profile `User.id`

### API

| Method | Path | Purpose |
|--------|------|---------|
| GET | `/api/v1/profiles/list` | List owner profiles + `isActive` |
| POST | `/api/v1/profiles/create` | Create Family/Business (`kind`, `displayName`) |
| POST | `/api/v1/profiles/switch` | Set active profile cookie |
| POST | `/api/v1/profiles/update` | Rename (optional v1) |

All `withAuth`. Reject switch/create for non-owners.

### Shared UI (`packages/features/src/profile-switcher/`)

- `ProfileSwitcherMenuItem`
- `ProfileSwitcherSubmenu`
- `AddProfileTypeDialog`

## Acceptance Criteria

- [ ] Personal always appears in the switcher as the owner-account placeholder (no signup seed required; `ProfileLink` optional)
- [ ] Owner can create FAMILY and BUSINESS child profiles
- [ ] Kind only affects icon/label in the switcher list
- [ ] Switch changes effective `userId` for API data scope
- [ ] Synthetic child Users cannot log in
- [ ] Demo mode ignores profile cookie
- [ ] Web sidebar shows profile row + flyout + add dialog
- [ ] Desktop sidebar supports the same switcher UX against local data
- [ ] Household feature remains unchanged in behavior for v1
- [ ] No PII in logs; auth checks server-side

## Non-Goals

- Linking separate email/Google logins (multi-login switcher)
- Different engines for Family vs Business
- Replacing or merging Household invites
- Migrating financial tables off `userId`
- Advisor / org / multi-seat admin
- iOS switcher (later)
- Archive/delete profile UI (later)
- Renaming the Financial Profile planning feature

## Open Questions

- Should household invites attach to the owner’s active profile or only personal?
- Billing: one subscription per owner covering all child profiles?
- Default display names when user skips naming?

## Related Specs

- [Row-level security](../row-level-security/spec.md) — effective `userId` / actors
- [Desktop local vault](../../complete/desktop-local-vault/spec.md) — future multi-profile note
- [Auth & permissions](../../../docs/patterns/auth-permissions.md)

## Suggested Commit Message

```text
refactor: rename workspaces to profiles
```
