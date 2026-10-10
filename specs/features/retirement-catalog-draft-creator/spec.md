# Retirement Catalog Draft Creator

## Status

Draft. Created August 27, 2026 after reviewing `packages/features/src/retirement/what-if/catalog-picker.tsx`, `packages/features/src/retirement/what-if/custom-builder.tsx`, `packages/features/src/retirement/what-if/compile-custom-lever.ts`, `packages/features/src/retirement/what-if/what-if-tab.tsx`, `packages/features/src/retirement/lever-catalog.ts`, `packages/domain/src/retirement/default-lever.ts`, `packages/features/src/retirement/retirement-store.ts`, `packages/features/src/retirement/what-if/lever-stack.tsx`, `packages/features/src/retirement/describe-lever.ts`, the OAuth New → AI Access highlight in `apps/web/src/app/(dashboard)/settings/ai-access/` (`oauth-connections-card.tsx`, `ai-assistant-connect-card.tsx`, `oauth-connection-status.ts`), the same ring on Financial Profile (`packages/features/src/financial-profile/financial-profile-page.tsx`), and `@keyframes connect-focus-ring` in `apps/web/src/styles/globals.css` / `apps/desktop/src/renderer/src/styles.css`. No code in this change.

## Goal

When the user picks a change from **Browse all changes**, do **not** push it onto the Exploring stack. Prefill the **Add another change** creator with that lever (retirement age, dollar amount, years, …), pulse the same gray/primary focus ring used when OAuth **New** lands on AI Access, and wait for **Add to stack**.

Success means:

- Clicking "Retire at an age" in the catalog closes the dialog, fills the creator with a retirement-age field (defaulted from the plan), and does not add a row under Exploring until **Add to stack**.
- The creator card shows the existing connect-focus ring (`animate-connect-focus ring-2 ring-primary`) for 2140ms and scrolls into view, matching OAuth New / Financial Profile `?highlight=accounts`.
- The user can change the prefilled age/amount/years, then add. A second catalog pick replaces the draft rather than stacking two silent levers.
- Suggested **Try it** and Improve **Try it** still add immediately. Only the catalog picker changes.

## Product Context

The catalog is how you pick a *kind* of change ("Retire at an age", "Change contributions", "Max Roth IRA"). The creator is how you set the *numbers*. Today those jobs are collapsed: catalog click = `addLever(defaultLeverFor(type))`, so "Retire at an age" lands on the stack at the plan's current target with no chance to type 57 first. The user then has to remove or live with the default. Stack rows have no Edit (despite the parent retirement spec promising a ⋮ Edit).

The creator already exists for this job. It is the sentence card with dotted underlines and **Add to stack**. Catalog should feed that card, not bypass it.

The emphasis is not a new invention. OAuth **New** navigates to `/ai-access?highlight=connect` and rings the connect card so you know where to act. Same ring, same duration, same scroll. Catalog is same-page, so the highlight is in-memory rather than a URL param, but the visual must be identical.

## Current Repo Context

### Catalog click (today)

`packages/features/src/retirement/what-if/catalog-picker.tsx`:

- Button copy: `Browse all changes` (dialog title `Browse changes`).
- `addType(type)` calls `addLever(defaultLeverFor(type, ctx))`, fires `retirement_lever_added` with `source: "catalog"`, closes the dialog.
- Dialog description: `Add a modeled change to the stack. You can remove or disable it afterward.`
- Catalog is `LEVER_CATALOG` (~70 `RetirementLeverType`s) grouped by `CATEGORY_ORDER`. Spouse types hidden when `!overview.plan.hasSpouse`.
- Defaults come from `defaultLeverFor` in `packages/domain/src/retirement/default-lever.ts` via `defaultLeverContextFromOverview`.

### Creator (today)

`packages/features/src/retirement/what-if/custom-builder.tsx` + `compile-custom-lever.ts`:

- Card: `rounded-lg border bg-white p-4`, heading `Add another change`, CTA `Add to stack`.
- Sentence grammar is **11 kinds only** (`CUSTOM_LEVER_KINDS`): receive income, spend, one-time, stop working, retire at, spouse stop/retire, reduce income, career break, job loss.
- Fields: kind dropdown + optional amount + from-age + optional until-age + optional label. `InlineRuleSentence` / `InlineRuleDropdown` / `InlineRuleTextInput` from `@moat/ui`.
- **Add to stack** compiles via `compileCustomLever` and `addLever`. Analytics `source: "custom"`.
- Mounted in `ScenarioColumn` with `key={overview ? "loaded" : "pending"}`, which resets local state when overview first arrives. Any catalog draft must survive that, so draft state cannot live only in `useState` inside the builder if overview can flip the key.

The creator is **not** a generic catalog param editor. Mapping 70 catalog types onto those 11 dropdown values is a dead end (`retire_later`, `max_roth_ira`, `social_security_claim_age`, `downsize_home`, … have no kind).

### Stack (today)

`lever-stack.tsx` can toggle, remove, move, duplicate. No Edit. Labels from `describeRetirementLever`. Parent spec (`specs/features/retirement/spec.md`) still lists ⋮ Edit; that is **out of scope** here, but the draft editor this spec adds is the natural reuse for Edit later.

### Connect-focus ring (reuse this, do not invent)

| Piece | Where | Value |
|-------|--------|--------|
| Animation | `apps/web/src/styles/globals.css` and `apps/desktop/src/renderer/src/styles.css` | `@keyframes connect-focus-ring` 0→8px `color-mix(in oklab, var(--color-primary) 35%, transparent)` halo; `.animate-connect-focus` = `1.07s ease-in-out 2` |
| Classes on the card | AI Access + Financial Profile + `packages/ui` split-action | `animate-connect-focus ring-2 ring-primary` |
| Overflow while ringing | `ai-assistant-connect-card.tsx` | `overflow-visible` while highlighted, otherwise `overflow-hidden` |
| Duration | `CONNECT_HIGHLIGHT_MS` / `ACCOUNTS_HIGHLIGHT_MS` | **2140** (two pulses) |
| Scroll | `scrollIntoView` after 50ms | AI Access uses `block: "center"` + `id={CONNECT_CARD_ELEMENT_ID}`; Financial Profile uses `block: "start"` + `id="accounts"` |
| Trigger | URL `?highlight=connect` or `?highlight=accounts` | Catalog is same-page: **do not** add a URL param. Mirror the effect with local/store state. |

The ring looks gray because `--color-primary` mixed at 35% is a soft halo, plus `ring-2 ring-primary`. Do not substitute `ring-muted` or a custom outline. Features already use these class names (`packages/features/src/financial-profile/components.tsx`). Both web and desktop load the keyframes. Do not duplicate CSS into `@moat/features`.

Closest copy-paste in features: `FinancialProfilePage` highlight effect (2140ms, scroll, then clear). AI Access also strips the query param; catalog has nothing to strip.

### Existing building blocks to reuse

| Asset | Location | Notes |
|-------|----------|-------|
| Catalog dialog | `what-if/catalog-picker.tsx` | Change `onSelect` from `addLever` to `seedDraft` |
| Creator card | `what-if/custom-builder.tsx` | Become the draft editor; keep sentence chrome |
| Kind compile | `what-if/compile-custom-lever.ts` | Keep for the empty-state freeform sentence |
| Defaults | `packages/domain/src/retirement/default-lever.ts` | Seed params; do not invent new defaults |
| Overview → ctx | `what-if/lever-context.ts` | Already used by the picker |
| Catalog labels | `lever-catalog.ts` | Title in the sentence ("Retire at an age") |
| Human sentence | `describe-lever.ts` | Optional helper text under the fields |
| Store | `retirement-store.ts` | Add a catalog draft; do **not** `addLever` until CTA |
| Column | `what-if/what-if-tab.tsx` | Pass draft into the creator; give the card an `id` |
| Focus ring | `animate-connect-focus ring-2 ring-primary` | Same as OAuth New / profile accounts |
| Inline fields | `@moat/ui` `InlineRule*` | Same dotted inputs as today |
| Analytics | `retirement-analytics` | Move `source: "catalog"` to **Add to stack** |

## Target Experience

```text
Browse all changes  →  pick "Retire at an age"  →  dialog closes

Add another change                         ← gray/primary focus ring, ~2s
What if  [I retire ↕]  at age  [62]
[ Add to stack ]

Browse all changes
```

1. User opens **Browse all changes**.
2. Clicks a row (e.g. Retire at an age, Retire later, Change contributions).
3. Dialog closes. Query in the dialog resets as today.
4. Creator is seeded:
   - Kind / title matches the catalog label.
   - Params from `defaultLeverFor(type, ctx)` so ages and dollars are already this user's (target retirement age, current age, $500 contribution delta, …).
   - Fields the user cares about are editable (age, years, monthly/annual amount, percents, catch-up, coverage). Nested blobs (spending stages, full buy-home mortgage, withdrawal order) stay at defaults in v1 with a one-line summary, still requiring **Add to stack**.
5. Card gets `id="retirement-lever-draft"`, `overflow-visible`, classes `animate-connect-focus ring-2 ring-primary` for 2140ms, `scrollIntoView({ behavior: "smooth", block: "center" })` after 50ms. Ring ends; card stays the draft until they add or replace.
6. User edits, clicks **Add to stack**. Lever goes on Exploring. Creator returns to the idle sentence (`What if I receive income…`). Ring does not stay after add.
7. If they open the catalog again and pick something else, the draft is **replaced**. Confirm is not required; the previous draft was never on the stack.
8. If they change the kind dropdown after a catalog seed, that edits the draft in place (same as typing a different sentence), not a second lever.

Empty / no-param levers (`max_401k`, `max_roth_ira`): still land in the creator so they can confirm catch-up (and see the ring). Do not auto-add.

Keyboard: picking a catalog row is a click today. After close, move focus to the first editable field in the creator (age/amount), not back to **Browse all changes**.

### Copy

| Surface | Copy |
|---------|------|
| Dialog title | `Browse changes` (unchanged) |
| Dialog description | `Choose a change, then set the details before adding it to the stack.` |
| Creator heading (idle) | `Add another change` |
| Creator heading (catalog draft) | `Add another change` (same). Optional one-line muted: catalog label, e.g. `Retire at an age`. |
| Primary CTA | `Add to stack` (unchanged) |
| Catalog trigger | `Browse all changes` (unchanged) |

Do not say "draft" in the UI. The ring plus the uncommitted CTA is the draft.

### Suggested / Improve

**Try it** stays `addLever` immediately with `source: "suggested"` / `"improve"`. Those cards already chose the params. Catalog is the path that needs numbers.

## Architecture / Data Model

No Prisma, no API, no contract change. UI + store only, all in `@moat/features/retirement`.

### Store

Add to `useRetirementStore`:

```ts
catalogDraft: RetirementLever | null
catalogDraftNonce: number  // increment on each catalog pick so the ring restarts
setCatalogDraft: (lever: RetirementLever | null) => void
```

- `setCatalogDraft(lever)` sets the lever, bumps nonce, does **not** set `isDirty` (nothing is on the stack yet).
- `addLever` from the creator clears `catalogDraft`.
- `hydrateDraft` / `clearDraft` also clear `catalogDraft`.
- Do not persist the draft in the URL `?levers=` encoding. Uncommitted.

Picker calls `setCatalogDraft(defaultLeverFor(type, ctx))` instead of `addLever`.

### Creator as draft editor

Split the card into two modes driven by `catalogDraft`:

1. **Idle (no draft)** — today's `CustomLeverBuilder` sentence + 11 kinds. Unchanged freeform path.
2. **Seeded** — render fields for `catalogDraft.type` using a field map, still inside the same bordered card, same **Add to stack**.

Do **not** explode `CUSTOM_LEVER_KIND_OPTIONS` to 70 entries. Keep compile-custom-lever for mode 1.

Recommended new helper (kebab-case, next to the builder):

`packages/features/src/retirement/what-if/lever-draft-fields.ts`

Maps `RetirementLeverType` → list of editable controls bound to `params`:

| Control | Used for |
|---------|----------|
| age | `age`, `atAge`, `fromAge`, `toAge`, `startAge` |
| years / integer | `years`, `monthsOut`, `recoveryYears`, `everyNYears`, `durationYears` |
| money | `amount`, `annualAmount`, `monthlyAmount`, `monthlyDelta`, `annualDelta`, `annualIncome`, `price`, … |
| percent (0–1 stored, shown as %) | `delta` on returns/inflation, `matchPercent`, `dropPercent`, `fillToBracket` |
| bool | `includeCatchUp`, `thenRent`, `hasCola`, `remove` |
| enum | `coverageType`, `whom`, `target`, `cadence`, `usage`, `direction` |

`Add to stack` builds `{ type, params }` from the edited map (start from the seeded lever, patch changed keys) and calls `addLever`. Validate the same way `compileCustomLever` does (finite ages, amounts > 0 when required). If invalid, do not add; keep the ring off, leave the draft.

Types with only booleans/enums still show those controls. Types with nested `stages` / `order` / full `buy_home` param objects: v1 shows `describeRetirementLever(draft)` as read-only summary plus any scalar fields that *are* mapped (`atAge`, `price`). User can still add the defaulted lever. Call this out in the card with no extra modal.

### Emphasis

On `catalogDraftNonce` change (and when `catalogDraft` becomes non-null):

1. `setHighlighted(true)`.
2. After 50ms, `document.getElementById("retirement-lever-draft")?.scrollIntoView({ behavior: "smooth", block: "center" })`.
3. After 2140ms, `setHighlighted(false)`. Do **not** clear `catalogDraft`.
4. Card className: `cn("space-y-4 rounded-lg border bg-white p-4", highlighted && "overflow-visible animate-connect-focus ring-2 ring-primary")`.
5. Constant `CATALOG_DRAFT_HIGHLIGHT_MS = 2140` next to the creator (or shared with financial-profile only if you extract; **do not** import from `apps/web/.../ai-access`). Copying the number is what Financial Profile already does.

Same-page: no `?highlight=` on the retirement URL. Do not fight `?scenario=` / `?levers=`.

Restart the animation when nonce increments (remount the card via `key={catalogDraftNonce}` **only for the ring wrapper**, or toggle the class off/on). Do not remount in a way that wipes in-progress edits of the same pick.

### Analytics

Fire `retirement_lever_added` `{ leverType, source: "catalog", stackSize }` when **Add to stack** commits a catalog-seeded draft. Do not fire on catalog row click. Idle creator stays `source: "custom"`.

Optional: `retirement_catalog_drafted` `{ leverType }` on pick if we want funnel metrics. Not required.

## Implementation Plan

### Phase 1 — Catalog seeds the creator (blocking)

1. Store `catalogDraft` + nonce + `setCatalogDraft`.
2. Picker `onSelect` → `setCatalogDraft(defaultLeverFor(...))`, close dialog. Update dialog description.
3. Creator reads the draft. Mode 1 idle vs mode 2 seeded. Seeded uses `lever-draft-fields` for scalars/enums/bools. **Add to stack** commits and clears draft.
4. Apply connect-focus ring + scroll + 2140ms on nonce change. `id="retirement-lever-draft"`.
5. Focus the first field after close.
6. Replace-on-re-pick. Clear draft on hydrate/clear stack.
7. Fix the `key={overview ? "loaded" : "pending"}` trap: do not remount the creator in a way that drops a live draft. Drive reset from `catalogDraftNonce` / explicit idle reset instead of overview identity.

**Acceptance criteria:** Phase 1 items below.

### Phase 2 — Sentence quality (same PR if small)

1. Seeded heading/sentence uses catalog `label` ("What if I retire at an age at age [62]") via `InlineRule*` so it still looks like the creator, not a settings form.
2. Where a catalog type already maps onto a `CustomLeverKind` (`retire_at_age` → `retire_at`, `stop_working_at_age` → `stop_working`, `job_loss`, `career_break`, `custom_income` / `custom_expense` / `custom_one_time`, spouse variants), reuse that sentence instead of a generic field list.
3. Tests: picker does not call `addLever`; committing does; highlight class present after seed.

Nested param editors (stages, withdrawal order, buy-home term/rate) are **not** Phase 1 or 2.

## Acceptance Criteria

- [ ] Catalog row click does not add a lever to Exploring.
- [ ] Catalog row click closes the dialog and prefills the Add another change card from `defaultLeverFor` for that type (age/years/amount as applicable).
- [ ] User can edit those fields, then **Add to stack** adds exactly one lever with the edited params.
- [ ] After add, Exploring shows the new row and the creator returns to the idle sentence.
- [ ] The creator card uses `animate-connect-focus ring-2 ring-primary` for 2140ms after a catalog pick, with `overflow-visible` during the pulse, matching OAuth New / Financial Profile accounts highlight. No new keyframes.
- [ ] After pick, the card scrolls into view (`block: "center"`) and focus lands on the first editable field.
- [ ] A second catalog pick replaces the uncommitted draft and restarts the ring.
- [ ] `max_401k` / `max_roth_ira` still go through the creator (catch-up visible) and need **Add to stack**.
- [ ] Suggested / Improve **Try it** still add immediately.
- [ ] Idle freeform creator (11 kinds) still works when nothing was picked from the catalog.
- [ ] `retirement_lever_added` `source: "catalog"` fires on commit, not on browse click.
- [ ] Spouse catalog rows remain hidden without a spouse; seeding spouse types is impossible from the UI in that case.
- [ ] No URL `highlight` param on `/retirement`. No API/schema change.
- [ ] Dialog description tells the user they will set details before adding.

## Non-Goals

- Implementing this spec in this change (docs only).
- Changing Suggested / Improve **Try it** to draft-first.
- ⋮ Edit on stack rows (parent spec still owes it; reuse this editor later).
- Expanding `CUSTOM_LEVER_KINDS` to the full catalog.
- A second "configure in the dialog" step; the creator card is the editor.
- Nested editors for spending stages, withdrawal order, or full buy-home mortgage terms (v1 uses `defaultLeverFor` and Add to stack).
- New CSS / a gray `ring-muted` substitute for `ring-primary`.
- iOS catalog (web/desktop `@moat/features/retirement` only).
- Persisting uncommitted drafts in `?levers=`.

## Open Questions

- **Idle kind after a catalog seed of a type with no `CustomLeverKind` map.** Default: keep the catalog label as a static sentence lead-in, dropdown still lists the 11 custom kinds so they can switch to freeform (that switch discards the seeded typed lever and starts a custom kind). Confirm that discard-on-kind-change is OK.
- **Extract a shared `useConnectFocusHighlight` hook** in features vs copy the 15-line effect. Default: copy next to the creator (Financial Profile already copied). Extract only if the third copy feels silly in review.
- **Ring after Add to stack.** Default: off. The stack row is the confirmation.

## Related Specs

- [features/retirement/spec.md](../retirement/spec.md) — What If catalog, custom builder, lever stack. This spec changes catalog → stack into catalog → creator → stack.
- [features/retirement-impact-suggestions/spec.md](../retirement-impact-suggestions/spec.md) — Suggested ranking. **Try it** stays immediate; do not route those cards through this draft.

## Suggested Commit Message

```text
docs (retirement): adds catalog-to-creator draft spec
```
