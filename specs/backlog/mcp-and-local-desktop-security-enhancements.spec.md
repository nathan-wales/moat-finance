MCP and local desktop security enhancements prompt

1. Does a fully local desktop app need login + MFA?
Not necessarily. If the app is truly local-only, never syncs to your cloud, and your company cannot access the data, then a traditional web-style login is not automatically required.
But you should still have local app protection because insurance + health + financial data is extremely sensitive.
For a local-only desktop app, I would do this:
Feature	Recommendation
Cloud login	Not required if there is no cloud account/sync
MFA	Not required for purely local-only mode
Local app password/PIN	Strongly recommended
Biometric unlock	Strongly recommended
OS keychain integration	Strongly recommended
Full database encryption	Must-have
Auto-lock	Must-have
Recovery key/export backup	Must-have
Secure delete/export	Must-have
The better model is not “login with MFA.” It is:
The user has a local encrypted vault protected by the device, OS keychain, password/passkey, and optional biometrics.
So when they open the app, you can ask for:
* App password
* PIN
* Face ID / Touch ID / Windows Hello
* Recovery key for backup restore
The local database should be encrypted even if the computer is stolen. For example, the database encryption key can be stored in the OS keychain, and optionally protected by a user password or biometric unlock.
For your product, I would avoid forcing cloud login in the privacy-first local app. It weakens the story. Instead, make the promise:
No account required. No cloud required. Your insurance and financial profile stays on your device unless you explicitly choose to sync or export it.
That is a very strong trust position.

⸻

2. What changes if you add cloud sync?
The second you add cloud sync, hosted backup, account recovery, web dashboard, AI cloud processing, or shared access, the answer changes.
Then you likely need:
* User accounts
* MFA
* Device/session management
* Account recovery flow
* Suspicious login alerts
* Server-side access controls
* Breach response process
* Subprocessor list
* Vendor reviews
* Data Processing Addendum
* Possibly BAAs, depending on healthcare data flow
* SOC 2 roadmap
If the cloud stores only client-side encrypted blobs that your company cannot decrypt, your risk is lower, but not zero. You still operate infrastructure, authentication, billing, telemetry, support, and update delivery.

⸻

3. For MCP: are every AI provider and MCP provider subprocessors?
Usually, yes, if your app sends user data to them or they process user data on your behalf.
A vendor/subprocessor is not just “someone you integrated with.” It is someone who receives, processes, stores, transmits, or can access user data for your service.
Examples:
Scenario	Subprocessor/vendor?
Your app sends user insurance profile to OpenAI/Anthropic/Gemini for analysis	Yes
Your app sends health/insurance docs to OCR provider	Yes
Your cloud stores logs in Datadog/Sentry with user data	Yes
User independently exports a file and uploads it to ChatGPT outside your app	Usually no
User configures their own local Ollama model	Usually no
User installs their own third-party MCP server and grants it access	Complicated, but you should treat it as a user-authorized integration
Your app recommends/hosts/routes/marketplaces MCP servers	More likely your responsibility
Your cloud MCP gateway brokers requests to third-party servers	Very likely your responsibility
For HIPAA specifically, HHS says a business associate is an entity that performs functions involving PHI for a covered entity, and business associate contracts govern permitted PHI use/disclosure. Downstream vendors that handle PHI may also need appropriate contracts.  
For financial data, the FTC Safeguards Rule says covered financial institutions must maintain safeguards and are responsible for taking steps to ensure service providers protect customer information.  
So the key question is:
Did your product/service cause user data to be shared with that vendor as part of your service?
If yes, put them through vendor review and likely list them.

⸻

4. If a user connects a bad MCP server, is it your fault?
Not always, but you should not rely on “the user chose it” as your only defense.
There are three different cases.
Case A: User runs local app + installs random MCP server themselves
If your app clearly says, “Third-party MCP servers are user-controlled extensions; they may access data you grant them,” and your app requires explicit permission before sharing data, then your liability is lower.
But you still need reasonable safety controls.
You should not silently hand over the whole insurance profile to any MCP server just because it asks.
Case B: Your app has an MCP marketplace or recommended integrations
Now you are more exposed.
If you curate, recommend, preinstall, or certify MCP servers, users will reasonably believe you vetted them. A bad MCP server stealing data could become your problem from a negligence, privacy, or deceptive-practices angle.
Case C: Your cloud routes data to MCP servers
This is the highest-risk case.
If your servers broker the connection, log payloads, mediate auth, or transmit sensitive data to third-party tools, those third parties are probably vendors/subprocessors, and your trust/privacy documentation needs to cover them.

⸻

5. What MCP security features you should build
MCP is powerful but dangerous because it gives AI systems tool access. The official MCP security guidance discusses risks around tool changes and authorization assumptions, and OWASP’s MCP guidance describes the architecture as an AI host/client connecting to MCP servers that expose tools, resources, and prompts.  
For your app, I would build MCP like a permissioned extension system, not a free-for-all.
Minimum controls:
Explicit user consent
Before connecting an MCP server, show:
* Who made it
* Whether it is local or remote
* What data it can access
* What actions it can perform
* Whether data leaves the device
* Whether it can write/change/delete data
* Whether it can access documents
* Whether it can access all policies or only selected records
Scoped permissions
Do not give MCP servers full access by default.
Use scopes like:
* Read insurance summary
* Read selected policy only
* Read uploaded documents
* Read health insurance only
* Read auto insurance only
* Read financial accounts
* Create draft recommendation
* Modify records
* Delete records
* Export data
* Send data externally
Per-action approval
For sensitive actions, require confirmation:
* Exporting data
* Sending data to external services
* Reading all documents
* Accessing health/EOB/claim records
* Modifying or deleting records
* Connecting to remote servers
* Sharing data with AI providers
Local sandboxing
If the MCP server runs locally:
* Run it with least privilege
* Avoid shell access
* Avoid arbitrary filesystem access
* Containerize if possible
* Restrict network access if possible
* Use allowlisted directories
* Do not pass secrets as environment variables unnecessarily
Data minimization
Never send the entire profile when the task only needs one field.
Bad:
“Here is Tyler’s entire insurance, health, financial, beneficiary, claims, and document history.”
Better:
“The user asked about their auto deductible. Send only auto policy deductible fields.”
Tool transparency
Show users:
* What tool the AI wants to call
* What data will be sent
* What result came back
* What action will happen next
Audit trail
Log locally:
* MCP server connected
* Permissions granted
* Data accessed
* Tool calls made
* Documents read
* External network calls, if detectable
* Actions taken
For privacy, store these audit logs locally and avoid sensitive payloads inside them.
Kill switch
User should be able to:
* Disconnect MCP server
* Revoke permissions
* Delete its cached data
* Reset all MCP permissions
* Disable remote MCP entirely
* Disable all AI tool access

⸻

6. The biggest MCP danger for your use case
The nightmare scenario is:
1. User connects an MCP server.
2. MCP server exposes a tool with a malicious description.
3. AI model is tricked into calling it.
4. Tool asks for “needed context.”
5. Your app sends the user’s full insurance/health profile.
6. Data leaves the machine.
Microsoft has specifically warned about “tool poisoning,” where malicious instructions are embedded in MCP tool metadata to manipulate the model into unintended tool calls.  
So your app should not trust MCP tool descriptions. The model should never be the only security boundary.
Your app needs a deterministic policy layer:
Even if the AI wants to send data, the app policy decides whether it is allowed.

⸻

7. How I would phrase this in your privacy/trust posture
For a privacy-first local desktop app, the ideal position is:
Third-party AI providers and MCP servers only receive your data if you explicitly connect them and approve what data is shared. We do not send your insurance or health data to AI providers by default. Local-only mode requires no account and does not transmit your vault to our servers.
This gives you a strong architecture and a strong compliance story.

⸻

My recommendation for your app
For the local desktop version:
* Do not require cloud login.
* Do add local vault unlock.
* Do encrypt the local database.
* Do support biometric/PIN unlock.
* Do auto-lock after inactivity.
* Do make cloud sync optional.
* Do make AI/MCP opt-in.
* Do require granular permissions for MCP.
* Do treat AI providers as subprocessors if your app sends them user data.
* Do treat MCP servers as user-authorized extensions, but with strong warnings, scopes, and audit logs.
* Do not let MCP servers read the whole vault by default.
The guiding rule should be:
No sensitive data leaves the device unless the user explicitly approves the destination, purpose, and scope.
