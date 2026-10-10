# Update MCP Metadata

We need to clean up the Moat Finance MCP/plugin metadata before resubmitting it to OpenAI for plugin review.

OpenAI rejected v1.0.0 with this feedback:

“Your submission has issues with tool naming and description quality. Tool names must be clear, unique, and accurately reflect functionality, and descriptions must clearly explain when the tool should be used without including comparative, biased, or preferential language.

Your app name or description did not meet our quality standards.”

Please audit the entire Moat Finance MCP server and update the tool metadata to align with OpenAI’s plugin/app guidelines.

OpenAI references:

* https://developers.openai.com/plugins/app-guidelines
* https://developers.openai.com/plugins/deploy/submission
* https://developers.openai.com/plugins/guides/optimize-metadata

The goal is NOT to change business logic unless needed. This should primarily be a metadata/tool-contract cleanup.

Please do the following.

1. Audit every MCP tool name and description.

For every exposed tool:

* Make the name clear, unique, and directly representative of what the tool actually does.
* Prefer a consistent naming convention like:
  `moat.action_object`
* Prefer plain-English action names over database/internal terminology.
* Avoid ambiguous names.
* Avoid tool names that imply a stronger action than actually occurs.
* Make descriptions concise and factual.
* Explicitly describe the user intent that should trigger the tool where useful.
* Where there is a nearby/overlapping tool, explain the distinction.
* Do NOT include language intended to make ChatGPT prefer Moat broadly.
* Do NOT include comparative, promotional, biased, or preferential language.
* Do NOT put large amounts of agent behavior/system-prompt-like instructions into descriptions.

For example, descriptions should generally resemble:

“Use this when the user asks to retrieve transactions matching a merchant, keyword, date range, category, or other transaction filter.”

rather than:

“Use this before giving financial advice so you have the user’s complete financial context.”

2. Fix overlapping transaction tools.

We currently expose both:

* `moat.listTransactions`
* `moat.searchTransactions`

These overlap significantly because `listTransactions` already has a `search` parameter, while `searchTransactions` has both `search` and `query`.

Please inspect actual usage and choose the cleanest design.

Preferred direction:

* Keep a simple recent/list transaction tool only if it has a distinct purpose.
* Use one clearly named search/filter tool for queries involving merchant, description, keyword, category, dates, hashtags, etc.
* Remove redundant parameters like both `search` and `query` if they mean the same thing.

A likely design would be:

* `moat.list_transactions` — recent transactions / pagination / structured filtering without free-text search, if we truly need it.
* `moat.search_transactions` — free-text transaction search plus structured filters.

If keeping both does not add meaningful capability, consolidate them.

3. Rename misleading or overly technical tools.

Please review all tools, but specifically consider changes like these:

Current:

* `moat.getProfileSummary`
  Suggested:
* `moat.get_financial_summary`

Current:

* `moat.applyRulesPreview`
  Suggested:
* `moat.preview_rule_matches`

Current:

* `moat.applyRuleHistorical`
  Suggested:
* `moat.apply_rule_to_past_transactions`

Current:

* `moat.deleteTransaction`
  Actual behavior:
* soft-deletes / hides a transaction
  Suggested:
* `moat.hide_transaction`

Current:

* `moat.pauseNotificationRule`
  Actual behavior:
* both pauses and resumes
  Suggested:
* `moat.set_notification_rule_paused`

Current:

* `moat.upsertCategoryBudget`
  Suggested:
* `moat.set_category_budget`

Current:

* `moat.getMemories`
  Suggested:
* `moat.get_saved_financial_context`

Current:

* `moat.saveMemory`
  Suggested:
* `moat.save_financial_context`

Do not blindly apply these exact names if there is a better convention already used in the codebase, but make the semantics clear and consistent.

4. Rewrite financial-memory/context descriptions.

The current `getMemories` description includes wording similar to:

“Use this to recall past financial context, goals, preferences, and user-specific rules before giving financial advice.”

Remove broad instructions like “before giving financial advice.”

Rewrite it around explicit intent, for example:

“Use this when the user asks to retrieve financial goals, preferences, household context, or other durable financial context previously saved in their Moat Finance account. Do not use for general financial questions that do not require saved Moat data.”

For `saveMemory`, remove the instruction that the agent should independently decide to persist information merely because it might be useful later.

Prefer something like:

“Use this when the user explicitly asks to save a financial goal, preference, household context, business context, or other durable financial information to their Moat Finance account. Do not use for temporary facts, ordinary transactions, or information the user has not asked to save.”

5. Simplify Community Tips descriptions.

Current Community Tips tools contain a lot of agent-policy-style instructions such as:

* ask once whether they want anonymity
* always populate useful metadata
* explain moderation behavior afterward

Move behavioral logic into appropriate application/server logic where possible.

Keep the MCP description focused on what the tool does and when it should be called.

For example:

`moat.create_community_tip`

“Use this when the user explicitly asks to submit a financial tip to the Moat community. Creates a tip for moderation before it can become publicly visible. Supports public or anonymous attribution.”

Apply the same principle to:

* update tip
* list tips
* my tips
* feedback submission
* report sharing
* notification rules

6. Simplify `submitFeedback`.

Audit its current description carefully.

Do not use the tool description as a mini system prompt instructing the agent to proactively submit feedback automatically under broad circumstances.

Clearly distinguish:

* feature request
* bug
* general feedback
* MCP tool issue

But keep the description focused on the actual operation and explicit user intent where appropriate.

7. Audit destructive/action tools.

Make sure tool names and descriptions accurately reflect:

* hard delete vs soft delete
* update vs replace
* create vs upsert
* pause vs toggle
* public sharing vs private state
* preview vs execution

Examples:

* If a transaction is merely hidden, don't call the tool “delete.”
* If a report share link becomes public to anyone with the URL, make that explicit.
* If a tool permanently deletes something, say so plainly.
* If a tool is only a preview, make “preview” part of the name.

8. Audit all input schemas.

Check every public MCP tool exposed in the scan.

I noticed that some tools may be surfacing without visible parameters/schema despite clearly requiring inputs, including possibly:

* `applyRulesPreview`
* `updateTransaction`
* `upsertCategoryBudget`
* `deleteCategoryBudget`
* `submitFeedback`

Determine whether that is just a client/display artifact or whether our MCP schema really lacks argument definitions.

Every tool should have an accurate JSON schema matching what the server actually accepts.

Remove:

* duplicate parameters
* unused parameters
* ambiguous parameter names
* overly generic `any` schemas where a concrete schema can reasonably be supplied

Prefer enums and explicit fields wherever practical.

9. Audit tool annotations / safety metadata.

Review the MCP annotations for every tool where applicable.

Make sure read-only tools are clearly read-only.

Make sure tools that:

* mutate transactions
* delete rules
* share reports publicly
* update budgets
* create alerts
* change saved context

are accurately represented as mutating/destructive where appropriate.

Do not mislabel a write operation as read-only.

10. Update the app/plugin description.

Keep the product name:

`Moat Finance`

Do not use `Moat Finance (Dev 1)` or other development wording in the production submission.

Replace vague marketing copy like:

“Chat with your finances”

with a concrete description.

Preferred description:

“Connect your Moat Finance account to view and manage your personal financial data in ChatGPT, including accounts, transactions, spending, budgets, net worth, forecasts, transaction rules, reports, and financial alerts.”

A shorter alternative is:

“View and manage your Moat Finance accounts, transactions, budgets, net worth, forecasts, and financial alerts.”

Use whichever length best fits the submission field.

11. Standardize naming across the entire MCP surface.

Prefer a consistent public API like:

* `moat.get_financial_summary`
* `moat.list_accounts`
* `moat.list_transactions`
* `moat.search_transactions`
* `moat.get_spending_breakdown`
* `moat.get_budget_status`
* `moat.get_forecast`
* `moat.explain_forecast`
* `moat.list_transaction_rules`
* `moat.create_transaction_rule`
* `moat.update_transaction_rule`
* `moat.preview_rule_matches`
* `moat.apply_rule_to_past_transactions`
* `moat.hide_transaction`
* `moat.set_category_budget`
* `moat.get_saved_financial_context`
* `moat.save_financial_context`

You do not need to use these exact strings if there is a stronger naming scheme, but the final public API should feel deliberate and consistent.

12. Preserve compatibility where practical.

Search the codebase for all internal references to the existing tool names before renaming.

Update:

* MCP registration
* route handlers
* tests
* fixtures
* documentation
* any hard-coded tool names
* prompts
* evals
* plugin submission configuration

If backwards-compatible aliases are technically possible but would cause both old and new tools to appear in OpenAI’s MCP scan, DO NOT expose both publicly. The submission surface should contain only the cleaned-up names.

13. Add/update tests.

Please add tests that assert:

* expected public tool names
* no duplicate/overlapping tool registrations
* every tool has a non-empty description
* every tool has a valid input schema
* known read tools are read-only
* known mutations are correctly annotated
* transaction search/list semantics are distinct
* renamed tools still call the same underlying business logic

14. Produce a final audit report after making the changes.

At the end, give me:

A. Every tool that was renamed:
`oldName -> newName`

B. Every tool whose description changed significantly.

C. Any tools removed or consolidated.

D. Any schemas that were fixed.

E. The final app name and app description.

F. Any remaining metadata that you believe could still cause an OpenAI review rejection.

G. A concise list of files changed.

Do not make unrelated product changes.

Do not change financial calculation logic.

Do not change database behavior unless required to accurately align a tool's actual behavior with its public contract.

The priority is making the Moat Finance MCP surface extremely clear to both:

1. OpenAI's reviewer, and
2. the model deciding which tool to call.
