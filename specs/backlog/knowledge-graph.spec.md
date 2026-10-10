# Spec: Financial Knowledge Graph

## Goal

Build the canonical financial knowledge graph for Moat Finance so we become the best financial data layer for agents: the best ontology, fastest agent-safe queries, clearest relationship model, and strongest provenance story in personal finance.

This is not "add a graph database." This is about making Moat Finance's financial memory model explicit, queryable, temporal, and trustworthy.

## Why

Moat Finance's mission already points at a continuously updated financial graph, and the desktop roadmap already calls out a financial context ontology for agents. The missing piece is a deliberate spec for how the graph should work across our existing data model.

If Moat Finance is going to be the financial memory infrastructure for agents, the moat is not the chat UI or the model provider. The moat is:

- canonical financial ontology
- deterministic, fast query paths
- explicit and documented relationships
- temporal consistency
- provenance and explainability
- memory that improves over time without rewriting history

For this problem, "knowledge graph" does not imply "move to Neo4j." The better architecture for Moat Finance is likely:

```txt
relational core + graph semantics + event sourcing + embeddings
```

That matches our current stack and avoids creating a second system of truth.

## What exists today

The current Prisma schema in `apps/api/prisma/schema.prisma` already contains most of the raw ingredients for a strong graph, but the semantics are spread across many models and some important concepts are still implicit.

### Existing graph-worthy domains in the schema

| Domain | Current models |
|---|---|
| Identity and access | `User`, `HouseholdMembership`, `HouseholdInvite`, auth/session models |
| Financial accounts and connectivity | `PlaidItem`, `PlaidAccount`, `Transaction`, `BalanceSnapshot` |
| Spending and classification | `Category`, `CategoryBudget`, `Hashtag`, `TransactionRule`, `TransactionRuleCondition`, `TransactionRuleAction`, `TransactionRuleApplication` |
| Assets and planning | `Investment`, `RealEstateInvestment`, `ForecastScenario` |
| Richer profile context | `FinancialProfileData` |
| Retail purchase enrichment | `RetailConnection`, `RetailOrder`, `RetailOrderItem` |
| Agent activity and tool audit | `AgentConversation`, `AgentMessage`, `AgentRun`, `AgentToolCall`, `AgentTimelineBlock`, `AgentWidgetAction`, `McpToolCall` |

### Key gaps in the current schema

- Important concepts are still buried in JSON blobs, especially in `FinancialProfileData` (`assets`, `liabilities`, `insurancePolicies`, `taxProfile`, `planningNotes`).
- Relationships are mostly foreign keys, which is fine for application code but weak for agent-facing semantic traversal.
- Merchants and institutions are not modeled as canonical entities. They mostly exist as strings or provider-specific records.
- There is no first-class memory model for "financial facts the agent should remember" or "user preferences / concerns / recurring behaviors."
- There is no explicit provenance model for inferred relationships, corrections, or agent-generated conclusions.
- There is no append-only event layer that lets us reconstruct how financial state evolved over time.
- There is no shared ontology package or relationship taxonomy that cloud and desktop can both rely on.

## What we are building

We should build a financial knowledge graph as a semantic layer on top of the existing relational system, not as a replacement for it.

### Core thesis

- Postgres remains the source of truth for hosted Moat Finance.
- Existing domain tables remain the canonical write path for operational data.
- The knowledge graph is a projection and enrichment layer that makes relationships explicit for agents and future intelligence features.
- Desktop SQLite should eventually reuse the same ontology contracts and project the same relationship types locally.

### Design principles

1. **Ontology first.** The hard problem is defining the entities and relationships clearly, not picking graph storage.
2. **Relational truth first.** Do not collapse the app into a generic node-edge blob.
3. **Time-aware by default.** Financial facts and relationships must support validity windows and history.
4. **Provenance by default.** Every inferred or normalized fact should explain where it came from.
5. **Append-only where truth matters.** Corrections and inferences should become events, not silent rewrites.
6. **Agent-safe query layer.** Tools should return structured, documented facts rather than raw table dumps.
7. **Cross-surface compatibility.** The ontology should work across web, API, MCP, and local desktop.

### Query model

The graph should behave like a precomputed intelligence layer, not a runtime reasoning detour.

We should avoid this query path:

```txt
agent -> MCP tool -> raw rows -> build relationships on demand -> reason -> answer
```

We should prefer this model:

```txt
ingestion/sync time
  raw data -> normalization -> entity resolution -> relationship projection -> summary updates

query time
  MCP tool -> indexed retrieval -> bounded graph expansion when needed -> optional semantic retrieval -> structured answer
```

The important rule is that the ontology should shape the read models and tool outputs, but ordinary tool calls should not need to rebuild the graph on demand.

## Proposed ontology

The ontology should start with concepts we already have in the schema, then grow into concepts currently stored as strings, JSON, or implied relationships.

### Canonical entity classes

| Entity class | Current source in schema | Why it matters |
|---|---|---|
| Person | `User` | Root identity and ownership boundary |
| Household | `HouseholdMembership`, `HouseholdInvite` | Shared context for multiple people and agents |
| Institution | `PlaidItem.institutionId`, `PlaidItem.institutionName` | Needed for connectivity, account grouping, and trust |
| Account | `PlaidAccount`, parts of `FinancialProfileData.accounts` | Core financial container |
| Transaction | `Transaction` | Ledger-level event and spending/income unit |
| Category | `Category` | User-defined semantic classification |
| Budget | `CategoryBudget` | Planning relationship between user, category, and target |
| Merchant | `Transaction.merchantName`, retail order data | Needed for normalization, recurring behavior, and spend intelligence |
| Rule | `TransactionRule` and related models | Encodes user intent and machine-applicable semantics |
| Hashtag / label | `Hashtag` | Lightweight user semantic tagging |
| Asset | `Investment`, `RealEstateInvestment`, parts of `FinancialProfileData.assets` | Net worth and planning graph |
| Liability | `RealEstateInvestment.currentLoanBalance`, parts of `FinancialProfileData.liabilities` | Debt graph and planning context |
| Balance state | `BalanceSnapshot` | Temporal financial state |
| Retail order | `RetailOrder`, `RetailOrderItem` | Purchase-level enrichment beyond bank feeds |
| Financial profile fact | `FinancialProfileData` | Source for normalized profile entities we do not model yet |
| Goal | Not yet modeled | Important future planning node |
| Financial event | Not yet modeled | Job changes, moves, large purchases, life events |
| Financial memory | Not yet modeled | Persistent agent context and user-specific observations |

### First relationship types to support

| Relationship | Example |
|---|---|
| `OWNS_ACCOUNT` | person -> account |
| `MEMBER_OF_HOUSEHOLD` | person -> household |
| `CONNECTED_TO_INSTITUTION` | account -> institution |
| `POSTED_TO_ACCOUNT` | transaction -> account |
| `BELONGS_TO_CATEGORY` | transaction -> category |
| `MATCHES_MERCHANT` | transaction -> merchant |
| `TRIGGERED_BY_RULE` | transaction -> rule |
| `TAGGED_WITH` | transaction -> hashtag |
| `FUNDS_BUDGET` / `GOVERNS_SPEND_IN` | budget -> category |
| `PART_OF_ORDER` | retail order item -> retail order |
| `ENRICHES_TRANSACTION` | retail order -> transaction |
| `HAS_BALANCE_SNAPSHOT` | account or asset -> balance state |
| `HOLDS_ASSET` | person or household -> asset |
| `OWES_LIABILITY` | person or household -> liability |
| `INFLUENCES_GOAL` | account, asset, liability, budget, or recurring expense -> goal |
| `DERIVED_FROM` | inferred entity/edge -> source row or event |
| `ASSERTED_BY_AGENT` | memory or inference -> agent run |

These relationship types should be versioned and documented, not ad hoc strings scattered through tool handlers.

## How it should be built

### 1. Keep the relational core

Do not replace the current domain tables with a graph database or a generic entity-attribute-value design.

The current operational schema is already valuable:

- `Transaction` is the transactional core
- `PlaidAccount` and `PlaidItem` are the connectivity/account core
- `Category`, `CategoryBudget`, and rules are the semantic classification core
- investments, real estate, and balance snapshots already provide asset-state data
- agent tables already give us audit and runtime provenance anchors

The graph layer should sit on top of these tables.

### 2. Add graph projection tables

We should introduce explicit graph tables in Postgres that project and enrich the operational schema.

Suggested starting shape:

#### `financial_entity`

Represents a canonical entity that agents can reason about.

Suggested fields:

- `id`
- `userId`
- `householdId?`
- `entityType`
- `canonicalName`
- `displayName?`
- `status`
- `sourceModel?`
- `sourceId?`
- `attributesJson`
- `validFrom?`
- `validTo?`
- `createdAt`
- `updatedAt`

#### `financial_relationship`

Represents an explicit, queryable relationship between entities.

Suggested fields:

- `id`
- `userId`
- `householdId?`
- `sourceEntityId`
- `targetEntityId`
- `relationshipType`
- `confidence`
- `isInferred`
- `validFrom?`
- `validTo?`
- `provenanceType`
- `provenanceRef`
- `metadataJson`
- `createdAt`

#### `financial_entity_alias`

Maps messy source labels to canonical entities.

Examples:

- `"AMZN Mktp US"` -> canonical merchant `Amazon`
- provider account labels -> canonical account identifiers
- institution display variants -> canonical institution entity

Entity resolution should be treated as a first-class subsystem, not as cleanup work hidden inside imports. For v1, the highest-leverage targets are:

- merchant canonicalization
- institution canonicalization
- account identity normalization across provider-shaped records
- extraction of profile concepts from `FinancialProfileData`

#### `financial_fact_event`

Append-only event log for material changes and derived knowledge.

Examples:

- Plaid sync imported transaction
- user re-categorized transaction
- merchant normalization merged aliases
- recurring expense was inferred
- agent created a memory
- user corrected or dismissed an inference

#### `financial_memory`

Persistent, agent-facing memory objects tied to entities, relationships, or events.

Examples:

- user prefers conservative risk
- user worries about debt
- spending spikes every July
- merchant group should be treated as groceries

Memory should be typed, versioned, and reviewable. It should not be a freeform dump of chat logs.

### 3. Make provenance a first-class feature

Every important inferred fact should be able to answer:

- What source rows or events support this?
- Was this user-confirmed, system-derived, or agent-inferred?
- When did it become valid?
- When was it superseded?
- How confident are we?

This matters more than graph traversal. Agents need trustworthy context, not opaque magic.

### 4. Add event-sourced semantics where they matter

Financial systems are temporal. We should not rely on mutable current-state rows alone for agent reasoning.

The long-term model should support:

- raw imports as immutable source events
- user edits as separate correction events
- rule applications as derived events
- merchant normalization as versioned decisions
- agent inferences and memories as explicit events with provenance

This does not require rewriting the whole app into full event sourcing on day one. It means new graph-relevant behavior should prefer append-only event records over silent mutation when possible.

### 5. Add embeddings inside Postgres, not a separate vector system first

When we reach semantic memory and retrieval, start with `pgvector` in Postgres.

Candidate embedding targets:

- normalized merchant descriptions
- transaction clusters or summaries
- financial memories
- conversation abstractions
- planning notes from `FinancialProfileData`

That gives us semantic retrieval without introducing a separate infrastructure tier too early.

### 6. Build agent-facing read models on top of the graph

The graph should not force every agent query to traverse raw node and edge tables directly.

We should expose curated, fast read paths for common jobs:

- account neighborhood summary
- merchant spend rollups
- recurring expense detection
- monthly cash flow graph
- liability and asset network
- budget pressure graph
- goal funding graph
- memory search and retrieval

Use the graph tables as canonical semantics, then materialize or project the hot paths that matter most.

We should make the query path explicit:

- Step 1: deterministic retrieval from indexed tables, projections, or materialized summaries
- Step 2: bounded graph expansion only when the tool needs adjacent context
- Step 3: optional semantic retrieval only for memory/search use cases
- Step 4: LLM or agent reasoning over already-compressed structured context

Guardrails:

- v1 tools should avoid arbitrary graph traversal
- default runtime expansion should be capped to one hop
- two-hop expansion should be rare and tool-specific
- anything deeper should be served from a precomputed read model, not discovered live by the agent

### 7. Define freshness semantics for graph-backed answers

If the graph is an intelligence cache, every graph-backed tool needs explicit freshness semantics.

At a minimum, graph-backed responses should be able to expose metadata like:

- `generatedAt`
- `basedOnDataThrough`
- `freshnessStatus`
- `confidence`
- `sourceCount`

The system should define how projections are maintained:

- sync-time updates
- event-driven updates after writes or imports
- scheduled repair or backfill jobs

We should prefer returning a slightly stale but clearly-labeled structured answer over returning apparently precise data with hidden staleness.

### 8. Design MCP tools in tiers

We should keep primitive tools for fallback, debugging, and power-user workflows, but agent-default tools should move toward graph-native summaries.

#### Primitive tools

Examples:

- `get_transactions`
- `get_accounts`
- `search_transactions`

These are still useful, but they should not be the only way an agent understands a user's finances.

#### Graph-native tools

Examples:

- `get_financial_state_snapshot`
- `get_subscription_graph`
- `get_liability_pressure_summary`
- `get_goal_funding_status`
- `get_financial_memories`

These tools should return compact, provenance-backed answers that reduce repeated tool-calling and reduce raw-row reasoning inside the model.

## Current schema implications

The current schema strongly suggests the first graph wins should come from normalization, not from adding entirely new surfaces.

### Highest-leverage existing models to graph first

#### `Transaction`

This is the center of the current financial graph. It already links to:

- user
- category
- plaid account
- plaid item
- applied rule
- hashtags
- source metadata
- raw payloads

This should become the richest connected entity in v1.

#### `PlaidAccount` and `PlaidItem`

These provide the account and institution graph backbone, but today the institution layer is still provider-shaped. We should normalize institution identity and account identity above Plaid-specific records.

#### `Category`, `CategoryBudget`, and rules

These already represent user semantics. The graph should capture them as explicit meaning, not just app features.

#### `FinancialProfileData`

This is the biggest ontology opportunity and one of the biggest schema smells for agent use. It contains valuable concepts that agents will care about, but many of them live inside JSON instead of first-class relational models.

That makes `FinancialProfileData` the right source for phased extraction into:

- liabilities
- insurance policies
- income sources
- tax entities
- planning assumptions
- planning notes and durable memory candidates

#### Agent and MCP audit models

`AgentRun`, `AgentToolCall`, `AgentMessage`, and `McpToolCall` are useful provenance anchors. They let us answer not just "what is true?" but also "what did the agent see, infer, or act on?"

## Non-goals

This spec does not propose:

- replacing Postgres with Neo4j
- replacing every domain table with generic graph tables
- exposing raw SQL or unrestricted graph traversal to agents
- storing all memory as unstructured chat transcripts
- shipping a full memory/search system before ontology and provenance exist

## Proposed implementation phases

### Phase 0 — Ontology and contracts

- Define canonical entity types
- Define canonical relationship types
- Define provenance types and confidence semantics
- Define query-time versus ingestion-time responsibilities
- Define graph-backed response metadata standards
- Decide package location for shared ontology code and docs, likely a future `packages/financial-graph`

### Phase 1 — Entity resolution and graph projection over existing relational models

- Create `financial_entity`, `financial_relationship`, and alias tables
- Define merchant, institution, and account identity resolution rules
- Project core entities from existing schema:
  - person
  - household
  - institution
  - account
  - transaction
  - category
  - budget
  - rule
  - merchant
- Build deterministic loaders/projectors from current Postgres tables

### Phase 2 — Provenance, freshness, and event layer

- Add append-only `financial_fact_event`
- Record normalization and inference provenance
- Capture user corrections and rule applications as explicit graph events where practical
- Define projection refresh strategy and stale-data behavior for graph-backed responses

### Phase 3 — Extract structured profile entities

- Normalize high-value concepts out of `FinancialProfileData`
- Introduce first-class entities for liabilities, income sources, insurance policies, and tax profile concepts
- Connect them to assets, goals, households, and planning flows

### Phase 4 — Financial memory layer

- Add `financial_memory`
- Define memory types:
  - user preference
  - concern
  - recurring pattern
  - planning assumption
  - major life event
- Add review, expiration, and supersession semantics

### Phase 5 — Embeddings and semantic retrieval

- Add `pgvector`
- Embed memories, merchant summaries, and selected transaction abstractions
- Support hybrid retrieval: deterministic filters plus semantic similarity

### Phase 6 — Shared agent surface

- Expose graph-backed read tools through MCP and API contracts
- Reuse the same ontology definitions for hosted Postgres and local desktop SQLite projections where possible
- Make "agent-safe structured context" the default output mode
- Prefer graph-native summary tools for agent workflows while retaining primitive tools as fallback paths

## Query standards we should optimize for

The graph should make it easy to answer questions like:

- What are this user's core accounts, institutions, and recurring expenses?
- Which merchants are driving category overspend?
- Which liabilities and recurring obligations threaten this goal?
- What changed in this user's finances in the last 30 days?
- Which transactions, memories, and profile facts support this recommendation?
- What does the agent know about this user's risk tolerance, tax pressure, or planning priorities?

The right answer is not "let the model infer it from raw transactions." The right answer is to return structured, provenance-backed context.

## Success criteria

- A documented ontology exists for core financial entities and relationships.
- Core agent questions can be answered from structured graph projections, not raw table dumps.
- Important facts can explain source, confidence, and validity window.
- Graph-backed responses expose freshness metadata and do not hide projection staleness.
- Merchant and institution identity are normalized enough to support reliable rollups and memory.
- `FinancialProfileData` is no longer the only home for high-value planning concepts.
- The architecture works with our current Postgres + Prisma stack and does not require a second source of truth.
- The same ontology can be projected into local desktop storage later.

## Open questions

- Should household become a first-class table instead of being inferred from membership models?
- Should merchant normalization be its own first-class subsystem before the general graph projection lands?
- Which entities deserve dedicated operational tables versus staying graph-projection-only?
- How much of event sourcing should be retrofitted to existing flows versus introduced only for new graph work?
- What is the right package boundary for shared ontology code and docs across API, MCP, and desktop?
- When do goals become first-class enough to include in the initial graph rather than a later phase?
- Which graph-native MCP tools should become the default agent entry points first?
