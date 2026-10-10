# Moat Finance Multi-Aggregator Implementation Plan: Plaid + MX + Finicity with Moat Finance-Owned Institution Routing

## Goal

Moat Finance already supports Plaid sync, Plaid webhooks, and Plaid import logic. We now want to add MX and Finicity while introducing a Moat Finance-owned institution search and routing layer.

The final user flow should be:

```txt
User clicks “Connect account”
→ Moat Finance-owned institution search dialog opens
→ User searches “Chase”, “JP Morgan”, “Fidelity”, etc.
→ Moat Finance shows one clean canonical institution result
→ Moat Finance chooses the best provider internally
→ Moat Finance launches Plaid Link, MX Connect, or Finicity Connect
→ One active provider syncs the connection
```

The user should not normally see or care whether the connection uses Plaid, MX, or Finicity. Provider choice should be visible only in advanced troubleshooting flows.

---

# Core Principles

## 1. Moat Finance owns institution discovery

Do not start the connection flow directly inside Plaid Link, MX Connect, or Finicity Connect.

Instead:

```txt
Moat Finance search dialog first
Provider widget second
```

Moat Finance owns:

```txt
institution search
institution display names
institution aliases
institution deduplication
provider recommendation
provider fallback
provider switching UX
```

The providers still own:

```txt
credential collection
OAuth
MFA
consent
secure bank authentication
account selection
```

Moat Finance should never collect or handle bank credentials directly.

---

## 2. One active syncing provider per logical connection

Do not connect every account to Plaid + MX + Finicity.

Default:

```txt
Chase Checking → Plaid
Fidelity Brokerage → Finicity
TIAA → MX
```

Not:

```txt
Chase Checking → Plaid + MX + Finicity
```

Multiple provider connections should happen only when:

```txt
user explicitly switches provider
support/admin enables fallback testing
temporary migration/deduplication is needed
```

---

## 3. Provider-specific at the edge, provider-neutral in the core

Provider-specific:

```txt
link session creation
provider widget launch
webhook verification
webhook payload parsing
API fetching
provider-specific mapping
```

Provider-neutral:

```txt
connection records
sync attempts
account import
transaction import
holdings import
institution search
provider routing
observability
error states
fallback UX
```

---

# Phase 1: Provider-Agnostic Schema Foundation

## Add enums

```prisma
enum FinancialDataProvider {
  PLAID
  MX
  FINICITY
}

enum ConnectionStatus {
  ACTIVE
  DEGRADED
  REAUTH_REQUIRED
  DISCONNECTED
  ERROR
  MIGRATING
}

enum SyncTrigger {
  WEBHOOK
  SCHEDULED
  USER_REFRESH
  INITIAL_LINK
  BACKFILL
  PROVIDER_SWITCH
}

enum SyncStatus {
  PENDING
  RUNNING
  SUCCESS
  FAILED
  PARTIAL_SUCCESS
  SKIPPED
}

enum ProviderWebhookStatus {
  RECEIVED
  VERIFIED
  REJECTED
  QUEUED
  PROCESSED
  FAILED
  IGNORED_DUPLICATE
}

enum InstitutionMatchConfidence {
  MANUAL
  HIGH
  MEDIUM
  LOW
  UNMATCHED
}

enum InstitutionCategory {
  BANK
  CREDIT_CARD
  INVESTMENT
  CREDIT_UNION
  FINTECH
  CRYPTO
  LOAN
  PAYROLL
  UNKNOWN
}
```

---

## Add `FinancialConnection`

```prisma
model FinancialConnection {
  id                          String   @id @default(cuid())
  userId                      String
  provider                    FinancialDataProvider

  canonicalInstitutionId       String?
  providerInstitutionId        String?
  providerConnectionId         String
  providerCustomerId           String?

  providerAccessTokenEncrypted String?
  providerRefreshTokenEncrypted String?
  syncCursorEncrypted          String?

  status                      ConnectionStatus @default(ACTIVE)

  lastSuccessfulSyncAt         DateTime?
  lastWebhookAt                DateTime?
  lastErrorAt                  DateTime?
  lastErrorCode                String?
  lastErrorMessage             String?
  consecutiveFailures          Int @default(0)

  metadata                    Json?

  createdAt                   DateTime @default(now())
  updatedAt                   DateTime @updatedAt

  @@unique([provider, providerConnectionId])
  @@index([userId])
  @@index([provider])
  @@index([canonicalInstitutionId])
}
```

Provider mappings:

```txt
Plaid providerConnectionId = item_id
MX providerConnectionId = member_guid
Finicity providerConnectionId = Finicity connection / aggregation id where available
Finicity providerCustomerId = Finicity customer id
```

Do not force MX or Finicity into Plaid-specific concepts.

---

## Add `ProviderWebhookEvent`

Use separate external webhook routes but one internal webhook event table.

```prisma
model ProviderWebhookEvent {
  id                    String @id @default(cuid())
  provider              FinancialDataProvider

  providerEventId        String?
  providerConnectionId   String?
  eventType              String
  eventCode              String?

  status                ProviderWebhookStatus @default(RECEIVED)

  idempotencyKey         String?
  headers                Json?
  rawPayload             Json
  normalizedPayload      Json?

  receivedAt             DateTime @default(now())
  processedAt            DateTime?
  errorMessage           String?

  @@index([provider])
  @@index([providerConnectionId])
  @@index([eventType])
  @@index([receivedAt])
  @@unique([provider, providerEventId])
  @@unique([provider, idempotencyKey])
}
```

If a provider does not send a stable event id, create one:

```ts
sha256([
  provider,
  providerConnectionId,
  eventType,
  eventCode,
  rawPayloadTimestamp,
  rawPayloadVersion,
].join('|'))
```

---

## Add `ProviderSyncAttempt`

```prisma
model ProviderSyncAttempt {
  id                    String @id @default(cuid())

  connectionId           String
  provider               FinancialDataProvider
  trigger                SyncTrigger
  webhookEventId         String?

  status                 SyncStatus @default(PENDING)
  startedAt              DateTime?
  completedAt            DateTime?

  addedCount             Int @default(0)
  modifiedCount          Int @default(0)
  removedCount           Int @default(0)
  accountCount           Int @default(0)
  holdingCount           Int @default(0)

  providerRequestCount   Int @default(0)
  errorCode              String?
  errorMessage           String?
  metadata               Json?

  createdAt              DateTime @default(now())

  @@index([connectionId])
  @@index([provider])
  @@index([status])
  @@index([createdAt])
}
```

---

# Phase 2: Institution Catalog + Canonicalization

This is the critical new layer.

Moat Finance needs three institution layers:

```txt
Provider institution catalog
Canonical institution catalog
Provider routing/preference table
```

Provider catalogs come from Plaid, MX, and Finicity. Canonical institutions are Moat Finance’s clean user-facing institutions.

---

## Add `CanonicalInstitution`

```prisma
model CanonicalInstitution {
  id              String @id @default(cuid())

  key             String @unique
  displayName     String
  legalName       String?
  aliases         String[]
  domains         String[]
  logoUrl         String?
  website         String?
  category        InstitutionCategory @default(UNKNOWN)
  countryCode     String?

  parentInstitutionId String?

  isActive        Boolean @default(true)
  createdAt       DateTime @default(now())
  updatedAt       DateTime @updatedAt

  @@index([displayName])
  @@index([category])
}
```

Example:

```ts
{
  key: 'chase',
  displayName: 'Chase',
  legalName: 'JPMorgan Chase Bank, N.A.',
  aliases: [
    'JP Morgan',
    'JPMorgan Chase',
    'JPMorgan Chase Bank',
    'Chase Bank'
  ],
  domains: ['chase.com', 'jpmorganchase.com'],
  category: 'BANK'
}
```

The user sees:

```txt
Chase
```

The user should not see duplicate rows like:

```txt
Chase
JPMorgan Chase Bank
JP Morgan Chase
```

unless those are genuinely separate portals/products.

---

## Add `InstitutionProviderMapping`

```prisma
model InstitutionProviderMapping {
  id                       String @id @default(cuid())

  canonicalInstitutionId    String?
  provider                 FinancialDataProvider
  providerInstitutionId     String
  providerInstitutionName   String
  providerInstitutionUrl    String?
  providerLogoUrl           String?

  countryCodes             String[]
  supportedProducts         String[]
  supportsOAuth             Boolean?
  status                   String?

  matchConfidence           InstitutionMatchConfidence @default(UNMATCHED)
  matchMethod               String?
  needsReview               Boolean @default(false)

  raw                      Json

  firstSeenAt              DateTime @default(now())
  lastSeenAt               DateTime @default(now())
  lastSyncedAt             DateTime @default(now())
  isActive                 Boolean @default(true)

  @@unique([provider, providerInstitutionId])
  @@index([canonicalInstitutionId])
  @@index([provider])
  @@index([providerInstitutionName])
  @@index([needsReview])
}
```

This stores raw provider records from each aggregator.

Example:

```txt
CanonicalInstitution: Chase

InstitutionProviderMapping:
- PLAID: Chase / ins_56
- MX: JPMorgan Chase Bank / mx_guid_123
- FINICITY: JP Morgan Chase / finicity_456
```

---

## Add `InstitutionProviderPreference`

```prisma
model InstitutionProviderPreference {
  id                      String @id @default(cuid())

  canonicalInstitutionId   String
  productSet               String

  primaryProvider          FinancialDataProvider
  fallbackProviders        FinancialDataProvider[]

  confidence               InstitutionMatchConfidence
  reason                   String?
  isManualOverride          Boolean @default(false)
  isActive                 Boolean @default(true)

  createdAt                DateTime @default(now())
  updatedAt                DateTime @updatedAt

  @@index([canonicalInstitutionId])
  @@index([primaryProvider])
}
```

Example:

```ts
{
  canonicalInstitutionKey: 'chase',
  productSet: 'transactions',
  primaryProvider: 'PLAID',
  fallbackProviders: ['MX', 'FINICITY'],
  confidence: 'HIGH',
  reason: 'Preferred provider for consumer Chase banking and credit-card sync.'
}
```

---

# Phase 3: Provider Catalog Sync Jobs

Moat Finance should not call Plaid/MX/Finicity on every search keystroke.

Instead:

```txt
Scheduled provider catalog sync
→ Store provider institution records
→ Canonicalize / dedupe
→ User searches Moat Finance DB
```

---

## Add catalog sync jobs

```txt
sync-plaid-institutions
sync-mx-institutions
sync-finicity-institutions
canonicalize-institution-mappings
```

Recommended schedule:

```txt
Daily full catalog sync
Hourly or daily health/status refresh for top institutions
On-demand provider search fallback only when Moat Finance DB has no good result
```

---

## Provider catalog adapter methods

Extend `ProviderAdapter`:

```ts
export interface ProviderAdapter {
  provider: FinancialDataProvider;

  listInstitutions(input: ListInstitutionsInput): Promise<ProviderInstitutionPage>;
  searchInstitutions(input: SearchInstitutionsInput): Promise<ProviderInstitution[]>;

  createLinkSession(input: CreateLinkSessionInput): Promise<CreateLinkSessionResult>;

  exchangePublicToken?(input: ExchangePublicTokenInput): Promise<CreateConnectionResult>;
  handleLinkCallback?(input: LinkCallbackInput): Promise<CreateConnectionResult>;

  verifyWebhook(input: VerifyWebhookInput): Promise<VerifiedWebhook>;
  classifyWebhook(input: VerifiedWebhook): ProviderWebhookClassification;

  syncConnection(input: SyncConnectionInput): Promise<SyncConnectionResult>;

  refreshConnection?(input: RefreshConnectionInput): Promise<void>;
  disconnectConnection(input: DisconnectConnectionInput): Promise<void>;
}
```

Normalized provider institution:

```ts
export type ProviderInstitution = {
  provider: FinancialDataProvider;
  providerInstitutionId: string;
  providerInstitutionName: string;
  providerInstitutionUrl?: string | null;
  providerLogoUrl?: string | null;
  countryCodes: string[];
  supportedProducts: string[];
  supportsOAuth?: boolean | null;
  status?: string | null;
  raw: unknown;
};
```

---

# Phase 4: Institution Canonicalization + Deduplication

The search dialog should return one result per `CanonicalInstitution`.

Search matching should use:

```txt
CanonicalInstitution.displayName
CanonicalInstitution.legalName
CanonicalInstitution.aliases
CanonicalInstitution.domains
InstitutionProviderMapping.providerInstitutionName
InstitutionProviderMapping.providerInstitutionUrl
```

Then group by:

```txt
canonicalInstitutionId
```

---

## Matching strategy

Use this priority order:

```txt
1. Manual curated top-institution seed
2. Existing canonical mapping
3. Exact domain match
4. Known alias match
5. Routing number overlap if provider exposes it
6. Strong normalized-name similarity
7. Medium fuzzy match
8. Leave unmatched and mark for review
```

Important: not all similar names should merge.

These may deserve separate canonical rows:

```txt
Chase
Chase Business
J.P. Morgan Wealth Management
J.P. Morgan Private Bank
```

Do not merge them blindly just because “JP Morgan” appears in the name.

---

## Add top-institution seed file

Create:

```txt
packages/financial-data-providers/src/institutions/canonical-seeds.ts
```

Example:

```ts
export const CANONICAL_INSTITUTION_SEEDS = [
  {
    key: 'chase',
    displayName: 'Chase',
    legalName: 'JPMorgan Chase Bank, N.A.',
    aliases: [
      'JP Morgan',
      'JPMorgan Chase',
      'JPMorgan Chase Bank',
      'Chase Bank'
    ],
    domains: ['chase.com', 'jpmorganchase.com'],
    category: 'BANK',
    preferredProvider: 'PLAID',
    fallbackProviders: ['MX', 'FINICITY'],
  },
  {
    key: 'fidelity',
    displayName: 'Fidelity Investments',
    legalName: 'Fidelity Brokerage Services LLC',
    aliases: [
      'Fidelity',
      'Fidelity Brokerage',
      'Fidelity Investments'
    ],
    domains: ['fidelity.com'],
    category: 'INVESTMENT',
    preferredProvider: 'FINICITY',
    fallbackProviders: ['MX', 'PLAID'],
  },
];
```

Start with the top 25, then expand to top 100.

---

# Phase 5: Top-25 Preferred Provider Routing

Create a curated seed table for the most common connected institutions.

This should be a starting point only. Telemetry should eventually override these preferences.

```ts
export const INITIAL_PROVIDER_PREFERENCES = [
  {
    key: 'chase',
    displayName: 'Chase',
    legalName: 'JPMorgan Chase Bank, N.A.',
    aliases: ['JP Morgan', 'JPMorgan Chase', 'JPMorgan Chase Bank', 'Chase Bank'],
    primaryProvider: 'PLAID',
    fallbackProviders: ['MX', 'FINICITY'],
    confidence: 'HIGH',
    category: 'BANK',
  },
  {
    key: 'bank_of_america',
    displayName: 'Bank of America',
    aliases: ['BofA', 'Bank of America NA'],
    primaryProvider: 'PLAID',
    fallbackProviders: ['MX', 'FINICITY'],
    confidence: 'MEDIUM',
    category: 'BANK',
  },
  {
    key: 'wells_fargo',
    displayName: 'Wells Fargo',
    aliases: ['Wells Fargo Bank'],
    primaryProvider: 'PLAID',
    fallbackProviders: ['MX', 'FINICITY'],
    confidence: 'HIGH',
    category: 'BANK',
  },
  {
    key: 'citi',
    displayName: 'Citi',
    aliases: ['Citibank', 'Citigroup'],
    primaryProvider: 'PLAID',
    fallbackProviders: ['MX', 'FINICITY'],
    confidence: 'MEDIUM',
    category: 'BANK',
  },
  {
    key: 'capital_one',
    displayName: 'Capital One',
    aliases: ['Capital One Bank', 'Capital One Credit Card'],
    primaryProvider: 'PLAID',
    fallbackProviders: ['MX', 'FINICITY'],
    confidence: 'MEDIUM',
    category: 'BANK',
  },
  {
    key: 'us_bank',
    displayName: 'U.S. Bank',
    aliases: ['US Bank', 'U.S. Bancorp'],
    primaryProvider: 'PLAID',
    fallbackProviders: ['MX', 'FINICITY'],
    confidence: 'MEDIUM',
    category: 'BANK',
  },
  {
    key: 'pnc',
    displayName: 'PNC Bank',
    aliases: ['PNC'],
    primaryProvider: 'PLAID',
    fallbackProviders: ['MX', 'FINICITY'],
    confidence: 'MEDIUM',
    category: 'BANK',
  },
  {
    key: 'truist',
    displayName: 'Truist',
    aliases: ['Truist Bank', 'BB&T', 'SunTrust'],
    primaryProvider: 'PLAID',
    fallbackProviders: ['MX', 'FINICITY'],
    confidence: 'MEDIUM',
    category: 'BANK',
  },
  {
    key: 'td_bank',
    displayName: 'TD Bank',
    aliases: ['TD'],
    primaryProvider: 'PLAID',
    fallbackProviders: ['MX', 'FINICITY'],
    confidence: 'MEDIUM',
    category: 'BANK',
  },
  {
    key: 'american_express',
    displayName: 'American Express',
    aliases: ['Amex', 'American Express Credit Card'],
    primaryProvider: 'PLAID',
    fallbackProviders: ['MX', 'FINICITY'],
    confidence: 'MEDIUM',
    category: 'CREDIT_CARD',
  },
  {
    key: 'discover',
    displayName: 'Discover',
    aliases: ['Discover Bank', 'Discover Card'],
    primaryProvider: 'PLAID',
    fallbackProviders: ['MX', 'FINICITY'],
    confidence: 'MEDIUM',
    category: 'CREDIT_CARD',
  },
  {
    key: 'navy_federal',
    displayName: 'Navy Federal Credit Union',
    aliases: ['NFCU', 'Navy Federal'],
    primaryProvider: 'PLAID',
    fallbackProviders: ['MX', 'FINICITY'],
    confidence: 'MEDIUM',
    category: 'CREDIT_UNION',
  },
  {
    key: 'usaa',
    displayName: 'USAA',
    aliases: ['USAA Bank'],
    primaryProvider: 'PLAID',
    fallbackProviders: ['MX', 'FINICITY'],
    confidence: 'MEDIUM',
    category: 'BANK',
  },
  {
    key: 'fidelity',
    displayName: 'Fidelity Investments',
    aliases: ['Fidelity', 'Fidelity Brokerage'],
    primaryProvider: 'FINICITY',
    fallbackProviders: ['MX', 'PLAID'],
    confidence: 'MEDIUM',
    category: 'INVESTMENT',
  },
  {
    key: 'schwab',
    displayName: 'Charles Schwab',
    aliases: ['Schwab', 'Charles Schwab Bank', 'Charles Schwab Brokerage'],
    primaryProvider: 'MX',
    fallbackProviders: ['PLAID', 'FINICITY'],
    confidence: 'LOW',
    category: 'INVESTMENT',
  },
  {
    key: 'vanguard',
    displayName: 'Vanguard',
    aliases: ['The Vanguard Group'],
    primaryProvider: 'MX',
    fallbackProviders: ['PLAID', 'FINICITY'],
    confidence: 'LOW',
    category: 'INVESTMENT',
  },
  {
    key: 'etrade',
    displayName: 'E*TRADE',
    aliases: ['E Trade', 'Morgan Stanley E*TRADE'],
    primaryProvider: 'MX',
    fallbackProviders: ['PLAID', 'FINICITY'],
    confidence: 'LOW',
    category: 'INVESTMENT',
  },
  {
    key: 'robinhood',
    displayName: 'Robinhood',
    aliases: ['Robinhood Financial'],
    primaryProvider: 'PLAID',
    fallbackProviders: ['MX', 'FINICITY'],
    confidence: 'LOW',
    category: 'FINTECH',
  },
  {
    key: 'paypal',
    displayName: 'PayPal',
    aliases: ['Paypal'],
    primaryProvider: 'PLAID',
    fallbackProviders: ['MX', 'FINICITY'],
    confidence: 'LOW',
    category: 'FINTECH',
  },
  {
    key: 'venmo',
    displayName: 'Venmo',
    aliases: ['Venmo PayPal'],
    primaryProvider: 'PLAID',
    fallbackProviders: ['MX', 'FINICITY'],
    confidence: 'LOW',
    category: 'FINTECH',
  },
  {
    key: 'coinbase',
    displayName: 'Coinbase',
    aliases: ['Coinbase Crypto'],
    primaryProvider: 'PLAID',
    fallbackProviders: ['MX'],
    confidence: 'LOW',
    category: 'CRYPTO',
  },
  {
    key: 'ally',
    displayName: 'Ally Bank',
    aliases: ['Ally'],
    primaryProvider: 'PLAID',
    fallbackProviders: ['MX', 'FINICITY'],
    confidence: 'MEDIUM',
    category: 'BANK',
  },
  {
    key: 'sofi',
    displayName: 'SoFi',
    aliases: ['SoFi Bank', 'Social Finance'],
    primaryProvider: 'PLAID',
    fallbackProviders: ['MX', 'FINICITY'],
    confidence: 'MEDIUM',
    category: 'FINTECH',
  },
  {
    key: 'synchrony',
    displayName: 'Synchrony Bank',
    aliases: ['Synchrony Credit Card'],
    primaryProvider: 'PLAID',
    fallbackProviders: ['MX', 'FINICITY'],
    confidence: 'LOW',
    category: 'CREDIT_CARD',
  },
  {
    key: 'tiaa',
    displayName: 'TIAA',
    aliases: ['TIAA Bank', 'TIAA Brokerage'],
    primaryProvider: 'MX',
    fallbackProviders: ['PLAID', 'FINICITY'],
    confidence: 'LOW',
    category: 'INVESTMENT',
  },
];
```

Important: these are initial defaults. Add admin overrides and telemetry-driven updates later.

---

# Phase 6: Moat Finance-Owned Connect Dialog

Build this before MX and Finicity are fully live.

The first version can route everything to Plaid. Then MX/Finicity can be enabled behind feature flags.

---

## New UI

Add:

```txt
components/financial-connections/
  ConnectFinancialInstitutionDialog.tsx
  InstitutionSearchInput.tsx
  InstitutionSearchResults.tsx
  InstitutionSearchResultRow.tsx
  ProviderAdvancedOptions.tsx
  ProviderLaunchBridge.tsx
  ConnectionSuccessState.tsx
  ConnectionErrorState.tsx
```

Use shadcn/ui components.

---

## User flow

```txt
User clicks “Connect account”
→ Moat Finance dialog opens
→ User searches institution
→ Moat Finance returns canonical institution rows
→ User selects institution
→ Backend chooses provider
→ Frontend launches provider widget
```

---

## Search API

```txt
GET /api/institutions/search?q=chase
```

Response:

```ts
type InstitutionSearchResult = {
  canonicalInstitutionId: string;
  displayName: string;
  legalName?: string | null;
  aliases: string[];
  logoUrl?: string | null;
  website?: string | null;
  category?: InstitutionCategory;

  recommendedProvider: FinancialDataProvider;
  availableProviders: FinancialDataProvider[];

  recommendationReason?: string;
  confidence: 'HIGH' | 'MEDIUM' | 'LOW' | 'MANUAL';

  supportedProducts: {
    transactions: boolean;
    investments: boolean;
    liabilities: boolean;
    identity: boolean;
    statements: boolean;
  };

  providerMappings: Array<{
    provider: FinancialDataProvider;
    providerInstitutionId: string;
    providerInstitutionName: string;
    status?: string | null;
    supportsOAuth?: boolean | null;
  }>;
};
```

Search should return one row for:

```txt
Chase
```

when user searches:

```txt
chase
jp morgan
jpmorgan chase bank
chase bank
```

---

## Link session API

```txt
POST /api/financial-connections/link-session
```

Request:

```ts
{
  canonicalInstitutionId: string;
  provider?: 'PLAID' | 'MX' | 'FINICITY';
  products: Array<'transactions' | 'investments' | 'liabilities' | 'identity'>;
}
```

If `provider` is omitted, backend calls:

```ts
chooseProviderForInstitution(...)
```

Response:

```ts
type LinkSessionResponse =
  | {
      provider: 'PLAID';
      linkToken: string;
    }
  | {
      provider: 'MX';
      connectWidgetUrl: string;
      memberGuid?: string;
    }
  | {
      provider: 'FINICITY';
      connectUrl: string;
      customerId?: string;
    };
```

Frontend:

```ts
switch (session.provider) {
  case 'PLAID':
    openPlaidLink(session.linkToken);
    break;
  case 'MX':
    openMxConnect(session.connectWidgetUrl);
    break;
  case 'FINICITY':
    openFinicityConnect(session.connectUrl);
    break;
}
```

---

## Provider selection UX

Default happy path should say:

```txt
Recommended connection
Moat Finance will use the provider expected to work best for this institution.
```

Do not show:

```txt
Plaid
MX
Finicity
```

by default.

Advanced troubleshooting:

```txt
Having trouble? Try another connection provider.
```

Expanded state:

```txt
Recommended: Plaid
Other options: MX, Finicity
```

---

# Phase 7: Provider Routing Logic

Create:

```ts
async function chooseProviderForInstitution(input: {
  canonicalInstitutionId: string;
  requestedProvider?: FinancialDataProvider;
  products: FinancialProduct[];
  userId: string;
}): Promise<ProviderRoutingDecision>
```

Return:

```ts
type ProviderRoutingDecision = {
  provider: FinancialDataProvider;
  reason: string;
  confidence: 'MANUAL' | 'HIGH' | 'MEDIUM' | 'LOW';
  availableProviders: FinancialDataProvider[];
};
```

Routing order:

```txt
1. If user selected advanced provider, use it.
2. If admin/manual override exists, use it.
3. If top-25 preference exists, use it.
4. If product requires a specific provider, use it.
5. Use observed reliability metrics.
6. Use provider catalog health/status.
7. Use provider cost as a tie-breaker.
8. Default to Plaid for general transaction sync.
```

Provider scoring:

```ts
score =
  coverageScore * 0.25 +
  oauthScore * 0.20 +
  observedSuccessRate * 0.25 +
  syncHealthScore * 0.20 -
  costScore * 0.10
```

MVP can use:

```txt
manual top-25 preferences
provider availability
fallback to Plaid
```

Later:

```txt
telemetry-driven provider scoring
```

---

# Phase 8: Provider Adapter Package

Create:

```txt
packages/financial-data-providers
```

Structure:

```txt
packages/financial-data-providers/
  src/
    core/
      types.ts
      provider-registry.ts
      sync-engine.ts
      institution-search.ts
      institution-canonicalization.ts
      institution-routing.ts
      errors.ts
      dedupe.ts
    institutions/
      canonical-seeds.ts
      provider-preferences.ts
    providers/
      plaid/
        plaid.adapter.ts
        plaid.mapper.ts
        plaid.webhook.ts
        plaid.catalog.ts
      mx/
        mx.adapter.ts
        mx.mapper.ts
        mx.webhook.ts
        mx.catalog.ts
      finicity/
        finicity.adapter.ts
        finicity.mapper.ts
        finicity.webhook.ts
        finicity.catalog.ts
```

Core adapter:

```ts
export interface ProviderAdapter {
  provider: FinancialDataProvider;

  listInstitutions(input: ListInstitutionsInput): Promise<ProviderInstitutionPage>;
  searchInstitutions(input: SearchInstitutionsInput): Promise<ProviderInstitution[]>;

  createLinkSession(input: CreateLinkSessionInput): Promise<CreateLinkSessionResult>;

  exchangePublicToken?(input: ExchangePublicTokenInput): Promise<CreateConnectionResult>;
  handleLinkCallback?(input: LinkCallbackInput): Promise<CreateConnectionResult>;

  verifyWebhook(input: VerifyWebhookInput): Promise<VerifiedWebhook>;
  classifyWebhook(input: VerifiedWebhook): ProviderWebhookClassification;

  syncConnection(input: SyncConnectionInput): Promise<SyncConnectionResult>;

  refreshConnection?(input: RefreshConnectionInput): Promise<void>;
  disconnectConnection(input: DisconnectConnectionInput): Promise<void>;
}
```

---

# Phase 9: Refactor Existing Plaid Into Adapter

Do not rewrite Plaid all at once.

Wrap existing Plaid code behind:

```txt
PlaidAdapter
```

Existing behavior should remain unchanged.

Current:

```txt
Plaid webhook
→ Plaid-specific sync
→ Plaid-specific import
```

Target:

```txt
Plaid webhook
→ ProviderWebhookEvent
→ sync-financial-connection job
→ PlaidAdapter.syncConnection()
→ normalized accounts/transactions
→ shared importNormalizedFinancialData()
```

Add Plaid catalog sync:

```txt
Plaid /institutions/get
→ InstitutionProviderMapping
→ canonicalization
```

---

# Phase 10: Shared Sync Engine

Create:

```txt
sync-financial-connection
```

Payload:

```ts
{
  connectionId: string;
  trigger: SyncTrigger;
  webhookEventId?: string;
  force?: boolean;
}
```

Implementation:

```ts
async function syncFinancialConnectionJob(payload) {
  const connection = await db.financialConnection.findUnique(...)

  if (!connection || connection.status === 'DISCONNECTED') {
    return
  }

  const attempt = await createSyncAttempt({
    connectionId: connection.id,
    provider: connection.provider,
    trigger: payload.trigger,
    webhookEventId: payload.webhookEventId,
  })

  try {
    await markAttemptRunning(attempt.id)

    const adapter = getProviderAdapter(connection.provider)

    const result = await adapter.syncConnection({
      connection,
      cursor: decrypt(connection.syncCursorEncrypted),
    })

    const importResult = await importNormalizedFinancialData({
      userId: connection.userId,
      connectionId: connection.id,
      provider: connection.provider,
      accounts: result.accounts,
      transactions: result.transactions,
      holdings: result.holdings,
    })

    await updateConnectionSuccess({
      connectionId: connection.id,
      nextCursor: result.nextCursor,
      lastSuccessfulSyncAt: new Date(),
    })

    await markAttemptSuccess(attempt.id, importResult)
  } catch (error) {
    const normalizedError = normalizeProviderError(connection.provider, error)

    await updateConnectionFailure({
      connectionId: connection.id,
      error: normalizedError,
    })

    await markAttemptFailed(attempt.id, normalizedError)

    if (normalizedError.requiresReauth) {
      await markConnectionReauthRequired(connection.id)
    }

    throw error
  }
}
```

Add locking:

```txt
Only one sync per connection can run at a time.
```

Use one:

```txt
database advisory lock
job uniqueness key
connection sync mutex table
```

Uniqueness key:

```txt
sync-financial-connection:${connectionId}
```

---

# Phase 11: Normalized Import Pipeline

Create:

```ts
async function importNormalizedFinancialData(input: {
  userId: string;
  connectionId: string;
  provider: FinancialDataProvider;
  accounts: NormalizedAccount[];
  transactions: {
    added: NormalizedTransaction[];
    modified: NormalizedTransaction[];
    removed: RemovedProviderTransaction[];
  };
  holdings?: NormalizedHolding[];
}): Promise<ImportResult>
```

Rules:

```txt
Upsert accounts by provider + providerAccountId.
Compute accountFingerprint for cross-provider matching.
Upsert transactions by provider + providerTransactionId.
Compute dedupeFingerprint for provider switching windows.
Store rawProviderPayload for debugging/audit.
Never let MX or Finicity write directly into Plaid-shaped tables.
```

Account fingerprint:

```ts
sha256([
  canonicalInstitutionId,
  normalizedAccountName,
  accountType,
  accountSubtype,
  mask,
  currencyCode
].join('|'))
```

Transaction dedupe fingerprint:

```ts
sha256([
  accountFingerprint,
  amount,
  date,
  normalizedMerchantNameOrName,
  pending ? 'pending' : 'posted'
].join('|'))
```

---

# Phase 12: Webhook Architecture

Use separate public routes:

```txt
POST /api/webhooks/plaid
POST /api/webhooks/mx
POST /api/webhooks/finicity
```

Do not use one public webhook endpoint for all providers.

But internally, all routes write to:

```txt
ProviderWebhookEvent
```

Webhook handler responsibilities:

```txt
read raw body
verify provider-specific signature/auth
parse payload
store raw payload
create normalized event metadata
enqueue process-provider-webhook-event
return 204 quickly
```

Do not run sync directly inside the webhook request.

Shared receiver:

```ts
export async function receiveProviderWebhook(input: {
  provider: FinancialDataProvider;
  request: Request;
}) {
  const adapter = getProviderAdapter(input.provider)

  const verified = await adapter.verifyWebhook({
    headers: input.request.headers,
    rawBody,
    parsedBody,
  })

  const event = await storeProviderWebhookEvent({
    provider: input.provider,
    providerEventId: verified.providerEventId,
    providerConnectionId: verified.providerConnectionId,
    eventType: verified.eventType,
    eventCode: verified.eventCode,
    headers: safeHeaders,
    rawPayload: parsedBody,
    normalizedPayload: verified.normalizedPayload,
    status: 'VERIFIED',
  })

  await enqueueProviderWebhookProcessing(event.id)

  return new Response(null, { status: 204 })
}
```

Internal job:

```txt
process-provider-webhook-event
```

Classify into:

```ts
type ProviderWebhookClassification =
  | { action: 'SYNC_CONNECTION'; connectionId: string }
  | { action: 'MARK_REAUTH_REQUIRED'; connectionId: string }
  | { action: 'MARK_DISCONNECTED'; connectionId: string }
  | { action: 'IGNORE'; reason: string };
```

---

# Phase 13: Add MX Provider

Implement:

```txt
MxAdapter
Mx catalog sync
MX Connect link session
MX callback/complete handler
MX accounts sync
MX transactions sync
MX holdings sync if enabled
MX webhook verification/classification
```

Required envs:

```env
MX_BASE_URL=
MX_CLIENT_ID=
MX_API_KEY=
MX_WEBHOOK_BASIC_AUTH_USERNAME=
MX_WEBHOOK_BASIC_AUTH_PASSWORD=
```

Expected connection flow:

```txt
User chooses institution in Moat Finance dialog
→ Moat Finance chooses MX
→ backend creates MX user/member/connect session
→ frontend opens MX Connect
→ MX returns member_guid / status
→ backend creates FinancialConnection(provider=MX)
→ enqueue initial sync
```

Store:

```txt
MX member_guid → providerConnectionId
MX account GUID → providerAccountId
MX transaction GUID → providerTransactionId
```

MX webhook MVP actions:

```txt
aggregation complete / data ready → enqueue sync
connection status changed → update status
history available → enqueue sync
balance changed → enqueue balance sync
```

---

# Phase 14: Add Finicity Provider

Implement:

```txt
FinicityAdapter
Finicity catalog sync
Finicity Connect/link session
Finicity callback/complete handler
Finicity accounts sync
Finicity transactions sync
Finicity holdings sync if enabled
Finicity webhook verification/classification
```

Required envs:

```env
FINICITY_BASE_URL=
FINICITY_PARTNER_ID=
FINICITY_PARTNER_SECRET=
FINICITY_APP_KEY=
FINICITY_WEBHOOK_SECRET=
```

Expected connection flow:

```txt
User chooses institution in Moat Finance dialog
→ Moat Finance chooses Finicity
→ backend creates Finicity customer/session/connect URL
→ frontend opens Finicity Connect
→ callback completes
→ backend creates FinancialConnection(provider=FINICITY)
→ enqueue initial sync
```

Store:

```txt
Finicity customer id → providerCustomerId
Finicity account id → providerAccountId
Finicity connection/aggregation id → providerConnectionId when available
```

If Finicity webhooks are limited or not reliable for the enabled product tier, use scheduled polling as the primary sync mechanism and webhooks only for connection/status events.

---

# Phase 15: Provider Switching / Fallback

Do not silently move users between providers.

Provider switching flow:

```txt
Connection is degraded
→ User clicks “Fix connection”
→ User sees “Try another connection provider”
→ Moat Finance recommends fallback provider
→ User completes new provider consent flow
→ Create new FinancialConnection
→ Run initial sync
→ Match accounts using accountFingerprint
→ Deduplicate overlap transactions
→ Deactivate old connection only after successful replacement
```

Overlap window:

```txt
45 days default
```

Do not delete the old connection until the new one has synced successfully.

---

# Phase 16: Scheduling and Backstop Polling

Webhooks are not enough.

Add scheduled sync:

```txt
Every 6–12 hours: active depository/card connections
Every 12–24 hours: investment/loan connections
Every 24 hours: low-activity/stale connections
```

Manual refresh:

```txt
User clicks refresh
→ enqueue sync-financial-connection with trigger USER_REFRESH
```

Rate limits:

```txt
1 manual refresh per connection per 15 minutes
Max 5 manual refreshes per user per hour
```

Webhook and polling should converge on the same sync job.

---

# Phase 17: Error Normalization

Create:

```ts
type NormalizedProviderError = {
  provider: FinancialDataProvider;
  code: string;
  message: string;
  retryable: boolean;
  requiresReauth: boolean;
  userActionRequired: boolean;
  providerRawError?: unknown;
}
```

Normalize into:

```txt
AUTH_EXPIRED
MFA_REQUIRED
INSTITUTION_DOWN
RATE_LIMITED
TEMPORARY_PROVIDER_ERROR
ACCOUNT_LOCKED
CONSENT_REVOKED
PRODUCT_NOT_SUPPORTED
UNKNOWN
```

Status mapping:

```txt
AUTH_EXPIRED / MFA_REQUIRED / CONSENT_REVOKED → REAUTH_REQUIRED
INSTITUTION_DOWN / TEMPORARY_PROVIDER_ERROR → DEGRADED
ACCOUNT_LOCKED → ERROR
PRODUCT_NOT_SUPPORTED → ERROR
```

---

# Phase 18: Admin Tools

Add internal admin screens for:

```txt
Canonical institutions
Provider institution mappings
Unmatched provider institutions
Top-25 provider preferences
Manual provider overrides
Connection detail
Webhook events
Sync attempts
Provider health by institution
```

Admin actions:

```txt
merge provider mapping into canonical institution
split mapping into separate canonical institution
mark canonical institution inactive
force preferred provider
reprocess webhook
retry sync
mark connection reauth required
disable provider for institution
```

This is important because institution canonicalization will never be perfect fully automatically.

---

# Phase 19: Observability

Track:

```txt
connections by provider
active connections by provider
sync success rate by provider
sync success rate by institution + provider
average sync duration
webhook receipt count
webhook duplicate rate
webhook processing failure rate
reauth rate
provider switch success rate
cost estimate by provider
catalog sync freshness
unmatched institution count
manual override count
```

Structured logs should include:

```txt
provider
connectionId
providerConnectionId
canonicalInstitutionId
providerInstitutionId
syncAttemptId
webhookEventId
trigger
errorCode
```

Alerts:

```txt
Provider webhook 5xx rate > 1%
Provider sync failure rate > 10% over 30 minutes
Institution/provider failure spike
Webhook queue lag > 5 minutes
Sync job queue lag > 15 minutes
Catalog sync failure
Unmatched top-search institution spike
```

---

# Phase 20: Feature Flags

Add:

```txt
ENABLE_PROVIDER_ORCHESTRATION
ENABLE_MOAT_CONNECT_DIALOG
ENABLE_UNIFIED_INSTITUTION_SEARCH
ENABLE_INSTITUTION_CATALOG_SYNC
ENABLE_INSTITUTION_CANONICALIZATION
ENABLE_MX_CONNECTIONS
ENABLE_FINICITY_CONNECTIONS
ENABLE_PROVIDER_SWITCHING
ENABLE_ADVANCED_PROVIDER_SELECTION
ENABLE_PROVIDER_ROUTING_TELEMETRY
```

Suggested rollout:

```txt
1. ENABLE_MOAT_CONNECT_DIALOG=true
2. ENABLE_UNIFIED_INSTITUTION_SEARCH=true
3. Route everything to Plaid
4. ENABLE_INSTITUTION_CATALOG_SYNC=true
5. ENABLE_INSTITUTION_CANONICALIZATION=true
6. ENABLE_MX_CONNECTIONS=true for internal users
7. ENABLE_FINICITY_CONNECTIONS=true for internal users
8. Enable top-25 routing
9. Enable advanced provider selection
10. Enable provider switching
```

---

# Recommended Implementation Order

## Task 1: Add provider-agnostic schema

* Add provider enums.
* Add `FinancialConnection`.
* Add `ProviderWebhookEvent`.
* Add `ProviderSyncAttempt`.
* Add provider fields to accounts/transactions.
* Backfill existing Plaid items into `FinancialConnection`.

## Task 2: Build institution catalog schema

* Add `CanonicalInstitution`.
* Add `InstitutionProviderMapping`.
* Add `InstitutionProviderPreference`.
* Add top-25 seed file.
* Add aliases/domains/display names.

## Task 3: Build Moat Finance-owned connect dialog

* Add institution search dialog.
* Search Moat Finance DB.
* Initially route every selection to Plaid.
* Keep existing Plaid Link behavior working.

## Task 4: Wrap Plaid in provider adapter

* Create `PlaidAdapter`.
* Move existing sync behind `syncConnection`.
* Move Plaid webhook parsing into `plaid.webhook.ts`.
* Add Plaid catalog sync.

## Task 5: Build shared sync engine

* Add `sync-financial-connection` job.
* Add normalized import pipeline.
* Add sync attempt records.
* Add locking/idempotency.
* Add normalized errors.

## Task 6: Build webhook ingestion layer

* Keep `/api/webhooks/plaid`.
* Add `/api/webhooks/mx`.
* Add `/api/webhooks/finicity`.
* All three store `ProviderWebhookEvent`.
* All three enqueue the same internal processing job.

## Task 7: Add catalog canonicalization

* Sync Plaid institution catalog.
* Sync MX institution catalog.
* Sync Finicity institution catalog.
* Match provider records to canonical institutions.
* Group search results by canonical institution.
* Mark uncertain matches for admin review.

## Task 8: Add provider routing

* Implement `chooseProviderForInstitution`.
* Use top-25 preferences first.
* Fall back to provider availability/scoring.
* Hide provider choice by default.
* Show advanced provider option only for troubleshooting.

## Task 9: Add MX

* Add MX API client.
* Add MX catalog sync.
* Add MX Connect flow.
* Add MX callback handling.
* Add MX sync.
* Add MX webhook classification.
* Enable behind feature flag.

## Task 10: Add Finicity

* Add Finicity API client.
* Add Finicity catalog sync.
* Add Finicity Connect flow.
* Add Finicity callback handling.
* Add Finicity sync.
* Add Finicity webhook classification.
* Enable behind feature flag.

## Task 11: Add provider switching

* Add “Fix connection.”
* Add “Try another provider.”
* Create replacement connection.
* Match accounts.
* Deduplicate overlap transactions.
* Deactivate old connection only after new sync succeeds.

## Task 12: Add admin and observability

* Provider health dashboard.
* Institution mapping review.
* Sync attempt detail.
* Webhook event detail.
* Provider override controls.

---

# MVP Scope

MVP should include:

```txt
Moat Finance-owned connect dialog
Canonical institution schema
Top-25 provider preference seed
Plaid routed through new dialog
Provider adapter interface
Plaid adapter wrapper
Shared FinancialConnection model
Shared ProviderWebhookEvent table
Shared ProviderSyncAttempt table
Shared sync job
Shared normalized import
MX adapter behind feature flag
Finicity adapter behind feature flag
Separate webhook routes for all providers
Basic provider switching
Basic admin override support
```

MVP should not include:

```txt
automatic silent provider switching
triple-syncing accounts
fully automated long-tail canonicalization
machine-learned provider routing
public provider health page
cost-optimized real-time routing
```

---

# Acceptance Criteria

## Existing Plaid behavior

* Existing Plaid users continue syncing without reconnecting.
* Existing Plaid webhooks still work.
* Existing Plaid items are backfilled into `FinancialConnection`.
* Existing Plaid transaction cursors are preserved.

## Institution search

* User clicks “Connect account” and sees Moat Finance’s institution search dialog.
* Search happens against Moat Finance’s canonical catalog.
* Searching “Chase”, “JP Morgan”, or “JPMorgan Chase Bank” returns one main result: “Chase.”
* Search results do not show duplicate Plaid/MX/Finicity institution rows.
* Separate portals like “Chase Business” or “J.P. Morgan Wealth Management” can appear separately when appropriate.

## Provider routing

* Top-25 institutions use primary preferred providers.
* Chase/JPMorgan Chase routes to Plaid by default.
* Fidelity routes to Finicity by default initially.
* TIAA routes to MX by default initially.
* Advanced users/support can choose another provider.
* Provider choice is hidden by default in the happy path.

## MX / Finicity

* New MX connection can be created and synced.
* New Finicity connection can be created and synced.
* MX and Finicity webhooks are stored and processed through the shared webhook pipeline.
* All providers write normalized accounts and transactions into the same core tables.

## Reliability

* Duplicate webhooks do not duplicate transactions.
* Out-of-order webhooks do not corrupt state.
* Manual refresh works for all providers.
* Scheduled polling works for all providers.
* Provider switching can create a replacement connection without deleting the old one prematurely.
* No account is connected to multiple providers unless the user explicitly initiates provider switching or support enables it.

## Admin

* Admin can review unmatched institution mappings.
* Admin can merge/split provider institution records.
* Admin can override preferred provider for an institution.
* Admin can inspect webhook events and sync attempts.
