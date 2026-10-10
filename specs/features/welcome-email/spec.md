# Welcome Email on Signup

## Status

Approved. Created 2026-08-29 to send a founder-signed welcome email when a real Moat account is created, styled like the weekly money summary.

## Goal

New users should receive one transactional welcome email immediately after account creation. It should feel like the weekly digest: navy-on-stone HTML, skimmable, and organized around what they can do now — not a marketing blast of every Moat feature.

Success means:

- A real signup (credentials, Google, or Apple) sends one welcome email.
- The HTML chrome matches the weekly summary (page background, white card, type, CTA button).
- Email failure never blocks account creation.
- Copy stays short: six capabilities, then privacy, CTA, trial, founder sign-off.

## Product Context

Signup is the first relationship moment. The job of this email is to reassure ("you now have one place for your financial life"), point to the next action (connect accounts / build your profile), and make Tyler reachable by reply.

## Current Repo Context

Signup creates users in several handlers; none send mail today.

| Asset | Location | Notes |
|-------|----------|-------|
| Credentials register | `apps/api/src/server/handlers/auth.ts` (`auth.register`) | Web email/password signup |
| Google (web NextAuth) | `apps/api/src/server/handlers/auth.ts` (`auth.nextAuthGoogle`) | Creates user on first Google sign-in |
| Google / Apple exchange | `apps/api/src/server/handlers/auth.ts` (`auth.exchange`) | Native + unified token exchange |
| Apple (legacy mobile) | `apps/api/src/server/handlers/mobile-auth.ts` | Apple user create path |
| Weekly HTML chrome | `apps/api/src/server/services/weekly-summary-email.ts` | Navy `#0F2744`, page `#EEF0F3`, 600px card, CTA button |
| Send primitive | `apps/api/src/lib/email/resend.ts` | Resend; `replyTo` is `support@moatfinance.ai` |
| Child profiles | `apps/api/src/server/services/profiles/profile.service.ts` | Creates users with `email: null` — must not email |

## Target Experience

**Subject:** `Welcome to Moat Finance 👋`

**Greeting:** `Hi {{firstName}},` when `User.name` has a first token; otherwise skip the name and open with thanks.

**Body (skimmable six):**

1. Connect your financial accounts
2. Understand your spending and cash flow
3. Track your complete net worth
4. Plan for retirement
5. Organize taxes and insurance
6. Give your AI assistant real financial context (2–3 example questions, not a long list)

Then: data-control reassurance, "connect your accounts" CTA (`Open Moat Finance →` → `https://app.moatfinance.ai`), 30-day trial note, reply invitation, Tyler / Founder sign-off.

HTML should reuse weekly summary visual language: logo lockup, 28px navy heading, 16px body, navy pill CTA on cloud signups.

Desktop Local signups (`POST /api/v1/auth/register` with `source: "desktop"`) get a variant that says the financial database already lives on their computer and is only visible to them plus locally permissioned agents. Cloud signups keep the existing "Moat Finance Local is an option" privacy box.

Google sign-in started from desktop still creates the user via `nextAuthGoogle` on the web, so those first-time Google users get the cloud welcome email.

## Architecture / Data Model

No schema change. Send only on `user.create` in the auth paths above. Do not send for child profiles, seeds, or existing-user Google/Apple sign-in.

`auth.register` accepts optional `source: "web" | "desktop"`. Moat Finance Local passes `source: "desktop"` from `apps/desktop/src/main/cloud-backup/api-client.ts`. Other create paths default to the cloud variant.

`sendWelcomeEmailForNewUser` awaits Resend (so Vercel does not freeze the isolate) but swallows errors after a structured log with `userId` only — never email or name.

## Acceptance Criteria

- [ ] Credentials, first-time Google, and first-time Apple signup each send the welcome email once.
- [ ] Existing-user login / OAuth does not resend.
- [ ] Child profile users are not emailed.
- [ ] HTML uses the weekly card layout and includes the six capability headings, CTA, trial line, and Tyler sign-off.
- [ ] Signup succeeds if Resend is down or `RESEND_API_KEY` is missing.
- [ ] Renderer unit tests cover named greeting, nameless greeting, HTML escaping, and required copy.

## Non-Goals

- Admin preview UI (weekly summary already has one).
- Marketing drip / day-2 emails.
- Per-user "welcome already sent" column (create-time send is enough).
- Changing weekly summary copy or links.

## Open Questions

None for V1. Reply-to stays `support@moatfinance.ai` (existing transactional default).

## Suggested Commit Message

```text
feat (api): send welcome email on signup
```
