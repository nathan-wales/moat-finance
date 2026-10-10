I compared the **Moat Finance insurance architecture plan** with the **Insurance safety steps** plan. The first document is strongest on **what data Moat Finance should store, how the insurance schema should work, ingestion, provenance, redaction, and MCP exposure**. The second document is strongest on **legal posture, HIPAA/GLBA/state privacy risk, field-level encryption, logging hygiene, admin access, vendor controls, AI safeguards, and phased compliance**.  

Here’s the combined plan I would use.

---

# Combined Legal + Safety Compliance Plan for Moat Finance

## Core posture

Moat Finance should not market itself as “HIPAA compliant,” “bank-level secure,” or “fully compliant” in a vague way.

Instead, Moat Finance should say internally:

> Moat Finance is a consumer financial and insurance intelligence product that stores highly sensitive personal, financial, insurance, and sometimes health-adjacent data. We will build with HIPAA-grade, GLBA-grade, and SOC 2-ready controls, even where those regimes are not technically triggered yet.

That gives you the right posture without accidentally making legal claims you cannot prove.

The guiding rule should be:

> Store only what improves financial understanding, coverage intelligence, renewal tracking, agent actionability, or user-requested recordkeeping. Do not store raw identifiers, full claims, medical records, credentials, or payment details unless a specific feature truly requires them.

---

# 1. What the two plans get right

## Plan 1: Moat Finance insurance architecture plan

This plan correctly says Moat Finance should use a **hybrid insurance data model**, not a single JSON blob and not dozens of unrelated tables. The best structure is:

* Shared `insurance_policies` table
* Type-specific detail tables
* Reusable `policy_coverages`
* `policy_documents`
* `policy_extractions`
* `policy_versions`
* `policy_access_scopes`
* JSONB only for carrier-specific long-tail fields

That is important for compliance because structured data makes it easier to redact, export, delete, permission, audit, and minimize access. It also correctly says Moat Finance should avoid storing SSNs, tax IDs, carrier passwords, payment-card numbers, full bank account numbers, full medical records, lab results, detailed diagnoses, and unredacted claim PDFs by default. 

## Plan 2: Insurance safety steps

This plan correctly treats Moat Finance as a **high-sensitivity product** even if HIPAA does not always formally apply. It also correctly emphasizes:

* HIPAA trigger analysis
* GLBA / FTC Safeguards analysis
* state insurance privacy/cybersecurity review
* privacy policy, terms, deletion/export flows
* written security program
* field-level encryption
* strict logging redaction
* admin access controls
* vendor review
* AI data minimization
* SOC 2 readiness before enterprise sales

It also makes the right distinction that **hashing is not encryption**. Passwords should be hashed. Policy numbers, member IDs, claims, documents, deductibles, premiums, and plan data need encryption if they must be shown back to the user. 

---

# 2. Combined legal classification

## A. Always required before launch

These are must-haves for Moat Finance even as a consumer-only app.

| Area                | Must-have                                                                                                                                                  |
| ------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Privacy disclosures | Privacy Policy that accurately explains financial, insurance, health-adjacent, AI, document, analytics, vendor, retention, deletion, and sharing practices |
| Terms               | Terms of Service with disclaimers that Moat Finance is not legal, tax, investment, medical, or insurance advice unless licensed                                     |
| Data rights         | Delete account, export data, delete individual policies, delete uploaded documents, disconnect institutions                                                |
| Security            | TLS, encryption at rest, secrets manager, MFA for admins, RBAC, no shared admin accounts                                                                   |
| Logging             | No sensitive data in logs, analytics, session replay, error monitoring, or support tools                                                                   |
| Vendor control      | Subprocessor list, vendor review, contracts with security/privacy terms                                                                                    |
| Incident response   | Written incident response and breach notification process                                                                                                  |
| Data minimization   | Do not store SSNs, carrier passwords, payment cards, full bank accounts, raw medical records, or claim PDFs by default                                     |
| AI disclosure       | User-facing disclosure of what AI can access and whether third-party AI providers receive data                                                             |
| MCP boundaries      | Narrow scopes, user consent, agent audit logs, no raw-document access by default                                                                           |

These are not all tied to one single law. They are a blended baseline for FTC unfair/deceptive practices risk, state privacy laws, GLBA risk, health-app risk, and ordinary negligence/security expectations.

---

## B. Conditionally required

These become must-haves depending on what Moat Finance does.

| Trigger                                                                                                                 | Additional must-haves                                                                                                                                                     |
| ----------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Moat Finance connects to banks, investments, or provides financial management/advice                                             | GLBA / FTC Safeguards analysis, written information security program, risk assessment, designated security owner, vendor oversight, encryption, monitoring, annual review |
| Moat Finance stores health insurance cards, SBCs, member IDs, EOBs, claims, provider info, or medication/diagnosis-adjacent data | Health-data risk assessment, FTC Health Breach Notification Rule analysis, stricter breach process, stronger minimization, no non-compliant vendors                       |
| Moat Finance sells to insurers, brokers, TPAs, employers, health plans, or providers                                             | HIPAA counsel review, BAA template, BAAs with customers/vendors, HIPAA policies, workforce training, HIPAA risk analysis                                                  |
| Moat Finance becomes licensed as an insurance producer/agency or helps quote/bind/sell insurance                                 | State insurance licensing review, state cybersecurity obligations, insurance privacy rules, regulator notification procedures                                             |
| Moat Finance uses AI vendors with health/insurance/financial data                                                                | AI vendor contract review, no-training terms, data retention terms, BAA if PHI is involved, prompt/output logging controls                                                |
| Moat Finance serves California or other privacy-law states at scale                                                              | State privacy rights workflows: access, deletion, correction, portability, opt-out of sale/share/targeted ads, sensitive data limitations                                 |
| Moat Finance serves EU/UK users                                                                                                  | GDPR/UK GDPR lawful basis, DPA, transfer mechanism, cookie consent, DSR workflows, possible representative/DPO analysis                                                   |
| Moat Finance supports families/dependents/minors                                                                                 | Children’s/minor data rules, stricter consent, parent/guardian access model, dependent deletion and export rules                                                          |

---

## C. Nice-to-have / trust-enhancing

These are valuable but not usually day-one legal requirements:

* SOC 2 Type I
* SOC 2 Type II
* ISO 27001
* HITRUST
* public trust center
* public status page
* bug bounty
* annual third-party penetration test
* independent accessibility audit
* customer-facing admin audit logs
* SAML/SCIM
* hardware security key support
* local-only AI mode
* client-side encryption with user-held keys

Some of these become “commercially mandatory” if you sell to enterprises, insurers, employers, or healthcare entities.

---

# 3. Product architecture decision

The safest product architecture is:

## Consumer cloud version

Use structured encrypted data with strict controls.

* Store normalized structured insurance fields
* Store uploaded docs encrypted
* Store OCR output encrypted
* Store extraction provenance
* Store confidence scores
* Store policy versions
* Store consent history
* Store document access logs
* Store MCP access logs

This version is usable and scalable, but Moat Finance can technically access user data if your backend decrypts it. That means higher breach and compliance exposure.

## Local desktop privacy version

This should be the premium privacy differentiator.

* SQLite database local to the user’s machine
* Optional local encryption key
* Optional app password / biometric unlock
* Local-only document storage
* Local LLM support where possible
* No cloud sync unless user opts in
* No server-side access to insurance documents
* No centralized breach exposure for local-only data

This does **not** eliminate all legal obligations, but it drastically reduces Moat Finance’s custody of sensitive data.

## Best long-term model

Offer three modes:

1. **Local-only Vault**

   * Fully local
   * No cloud sync
   * No Moat Finance server access
   * Best privacy

2. **Private Cloud Sync**

   * Encrypted server storage
   * Strong app security
   * Useful across web/mobile

3. **Enterprise / Regulated Mode**

   * SOC 2
   * HIPAA-ready
   * BAA support
   * advanced audit logs
   * SSO/SAML
   * vendor documentation

---

# 4. Data storage policy

## Store by default

These are core to Moat Finance’s value:

* insurer/payer name
* policy type
* policy status
* effective dates
* renewal date
* premium amount
* billing cadence
* deductible
* out-of-pocket max
* coverage limits
* covered assets
* covered people
* policy/member ID, encrypted
* document source
* extraction confidence
* source provenance
* last verified date
* computed summaries:

  * monthly insurance spend
  * annual insurance spend
  * upcoming renewals
  * deductible exposure
  * coverage gap flags
  * stale document flags

## Store only when needed

These should be feature-gated:

* VIN
* driver’s license number
* full address
* lienholder/mortgagee
* claim number
* claims summaries
* beneficiary percentages
* cash value
* provider names
* EOB summaries
* dependent details
* full uploaded insurance cards
* full policy PDFs
* life/disability policy documents

## Do not store by default

These should be blocked, redacted, or require explicit override:

* SSNs
* tax IDs
* carrier passwords
* full payment cards
* full bank account/routing numbers
* medical records
* lab results
* diagnoses
* medications
* procedure codes
* raw EOB PDFs
* raw claims documents
* screenshots containing unrelated sensitive data
* unredacted OCR text with unnecessary identifiers

---

# 5. Database and schema plan

Use the hybrid model from the first plan, but apply the security model from the second plan.

## Core tables

* `insurance_policies`
* `policy_parties`
* `policy_assets`
* `policy_coverages`
* `policy_documents`
* `policy_extractions`
* `policy_versions`
* `policy_access_scopes`
* `policy_consents`
* `policy_audit_events`
* `policy_sensitive_fields`
* `policy_redaction_events`

## Type-specific tables

* `auto_policy_details`
* `health_policy_details`
* `dental_policy_details`
* `vision_policy_details`
* `life_policy_details`
* `disability_policy_details`
* `property_policy_details`
* `ltc_policy_details`

## Security metadata every sensitive object should have

For each policy, document, extraction, and field:

* owner user ID
* source
* sensitivity level
* encryption status
* retention category
* legal basis / consent source
* source document ID
* extraction confidence
* last accessed by user
* last accessed by admin
* last accessed by agent
* deletion eligibility
* sharing status
* MCP scope required

---

# 6. Encryption policy

## Passwords

Use:

* Argon2id preferred
* bcrypt acceptable

Never encrypt passwords. Never store plaintext passwords.

## Normal sensitive fields

Encrypt at the application layer:

* policy number
* member ID
* group ID
* claim number
* beneficiary names
* dependent names
* date of birth
* address
* phone number
* driver’s license
* VIN if linked to user identity
* health plan identifiers
* life/disability details

## Uploaded documents

Use:

* encrypted object storage
* private buckets
* signed URLs only
* short-lived download links
* per-document access audit logs
* virus scanning
* file type/size limits
* optional client-side encryption for local/private mode

## Search

Avoid plaintext search indexes over sensitive fields.

Use:

* non-sensitive metadata search
* encrypted field display only
* keyed hashes for exact-match lookup where needed
* no full-text indexing of OCR output unless heavily redacted and justified

---

# 7. Document ingestion plan

The combined plan should be:

## Step 1: quarantine

Every uploaded document starts in quarantine.

* virus scan
* file type validation
* size validation
* object storage encryption
* no public URLs
* no analytics/session replay
* no support visibility

## Step 2: extract

Run OCR/document parsing.

* extract text
* identify tables
* detect key-value fields
* classify sensitivity
* detect likely SSNs, account numbers, card numbers, diagnoses, medications, provider names

## Step 3: redact

Before saving extracted text broadly:

* remove forbidden identifiers
* mask unnecessary sensitive fields
* separate raw OCR from normalized fields
* store raw OCR only if explicitly needed
* prefer redacted derivative over raw document

## Step 4: normalize

Use strict schema extraction.

* policy type
* insurer
* coverage dates
* premium
* deductible
* limits
* covered assets/people
* confidence score
* source page/field provenance

## Step 5: review

User confirms before final commit.

* show extracted fields
* highlight low-confidence fields
* ask only missing questions
* allow field deletion
* final “check answers” step

## Step 6: persist

Only after user confirmation:

* save normalized data
* save provenance
* save redacted document preview
* save original only if user chooses or feature requires it

---

# 8. MCP and AI safety plan

This is one of the highest-risk areas because agents can exfiltrate data accidentally.

## MCP scopes

Do not give an agent broad database access.

Use narrow scopes:

* `insurance.read.summary`
* `insurance.read.coverages`
* `insurance.read.renewals`
* `insurance.read.spend`
* `insurance.read.gaps`
* `insurance.read.documents.redacted`
* `insurance.read.documents.raw`
* `insurance.write.draft`
* `insurance.write.user_confirmed`
* `insurance.delete.user_confirmed`

Raw document access should be a separate permission and should require explicit user approval.

## AI data rules

Default:

* no training on user data
* no full-profile sending by default
* no raw documents unless required
* no PHI/financial data to vendors without proper contract review
* prompt/output logs disabled or redacted
* agent actions logged
* destructive actions require confirmation

## Agent action levels

| Action                         | Requirement                                |
| ------------------------------ | ------------------------------------------ |
| Read summary                   | Allowed with standard insurance read scope |
| Read coverage details          | Allowed with coverage scope                |
| Read redacted document preview | Separate redacted-doc scope                |
| Read raw document              | Step-up consent                            |
| Update a policy                | User confirmation                          |
| Delete policy/document         | Re-authentication + confirmation           |
| Export profile                 | MFA or re-authentication                   |
| Share report publicly          | Explicit share warning                     |
| Send data to third party       | Explicit consent                           |

## Prompt injection defense

Uploaded documents should be treated as untrusted input.

Add:

* document-instruction stripping
* tool-call allowlists
* output validation
* source citations/provenance in agent answers
* no hidden instructions from PDFs/cards/images
* user confirmation before external actions

---

# 9. Admin and support access

This should be extremely locked down.

## Default support view

Support should see:

* user email
* account status
* billing status
* sync status
* error category
* last successful connection
* non-sensitive metadata

Support should **not** see:

* policy numbers
* member IDs
* claim numbers
* uploaded documents
* OCR text
* beneficiaries
* dependents
* health details
* life/disability details
* bank/investment balances unless necessary

## Sensitive reveal flow

If support/admin must see sensitive data:

* require reason code
* require approval for very sensitive fields
* time-limited access
* show masked by default
* log every reveal
* alert on unusual access
* no bulk export
* no casual impersonation
* break-glass only for emergencies

---

# 10. Logging, analytics, and monitoring

This is where Moat Finance could accidentally create huge liability.

## Never log

* policy numbers
* member IDs
* SSNs
* claim numbers
* uploaded document content
* OCR text
* beneficiary names
* dependent names
* provider/diagnosis/medication details
* access tokens
* refresh tokens
* API responses from aggregators
* full request bodies from sensitive routes
* full prompt payloads
* raw model outputs containing sensitive data

## Disable or heavily restrict

* session replay on insurance/finance pages
* analytics on document upload/review pages
* support chat on pages where users may paste PHI/financial data
* error monitoring request-body capture
* browser breadcrumbs containing form data

## Required monitoring

* failed login attempts
* suspicious admin access
* mass export attempts
* unusual document access
* token refresh anomalies
* MCP tool abuse
* new device login
* password reset abuse
* webhook failures
* sync-provider errors

---

# 11. Vendor and subprocessor plan

Create a vendor matrix before launch.

## Vendor categories

* cloud hosting
* database
* object storage
* authentication
* payment processor
* email
* SMS
* analytics
* error monitoring
* logging
* OCR/document AI
* AI model provider
* support/chat
* data warehouse
* financial data aggregator
* insurance data aggregator

## For each vendor, track

* data they receive
* whether they receive sensitive data
* whether they receive PHI
* whether they support BAA
* whether they train on data
* retention period
* subprocessor list
* breach notification SLA
* security certifications
* deletion capabilities
* data residency
* contract owner

## Hard rule

Do not send health/insurance/financial payloads into analytics, support, logs, OCR, AI, or warehouse tools unless you have reviewed the vendor and signed the correct agreement.

---

# 12. Legal documents and policies

## Public docs

Before real launch:

* Privacy Policy
* Terms of Service
* Cookie Policy
* State Privacy Rights Notice
* Data Deletion Policy
* Data Retention Summary
* Subprocessor List
* Security Overview
* AI Data Use Disclosure
* Vulnerability Disclosure Policy
* Support / Privacy Contact

## Internal policies

Before storing sensitive production data:

* Written Information Security Program
* Data Classification Policy
* Access Control Policy
* Encryption and Key Management Policy
* Secure SDLC Policy
* Logging and Monitoring Policy
* Vendor Risk Management Policy
* Incident Response Policy
* Breach Notification Procedure
* Data Retention and Deletion Policy
* Employee Onboarding/Offboarding Policy
* Acceptable Use Policy
* AI Data Handling Policy
* Production Access Policy

## Conditional docs

When needed:

* DPA
* BAA template
* HIPAA policies
* HIPAA training materials
* HIPAA risk analysis
* GLBA Safeguards assessment
* state insurance regulatory memo
* SOC 2 controls matrix
* enterprise security whitepaper
* pen test report under NDA

---

# 13. Compliance roadmap

## Phase 0: before building more insurance features

Goal: avoid painting yourself into a compliance corner.

Build:

* data classification system
* sensitivity enum on fields/documents
* policy schema spine
* field-level encryption architecture
* consent model
* audit event model
* deletion model
* MCP scope model
* local/private mode architecture decision

Decide:

* Are claims/EOBs in scope?
* Are diagnoses/medications out of scope?
* Will Moat Finance ever sell insurance?
* Will Moat Finance sell to employers/insurers?
* Will Moat Finance sign BAAs?
* Will cloud Moat Finance be able to decrypt data?
* Will local desktop be the privacy-premium version?

---

## Phase 1: consumer app, lowest compliance burden

Goal: launch safely without triggering heavier healthcare/insurance obligations.

Allowed:

* manual insurance entry
* upload declarations pages/cards with redaction
* no claims ingestion
* no diagnosis/medication/provider storage
* no insurer integrations yet
* no employer/insurer customers
* no insurance quoting/binding/selling
* AI only on normalized summaries unless user approves more

Must-have:

* Privacy Policy
* Terms
* deletion/export
* field-level encryption for sensitive fields
* encrypted documents
* admin MFA
* RBAC
* audit logs
* logging redaction
* vendor review
* incident response
* basic trust page
* no sensitive data in analytics/session replay

---

## Phase 2: cloud sync + document intelligence

Goal: support richer insurance profiles safely.

Add:

* document quarantine
* OCR redaction
* extraction confidence
* source provenance
* per-document deletion
* per-document access logs
* re-auth before export
* MFA option for users
* consent history
* stricter AI controls
* vendor contracts for OCR/AI/logging/support
* SOC 2 readiness

Security:

* encrypted object storage
* private buckets
* signed URLs
* DLP scanning
* backup retention rules
* production access approval
* vulnerability scanning
* dependency scanning
* pen test before broad launch

---

## Phase 3: financial/insurance integrations

Goal: handle connected accounts and external data providers.

Add:

* explicit connection consent
* show what data is accessed
* show sync frequency
* disconnect and token revoke
* OAuth token encryption
* provider API response redaction
* no raw provider responses in logs
* per-provider data retention rules
* GLBA / Safeguards legal review
* written information security program
* designated security owner
* annual risk assessment
* vendor oversight process

For insurance connectors:

* treat P&C, health, dental, benefits, and employer data differently
* health integrations require extra legal review
* do not ingest full claims/EOBs by default
* write all connectors into the same canonical schema

---

## Phase 4: healthcare integrations or B2B

Goal: be ready if Moat Finance sells to regulated customers or handles PHI on behalf of others.

Add:

* HIPAA counsel review
* BAA template
* BAAs with covered entity customers
* BAAs with subcontractors touching PHI
* HIPAA risk analysis
* HIPAA policies
* HIPAA workforce training
* minimum necessary policy
* sanction policy
* emergency access procedure
* automatic logoff
* access logs
* audit controls
* breach notification process
* SOC 2 Type I

Avoid launching this phase until you are ready to operate like a real regulated vendor.

---

## Phase 5: enterprise insurance/healthcare sales

Goal: pass procurement.

Add:

* SOC 2 Type II
* SSO/SAML
* SCIM
* enterprise admin roles
* customer-visible audit logs
* security questionnaire packet
* annual pen test
* formal vendor risk program
* formal incident tabletop exercises
* cyber insurance
* trust center
* DPA/BAA workflow
* state insurance counsel review
* HITRUST only if customers demand it

---

# 14. Must-not-do list

Moat Finance should not:

* store SSNs by default
* store carrier passwords
* store full bank account/payment details for premium autopay
* store raw EOBs/claims/medical records by default
* put sensitive data in logs
* use session replay on sensitive pages
* send health/insurance data to analytics tools
* let support casually view user data
* use production data in dev
* email full policy or health details
* expose public object URLs
* allow broad MCP read access
* silently send full profiles to third-party AI models
* claim “HIPAA certified”
* claim “bank-level security” without evidence
* sell to health insurers before BAA/HIPAA readiness
* sell/quote/bind insurance without state insurance licensing review

---

# 15. Recommended final operating model

The cleanest combined plan is:

## Product

* Hybrid insurance schema
* Upload-first, review-second workflow
* Manual wizard fallback
* API connectors only where mature
* Claims/EOBs out of scope by default
* Local-only premium privacy option
* Cloud sync option with strong encryption
* MCP exposed through narrow scopes

## Legal

* Privacy/terms/trust docs before launch
* HIPAA/GLBA/state insurance analysis before integrations
* BAA readiness before healthcare/B2B
* state insurance review before quoting/selling/binding
* state privacy rights workflows from day one
* incident/breach process from day one

## Security

* field-level encryption
* encrypted docs
* strict logging redaction
* RBAC
* MFA for admins
* user MFA support
* audit logs
* no production data in dev
* vendor review
* admin reveal controls
* vulnerability scanning
* pen test before broad launch

## AI/MCP

* no training on user data
* data minimization
* user-visible consent
* raw-doc access requires separate permission
* agent actions logged
* destructive actions confirmed
* prompt injection defenses
* third-party AI vendor review

---

# My recommended build order

1. **Data classification + schema**
2. **Field-level encryption**
3. **Deletion/export**
4. **Privacy Policy + Terms + Subprocessor List**
5. **Audit logs**
6. **Admin masking/reveal controls**
7. **Document quarantine + redaction**
8. **MCP scopes**
9. **AI consent and no-training controls**
10. **Incident response + vendor review**
11. **SOC 2 readiness**
12. **GLBA/HIPAA/state insurance attorney review before integrations/B2B**

That sequence gives you a product that can launch without pretending to be an enterprise compliance shop on day one, while still avoiding the nightmare of rebuilding the entire privacy/security model later.
