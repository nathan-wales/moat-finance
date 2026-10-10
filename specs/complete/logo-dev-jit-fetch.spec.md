# Coding Agent Prompt: Add Just-in-Time Financial Institution Logos via Logo.dev

## Context

We are building **Moat Finance**, a personal finance intelligence and forecasting platform. Moat Finance lets users connect financial institutions through providers like Plaid, MX, and Finicity. We have institution search/select flows where users search for banks, credit unions, brokerages, and other financial institutions before connecting accounts.

Implement a shared system so every financial institution result can display a logo just in time using Logo.dev.

Logo.dev docs: https://www.logo.dev/docs/logo-images/introduction

The goal is to avoid manually storing logos upfront. Instead, generate safe Logo.dev image URLs when institution data is rendered, cache/normalize useful metadata in our own DB where appropriate, and gracefully fall back to a local placeholder when no logo is found.

## Product Goal

When a user searches financial institutions in Moat Finance, every institution row/card should show:

1. The institution logo if we can resolve it.
2. A consistent fallback icon/monogram if no logo is available.
3. No layout shift or broken image icon.
4. Fast loading with lazy loading where appropriate.
5. Shared behavior across `apps/web` and the future desktop/local app.

## Important Logo.dev Details

Use Logo.dev image URLs:

* Prefer domain lookup when we have a verified institution domain:

  * `https://img.logo.dev/{domain}?token={LOGO_DEV_PUBLISHABLE_KEY}&size=80&retina=true&format=png&fallback=404`
* Use name lookup only when no domain is available:

  * `https://img.logo.dev/name/{encodedInstitutionName}?token={LOGO_DEV_PUBLISHABLE_KEY}&size=80&retina=true&format=png&fallback=404`
* Use `encodeURIComponent()` for name lookups.
* Use `fallback=404` so Moat Finance can show its own fallback UI instead of Logo.dev’s generated monogram.
* Use `format=png` for better transparency support.
* Use `retina=true` for sharp logos.
* Use `size=80` as the default source size unless an existing avatar/logo component uses another size.
* Publishable Logo.dev keys are safe for client-side `img.logo.dev` usage, but the key must still be stored in env/config and not hardcoded.
* Secret Logo.dev keys must never be exposed client-side. Do not use secret-key APIs unless explicitly needed later.

## Required Environment Variables

Add:

```bash
NEXT_PUBLIC_LOGO_DEV_PUBLISHABLE_KEY=
```

For server-only contexts, do not expose secret keys. This task should only require the publishable image CDN key.

For desktop/local development, add the equivalent public runtime config pattern already used by the desktop app. If no env config exists yet for desktop, create a small shared config helper with clear TODOs and safe undefined behavior.

## Architecture Requirements

Create shared logic in a package that can be reused by web and desktop.

Prefer one of these locations depending on the current monorepo conventions:

```txt
packages/shared/src/logos/
```

or

```txt
packages/ui/src/logos/
```

Implement:

```ts
type InstitutionLogoInput = {
  name: string;
  domain?: string | null;
  logoUrl?: string | null;
};

type InstitutionLogoOptions = {
  size?: number;
  format?: "png" | "jpg" | "webp";
  theme?: "auto" | "light" | "dark";
  greyscale?: boolean;
  retina?: boolean;
  fallback?: "404" | "monogram";
};

function getInstitutionLogoUrl(
  institution: InstitutionLogoInput,
  options?: InstitutionLogoOptions
): string | null;
```

Behavior:

1. If `institution.logoUrl` already exists and is trusted, use it first.
2. Else if `institution.domain` exists, use domain lookup.
3. Else if `institution.name` exists, use Logo.dev name lookup.
4. Else return `null`.
5. Always append the publishable token if configured.
6. Always use `fallback=404` by default.
7. Normalize domains before using them:

   * Trim whitespace.
   * Lowercase.
   * Remove protocol: `https://`, `http://`.
   * Remove leading `www.` if appropriate.
   * Remove path/query/hash.
8. Do not throw if the key is missing. Return `null` or fallback gracefully in development.

## UI Component

Create or update a shared component:

```tsx
<InstitutionLogo
  name={institution.name}
  domain={institution.domain}
  logoUrl={institution.logoUrl}
  size={40}
/>
```

Requirements:

* Use the shared `getInstitutionLogoUrl()` helper.
* Render a square logo container with stable dimensions.
* Use `alt={`${name} logo`}`.
* Use `loading="lazy"` for search result lists.
* Use `decoding="async"`.
* Use `referrerPolicy="origin"` so domain-restricted Logo.dev keys continue to work.
* On image error, hide the broken image and show Moat Finance’s local fallback.
* Fallback should be visually consistent with the app:

  * Rounded square or circle matching current institution/account avatars.
  * Use first letter initials or a generic bank/building icon.
  * Accessible contrast in light mode and dark mode.
* Avoid Next.js `<Image>` unless remote image config for `img.logo.dev` is already in place. A plain `<img>` is acceptable and likely simpler for dynamic external image URLs.
* Prevent layout shift by setting explicit width and height.

## Database / Data Model

Do not store the actual logo image file.

Add optional institution metadata fields only if they do not already exist:

```prisma
model FinancialInstitution {
  id          String   @id @default(cuid())
  name        String
  domain      String?
  logoUrl     String?
  // existing fields...
}
```

Use the existing model name if Moat Finance already has one for institutions/provider institutions.

Guidance:

* `domain` should be our preferred stable lookup key.
* `logoUrl` should only be used if the provider gives us an official logo URL or we manually override a problematic institution.
* Do not persist generated Logo.dev URLs containing tokens into the database.
* Do not store `NEXT_PUBLIC_LOGO_DEV_PUBLISHABLE_KEY` anywhere in DB records.
* If institution data is returned from Plaid/MX/Finicity and includes a domain/homepage URL, normalize and save it.
* If a provider gives a logo directly, keep supporting it, but prefer Moat Finance’s `InstitutionLogo` component so behavior is consistent.

## Institution Search Integration

Update the financial institution search UI so each result includes the logo component.

Likely places to inspect:

```txt
apps/web
apps/desktop
packages/client-ts
packages/shared
packages/ui
packages/openapi
```

Find the existing institution search component(s), provider connection dialog(s), and account-linking flows.

For each institution result, pass:

```ts
{
  name: institution.name,
  domain: institution.domain ?? institution.url ?? institution.website ?? null,
  logoUrl: institution.logoUrl ?? institution.logo_url ?? null
}
```

Do not block search results while logos load. Institution search results should render immediately, and logos should load independently as images.

## API Contract

If institution search APIs currently do not return `domain`, `website`, `url`, or `logoUrl`, update the API response type to include nullable fields.

Update:

* API route response schema.
* OpenAPI spec if applicable.
* Generated TypeScript client if required by the repo workflow.
* Any React Query types/hooks.

Return shape example:

```ts
type InstitutionSearchResult = {
  id: string;
  name: string;
  provider: "plaid" | "mx" | "finicity" | string;
  domain?: string | null;
  website?: string | null;
  logoUrl?: string | null;
  routingNumbers?: string[];
  oauth?: boolean;
};
```

## Provider Mapping Rules

When combining institutions from Plaid, MX, and Finicity:

1. Preserve provider-specific IDs.
2. Normalize institution names for dedupe/search display.
3. Prefer a verified domain if any provider returns one.
4. If multiple providers return conflicting domains:

   * Prefer manually curated Moat Finance override.
   * Else prefer Plaid/MX/Finicity according to whatever provider-priority system already exists.
   * Else choose the first non-null domain and log enough context for debugging.
5. Do not make extra Logo.dev API calls during search. Generate image URLs only.

## Security / Privacy

* Do not send user financial account data to Logo.dev.
* Only the institution domain/name should appear in the image URL.
* No account IDs, access tokens, item IDs, balances, transaction data, or user identifiers should be included in any Logo.dev request.
* Use the publishable key only for `img.logo.dev`.
* Do not introduce server-side calls to Logo.dev secret-key APIs in this task.
* Add `img.logo.dev` to remote image CSP / allowed image domains if the app uses a strict CSP.
* If Logo.dev domain restrictions are enabled, ensure referrer policy allows origin referrer:

  * Global header: `Referrer-Policy: strict-origin-when-cross-origin`
  * Or per-image: `referrerPolicy="origin"`

## Desktop / Local-First Considerations

For the local desktop privacy version:

* Logo.dev requires network access. This is acceptable only when the user is online and has not disabled external logos.
* Add a future-safe config flag if settings infrastructure exists:

```ts
enableExternalInstitutionLogos: boolean
```

Default:

* Cloud/web app: enabled.
* Local desktop/offline privacy mode: disabled by default if the product positioning requires zero external requests.

If desktop has no setting yet, structure the component so it can accept:

```tsx
externalLogosEnabled={boolean}
```

When disabled, only show local fallback icons.

Do not make Logo.dev requests from the desktop app when external logos are disabled.

## Error Handling

* Broken logo URL should never show a browser broken-image icon.
* `onError` should switch to fallback UI.
* Missing key should show fallback UI.
* Unknown institution should show fallback UI.
* Ambiguous name lookup may return the wrong brand. Prefer domain lookup whenever available.
* Add a manual `logoUrl` override path for institutions where Logo.dev returns an incorrect match.

## Testing Requirements

Add unit tests for the logo URL helper:

* Domain lookup with normal domain.
* Domain lookup with `https://www.bank.com/path?q=1`.
* Name lookup with spaces and special characters.
* Existing trusted `logoUrl`.
* Missing publishable key.
* Missing domain and name.
* Default query params: `size`, `retina`, `format`, `fallback`.
* Custom options override defaults.

Add component tests for `InstitutionLogo`:

* Renders image when URL can be generated.
* Renders fallback when no key or no name/domain.
* Switches to fallback on image error.
* Uses stable width/height.
* Uses accessible alt text.
* Includes `loading="lazy"`, `decoding="async"`, and `referrerPolicy="origin"`.

Add integration coverage where practical:

* Institution search result displays logos without blocking search.
* Institutions with no domain still render name-based logo URL or fallback.
* Desktop/offline external logos disabled state does not render Logo.dev image URLs.

## Suggested Implementation Steps

1. Inspect the current institution search/linking flow and identify existing institution types.
2. Add env/config support for `NEXT_PUBLIC_LOGO_DEV_PUBLISHABLE_KEY`.
3. Create shared logo URL helper and tests.
4. Create shared `InstitutionLogo` component and tests.
5. Update institution search result UI to render `InstitutionLogo`.
6. Update API/OpenAPI/client types if institution metadata fields are missing.
7. Normalize provider domain/logo metadata at the API boundary.
8. Add CSP/image-domain/referrer-policy support if needed.
9. Add desktop/offline guard if the desktop app already has privacy/network settings.
10. Run typecheck, lint, tests, and any OpenAPI generation scripts.

## Acceptance Criteria

* Searching financial institutions shows a logo or polished fallback for every result.
* Logos are resolved just in time using Logo.dev image URLs.
* Domain lookup is used before name lookup.
* No Logo.dev URL containing the publishable token is persisted in the database.
* No user financial data is sent to Logo.dev.
* Broken/missing logos gracefully fall back to Moat Finance UI.
* Shared helper and component are reusable by web and desktop.
* Works in light and dark mode.
* TypeScript, lint, unit tests, and relevant integration tests pass.
* The implementation does not regress existing Plaid/MX/Finicity institution search behavior.

## Notes

Do not overbuild a logo ingestion pipeline. This task is specifically for just-in-time logo rendering during institution search and institution/account display. Keep the system small, shared, typed, and easy to override later.
