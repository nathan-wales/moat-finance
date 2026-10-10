# Profile Net Worth Rollup & Household Profile Access

## Status

Draft. Updated 2026-08-05 — expanded beyond Personal net-worth rollup to include **per-member profile grants** on household invites (multi-select which profiles a member can access, with full admin on those profiles except deleting the profile).

Originally created 2026-08-05 after the profile switcher landed (`ProfileLink` / `ProfileKind`) and a product discussion about consolidating Family/Business totals into Personal Overview plus sharing specific profiles with household members (e.g. son → one profile; spouse → all profiles).

## Goal

1. Let a signed-in **owner** manage child profiles from Settings, open a quick view, and optionally include Family/Business **total net worth** in the Personal Overview net worth and portfolio allocation.
2. Let the owner **grant household members access to specific profiles** (multi-select). Members get full admin on each granted profile except deleting/archiving that profile.

Success means:

- Settings has a **My Profiles** section (owner) listing profiles with include-in-net-worth controls
- Toggling **Include in personal net worth** on a Family or Business profile rolls that profile’s total into Personal Overview NW + portfolio allocation
- Household invite / member management includes a **multi-select of profiles** the member may access
- A member only sees and can switch among granted profiles; on those profiles they can fully manage financial data
- Members **cannot** create, archive, or delete profiles; cannot manage household/billing; cannot change another member’s grants
- Transactions, categories, and rules stay per-profile (no ledger merge)
- No MCP / agent surface work in this phase

## Product Context

Owners already create separate Family and Business profiles under one login ([account-switcher](../account-switcher/spec.md)). Those ledgers stay isolated for day-to-day tracking, but:

- Wealth is often still “mine” in aggregate → Personal Overview should be able to **roll up** selected child totals without merging transactions
- Family members need access to **specific** ledgers → a teen’s profile vs a spouse on every profile

Today household membership always maps the member onto the owner’s **personal** `userId` with hardcoded `FULL_ACCESS`, and members cannot use the profile switcher. This spec replaces that with **profile-scoped grants**.

Distinct from:

| Concept | Difference |
|---------|------------|
| **Financial Profile** page | Planning JSON for the *active* profile — not the switcher entity |
| **Household (today)** | Invite another person into one shared owner ledger (personal only) — this spec evolves that |
| Per-item `includeInNetWorth` | Asset/liability flag *inside* one profile |

### Example scenarios

| Member | Granted profiles | Result |
|--------|------------------|--------|
| Son | `Jake` (Family) only | Sees only Jake in the switcher; full admin on that ledger; cannot delete the profile |
| Wife | Personal + Smith Family + Acme LLC | Sees all three; can switch and fully manage each; cannot delete any profile or manage billing/household |

## Current Repo Context

| Asset | Location | Notes |
|-------|----------|-------|
| Profile model | `apps/api/prisma/schema.prisma` — `ProfileLink`, `ProfileKind` | No rollup flag; no household link |
| Household models | `HouseholdInvite`, `HouseholdMembership` | No profile FKs; unique `(ownerUserId, memberUserId)` |
| Household handlers | `apps/api/src/server/handlers/household.ts` | Hardcoded `access: "FULL_ACCESS"`; **max one** active member + one pending invite |
| Identity resolve | `apps/api/src/server/context/resolve-active-context.ts` | Profile switch only if `ownerUserId === actor`; else household → owner personal `userId` |
| Profile handlers | `apps/api/src/server/handlers/profiles.ts` | Owner-only (`assertProfileOwner` / `isHouseholdMember` blocked) |
| Net worth history | `apps/api/src/server/handlers/balance-snapshot.ts` → `getHistory` | Single `userId` |
| Portfolio allocation | `apps/api/src/server/handlers/investment.ts` → `getPortfolioAllocation` | Single `userId` |
| Overview UI | `packages/features/src/overview/components/overview-dashboard.tsx` | Calls both endpoints |
| Settings | `apps/web/src/app/(dashboard)/settings/page.tsx` | `ProfileSection` (name/avatar) + `household-section/` invite name/email only |
| Invite UI | `household-section/invite-member-card.tsx` | Name + email; copy says one member |
| Profile switcher UI | `packages/features/src/profile-switcher/` | Kind icons; wired in web/desktop sidebars |
| OpenAPI | `packages/openapi/api-v1.yaml` | Profiles + household endpoints |
| Auth docs | `docs/patterns/auth-permissions.md` | Members rewrite `userId` to owner; UI is not authz |

### Existing building blocks to reuse

| Asset | Location | Notes |
|-------|----------|-------|
| `listProfiles` / profile service | `profile.service.ts` | Extend for rollup flag; members get **filtered** list by grants |
| Household section cards | `settings/household-section/` | Add profile multi-select to invite + member edit |
| Kind options / icons | `profile-switcher/profile-kind-options.ts` | Shared glyphs in My Profiles + grant picker |
| `@moat/ui` Dialog / Switch / Checkbox | `packages/ui`, web `~/components/ui` | Quick view, toggle, multi-select |
| `assertHouseholdOwner` | `handlers/household.ts` | Keep for invite/remove/grant edits |
| Overview query keys | `overview-dashboard.tsx` | Invalidate after rollup toggle |

## Target Experience

### A. Settings → My Profiles (owner)

Placed on Account settings (`/settings`), after the existing **Profile** (name/avatar) section.

```text
My Profiles
Manage the profiles under this login. Include Family or Business
totals in your personal net worth without merging transactions.

┌──────────────────────────────────────────────────────────┐
│  👤  Tyler Smith                          Personal       │
│      Personal · Active                                   │
├──────────────────────────────────────────────────────────┤
│  👨‍👩‍👧  Smith Family                         Family         │
│      Included in personal net worth                      │
├──────────────────────────────────────────────────────────┤
│  🏢  Acme LLC                             Business       │
│      Not included                                        │
└──────────────────────────────────────────────────────────┘
```

**Copy**

- Section title: `My Profiles`
- Description: `Manage profiles under this login. Include a Family or Business profile’s net worth in your Personal Overview without merging transactions or categories.`
- Row secondary: kind; children show `Included in personal net worth` or `Not included`

**Behavior**

1. Owner loads enriched `GET /api/v1/profiles/list`.
2. Row click → **Profile quick view**.
3. Demo: hide or disable (same as sidebar switcher).
4. Household members: **do not** see My Profiles (rollup is an owner consolidation control). Members use the sidebar switcher for granted profiles only.

### Profile quick view (owner)

```text
┌─────────────────────────────────────┐
│  Acme LLC                     [×]   │
│  Business                           │
│                                     │
│  Net worth           $128,400       │
│  Accounts                  4        │
│                                     │
│  ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─   │
│  Include in personal net worth  [●] │
│  Adds this profile’s total into     │
│  your Personal Overview net worth   │
│  and portfolio allocation.          │
│                                     │
│  [ Open profile ]                   │
└─────────────────────────────────────┘
```

- Toggle only on Family/Business (not Personal)
- `Open profile` → existing switch + reload
- Toggle owner-only; invalidate Overview queries on success

### B. Settings → Household — profile access grants

Evolve the existing Household section. Owner invites or edits a member with a **multi-select list of profiles**.

```text
Invite household member

Name   [ Jake            ]
Email  [ jake@…          ]

Profiles they can access
┌────────────────────────────────────┐
│ [ ] Personal                       │
│ [x] Jake                           │
│ [ ] Smith Family                   │
│ [ ] Acme LLC                       │
└────────────────────────────────────┘
At least one profile required.

              [ Cancel ]  [ Send invite ]
```

Active member card:

```text
┌────────────────────────────────────┐
│ Jake                   Full Access │
│ jake@…                             │
│ Profiles: Jake                     │
│              [ Edit access ] [ Remove ]
└────────────────────────────────────┘
```

`Edit access` opens the same multi-select (pre-checked with current grants). Saving replaces the grant set (must keep ≥ 1 profile).

**Copy**

- Invite description: `Choose which profiles this person can open and manage.`
- Multi-select label: `Profiles they can access`
- Helper: `They get full access to each selected profile’s data, but cannot delete the profile or manage billing.`
- Member badge: keep **Full Access** for v1 (means full admin on *granted* profiles, not the whole account)
- Remove footer copy that says only one household member can be invited (see multi-member below)

**Behavior**

1. Invite requires name, email, and **≥ 1** profile selected.
2. Pending invite stores the selected `profileLinkId`s; resend keeps the same grants (owner can revoke + re-invite to change before accept, or allow edit-pending as a nice-to-have).
3. On accept, grants copy onto the membership.
4. Owner can change grants anytime on an active member.
5. If owner archives a profile later (future feature), grants for that `profileLinkId` are removed; if that was the member’s last grant, membership should be blocked from data access until owner adds another (or treat as remove — see Open Questions).

### C. Member experience

1. Member signs in → identity resolves to a **granted** profile (default: Personal if granted, else first granted by kind/name).
2. Sidebar profile switcher lists **only granted** profiles (no Add profile; no profiles they lack).
3. Switching sets `activeProfileId` among grants only; API rejects switch to non-granted profiles.
4. On an active granted profile, member has **full financial admin** (same mutations the owner has on that ledger): transactions, categories, rules, connections, investments, Financial Profile planning data, etc.
5. Member **cannot**:
   - Create / archive / delete a profile
   - Change `includeInOwnerNetWorth`
   - Manage household (invite, remove, edit others’ grants)
   - Manage owner billing / subscription
   - Delete the owner’s account
6. Member’s own Settings account deletion / 2FA / sessions remain on `actorUserId` (their login), unchanged.

## Member permission matrix (v1)

| Action | Owner | Member (on granted profile) |
|--------|-------|-----------------------------|
| View / mutate financial data for profile `userId` | Yes | Yes |
| Switch among profiles | All owned | Granted only |
| Create profile | Yes | No |
| Rename profile | Yes | Yes (granted only) — optional; default **yes** for “full admin” |
| Archive / delete profile | Yes (future UI) | **Never** |
| Include in personal net worth | Yes | No |
| Household invite / remove / edit grants | Yes | No |
| Billing | Yes | No |

Server must enforce this matrix; UI hiding is not sufficient ([auth-permissions](../../../docs/patterns/auth-permissions.md)).

## Rollup semantics (owner Personal only)

When the **active profile is the owner’s Personal** (`actor` is owner and `profileUserId === ownerUserId`):

1. **Net worth** — `personalNetWorth + Σ(netWorth(child))` for children with `includeInOwnerNetWorth === true`
2. **Portfolio allocation** — merge section keys; child items get a subtitle/prefix with profile display name

Child totals use that profile’s existing include rules (Plaid / assets / liabilities).

**Does not change**

- Member sessions: no owner rollup; member sees only the active granted profile’s NW/allocation
- Owner viewing Family/Business: no rollup into that child
- Transactions / cash flow / budgets: still single active `userId`
- DB snapshots: still per `profileUserId`; no cross-profile copied rows
- MCP / emails / notifications: out of scope this phase

### Historical chart (phase 1)

- Sum Personal monthly totals with included children’s months when snapshot data exists
- Do not invent history before a child existed
- Forecast from consolidated current total using Personal contribution inputs only (limitation OK for phase 1)

## Architecture / Data Model

### Prisma

```prisma
model ProfileLink {
  id                     String   @id @default(cuid())
  ownerUserId            String
  profileUserId          String
  kind                   ProfileKind
  displayName            String
  includeInOwnerNetWorth Boolean  @default(false)
  createdAt              DateTime @default(now())
  archivedAt             DateTime?
  // existing relations…
  householdAccessGrants  HouseholdProfileAccess[]
  householdInviteGrants  HouseholdInviteProfileAccess[]
}

model HouseholdInviteProfileAccess {
  id            String @id @default(cuid())
  inviteId      String
  profileLinkId String
  createdAt     DateTime @default(now())

  invite      HouseholdInvite @relation(fields: [inviteId], references: [id], onDelete: Cascade)
  profileLink ProfileLink     @relation(fields: [profileLinkId], references: [id], onDelete: Cascade)

  @@unique([inviteId, profileLinkId])
  @@index([inviteId])
  @@index([profileLinkId])
}

model HouseholdProfileAccess {
  id            String @id @default(cuid())
  membershipId  String
  profileLinkId String
  createdAt     DateTime @default(now())

  membership  HouseholdMembership @relation(fields: [membershipId], references: [id], onDelete: Cascade)
  profileLink ProfileLink         @relation(fields: [profileLinkId], references: [id], onDelete: Cascade)

  @@unique([membershipId, profileLinkId])
  @@index([membershipId])
  @@index([profileLinkId])
}
```

- Migrations via `pnpm db:migrate:dev` only (never `db push` on Neon)
- `includeInOwnerNetWorth` default `false`; reject setting on Personal links
- On invite accept: copy `HouseholdInviteProfileAccess` → `HouseholdProfileAccess` for the new membership
- Validate every `profileLinkId` is owned by the inviting `ownerUserId` and `archivedAt` is null
- **Lift the one-active-member limit** so son + spouse can both be members (remove or raise the check in `household.ts` that returns “This household already has an active member”). Keep a soft upper bound if needed (Open Question).

### Identity resolution

Update `resolveRequestIdentity` in `resolve-active-context.ts`:

```text
1. If activeProfileId present:
   a. Owner: ProfileLink where id + ownerUserId === actor → effectiveUserId = profileUserId
   b. Member: ACTIVE membership for actor + HouseholdProfileAccess for that profileLinkId
      → effectiveUserId = profileUserId, isHouseholdMember = true
   c. Else ignore cookie and continue
2. Else if actor has ACTIVE household membership:
   → pick default granted profile (Personal if granted, else earliest grant)
   → effectiveUserId = that profileUserId, isHouseholdMember = true
3. Else self
```

Profile list/switch for members:

- `GET /profiles/list` returns only granted profiles when `isHouseholdMember`
- `POST /profiles/switch` allowed for granted profiles (not owner-only)
- `POST /profiles/create` remains owner-only
- Future archive/delete endpoints: owner-only forever for members

Billing / household management continues to use `actorUserId === owner` (or `!isHouseholdMember` where appropriate). Prefer asserting against **owner** identity, not `effectiveUserId === actorUserId`, so an owner with a child profile active can still manage household (today `assertHouseholdOwner` breaks when owner is on a child profile — fix as part of this work).

### API

| Method | Path | Auth | Purpose |
|--------|------|------|---------|
| GET | `/api/v1/profiles/list` | `withAuth` | Owner: all profiles + `includeInOwnerNetWorth`. Member: granted only |
| GET | `/api/v1/profiles/summary` | `withAuth` | Quick view summary; owner any owned; member if granted |
| POST | `/api/v1/profiles/update` | `withAuth` | Owner: rename + `includeInOwnerNetWorth`. Member: rename only if granted; never rollup flag |
| POST | `/api/v1/profiles/switch` | `withAuth` | Owner any owned; member if granted |
| POST | `/api/v1/profiles/create` | `withAuth` | Owner only |
| POST | `/api/v1/household/createInvite` | `withAuth` owner | Body adds `profileLinkIds: string[]` (min 1) |
| GET | `/api/v1/household/getState` | `withAuth` | Members include `profileLinkIds` / display names for grants; `canManage` for owner |
| POST | `/api/v1/household/updateMemberAccess` | `withAuth` owner | `{ membershipId, profileLinkIds }` replace grants (min 1) |

OpenAPI + `@moat/client-ts` updates required.

### Aggregation helpers (rollup)

Service helper used by:

- `balanceSnapshot.getHistory` — when owner Personal is active
- `investment.getPortfolioAllocation` — same

Read-time only; no cross-profile snapshot writes.

### UI layout

| Piece | Location |
|-------|----------|
| My Profiles section | `apps/web/src/app/(dashboard)/settings/my-profiles-section/` |
| Household grant picker | Extend `household-section/` (invite + edit-access dialog) |
| Sidebar switcher | Existing `profile-switcher` — already list-driven; feed filtered list for members; hide **Add profile** for members |

### Analytics (optional)

- `profile_include_in_net_worth_toggled` — `{ userId, enabled, kind }` (no names/amounts)
- `household_profile_access_updated` — `{ userId, profileCount }` (count only; no emails)

## Implementation Plan

### Phase 1 — Rollup + household profile grants (this spec)

1. Schema: `includeInOwnerNetWorth`, `HouseholdInviteProfileAccess`, `HouseholdProfileAccess` + migrations
2. Identity resolve: member profile grants + owner household asserts fixed when on child profile
3. Profiles API: filtered list/switch for members; rollup fields for owner
4. Household API: invite with `profileLinkIds`; `updateMemberAccess`; lift one-member limit
5. Aggregation in `getHistory` + `getPortfolioAllocation` for owner Personal
6. Settings: My Profiles + Household multi-select / Edit access
7. Sidebar: hide Add profile for members; list = grants
8. OpenAPI / client updates

### Phase 2 — follow-ups (out of scope)

- Desktop / SQLite parity
- MCP / notification / email consolidated NW
- Forecast contributions from included children
- iOS household grants + switcher
- Richer quick view
- Finer roles (read-only member) — not needed while “full admin on grant” is the only mode

## Acceptance Criteria

### Net worth rollup

- [ ] `ProfileLink.includeInOwnerNetWorth` exists (default `false`) with committed migration
- [ ] Settings **My Profiles** lists owned profiles; Family/Business quick view has include toggle; Personal does not
- [ ] Toggle owner-only; Personal Overview NW + portfolio allocation include opted-in children
- [ ] No ledger merge for transactions/categories/cash flow; no cross-profile snapshot rows
- [ ] Owner on a child profile does not roll up other profiles into that child

### Household profile access

- [ ] Invite requires multi-select of ≥ 1 owned profile; grants stored on invite and copied on accept
- [ ] Owner can edit an active member’s granted profiles (≥ 1)
- [ ] More than one active household member is allowed (son + spouse scenarios)
- [ ] Member `profiles/list` / switcher shows only granted profiles; **Add profile** hidden
- [ ] Member can fully mutate financial data on a granted profile’s `userId`
- [ ] Member cannot create/archive/delete profiles, manage household, manage billing, or set include-in-NW
- [ ] API rejects member access to non-granted `profileUserId`s (switch + data scoped via identity)
- [ ] Owner can manage household even while a child profile is active (`assertHouseholdOwner` uses owner/actor, not “effective === actor”)
- [ ] OpenAPI + TS client updated
- [ ] No PII in logs; analytics use counts/booleans/enums only

## Non-Goals

- Merging transactions, categories, rules, or Financial Profile JSON across profiles
- MCP or agent tools net-worth live breakdowns
- Writing consolidated balances into Personal `BalanceSnapshot` rows
- Including Personal in itself, or reciprocal “include Personal in Business”
- Read-only or custom permission roles beyond “full admin on granted profiles”
- Letting members delete/archive profiles
- Letting members invite others or edit grants
- Archive/delete profile UI for owners (still later; when built, members remain blocked)
- iOS / desktop UI parity (unless shared packages make it cheap)
- Different product engines per `ProfileKind`

## Open Questions

- **Quick view depth:** Net worth + account count enough, or a one-line allocation breakdown?
- **Allocation item labeling:** Subtitle per child item vs one synthetic rolled-up item per section per child?
- **Default member landing profile:** Personal-if-granted, else first by `createdAt` — OK?
- **Member rename:** Confirm members may rename granted profiles (recommended yes for “full admin”).
- **Soft cap on household members:** e.g. 5 or 10, or unlimited for now?
- **Last grant removed / profile archived:** Auto-remove membership vs force owner to pick another profile before save?
- **Pending invite grant edit:** Allow editing profile multi-select on pending invites, or revoke + re-invite only?
- **My Profiles placement:** Immediately under Profile (name) vs after Household?

## Related Specs

- [Profile Switcher & Adder](../account-switcher/spec.md) — `ProfileLink`, switcher, identity order (this spec extends household interaction)
- [Row-level security](../row-level-security/spec.md) — effective `userId` / actors
- [Auth & permissions](../../../docs/patterns/auth-permissions.md)

## Suggested Commit Message

```text
docs: adds household profile access to rollup spec
```
