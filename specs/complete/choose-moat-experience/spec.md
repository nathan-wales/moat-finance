# Choose Moat Experience (Pre-Onboarding)

## Status

Draft. Created 2026-07-12 after reviewing marketing Get Started CTAs, web onboarding entry, and the Local download page.

## Goal

Insert a decision screen between marketing “Get Started” and the existing cloud acquisition funnel so users choose Convenience (web/cloud) or Private (desktop/local) before continuing.

Success means:

- Marketing primary Get Started CTAs land on `/get-started` instead of `/overview`
- Convenience continues today’s funnel (`/overview` → auth → onboarding) with no onboarding code changes
- Private redirects to the marketing Local download page and never starts web onboarding
- The chooser is data-driven so badges, extra options, and analytics enums can be added later

## Product Context

Users should understand Moat as two first-class experiences: access from anywhere (Convenience) vs maximum local control (Private). Messaging must not imply the cloud path is insecure.

## Current Repo Context

| Concern | Today |
|---------|--------|
| Marketing Get Started | Links to `https://app.moatfinance.ai/overview` in `apps/marketing/*.html` |
| Cloud funnel | `/overview` → middleware → `/auth/signin` → register → `/onboarding` |
| Onboarding | `apps/web/src/app/onboarding/` (auth required; unchanged by this feature) |
| Local download | `https://moatfinance.ai/download` (`apps/marketing/download.html`) |
| Marketing Cloud vs Local | Homepage `#privacy-modes` comparison (left alone; already a choice) |
| Public routes | `apps/web/src/middleware.ts` allowlists `/auth`, `/invite/`, `/api`, `/r/` |

### Existing building blocks to reuse

| Asset | Location | Notes |
|-------|----------|-------|
| Selectable tile styling | `apps/web/src/app/onboarding/onboarding-flow/step-goals.tsx` | `border-2` + selected `border-primary bg-primary/5` |
| Two-card chooser pattern | `packages/features/.../assisted-intake-step.tsx` | Tall equal cards, icon + title + description |
| Analytics | `apps/web/src/lib/analytics.ts` | `capture()` with identity + enum props |
| Auth gate | `~/server/auth` | Redirect logged-in users away from chooser |
| Logo | `~/components/common/logo` | Brand on the chooser page |
| Button | `~/components/ui/button` | Per-card primary CTA |

## Target Experience

### Route

- **Public:** `/get-started`
- **Authenticated visit:** redirect to `/overview`

### Copy

**Title:** How would you like to use Moat?

**Subtitle:** Choose the experience that works best for you. You can always switch later.

**Option 1 — Convenience**

- Subtitle: Access your finances anywhere.
- Bullets: Web app; iPhone app; Automatic syncing; Encrypted cloud storage
- CTA: Continue → `/overview`

**Option 2 — Private**

- Subtitle: Keep everything on your computer.
- Bullets: Desktop app; Local SQLite database; Works offline; Your financial data stays on your device
- CTA: Download Desktop → `https://moatfinance.ai/download`

### UI

- Large centered layout, lots of whitespace, rounded cards
- Two equal-width cards; stack vertically on mobile
- Light hover animation; selected card slightly elevates
- Lucide `Cloud` / `Shield` icons (no emoji)

### Analytics

| Event | When | Properties |
|-------|------|------------|
| `onboarding_experience_viewed` | Chooser mounts | identity only |
| `onboarding_experience_selected` | CTA click | `{ experience: "convenience" \| "private" }` |

Unauthenticated visitors use `{ demoUser: true }`.

## Architecture / Data Model

No API or schema changes.

File layout:

```text
apps/web/src/app/get-started/
  page.tsx
  experience-options.ts
  experience-option-card.tsx
  choose-experience.tsx
```

Options are data-driven (`id`, title, subtitle, bullets, ctaLabel, destination, icon) so recommended badges, enterprise, Android, or a comparison table can extend the same config later.

## Acceptance Criteria

- [ ] `/get-started` is public (no auth redirect to sign-in)
- [ ] Logged-in users hitting `/get-started` redirect to `/overview`
- [ ] Convenience Continue navigates to `/overview` (existing auth/onboarding path)
- [ ] Private Download Desktop goes to `https://moatfinance.ai/download`
- [ ] Onboarding implementation under `apps/web/src/app/onboarding/` is unmodified
- [ ] Homepage primary Get Started CTAs point to `/get-started`
- [ ] Privacy-modes Cloud/Local cards and View demo links remain unchanged
- [ ] Viewed + selected analytics events fire with enum-only payloads
- [ ] Cards stack on mobile and sit side-by-side on desktop

## Non-Goals

- Changing onboarding steps, store, or completion logic
- Rewriting marketing `#privacy-modes`
- Adding Enterprise / Android / comparison table in this iteration
- Implying Convenience is less secure than Private

## Open Questions

None for v1 — Convenience preserves `/overview` funnel; Private uses canonical `/download`.

## Related Specs

- `specs/complete/shared-onboarding/spec.md` — existing web onboarding
- `specs/complete/new-fin-marketing-website.spec.md` — Cloud vs Local marketing positioning

## Suggested Commit Message

```text
feat (web): adds pre-onboarding experience chooser
```
