# Analytics Event Catalog

**Status:** Active  
**Owner:** Moat Finance engineering  
**Last reviewed:** August 31, 2026  
**Related:** `apps/web/src/lib/analytics.ts`, `apps/mcp/src/lib/analytics.ts`

---

## Rules

All product analytics events must go through an approved analytics wrapper:

| Surface | Wrapper |
|---------|---------|
| Web | `apps/web/src/lib/analytics.ts` |
| MCP server | `apps/mcp/src/lib/analytics.ts` |
| Desktop | `apps/desktop/src/renderer/src/lib/analytics.ts` |
| iOS | `apps/ios/Moat/Core/Analytics/Analytics.swift` |

Allowed event properties are limited to counts, booleans, enums, feature names, and non-sensitive IDs. Events must include exactly one identity shape: `{ userId }` or `{ demoUser: true }`.

Identify signed-in users with distinct ID = `userId` and optional person property `email`. Never use email as the distinct ID. Never send `name`.

Never send email, name, merchant names, account masks, transaction descriptions, account numbers, routing numbers, tokens, secrets, passwords, prompts, raw user messages, raw tool I/O, or raw financial values **on capture events**. Email is allowed only as an identify person property.

`scripts/check-analytics-usage.mjs` fails CI if product code calls PostHog capture/identify directly outside approved wrappers.

Session recordings, autocapture, heatmaps, rageclicks, dead clicks, and surveys stay off in SDK init (`apps/web/src/lib/posthog.ts`, `apps/desktop/src/renderer/src/lib/posthog.ts`, iOS `Analytics.swift`). Product analytics is named events and manual `$pageview` only.

Shared UI in `@moat/features` emits via optional `onCapture` — hosts wire PostHog. Do not import PostHog inside shared packages.

---

## Events

### Page / identity

| Event | Owner | Purpose | Allowed Properties |
|-------|-------|---------|--------------------|
| `$identify` | Web / iOS | Associate distinct ID (`userId`) with account email as a person property | person property `email` only; never `name` |
| `$pageview` | Web / Desktop / iOS | Route or screen view | `path` or `screen` (sanitized); identity |

### Onboarding / experience

| Event | Owner | Purpose | Allowed Properties |
|-------|-------|---------|--------------------|
| `onboarding_experience_viewed` | Web | Choose experience page | identity |
| `onboarding_experience_selected` | Web | Cloud vs private chosen | `experience` |
| `onboarding_privacy_viewed` | Desktop | Privacy step | identity |
| `onboarding_connect_accounts_viewed` | Web / Desktop / iOS | Connect step | `platform` |
| `onboarding_account_connected` | Web / Desktop / iOS | Account linked | `accountCount` |
| `onboarding_completed` | Web / Desktop / iOS | Flow finished | `platform`, `stepCount` |
| `onboarding_skipped` | Web / Desktop / iOS | User skipped | `platform`, `stepAtSkip` |
| `onboarding_allocation_viewed` | iOS | Allocation step | `hasAllocation`, `institutionCount` |
| `onboarding_institution_connected` | iOS | Institution linked | `institutionCount` |
| `setup_guide_step_opened` | Shared → Web/Desktop/iOS | Setup guide step opened | `stepId` |
| `setup_guide_dismissed` | Shared → Web/Desktop/iOS | Setup guide closed | identity |
| `setup_guide_goals_updated` | Shared → Web/Desktop/iOS | Setup guide goals saved | `goalCount` |

### Auth / session

| Event | Owner | Purpose | Allowed Properties |
|-------|-------|---------|--------------------|
| `auth_login_completed` | Web / Desktop / iOS | Successful login | `provider` |
| `auth_logout_completed` | Web / Desktop / iOS | Sign out | identity |
| `auth_2fa_completed` | Web / iOS | 2FA verified | `provider` |
| `app_lock_unlocked` | iOS | Biometric unlock | identity |

### Core money

| Event | Owner | Purpose | Allowed Properties |
|-------|-------|---------|--------------------|
| `dashboard_viewed` | Web / Desktop / iOS | Overview / home | `platform` |
| `transaction_edit_completed` | Web / Desktop / iOS | Save edit | `hasCategoryChange`, `isSplit` |
| `transaction_split_completed` | Shared → Web/Desktop | Split saved | `legCount` |
| `transaction_unsplit_completed` | Shared → Web/Desktop | Split removed | identity |
| `transaction_bulk_action_completed` | Web / Desktop / iOS | Bulk action | `action`, `count` |
| `rule_created` / `rule_updated` / `rule_deleted` | Web / Desktop / iOS | Rules CRUD | identity |
| `budget_updated` | Web / Desktop / iOS | Budget save | identity |
| `insights_viewed` | Web / Desktop / iOS | Insights view | `period` |
| `categories_updated` | Web / Desktop / iOS | Category durable save | identity |
| `what_if_viewed` | Web / Desktop / iOS | What-if opened | identity |
| `what_if_scenario_reset` | Shared → hosts | Scenario reset | identity |
| `what_if_baseline_period_changed` | Shared → hosts | Baseline lookback months changed | `months` |
| `what_if_item_added` | Shared → hosts | Item added | `itemType` |
| `what_if_item_updated` | Shared → hosts | Item updated | `isNew`, `itemType` |
| `plaid_link_completed` | Web / Desktop / iOS | Link success | `outcome`, `alreadyLinkedCount`, `addedAccountCount` |
| `plaid_link_exited` | Web / Desktop / iOS | Link exit | `outcome` |
| `apple_wallet_connect_completed` | iOS | Wallet connect success | identity |
| `apple_wallet_permission_denied` | iOS | Permission denied | identity |
| `apple_wallet_auto_sync_completed` | iOS | Foreground staleness sync ran | `importedTransactions`, `updatedTransactions`, `removedTransactions`, `failedAccountCount` |
| `moat_mode_toggled` | Web / Desktop | Moat Mode toggle | `active` |

### Prompts / Ask AI CTAs

| Event | Owner | Purpose | Allowed Properties |
|-------|-------|---------|--------------------|
| `ai_prompt_library_viewed` | Web / Desktop / iOS | Prompt library viewed | identity |
| `ai_prompt_clicked` | Shared → hosts | Prompt / Ask AI CTA | `promptId`, `surface`, `provider` |
| `prompt_creation_sheet_opened` | Shared → hosts | Create sheet opened | identity |
| `prompt_create_with_ai_selected` | Shared → hosts | Create with AI | identity |
| `prompt_write_manually_selected` | Shared → hosts | Write manually | identity |
| `prompt_ai_connection_gate_shown` | Shared → hosts | Connection gate | identity |
| `prompt_ai_connection_flow_opened` | Shared → hosts | Routed to AI Access | identity |
| `prompt_ai_draft_generated` | Shared → hosts | AI draft returned | identity |
| `prompt_private_saved` | Shared → hosts | Private prompt saved | identity |
| `prompt_submitted_for_review` | Shared → hosts | Community submit | identity |
| `prompt_submission_withdrawn_by_edit` | Shared → hosts | Edit withdrew review | identity |
| `prompt_community_saved_to_library` | Shared → hosts | Saved from community | identity |

### Moat Finance AI (in-app panel)

| Event | Owner | Purpose | Allowed Properties |
|-------|-------|---------|--------------------|
| `moat_finance_ai_panel_opened` | Web | Panel opened | identity |
| `moat_finance_ai_panel_closed` | Web | Panel closed | identity |
| `moat_finance_ai_acknowledgement_accepted` | Web | Ack accepted | identity |
| `moat_finance_ai_message_sent` | Web | Message submitted | `hasConversation`, `messageLength` |
| `moat_finance_ai_run_completed` | Web | Run completed | identity |
| `moat_finance_ai_run_failed` | Web | Run failed | `code` |
| `moat_finance_ai_run_aborted` | Web | Run aborted | identity |
| `moat_finance_ai_conversation_reset` | Web | Conversation reset | identity |
| `moat_finance_ai_suggested_prompt_clicked` | Web | Suggested prompt | identity |

### MCP / AI Access (personal assistants)

| Event | Owner | Purpose | Allowed Properties |
|-------|-------|---------|--------------------|
| `mcp_ai_access_viewed` | Web / Desktop / iOS | AI Access page | `surface`, `tab` |
| `mcp_pat_create_started` | Web / iOS | Create PAT dialog | `surface`, `scope_preset`, `scope_count`, `has_expiration`, `has_write_scope` |
| `mcp_pat_created` | Web / iOS | PAT created | same + `expires_in_days` |
| `mcp_pat_revoked` | Web / iOS | PAT revoked | `surface` |
| `mcp_cursor_install_clicked` | Web / Desktop | Add to Cursor (OAuth connect or local deeplink) | `surface`, `install_kind` (`oauth` \| `local_deeplink`) |
| `mcp_chatgpt_install_clicked` | Desktop | ChatGPT Desktop local config install | `surface`, `install_kind` (`local_config`) |
| `mcp_claude_install_clicked` | Web / Desktop | Claude custom connector guide or local Claude Desktop install | `surface`, `install_kind` (`oauth` \| `local_mcpb`) |
| `mcp_assistant_open_clicked` | Desktop | Open Claude, ChatGPT, or Cursor from an AI Access card | `surface`, `provider` (`Claude` \| `ChatGPT` \| `Cursor`) |
| `mcp_oauth_consent_viewed` | Web | Consent page | `client_profile`, `privacy_level_default` |
| `mcp_oauth_consent_approved` | Web | Consent approved | `client_profile`, `privacy_level`, `domain_count`, `scope_count`, `has_write_scope` |
| `mcp_oauth_consent_denied` | Web | Consent denied | `client_profile` |
| `mcp_oauth_connection_revoked` | Web / iOS | OAuth disconnected | `client_profile`, `surface` |
| `mcp_gateway_toggled` | Desktop | Local gateway toggle | `enabled`, `auto_start` |
| `mcp_local_token_created` | Desktop | Local agent token | `scope_count`, `has_write_scope` |
| `mcp_local_token_revoked` | Desktop | Local token revoked | identity |
| `mcp_tool_invoked` | MCP | Cloud tool call | `client_profile`, `auth_kind`, `tool_name`, `tool_domain`, `safety_class`, `status`, `is_write`, `duration_bucket`, `rate_limited`, `transport` |
| `mcp_auth_failed` | MCP | Unauthorized | `auth_kind_attempt`, `transport` |
| `mcp_oauth_register_rejected` | MCP | Registration rejected | `registration_kind`, `reason_code` |

### Desktop platform

| Event | Owner | Purpose | Allowed Properties |
|-------|-------|---------|--------------------|
| `desktop_vault_setup_completed` | Desktop | First vault configure | identity |
| `desktop_vault_unlocked` | Desktop | Vault unlocked | identity |
| `desktop_vault_locked` | Desktop | Vault locked | identity |
| `desktop_vault_recovery_code_sent` | Desktop | Recovery code sent | identity |
| `desktop_vault_recovery_completed` | Desktop | Recovery completed | identity |
| `desktop_vault_reset_completed` | Desktop | Vault reset | identity |
| `desktop_import_completed` | Desktop | Import finished | `success`, `rowCount` |
| `desktop_update_downloaded` | Desktop | Update downloaded | identity |
| `desktop_update_installed` | Desktop | Update installed | identity |

### Mileage

| Event | Owner | Purpose | Allowed Properties |
|-------|-------|---------|--------------------|
| `mileage_trip_started` | iOS | User started tracking | identity |
| `mileage_trip_paused` | iOS | User paused tracking | identity |
| `mileage_trip_resumed` | iOS | User resumed tracking | identity |
| `mileage_trip_stopped` | iOS | User stopped tracking | identity |
| `mileage_trip_saved` | iOS | Trip saved locally | identity |
| `mileage_trip_discarded` | iOS | Trip discarded | identity |
| `mileage_trip_opened` | Web | History trip opened | `year` |

---

## Review Checklist

Before adding or changing an event:

- [ ] The event name follows `<domain>_<object>_<action>` unless it is PostHog's `$pageview`.
- [ ] The event is added to this catalog with an owner.
- [ ] The event goes through the platform analytics wrapper.
- [ ] The event does not include prohibited properties.
- [ ] The payload does not include raw prompts, raw financial values, merchant names, or transaction descriptions.
