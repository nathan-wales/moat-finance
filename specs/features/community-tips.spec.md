Implement a new feature called **Community Tips** across Moat Finance.

Keep the first version intentionally simple. The goal is to let users share short, useful money-saving or money-earning tips, review them safely, browse approved tips, like them, and surface relevant tips beneath matching transactions.

Do not expand this into a full social network.

## Repository context

Moat Finance uses a multi-platform monorepo:

- `apps/web` — Next.js 15 App Router
- `apps/api` — Next.js REST API using the Pages Router
- `apps/desktop` — Electron desktop app
- `apps/ios` — native iOS app
- `packages/client-ts` — TypeScript API client
- `packages/openapi` — OpenAPI specification and generated client
- `packages/shared` — shared TypeScript utilities and types
- Prisma 6
- Neon Postgres
- NextAuth v5
- React Query
- Tailwind v4
- shadcn/ui
- Biome

Inspect the repository before implementing and follow existing patterns for:

- Authentication
- API routes
- Prisma models
- Admin authorization
- Pagination
- React Query
- Shared packages
- OpenAPI generation
- iOS API consumption
- Desktop and web component reuse
- LLM provider abstractions
- Rate limiting
- Transaction detail views

Do not create parallel architecture when an established pattern already exists.

# Product name

Use **Community Tips** consistently.

Use these terms:

- Feature: `Community Tips`
- Singular item: `Community Tip`
- Navigation label: `Community Tips`
- Submission action: `Add a tip`
- User submissions: `My tips`
- Admin page: `Community Tips moderation`
- Transaction card heading: `Community tip`

Do not call the feature Tips & Tricks, Money Hacks, Playbook, or another name.

# Core product scope

Implement:

1. A Community Tips feed
2. A simple Community Tip submission form
3. Optional recommendation metadata
4. Public or anonymous posting
5. LLM first-pass review
6. Manual admin approval
7. Five submissions per user per rolling 24-hour period
8. Like functionality
9. Search and basic filtering
10. Keyword-based transaction matching
11. Community Tip recommendations beneath transaction details
12. Web UI
13. Desktop UI
14. Native iOS UI
15. Add-a-tip dropdown with Make with AI and Add manually
16. MCP tools for listing, querying, creating, and updating Community Tips

Do not implement:

- Comments
- Replies
- Direct messages
- Following users
- Creator payments
- Referral codes
- Affiliate programs
- Embeddings
- Semantic search
- Complex recommendation models
- Automatic final publication
- User-authored matching rules



# Shared package architecture

Create a reusable Community Tips package under `packages/`.

Use an appropriate package name based on repository conventions, such as:

```text
packages/community-tips
```

This package should contain platform-independent Community Tips domain logic that can be consumed by the web and desktop apps.

Suitable package responsibilities include:

- Domain types
- Validation schemas
- Status enums
- Attribution enums
- Moderation result schemas
- Keyword normalization
- Keyword matching
- Ranking calculations
- Recommendation scoring
- Shared constants
- Shared formatting helpers
- Shared client-facing interfaces

Do not put React DOM components into the shared package unless the repository already has a cross-app component package used by both web and desktop.

Web and desktop may share React components where technically appropriate.

The native iOS app cannot directly consume TypeScript runtime code. iOS should consume the same Community Tips API contract through the OpenAPI-generated client or the repository’s existing Swift networking architecture.

The backend and all clients must rely on the same API behavior and domain rules even though iOS uses a native implementation.

# Community Tip submission

The primary CTA on the feed and My Tips is an **Add a tip** dropdown (same pattern as Add Asset):

- **Make with AI** — connection-gated AI-assisted flow (see below)
- **Add manually** — opens the existing submission form

The manual form should feel like writing a simple post.

Required fields:

- Title
- Body
- Attribution choice

Attribution options:

- My profile (default; “Post anonymously” unchecked)
- Anonymous

Optional fields should be placed inside a collapsed section labeled:

> Help Moat recommend this tip

Supporting copy:

> Add optional details so Moat can show your tip when it may be useful.

Optional metadata:

- Keywords
- Related merchants
- Related transaction categories
- Tags
- Tip type
- Potential benefit
- Estimated savings percentage
- Estimated savings amount
- Applicable countries
- Requirements
- Relevant external link
- Expiration date
- Personally tested

The user must be able to submit without completing any optional metadata.

# Make with AI

Mirror the prompt-library Create with AI connection gate.

Flow:

1. User chooses **Make with AI**
2. Check whether the user has a connected AI assistant (`hasPromptAiConnection` / MCP OAuth or PAT)
3. If not connected, show a gate dialog titled **Connect an AI assistant first**, with actions to connect or add manually instead
4. If connected, open a short in-app builder (topic + optional context)
5. Generate a starter prompt the user copies into their connected assistant
6. The assistant uses MCP Community Tip tools to create the tip

Anonymity rules for the AI flow:

- In the assistant’s **initial questionnaire**, ask once whether the user wants to post anonymously
- Do not ask again
- If the user does not answer, assume **PUBLIC**
- MCP `moat.createCommunityTip` defaults `attribution` to `PUBLIC` when omitted

After create (tool response and assistant messaging):

- Remind the user the tip must go through review before it can appear publicly
- Remind them they can change attribution later (e.g. to anonymous) via `moat.updateCommunityTip` or My tips

Always populate useful metadata on AI-created tips (keywords, merchants, tags, tipType, potentialBenefit, etc.).

# MCP Community Tip tools

Expose scoped MCP tools:

| Tool | Scope |
|------|-------|
| `moat.listCommunityTips` | `mcp:community-tips:read` |
| `moat.getCommunityTip` | `mcp:community-tips:read` |
| `moat.listMyCommunityTips` | `mcp:community-tips:read` |
| `moat.createCommunityTip` | `mcp:community-tips:write` |
| `moat.updateCommunityTip` | `mcp:community-tips:write` |

Create uses the same server rules as the REST create path (rate limit, fingerprint, `LLM_REVIEW`, moderation). Write scopes remain PAT / local-agent oriented; privacy UI exposes read and create/update items.

# Anonymous posting

Anonymous means anonymous to the public, not anonymous to Moat.

Always retain the author user ID privately.

For anonymous tips:

- Do not expose the author’s name
- Do not expose their avatar
- Do not expose a profile link
- Do not expose identifying author metadata through public APIs
- Display `Anonymous member`

The original author must still be able to:

- View the tip in My Tips
- Edit it
- Delete or withdraw it
- View its moderation status

Administrators must be able to see the real author.

Use separate public, owner, and admin serializers or response schemas so anonymous author identity cannot leak through nested database relationships.

# Submission rate limit

Allow each user to submit no more than:

```text
5 Community Tips per rolling 24-hour period
```

Enforce this on the server.

Do not rely on client-side disabling.

Requirements:

- Count submitted tips regardless of whether they are later approved, rejected, or deleted
- Draft saves should not count unless the draft is formally submitted
- Return a structured API error when the limit is reached
- Include the next eligible submission time when practical
- Show a clear client message
- Add tests for the boundary
- Make the limit configurable through a shared constant or environment-backed configuration

Also protect the endpoint against obvious duplicate or concurrent submission attempts.

# Suggested data model

Adapt this to existing Prisma conventions.

## CommunityTip

Support fields equivalent to:

```ts
type CommunityTip = {
  id: string;
  authorUserId: string;
  title: string;
  body: string;
  attribution: "PUBLIC" | "ANONYMOUS";
  status:
    | "LLM_REVIEW"
    | "PENDING_ADMIN_REVIEW"
    | "CHANGES_REQUIRED"
    | "APPROVED"
    | "REJECTED"
    | "ARCHIVED"
    | "EXPIRED";
  moderationReason?: string;
  moderationMetadata?: JsonValue;
  publishedAt?: Date;
  expiresAt?: Date;
  createdAt: Date;
  updatedAt: Date;
};
```



## Recommendation metadata

Support optional fields equivalent to:

```ts
type CommunityTipRecommendationMetadata = {
  keywords?: string[];
  normalizedKeywords?: string[];
  merchantNames?: string[];
  normalizedMerchantNames?: string[];
  transactionCategories?: string[];
  tags?: string[];
  tipType?: string;
  potentialBenefit?: string;
  estimatedSavingsPercent?: number;
  estimatedSavingsAmount?: number;
  countryCodes?: string[];
  requirements?: string[];
  externalUrl?: string;
  personallyTested?: boolean;
};
```

Use normalized relational tables or structured JSON based on current repository patterns.

The design must support efficient matching against transaction merchant names and descriptions.

## Likes

Create a unique user-to-tip relationship.

Equivalent behavior:

```ts
CommunityTipLike {
  id
  tipId
  userId
  createdAt
}
```

Enforce one like per user per tip.

Users must be able to:

- Like a tip
- Unlike a tip
- See the like count
- See whether they personally liked it

Only approved tips should receive new public likes.

# LLM moderation and enrichment

Run an LLM first pass whenever a tip is submitted.

Use the repository’s existing LLM provider abstraction if one exists.

Otherwise, create a provider-independent interface rather than coupling the feature directly to one vendor.

Suggested interface:

```ts
type CommunityTipLlmReviewResult = {
  decision:
    | "PASS_TO_ADMIN"
    | "CHANGES_REQUIRED"
    | "REJECT";
  summary: string;
  reasons: string[];
  riskScore: number;
  containsSolicitation: boolean;
  containsReferralCode: boolean;
  containsSelfPromotion: boolean;
  containsUnsafeAdvice: boolean;
  containsIllegalAdvice: boolean;
  containsFinancialMisinformation: boolean;
  containsGuaranteedClaims: boolean;
  containsSensitiveInformation: boolean;
  suspiciousExternalLink: boolean;
  suggestedTitle?: string;
  suggestedKeywords: string[];
  suggestedMerchants: string[];
  suggestedCategories: string[];
  suggestedTags: string[];
  suggestedTipType?: string;
  suggestedPotentialBenefit?: string;
};
```

The LLM should review for:

- Solicitation
- Self-promotion
- Referral codes
- Affiliate spam
- Recruiting
- Multi-level marketing
- Guaranteed earnings
- Guaranteed savings
- Scams
- Credit-repair misinformation
- Unsafe or illegal activity
- Deceptive credit card strategies
- Personally identifiable information
- Sensitive financial information
- Suspicious links
- Low-quality or incoherent submissions
- Duplicate-looking content where practical

The LLM should also create or normalize:

- Keywords
- Merchant names
- Categories
- Tags
- Tip type
- Potential benefit



## LLM moderation rules

- The LLM must never directly publish a tip
- A passing tip moves to `PENDING_ADMIN_REVIEW`
- A concerning but fixable tip moves to `CHANGES_REQUIRED`
- A clearly prohibited tip may move to `REJECTED`
- Final approval requires an administrator
- Store structured moderation output
- Do not expose raw internal prompts to users
- Do not send unrelated private financial data to the LLM
- Do not send user transactions to the LLM during post moderation
- LLM failure must not lose the submitted tip
- A provider timeout or failure should leave the tip in a retryable review state
- Add retry protection so duplicate LLM reviews do not create conflicting state transitions



# Keywords

Keywords are the main matching mechanism for the MVP.

The LLM should generate a concise set of normalized keywords based on the title, body, and optional metadata.

Examples for an Amazon credit card tip:

```text
amazon
amazon.com
amazon marketplace
prime
amazon prime
amazon rewards
amazon visa
shopping
online shopping
credit card rewards
cash back
5 percent
```

Requirements:

- Lowercase normalized form
- Trim whitespace
- Deduplicate
- Remove meaningless stop words
- Limit the number of generated keywords
- Preserve user-entered keywords separately when useful
- Allow an admin to add, edit, or remove keywords
- Support merchant aliases
- Avoid overly broad terms that would match unrelated transactions
- Do not use regular expressions supplied by community users
- Do not allow arbitrary executable matching logic



# Admin moderation

Add an admin moderation view.

Administrators must be able to:

- View tips awaiting review
- View the original submission
- View the real author
- See whether it will be public or anonymous
- View LLM review results
- View risk flags
- Review generated keywords
- Edit keywords
- Edit merchant names
- Edit categories
- Edit tags
- Edit optional metadata
- Approve
- Reject
- Request changes
- Archive
- Mark expired

Use existing admin authorization patterns.

Enforce all admin permissions server-side.

Do not expose administrative data through normal user APIs.

When an admin approves a tip:

- Set status to `APPROVED`
- Set `publishedAt`
- Make it available in the public feed
- Make it eligible for transaction recommendations



# Editing approved tips

If an author changes an approved tip’s:

- Title
- Body
- External URL
- Keywords
- Merchants
- Benefit claims
- Requirements
- Expiration date

the edited content must return through LLM and admin review.

Do not allow approved content to be replaced without another moderation cycle.

Use a revision model if the repository already has a suitable pattern.

Otherwise, it is acceptable for the initial implementation to temporarily unpublish the edited tip while it is re-reviewed.

# Community Tips feed

Create a clean feed for web, desktop, and iOS.

Each card should show:

- Title
- Short body preview
- Public author name or `Anonymous member`
- Up to three tags or keywords
- Like count
- Whether the current user liked it
- Published date where appropriate

Actions:

- Like
- Unlike
- Open tip
- Save if an existing reusable save/favorite pattern already exists

Saving is optional for this phase if it significantly expands scope. Likes are required.

No comments.

## Feed ordering

Default feed ordering should account for:

- Like count
- Recency
- Relevance to the current search or filter

Use a simple deterministic score.

For example:

```ts
feedScore =
  likeWeight * normalizedLikeCount +
  recencyWeight * recencyScore;
```

Do not over-engineer the ranking model.

Requirements:

- More-liked tips should generally surface toward the top
- New tips must still have a reasonable opportunity to appear
- Avoid a permanent rich-get-richer ordering
- Add a `Newest` sort option
- Add a `Most liked` sort option

Search should cover:

- Title
- Body
- Keywords
- Tags
- Merchant names

Basic filters may include:

- Category
- Tip type
- Personally tested
- Active or non-expired



# Transaction recommendations

Show relevant approved Community Tips beneath transaction details.

Add a user setting:

> Show Community Tips on transactions

Description:

> Show approved community recommendations that may relate to a transaction’s merchant, description, or category.

The setting should be available on web, desktop, and iOS.

Only show recommendations when this setting is enabled.

## Matching inputs

Use:

- Normalized transaction merchant name
- Transaction description
- Original statement name if available
- Transaction category
- User country or account country when available
- Tip expiration status
- Tip keywords
- Tip normalized merchant names

Do not use embeddings in this phase.

## Matching behavior

Create a shared matching service in the Community Tips package.

Suggested logic:

```ts
type CommunityTipMatchInput = {
  merchantName?: string;
  description?: string;
  originalDescription?: string;
  category?: string;
  countryCode?: string;
};

type CommunityTipMatchResult = {
  tipId: string;
  keywordMatchScore: number;
  merchantMatchScore: number;
  categoryMatchScore: number;
  likeScore: number;
  totalScore: number;
  matchedKeywords: string[];
};
```

Suggested scoring priorities:

1. Exact merchant match
2. Merchant alias match
3. Strong keyword match in merchant
4. Strong keyword match in transaction description
5. Category match
6. Like-based quality weight

Likes should improve recommendation ranking, but must not overpower relevance.

Use logic equivalent to:

```ts
totalScore =
  merchantMatchScore * 0.45 +
  keywordMatchScore * 0.3 +
  categoryMatchScore * 0.15 +
  likeScore * 0.1;
```

The exact weights may be adjusted after inspecting the repository and test data.

Important rules:

- Relevance must remain the primary signal
- Likes are a quality signal, not the main matching signal
- A highly liked but unrelated tip must never appear
- Use a minimum match threshold
- Prefer one strong recommendation over many weak ones
- Return no more than three recommendations
- Default to showing one recommendation
- Exclude expired tips
- Exclude archived tips
- Exclude rejected tips
- Exclude tips awaiting review
- Exclude geographically incompatible tips where metadata exists



# Example transaction recommendation

For an Amazon transaction:

```text
Amazon Marketplace
$86.42
```

A matching card could display:

> Community tip
>
> **Get 5% back on Amazon purchases**
>
> A community member uses an Amazon rewards card only for Amazon purchases and keeps it on autopay.
>
> 184 likes
>
> View tip · Like

If a reliable percentage is present, the UI may show:

> Potential benefit on this purchase: up to $4.32

Only calculate this when:

- A valid savings percentage exists
- The transaction amount is known
- The tip plausibly applies
- The language clearly says `potential`, `estimated`, or `up to`

Do not imply guaranteed eligibility or savings.

# Web implementation

Add Community Tips to the web app.

Suggested routes, adapted to existing conventions:

```text
/community-tips
/community-tips/new
/community-tips/[tipId]
/community-tips/my-tips
/admin/community-tips
```

Web requirements:

- Responsive feed
- Search
- Sort
- Add a tip dropdown (Make with AI / Add manually)
- Make with AI connection gate + starter prompt
- Submission form
- Optional collapsed metadata
- Public/anonymous attribution selector
- My Tips status view
- Tip detail page
- Like/unlike
- Admin moderation
- Transaction recommendation card
- User preference toggle

Use existing shadcn/ui and Moat styling.

# Desktop implementation

Add Community Tips to the Electron desktop app.

Reuse the shared Community Tips package and shared React components when the existing architecture supports it.

Desktop requirements:

- Community Tips navigation entry
- Feed
- Search and sort
- Submission form
- My Tips
- Like/unlike
- Tip detail view
- Transaction recommendation card
- User preference toggle

Respect the desktop app’s local-first architecture.

If Community Tips requires cloud connectivity:

- Clearly handle offline state
- Do not pretend the community feed is available offline unless cached
- Show an appropriate offline message
- Avoid blocking unrelated local financial features
- Cache approved tips only if an existing safe caching pattern exists



# iOS implementation

Add native Community Tips views to the iOS app.

iOS requirements:

- Community Tips navigation entry
- Native feed
- Search
- Sort
- Submission form
- Collapsible optional metadata
- Public/anonymous attribution selection
- My Tips
- Moderation status
- Tip detail view
- Like/unlike
- Transaction recommendation card
- User preference toggle
- Loading, error, empty, and offline states

Use existing native design patterns.

Do not attempt to share TypeScript UI code with iOS.

Consume the same REST/OpenAPI endpoints used by web and desktop.

Regenerate or update the Swift client if the repository already generates one. Otherwise, follow the established iOS networking layer.

# API operations

Adapt exact paths to existing API conventions.

Support operations equivalent to:

```text
GET    /community-tips
POST   /community-tips
GET    /community-tips/{tipId}
PATCH  /community-tips/{tipId}
DELETE /community-tips/{tipId}

GET    /community-tips/mine

POST   /community-tips/{tipId}/like
DELETE /community-tips/{tipId}/like

GET    /transactions/{transactionId}/community-tips

GET    /admin/community-tips
GET    /admin/community-tips/{tipId}
POST   /admin/community-tips/{tipId}/approve
POST   /admin/community-tips/{tipId}/reject
POST   /admin/community-tips/{tipId}/request-changes
PATCH  /admin/community-tips/{tipId}/metadata
```

Update:

- OpenAPI spec
- Generated TypeScript client
- Native iOS client or networking models
- Shared types
- API validation
- React Query hooks

Use cursor pagination if that is the repository standard.

# Public, owner, and admin API responses

Create clearly separated response shapes.

## Public response

May include:

- Tip ID
- Title
- Body
- Public attribution
- Public author details only when attribution is public
- Tags
- Tip type
- Potential benefit
- Like count
- Current user liked state
- Published date

Must not expose:

- Anonymous author ID
- Email
- Private user profile
- Moderation metadata
- LLM results
- Internal risk flags



## Owner response

May additionally include:

- Status
- Moderation feedback
- Editable metadata
- Submission date



## Admin response

May additionally include:

- Real author
- Full LLM review
- Internal moderation metadata
- Generated keyword details
- Audit information



# Validation

Add validation for:

- Title length
- Body length
- Attribution
- Keyword count
- Keyword length
- Tag count
- Merchant count
- URL scheme
- Savings percentage
- Savings amount
- Country codes
- Expiration dates
- Like uniqueness

Use existing validation libraries.

Suggested limits should be reasonable and centralized.

Example starting points:

```text
Title: 5–120 characters
Body: 20–5,000 characters
Keywords: maximum 30
Tags: maximum 10
Merchant names: maximum 20
```

Adjust based on repository conventions.

# Security and privacy

Requirements:

- Enforce ownership server-side
- Enforce admin authorization server-side
- Do not leak anonymous author identity
- Do not expose transaction data to Community Tip authors
- Do not expose which users saw a recommendation
- Do not expose user financial information to the community
- Do not send user transactions through LLM moderation
- Validate external URLs
- Allow only HTTP and HTTPS links
- Render external links safely
- Do not automatically fetch arbitrary submitted URLs
- Sanitize or safely render user-generated content
- Add anti-abuse protection
- Prevent duplicate likes
- Prevent unsupported status transitions



# Tests

Add focused tests for:

## Submission

- Valid public submission
- Valid anonymous submission
- Anonymous public serializer
- Five submissions allowed
- Sixth submission blocked
- Rolling 24-hour reset
- Concurrent limit attempts
- Invalid title
- Invalid body
- Invalid URL



## Moderation

- LLM pass moves to admin review
- LLM changes-required result
- LLM rejection result
- LLM failure recovery
- Admin approval
- Admin rejection
- Non-admin moderation denial
- Approved tip editing triggers re-review



## Likes

- Like
- Unlike
- Duplicate like prevention
- Like count
- Only approved tips can receive public likes



## Feed

- Only approved tips appear
- Expired tips excluded
- Most-liked ordering
- Newest ordering
- Search by title
- Search by keyword
- Search by merchant



## Recommendations

- Exact merchant match
- Merchant alias match
- Description keyword match
- Category match
- Like weight affects ranking
- Likes cannot make an unrelated tip match
- Minimum threshold
- Expired tip excluded
- Disabled user preference returns no recommendations
- Maximum result count



## Privacy

- Anonymous author hidden publicly
- Anonymous author visible to admin
- Owner can edit their anonymous tip
- Other users cannot edit it
- Transaction data is not exposed through Community Tip APIs

Add integration or end-to-end coverage for the main flow if the repository has an established framework:

1. User submits a tip
2. LLM review completes
3. Admin approves
4. Tip appears in feed
5. Another user likes it
6. Tip appears beneath a matching transaction



# Implementation order

Implement in this order:

1. Audit repository patterns
2. Create the shared Community Tips package
3. Add Prisma models and migration
4. Add validation and domain types
5. Add submission rate limiting
6. Add LLM review and keyword enrichment
7. Add admin approval flow
8. Add public API and feed
9. Add likes
10. Add keyword matching and ranking
11. Add transaction recommendation API
12. Add web UI
13. Add desktop UI
14. Add iOS UI
15. Add tests
16. Run repository checks

Do not let advanced UI polish or recommendation tuning delay the complete vertical flow.

# Completion criteria

The feature is complete when:

- A signed-in user can submit a title and body
- The user may post publicly or anonymously
- Optional metadata may be added
- The server enforces five submissions per rolling 24 hours
- The LLM performs first-pass review
- The LLM generates normalized keywords
- An administrator can approve or reject the tip
- Only approved tips appear publicly
- Users can like and unlike tips
- Like counts influence feed ordering
- Web users can browse and submit tips
- Desktop users can browse and submit tips
- iOS users can browse and submit tips
- Approved tips can match transactions using merchant and description keywords
- Relevant liked tips receive a modest ranking boost
- The user can disable transaction Community Tips
- No comments exist
- Anonymous author identity remains private
- Tests pass



# Final implementation report

When finished, report:

- Files and packages added
- Prisma schema changes
- Migration name
- API routes added
- OpenAPI operations added
- Shared package architecture
- LLM provider and fallback behavior
- Rate-limit implementation
- Keyword normalization and matching behavior
- Ranking formula
- Web screens added
- Desktop screens added
- iOS screens added
- Privacy protections
- Tests added
- Commands run
- Typecheck results
- Lint results
- Test results
- Build results
- Any deferred work or known limitations

