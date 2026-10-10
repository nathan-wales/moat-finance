# Provider orchestration architecture for Moat Finance

Executive summary
A three-aggregator stack can improve coverage, but the economically sane pattern for Moat Finance is single-homing by default: choose one aggregator per user–institution connection, keep institution-level fallback preferences, and only invoke a fallback when the primary path is failing or unsupported. Public evidence strongly favors Plaid for many large U.S. retail banks because Plaid has the richest public trail of direct bank agreements, OAuth guidance, and institution/product coverage pages. The clearest exceptions in this research are Fidelity, where Finicity remains the strongest publicly documented API/OAuth path through Fidelity Access, and TIAA, where recent Monarch operational guidance says MX is the default and Plaid first-time connections are “rarely successful.” 

The answer to the cost question is also straightforward: yes, triple-connecting the same relationship to Plaid, MX, and Finicity would usually multiply variable cost and operational complexity, while also creating duplicate accounts, duplicate transactions, and reconnection burden. Plaid’s billing docs show that data products often use subscription pricing, and some products such as Investments can create multiple subscriptions on the same Item. Public pricing for MX and Finicity is largely quote-based, but public benchmarks and practitioner reports put consumer transaction-feed pricing in roughly the $0.30–$0.60 per active connection per month range, with some public benchmarks at $0.30 and additional institution access fees now possible at some banks such as JPMorgan. 

The strongest design is therefore an orchestration layer that does five things well: maintain a canonical institution registry across providers; score providers by coverage + OAuth + observed health + cost + product support; keep exactly one active transaction-producing provider per logical connection unless the user explicitly chooses otherwise; make fallbacks mostly one-tap re-link flows rather than silent background swaps; and measure success aggressively so your default provider matrix improves over time. This approach matches how modern multi-provider consumer apps describe their setup: Monarch publicly states it uses Plaid, Finicity, and MX, recommends the provider with the best connection, and exposes connection-health details by provider. 

Method and decision rule
There is no public, provider-neutral dataset of the “top 25 most commonly connected” institutions in budgeting and PFM apps. I therefore used a practical proxy set: the largest U.S. consumer banks and credit-card issuers, major retail brokerages and retirement institutions, and widely used wallets / crypto platforms. For the bank side, that proxy largely overlaps with the biggest U.S. retail institutions by assets and footprint; for brokerages it overlaps with mainstream retail broker shortlists; and for wallets / exchanges it overlaps with large consumer usage footprints such as Venmo and Coinbase. 

The recommendation rule was intentionally conservative. I weighted, in order: recent official institution–aggregator agreements; official provider documentation for institution support and OAuth; official consumer consent flows; recent public status / incident reports; and finally developer-community or app-operations reports where official mappings were incomplete. High confidence means there is strong official support plus recent evidence. Medium confidence means there is official support but weaker public evidence on comparative reliability. Low confidence means the recommendation leans heavily on indirect operational evidence. Unspecified means public sources did not support a rigorous cross-provider winner. 

One implementation note matters: public provider docs generally expose institution-search APIs and dashboards, but not a clean public export of all live institution IDs in the manner you would want for a production routing table. In the table below I therefore list public directory handles when visible and otherwise mark IDs as not publicly exposed; in production, Moat Finance should source the true provider IDs from each vendor’s institution-search endpoint during catalog ingestion. 

Preferred-provider table
Interpretation: “Primary” is the best public bet for a new connection today. “Fallbacks” are the order I would test next, but for lower-confidence institutions the fallback order should be learned from Moat Finance’s own telemetry rather than treated as fixed truth.

Institution	Category	Public handle or note	Recommended primary	Fallback(s)	Reason	Confidence	Sources
Chase	Bank	API ID not public	Plaid	MX, Finicity	Renewed JPMC–Plaid data-access agreement in 2025; Plaid requires OAuth for major U.S. banks and has Chase-specific operational guidance; Plaid also documents tokenized account-number behavior for Chase.	High	
Bank of America	Bank	bank-of-america	Plaid	MX, Finicity	Bank of America has explicit consent terms naming Plaid and a secure third-party access flow; Plaid also publicly supports BofA.	High	
Wells Fargo	Bank	wells-fargo	Plaid	MX, Finicity	Wells Fargo signed a data-exchange agreement with Plaid; public Wells terms support a consent-driven account-information service; Plaid supports Wells Fargo.	High	
Citi	Bank / cards	API ID not public	Plaid	MX, Finicity	Plaid’s official Trial-plan documentation lists Citi among major OAuth institutions. Comparative MX / Finicity public evidence is weak.	Medium	
Capital One	Bank / cards	API ID not public	Plaid	MX, Finicity	Capital One and Plaid announced a formal data-sharing agreement and migration to the Capital One API.	High	
U.S. Bank	Bank	API ID not public	Plaid	MX, Finicity	Plaid and U.S. Bank announced API-based sharing; Plaid later documented tokenized account-number support for U.S. Bank. MX also has an older U.S. Bank API collaboration, so it is the best-defined fallback.	High	
PNC	Bank	API ID not public	Plaid	MX, Finicity	PNC and Plaid signed a 2024 data-access agreement; Plaid later added PNC-specific TAN / OAuth features.	High	
Truist	Bank	API ID not public	Plaid	MX, Finicity	Truist announced an expanded open-banking partnership with Plaid in 2026.	High	
TD Bank	Bank	td-bank	Plaid	MX, Finicity	TD and Plaid signed a North American data-access agreement in 2023, explicitly covering U.S. customers; Plaid has a TD support page.	High	
Ally	Bank	ally-bank	Plaid	MX, Finicity	Plaid publicly supports Ally; I did not find stronger recent public evidence favoring MX or Finicity.	Medium	
SoFi	Bank / fintech	No rigorous public winner	Unspecified	Plaid, Finicity	SoFi itself uses Plaid for some account-linking experiences, but public operational reports suggest Finicity can outperform Plaid for syncing SoFi accounts in some PFM contexts. Public cross-provider evidence is mixed.	Low	
Navy Federal Credit Union	Credit union	navy-federal-credit-union	Plaid	MX, Finicity	Plaid publicly supports NFCU, and Plaid’s official Trial-plan doc lists Navy Federal among major OAuth institutions.	High	
USAA	Bank / insurance	No reliable public ID	Plaid	Finicity, MX	Public OAuth support materials list USAA among Plaid OAuth institutions, and recent Monarch operations commentary indicates Plaid was in better shape than Finicity during a sync issue.	Medium-low	
American Express	Credit cards / bank	american-express	Plaid	MX, Finicity	Plaid and American Express announced a data-access agreement with OAuth and biometric authentication, and Plaid has an AmEx support page.	High	
Discover	Credit cards / bank	discover	Plaid	Finicity, MX	Plaid publicly supports Discover, and Monarch’s status page specifically reported that Plaid was working while Finicity’s Discover connection was down.	High	
Fidelity Investments	Brokerage / retirement	No public API ID; Finicity listing visible	Finicity	Plaid, MX	Fidelity Access is officially integrated with Finicity; Fidelity’s 2024 update said it would restrict credential-sharing access; Fidelity Access uses direct authorization / tokens. Plaid access exists publicly for some customers, but it is plan-gated and slower to enable.	Medium-high	
Charles Schwab	Brokerage / bank	No public API ID	Plaid	Finicity, MX	Schwab’s own API is OAuth-based; Plaid’s docs explicitly reference Schwab OAuth registration and unusually long enablement windows, which is strong evidence of a supported OAuth path.	Medium	
Vanguard	Brokerage	vanguard	Plaid	Finicity, MX	Plaid has a public Vanguard institution page with investment support. I did not find stronger public evidence favoring MX or Finicity.	Medium	
E*TRADE	Brokerage	e-trade-financial	Plaid	Finicity, MX	Plaid has a public E*TRADE institution page with investment and transaction coverage.	Medium-high	
Merrill	Brokerage / wealth	merrill-lynch	Plaid	Finicity, MX	Plaid has a public Merrill page, and Plaid’s Trial-plan OAuth list explicitly includes Merrill.	High	
Robinhood	Brokerage / crypto	No public API ID	Plaid	MX, Finicity	Robinhood and Plaid have a deep official partnership on account-linking / funding, and public directories indicate Robinhood is supported via Plaid in consumer account-linking contexts.	Medium	
TIAA	Retirement / brokerage	No public API ID	MX	Plaid, Finicity	Monarch’s official U.S. connection-status page says MX is the default provider for TIAA and that Plaid first connections are rarely successful.	Medium	
PayPal	Wallet	Underlying aggregator not disclosed	Unspecified	MX, Plaid	PayPal confirms it uses a third-party provider for instant bank linking, but public materials do not identify whether that path is Plaid, MX, or Finicity. Monarch user reports mention MX but also report instability.	Low	
Venmo	Wallet	Underlying aggregator not disclosed	Unspecified	Plaid, MX	Monarch officially supports Venmo, but community reports show Plaid failures and partial MX behavior. Public source quality is not strong enough to name a winner.	Low	
Coinbase	Crypto exchange / card	Underlying aggregator not disclosed	Unspecified	Manual choice; prefer direct if available	Coinbase officially documents a consent-based connection flow from finance apps for “Coinbase” / “Coinbase One Card,” but does not identify the aggregator. Public issue reports also show product-coverage gaps around staked holdings.	Low	

The practical pattern in this table is clear. For large U.S. retail banks and card issuers, the public evidence overwhelmingly points to Plaid as the default route. For Fidelity, the public evidence is strongest for Finicity. For TIAA, recent operational evidence favors MX. For several wallet / crypto institutions, the public mapping is too opaque to justify a hard-coded winner, so Moat Finance should treat them as institutions where UI guidance and empirical routing matter more than prior assumptions. 

Economics and cost control
Public pricing for consumer open-finance aggregation is incomplete. Plaid’s own pricing and billing documentation confirms that products can be billed as one-time, subscription, or per-request fees, and Plaid explicitly notes that Investments Holdings and Investments Transactions can each add subscriptions to an Item. MX and Mastercard / Finicity publicly market the products, but generally route serious pricing discussions through sales rather than publishing a clean retail rate card. 

For planning, the best honest position is to use an industry estimate, not pretend the prices are public truth. Public benchmarks and buyer reports cluster around roughly $0.30–$0.60 per active transaction-producing connection per month, with a public benchmark at $0.30 per institution per account holder per month and practitioner commentary often citing approximately $0.30 for linked-bank / transactions use cases. The real range can be higher once product add-ons, minimums, support tiers, growth-plan access, and bank pass-through data fees are included. JPMorgan’s move to charge aggregators for data access is an important warning that institution-specific access tolls can raise this baseline further. 

A good working formula is:

text
Copy
monthly_variable_cost
≈ active_live_connections
× subscription_rate_per_connection
× live_provider_copies
+ product_add_ons
+ institution-specific pass-through fees
For illustration, assume 10,000 users and 4 active institution connections per user on average. That is 40,000 live connections. Using a planning range of $0.30–$0.60 per live connection per month:

Strategy	Live provider copies per logical connection	Estimated billed connections	Estimated monthly variable cost
Single-home default	1.0x	40,000	$12,000–$24,000
Single-home + 10% temporary shadow / fallback population	1.1x	44,000	$13,200–$26,400
Dual-live redundancy for everyone	2.0x	80,000	$24,000–$48,000
Triple-live redundancy for everyone	3.0x	120,000	$36,000–$72,000

Those numbers are illustrative industry estimates, not quotes. But they are directionally good enough to answer the strategic question: yes, maintaining all three providers live for every connection is usually a bad unit-economics choice unless you are in a narrow, high-value workflow where redundancy is worth it. 

The core cost-control rules for Moat Finance should be simple. Keep one active syncing provider per connection. Do not create background shadow connections except for canaries, migrations, or high-value broken institutions. Slow the refresh cadence for stale or low-activity accounts. Avoid product subscriptions you do not need, especially investment-transaction add-ons. And negotiate institution-specific routing only where you have enough volume for pricing to matter. 

Architecture for Moat Finance
Moat Finance should implement an orchestration layer that sits above the three providers, not logic that is embedded inside each provider integration. The orchestration layer owns institution search, provider scoring, routing, connection health, and failover policy; provider adapters only translate the common contract into Plaid / MX / Finicity specifics. This is a natural fit because all three ecosystems expose institution search / connection constructs, and at least Plaid and Mastercard publicly document institution-health tooling while MX exposes institution listing and product status tooling. 

User in Moat Finance

Unified Institution Search

Canonical Institution Registry

Provider Scoring Engine

Recommended Provider

Advanced Provider Choice

Provider-specific Link Flow

Normalization Layer

Dedup & Reconciliation

Moat Finance Accounts / Transactions / Holdings

Health + Cost Telemetry

Institution Status Feeds



Show code
The minimum data model should include a canonical institution registry, a provider mapping table, a connection table, an account table, and a sync-attempt fact table. The important fields are:

Entity	Suggested fields
canonical_institution	canonicalInstitutionId, displayName, category, searchAliases, country, isWallet, isBrokerage, isCrypto, notes
institution_provider_mapping	canonicalInstitutionId, provider, providerInstitutionId, providerHandle, oauthSupported, supportedProducts, supportedAccountTypes, lastCatalogSyncAt
institution_preference	canonicalInstitutionId, productSet, primaryProvider, fallbackProviders[], confidence, reason, effectiveFrom, effectiveTo, manualOverrideAllowed
connection	connectionId, userId, canonicalInstitutionId, provider, providerItemId/memberId/customerId, authMethod, status, healthScore, lastSuccessAt, lastFailureAt, consecutiveFailures, requiresReauth, manualOverride, fallbackEligible
account	canonicalAccountId, connectionId, providerAccountId, type, subtype, officialName, mask, currency, ownerFingerprint, persistentAccountIdentifier, tokenizedAccountNumberFlag
sync_attempt	attemptId, connectionId, provider, trigger, startedAt, completedAt, result, normalizedError, providerError, latencyMs, accountsChanged, transactionsAdded, transactionsUpdated, transactionsRemoved, estimatedCostImpact

The connection UX should start with a unified institution search across the combined provider catalog. Return one result per canonical institution, not three duplicate rows. Show a badge such as “Recommended: Plaid” or “Recommended: Finicity” with a short rationale like “best recent success and OAuth support.” Add a subtle “Choose another provider” affordance for power users and support agents. This is consistent with how Monarch publicly describes its model: it suggests the best provider, but still lets users choose another provider when needed. 

The most important orchestration rule is about failover and consent. Do not assume cross-provider failover can happen silently. Consumer consent is often provider-specific. Bank of America’s public terms name Plaid specifically as the third party; Fidelity Access authorizes an integrated connection and token-based data share with a particular application path. In practice, switching from Plaid to MX or Finicity often means a new OAuth / consent journey, not an invisible backend swap. So the right product decision is usually automatic recommendation + one-tap re-link, not “automatic background failover.” Silent migration should only be used where contractual rights, institution behavior, and previous user consent clearly allow it. 

Yes

No

No

Yes

Scheduler / Webhook / User Refresh

Sync Worker

Provider Adapter

Normalize Payload

Deduplicate Accounts + Transactions

Update Health Score

Healthy?

Persist Data and Exit

Failover Eligible?

Prompt Reauth / Support Flow

Preselect Fallback Provider

One-tap Relink Flow



Show code
On sync cadence, avoid the temptation to “pull harder” as a substitute for good routing. Plaid’s own docs note that balances for regularly updating products typically update about once a day when the Item is healthy. That is a good reminder that cadence is constrained by institution-side realities. In Moat Finance, I would default to 6–12 hours for active depository / card accounts, 12–24 hours for investment holdings, and immediate webhook-driven refresh or user-initiated refresh where the provider supports it. Manual refresh should be rate-limited and should not create new paid subscriptions by accident. 

On telemetry, collect at least these metrics at the institution × provider × product × platform level: connection-start conversion, OAuth completion, time to first successful sync, 1-day / 7-day / 30-day survival, sync success rate, stale-data age, median update latency, re-auth frequency, support tickets per 1,000 live connections, manual-provider-override rate, and cost per healthy live connection. Plaid, Mastercard, and MX all publish enough status / dashboard surface area that Moat Finance should materialize a comparable internal health score. 

For deduplication, assume the same real-world account can appear under different provider account IDs. Plaid explicitly says linking the same account twice yields different item_id values, and it documents persistent-account behavior only for a small set of tokenized institutions such as Chase, PNC, and U.S. Bank. So the safe approach is a multi-feature account fingerprint: institution, masked account, normalized official / display name, account subtype, owner fingerprint, tokenized / persistent account ID when available, and limited routing / account-number suffixes where legally retained. Transactions should be deduped with a merge key built from account fingerprint + amount + date window + merchant canonicalization + pending/posting relationship. Overlap windows during failover should be short and explicit. 

Rollout and optimization
The operational plan should be staged. First, build the institution catalog and scoring framework without changing existing healthy connections. Second, route new connections only through the orchestrator. Third, add support tooling and one-tap fallback. Fourth, only then test institution-level preference changes on selected cohorts. This avoids forcing users through expensive and unnecessary reconnects while you are still learning where the public evidence diverges from your own traffic. 

A viable rollout plan looks like this:

Phase	Scope	Estimated duration	Main owners
Platform foundation	Canonical institution registry, provider adapters, health-score schema, sync-attempt telemetry	2–3 weeks	2 backend engineers
User-facing connect flow	Unified search, provider recommendation UI, advanced choose, support tooling	2–3 weeks	1 frontend + 1 backend
Sync orchestration	Failure classification, stale-data rules, one-tap fallback re-link, dedup overlap handling	3–4 weeks	2 backend engineers
Optimization	Canary routing, A/B tests, cost dashboards, institution matrix tuning	2–4 weeks	backend + data + PM

That is roughly a 9–14 week MVP-to-tuning timeline for a small focused team. My estimate would be 3 engineers full-time as the core staffing, plus 0.5 PM / designer and 0.5 data / analytics support. This is an estimate, not a sourced fact; it reflects the real complexity implied by provider-specific OAuth registration, health monitoring, connection normalization, and reconciliation. 

The experimentation strategy should be narrow and empirical. Do not A/B test providers for institutions with a clearly dominant official path, such as Chase, Bank of America, Wells Fargo, PNC, TD, Truist, Fidelity, or TIAA. Do test routing where the evidence is soft or where your user base is unusual—SoFi, USAA, Schwab, Robinhood, PayPal, Venmo, Coinbase. The primary decision metrics should be connect conversion, 30-day healthy survival, stale-data rate, user support burden, and cost per healthy ongoing connection. If the top two providers are within a narrow score band, prefer the cheaper one only if the reliability delta stays below a threshold you are willing to tolerate. 

Open questions and limitations
Several institution mappings are still not rigorous enough for a hard-coded long-term preference. The biggest gaps are PayPal, Venmo, Coinbase, and SoFi, where public consumer help pages and community reports confirm that connections exist, but public sources do not cleanly identify the underlying provider or provide trustworthy side-by-side health data across Plaid, MX, and Finicity. Those should be treated as telemetry-first routing problems inside Moat Finance rather than “solved by research.” 

Pricing is also materially incomplete in public. Plaid documents the billing model types, but not a universal public rate card for production-scale open-finance use. MX and Mastercard / Finicity are even more sales-led in public pricing. Bank access tolls, especially after JPMorgan’s 2025 negotiations, are a further source of variance. Any hard business case should therefore be recalculated against your actual contract language and institution mix before launch. 

The final practical implication is simple: Moat Finance should build for one active provider per connection, provider-specific consent, explicit fallback, and continuous learning. That design captures almost all of the coverage upside of a tri-aggregator strategy without paying the full reliability and cost penalty of tripling every live sync. 