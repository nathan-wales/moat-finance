# Private-hosted Qwen 8B on GCP

We need to replace/augment our unreliable deterministic W-2 field extraction with a fully self-hosted LLM extraction pipeline on GCP.

You have access to this codebase and to `gcloud`. Inspect the existing repository, existing Docling deployment, existing GCP project/configuration, existing database/job abstractions, and existing tax/W-2 schemas before making changes. Reuse what exists rather than creating parallel infrastructure unnecessarily.

Do not ask me for confirmation between steps. Make reasonable choices, execute the implementation, test it end-to-end, and report exactly what you created/changed at the end.

# Objective

Build this production architecture:

Docling
→ raw parsed text
→ encrypt immediately in application memory
→ Pub/Sub durable queue
→ ensure private GPU worker is running
→ Qwen3-8B/vLLM worker decrypts text in memory
→ tokenize SSN + EIN before LLM inference
→ Qwen3-8B extracts strict structured W-2 JSON
→ Zod/schema validation
→ rehydrate SSN/EIN from the in-memory token map
→ persist only the intended final structured W-2 result
→ acknowledge Pub/Sub message
→ GPU VM stays warm for exactly 120 seconds after the last completed/in-flight job
→ automatically shuts down
→ next job automatically starts it again

The raw W-2 text, prompts, SSNs, EINs, LLM outputs, and encryption keys must NEVER appear in application logs, Cloud Logging, vLLM logs, error traces, analytics, APM, or console output.

The self-hosted Qwen model must have no public endpoint and no runtime public-internet access.

# Important architectural requirements

Use:

* Model: `Qwen/Qwen3-8B`
* Inference server: vLLM
* GPU: one NVIDIA L4
* Compute Engine machine: start with `g2-standard-8`
* Standard/on-demand VM initially, NOT Spot
* Private Compute Engine VM with NO external IP
* Pub/Sub pull subscription
* Exactly-once delivery enabled
* 24-hour Pub/Sub subscription retention
* Do NOT retain acknowledged messages
* Do NOT enable topic-level message retention
* Worker idle timeout: exactly 120 seconds after there are zero in-flight jobs and no new jobs have arrived
* vLLM bound to `127.0.0.1`, not `0.0.0.0`
* Qwen thinking disabled
* JSON-schema constrained output
* No vLLM request logging
* No Uvicorn access logging
* Private Google Access for necessary GCP APIs
* No general internet egress from the production GPU VM

Do not expose port 8000 outside the VM. The queue worker and vLLM should live on the same VM and communicate over localhost.

# Step 1: inspect the existing environment

Before provisioning anything:

1. Run:

   * `gcloud config get-value project`
   * `gcloud config get-value compute/region`
   * `gcloud config get-value compute/zone`
   * inspect existing Cloud Run/Compute/VPC/Pub/Sub resources
   * inspect the existing Docling deployment
   * inspect existing service accounts and networking

2. Determine which GCP region Docling currently uses.

3. Prefer putting the Qwen worker in that same region if an L4/G2 zone is available there.

4. Verify `g2-standard-8` availability before creating the VM.

5. Do not hard-code a project ID if the active project differs from what the repo expects.

6. Do not modify/delete shared VPCs, routers, NATs, service accounts, firewall rules, or other existing infrastructure unless you have verified they belong exclusively to this feature.

7. Inspect the existing W-2 TypeScript/Zod types. Reuse the canonical schema if one exists.

8. Inspect the current path:
   PDF → Docling → deterministic extraction.
   Preserve Docling. Replace or augment only the structured-extraction stage.

# Step 2: enable required GCP APIs

Enable only what is required, likely including:

* Compute Engine
* Pub/Sub
* Cloud Tasks
* Cloud Run if we need a tiny worker-controller service
* Secret Manager
* Artifact Registry if needed
* IAM
* Cloud Resource Manager as required

Use existing enabled APIs where possible.

# Step 3: Pub/Sub queue

Create namespaced resources similar to:

* Topic: `moat-tax-llm-extraction`
* Pull subscription: `moat-tax-llm-extraction-worker`

Configure the subscription with:

* exactly-once delivery enabled
* acknowledgment deadline of 600 seconds
* message retention of 24 hours
* retain acknowledged messages = false
* expiration = never
* sensible exponential retry, roughly 10–60 seconds

Pub/Sub may discard a message once its retention duration expires, regardless of acknowledgment state. Ten minutes is only the minimum; seven days is the default. 24 hours is long enough that an L4 stockout (`ZONE_RESOURCE_POOL_EXHAUSTED`) cannot drop an uploaded tax document's extraction job, without keeping ciphertext for the full default week. Do not retain acknowledged messages.

Do NOT configure topic-level retention.

Do not put readable tax information in Pub/Sub.

The message should contain an encrypted payload.

Use a versioned envelope similar to:

```ts
type TaxLlmQueueMessageV1 = {
  version: 1;
  jobId: string;
  documentType: "W2";
  schemaVersion: string;

  encryption: {
    algorithm: "aes-256-gcm";
    keyVersion: string;
    iv: string;
    authTag: string;
    ciphertext: string;
  };
};
```

Everything under encryption should be Base64 as appropriate.

The plaintext being encrypted should contain the Docling text and only the minimal metadata necessary to process the extraction.

Do NOT put these into Pub/Sub attributes:

* names
* SSNs
* EINs
* wages
* addresses
* document text
* user IDs where avoidable

Keep attributes nonsensitive.

Add a serialized-message-size check well below Pub/Sub's 10 MB limit. Since Base64 increases size, fail safely before approaching the Pub/Sub maximum. W-2 text should normally be nowhere near this threshold.

# Step 4: application-level encryption

Immediately after receiving parsed text from Docling, encrypt it before it goes into Pub/Sub.

Use AES-256-GCM.

Generate a cryptographically random 12-byte IV for every payload.

Use authenticated additional data such as:

```ts
`${jobId}:${documentType}:${schemaVersion}`
```

Never reuse an IV/key combination.

Create a dedicated encryption key:

* 32 cryptographically random bytes
* stored as Base64
* versioned, beginning with `v1`
* never committed to source control

Use the repo's existing secret-management mechanism if one already exists.

For GCP runtime, store/retrieve the key securely through Secret Manager.

If a non-GCP service also needs to publish encrypted jobs, integrate the same key through its existing secure secret mechanism rather than writing a service-account JSON file into the repo.

Structure the code so key rotation is possible later:

```ts
{
  keyVersion: "v1"
}
```

and decryption selects the correct configured key.

Create reusable functions similar to:

```ts
encryptTaxExtractionPayload(...)
decryptTaxExtractionPayload(...)
```

Use Node's built-in `node:crypto` where this happens in TypeScript.

Never log plaintext or encryption keys.

# Step 5: extraction job tracking

Reuse the existing job/queue database model if there is one.

Otherwise add the smallest appropriate model necessary to track:

* id
* documentId if appropriate
* user ownership using the project's existing conventions
* status:

  * QUEUED
  * PROCESSING
  * COMPLETED
  * FAILED
* attemptCount
* model name
* model revision
* schema version
* createdAt
* startedAt
* completedAt
* sanitized failure code/message

Do NOT put:

* raw Docling text
* LLM prompts
* LLM raw responses
* SSN token mappings
* encryption keys

into the job table.

Make completion idempotent by `jobId`.

A duplicate Pub/Sub publish or redelivery must never create duplicate extracted records.

# Step 6: enqueue flow

The existing application flow should become conceptually:

```ts
const parsedText = await runDocling(...);

// raw parsedText exists only in memory here

const job = await createExtractionJob(...);

const encryptedPayload = encryptTaxExtractionPayload({
  jobId: job.id,
  documentType: "W2",
  schemaVersion: W2_SCHEMA_VERSION,
  parsedText,
});

await publishToTaxExtractionQueue(encryptedPayload);

await ensureTaxLlmWorkerRunning();

// Add watchdog checks described below.
```

Do not log `parsedText`.

After publishing, release references to the plaintext as soon as practical.

Do not persist the Docling text solely for this LLM pipeline.

If the existing product already intentionally stores original tax documents, do not change that product behavior without reason, but do not introduce an additional copy of the raw parsed text.

# Step 7: SSN/EIN tokenization

Inside the private GPU worker, after decrypting the queue payload but BEFORE calling vLLM, run a deterministic identifier-tokenization step.

The model should see:

```text
Employee's SSN: <SSN_1>
Employer identification number: <EIN_1>
```

instead of:

```text
Employee's SSN: 123-45-6789
Employer identification number: 87-1234567
```

Return:

```ts
{
  redactedText,
  tokenMap
}
```

where `tokenMap` exists ONLY in worker process memory.

Example:

```ts
{
  "<SSN_1>": "123-45-6789",
  "<EIN_1>": "87-1234567"
}
```

Do not write `tokenMap` to disk, logs, Pub/Sub, database, telemetry, or traces.

Tokenization requirements:

1. Recognize normal formatted SSNs:

   * `123-45-6789`
   * tolerate spaces and common OCR dash characters

2. Recognize normal EINs:

   * `12-3456789`
   * tolerate spaces and OCR dash characters

3. Handle Docling/OCR cases where labels and numbers are separated by whitespace or line breaks.

4. For unformatted 9-digit values, use nearby semantic labels rather than blindly assuming every 9-digit number is an SSN.

Relevant SSN context includes phrases such as:

* employee's social security number
* social security number
* SSN
* employee SSN

Relevant EIN context includes:

* employer identification number
* employer ID number
* EIN
* federal employer identification number

5. Preserve exact original identifier strings in `tokenMap`.

6. Support multiple SSNs/EINs:

   * `<SSN_1>`
   * `<SSN_2>`
   * `<EIN_1>`
   * etc.

7. Use highly recognizable sentinel tokens unlikely to occur naturally.

8. Never print either the original or transformed document during tests unless using explicitly synthetic fixture data.

Make this module independently unit-testable.

Use completely fake identifiers in test fixtures.

# Step 8: Qwen/vLLM VM

Provision a private Compute Engine GPU VM.

Start with:

* machine type: `g2-standard-8`
* one L4 GPU inherent to G2
* Ubuntu 24.04 or another currently supported Ubuntu version verified against Google's GPU-driver documentation
* `pd-balanced`, NOT `pd-standard`
* enough persistent disk for OS, vLLM, Qwen model weights, and working space; 100 GB is reasonable to start
* no external IP
* appropriate GPU maintenance behavior
* automatic restart for infrastructure failure if compatible, while still allowing an intentional API stop to keep the machine stopped
* a dedicated service account
* no broad Editor/Owner permission

Name it clearly, e.g.:

`moat-tax-llm-worker`

Do not use Spot initially. Reliability is more important at our current volume.

# Step 9: least-privilege service accounts

Create or reuse dedicated service accounts with minimal permissions.

The GPU worker needs:

* subscribe/ack access to the specific Pub/Sub subscription
* access to the specific encryption secret
* permission to stop its own Compute Engine instance
* whatever narrow access is required to persist the final extraction result
* no permission to start arbitrary VMs
* no broad project Editor role

The controller needs enough permission to:

* read the state of this specific instance
* start this specific instance

Prefer a custom role or resource-scoped IAM binding over broad `Compute Instance Admin` if practical.

At minimum understand these operations map to:

* `compute.instances.get`
* `compute.instances.start`
* worker: `compute.instances.stop`

Use service accounts and workload identity; do not create downloadable long-lived service-account JSON keys unless there is absolutely no supported alternative.

# Step 10: bootstrap model and dependencies securely

The production GPU VM must not need general internet access.

Provision Qwen/vLLM once.

Use:

`Qwen/Qwen3-8B`

Pin the exact model revision/commit used. Do not depend indefinitely on mutable `main`.

Cache the model weights to a persistent path such as:

`/opt/moat/models/qwen3-8b`

Record:

* model name
* pinned revision
* vLLM version
* Transformers version if relevant

If internet access is necessary for the initial bootstrap, use a TEMPORARY controlled outbound mechanism such as a feature-specific Cloud NAT.

Do not assign a public IP merely for normal runtime.

After model/dependency bootstrap:

* remove the temporary feature-specific NAT if it was created solely for this
* verify the VM has no public IP
* verify it cannot reach arbitrary public internet destinations
* verify necessary Google APIs still work using Private Google Access

Do not remove a NAT/router shared by existing services.

Install current Google-supported NVIDIA L4 drivers.

Make installation idempotent.

# Step 11: vLLM runtime

Run vLLM as a systemd-managed process or similarly robust local service.

Serve the pinned local model path.

Use configuration conceptually equivalent to:

```bash
vllm serve /opt/moat/models/qwen3-8b \
  --served-model-name qwen3-8b-tax \
  --host 127.0.0.1 \
  --port 8000 \
  --dtype bfloat16 \
  --max-model-len 16384 \
  --gpu-memory-utilization 0.90 \
  --default-chat-template-kwargs '{"enable_thinking":false}' \
  --no-enable-log-requests \
  --disable-uvicorn-access-log
```

Verify the exact flags against the installed vLLM version and adapt if syntax has changed.

Important:

* request logging MUST remain disabled
* Uvicorn access logging should be disabled
* never run vLLM at DEBUG level in production
* do not enable prompt logging
* do not enable features that persist request bodies
* bind only to localhost
* do not create an ingress firewall rule for the vLLM port

Set:

```text
enable_thinking=false
```

for Qwen3.

This extraction task should not emit `<think>` content.

Wait for vLLM `/health` to succeed before starting queue consumption.

# Step 12: structured W-2 extraction

Reuse the application's existing canonical W-2 schema if possible.

Convert the Zod schema to JSON Schema if necessary.

Call the local vLLM OpenAI-compatible endpoint with strict JSON-schema structured output.

The request should conceptually use:

```ts
{
  model: "qwen3-8b-tax",
  messages: [...],
  temperature: 0.1,
  max_tokens: 2048,
  response_format: {
    type: "json_schema",
    json_schema: {
      name: "w2_extraction",
      strict: true,
      schema: ...
    }
  }
}
```

If the current vLLM version uses `structured_outputs` rather than the OpenAI-compatible `response_format` implementation, use the supported current mechanism.

Do not rely solely on prompt instructions to produce valid JSON; use vLLM's constrained structured-output feature.

The system extraction prompt should communicate:

* This is structured data extraction, not tax advice.
* Extract only values explicitly supported by the supplied document text.
* Never guess.
* Never calculate a missing tax box from another tax box.
* Never manufacture a value because it is normally present on a W-2.
* Return `null` for missing/uncertain optional values.
* Preserve `<SSN_n>` and `<EIN_n>` tokens exactly.
* Do not change, partially reveal, normalize, or reconstruct those identifiers.
* Monetary values should become numbers using the application's existing representation.
* Preserve employer/employee names and addresses accurately.
* Correctly handle repeated Box 12, Box 14, state, and local entries according to the existing schema.

Do not put the user's raw document into a system message. Put only the redacted text in the user/content portion.

# Step 13: response validation and identifier restoration

After vLLM responds:

1. Parse using the canonical Zod W-2 schema.

2. Reject structurally invalid responses.

3. Verify every `<SSN_n>`/`<EIN_n>` token returned by the model exists in the in-memory token map.

4. Do NOT accept an LLM-generated raw SSN/EIN.

If an identifier field contains something that looks like a raw SSN/EIN rather than one of our sentinel tokens, treat that as a validation failure.

5. Recursively restore sentinel tokens using the in-memory token map.

6. Run deterministic sanity validation after restoration.

Examples:

* numeric boxes contain valid values
* expected array structures are valid
* year format is valid
* SSN/EIN format matches what was extracted from the source
* no unknown placeholder tokens remain
* required fields conform to the existing product requirements

Do NOT silently "fix" tax values by calculating them.

7. Persist the final intended structured W-2 result using the existing secure tax-data persistence path.

8. Mark the job COMPLETED.

9. ACK the Pub/Sub message only after successful durable completion.

# Step 14: failures and retries

The worker must tolerate Pub/Sub redelivery.

Use `jobId` for idempotency.

If a completed job is received again:

* do not run the model again
* ACK it safely

For retryable failures:

* increment attempt count
* NACK / allow redelivery
* retain only a sanitized error category

Examples:

* MODEL_STARTING
* MODEL_TIMEOUT
* MODEL_INVALID_JSON
* SCHEMA_VALIDATION_FAILED
* PERSISTENCE_FAILED

Never put document contents into `lastError`.

After an appropriate maximum attempt count, mark FAILED and ACK the message so it does not loop forever.

A user can then retry the extraction through the application.

# Step 15: worker process

Create a queue-worker service on the VM.

Prefer TypeScript/Node for application/orchestration code if that matches the existing stack. vLLM itself can remain Python.

The worker should:

1. boot
2. wait for vLLM health
3. open Pub/Sub pull/StreamingPull subscriber
4. limit concurrency initially to a safe level, e.g. 1–2 jobs
5. receive encrypted message
6. update last-activity timestamp
7. decrypt only in memory
8. tokenize SSN/EIN
9. call localhost vLLM
10. validate
11. restore identifiers
12. persist final result
13. ACK
14. update last-activity timestamp
15. keep polling/draining queued jobs
16. shut itself down after 120 seconds of true idle

Use the official current Pub/Sub client library so acknowledgement leases are extended while processing.

Do not implement a fixed 600-second sleep and hope the ack remains valid.

# Step 16: exact 120-second warm behavior

Define idle as:

* zero currently processing jobs AND
* no message received/completed for 120 seconds

Every new message or completed job resets the idle deadline.

Example:

```ts
idleDeadline = Date.now() + 120_000;
```

Do not count model startup time as idle.

Do not stop while:

* a message is in flight
* a result is being persisted
* an ACK is being completed

When idle reaches 120 seconds:

1. stop pulling new work
2. ensure there is no active in-flight job
3. perform a brief final opportunity for work to arrive
4. initiate a clean Compute Engine stop of THIS VM

Use the Compute Engine API rather than killing processes.

The worker service account should only need permission to stop its own instance.

# Step 17: protect against the shutdown/enqueue race

There is a race we MUST handle:

* worker sees 120 seconds idle
* new job publishes
* publisher sees VM RUNNING
* publisher therefore does not start it
* worker stops one millisecond later
* message is now queued while VM is off

Do not ignore this race.

Implement BOTH of the following:

## Immediate ensure-running

Every successful queue publish calls an idempotent:

```ts
ensureTaxLlmWorkerRunning()
```

Behavior:

* TERMINATED → start instance
* RUNNING → no-op
* PROVISIONING/STAGING → no-op
* STOPPING → retry/poll until TERMINATED, then start
* unknown/error state → fail safely and record sanitized operational error

Do not blindly call `instances.start` on an already running VM.

## Delayed watchdog ensures

For every newly enqueued job, schedule short-lived Cloud Tasks that call the same idempotent controller at approximately:

* +30 seconds
* +90 seconds

These tasks should only ensure that the worker is not accidentally stopped during the expected processing/warm interval.

Since a successful worker remains warm for 120 seconds after completing the job, these +30/+90 checks should normally find it RUNNING and do nothing.

This eliminates the enqueue-vs-shutdown race without keeping an always-on controller.

If a +30/+90 task encounters STOPPING, it should retry until the machine reaches TERMINATED and then start it.

Cloud Tasks must not contain W-2 data. The task needs only something nonsensitive such as:

```json
{
  "action": "ensure-tax-llm-worker-running"
}
```

Configure Cloud Tasks authentication using service-account/OIDC mechanisms rather than a public unauthenticated endpoint.

# Step 18: worker controller

If a small GCP controller service is required, make it a minimal Cloud Run service that scales to zero.

Its job is ONLY:

* inspect the one GPU VM's current state
* start it if necessary
* handle STOPPING/start races safely

It does NOT receive:

* W-2 text
* SSNs
* EINs
* prompts
* model responses

Give its service account only the required Compute Engine permissions.

Do not build a general-purpose "start any VM" API.

Hard-code/allowlist the configured project, zone, and instance name server-side.

Require authenticated invocation.

# Step 19: production networking

The GPU VM should have:

* no external IP
* no public HTTP service
* no load balancer
* no vLLM ingress
* no general Cloud NAT during normal runtime
* Private Google Access enabled on its subnet as necessary

The only model connection should be:

```text
worker process
    ↓
127.0.0.1:8000
    ↓
vLLM/Qwen
```

At runtime Qwen must not contact:

* Alibaba/Qwen
* Hugging Face
* OpenAI
* Anthropic
* arbitrary external HTTP services

All model files must already be local.

Verify this rather than merely assuming it.

# Step 20: logging/telemetry policy

Audit every added logger.

Allowed logs:

```text
job abc123 queued
worker starting
model healthy
job abc123 processing
job abc123 completed
worker idle
worker shutting down
```

Forbidden logs:

```text
parsed Docling text
prompt contents
LLM response body
SSNs
EINs
names plus financial data
encryption key
decrypted queue payload
token map
```

Never interpolate full caught request/response objects into errors.

Sanitize model/API errors before logging.

Ensure vLLM:

* request logs off
* access logs off
* debug logs off

If APM/error tracking exists in the application, verify these routes/functions do not attach request bodies as breadcrumbs/context.

# Step 21: model versioning

Store operational metadata such as:

```ts
{
  provider: "self-hosted",
  model: "Qwen/Qwen3-8B",
  modelRevision: "<pinned commit>",
  inferenceServer: "vllm",
  vllmVersion: "...",
  schemaVersion: "..."
}
```

This is useful for debugging extraction accuracy later.

Do not store prompts/responses just to get reproducibility.

# Step 22: tests

Create automated tests using synthetic W-2 text ONLY.

At minimum test:

### PII tokenization

Input:

```text
Employee's social security number
123-45-6789

Employer identification number
87-1234567
```

Verify Qwen input contains:

```text
<SSN_1>
<EIN_1>
```

and does NOT contain either fake original identifier.

Test:

* OCR spaces
* Unicode dash characters
* line breaks
* label on prior line
* two SSNs
* two EINs
* random unrelated 9-digit numbers

Do not misclassify unrelated 9-digit numbers without context.

### Encryption

Verify:

* encrypt/decrypt round trip
* different IV each time
* tampered ciphertext fails authentication
* wrong AAD fails
* wrong key fails
* plaintext is not present in serialized Pub/Sub message

### Structured model output

Using synthetic Docling text, verify:

* valid schema
* correct Box 1
* correct Box 2
* employer and employee fields
* missing values become null
* repeated fields work
* token placeholders survive exactly
* raw SSNs/EINs returned by the LLM are rejected

### Queue behavior

Verify:

* enqueue is durable
* duplicate job delivery is idempotent
* failed processing redelivers
* successful processing ACKs
* acknowledged messages are not retained by our subscription configuration

### Worker lifecycle

Test:

1. VM initially stopped.
2. Enqueue synthetic W-2.
3. VM starts automatically.
4. vLLM becomes healthy.
5. job is processed.
6. result is saved.
7. worker remains RUNNING for approximately 120 seconds after final activity.
8. worker stops automatically.
9. next job starts it again.

### Batch test

Queue 10 synthetic documents at once.

Verify:

* one cold start
* worker drains all jobs
* no stop between jobs
* 120-second timer begins only after final completion
* one shutdown

### Race test

Specifically reproduce:

* worker is nearly at the 120-second idle shutdown
* publish another job

Verify either:

* worker receives it before shutdown and resets timer

OR:

* worker shuts down but the +30/+90 watchdog detects the stopped VM and restarts it

The message must never remain permanently stranded.

### Crash test

Kill/restart the worker during a synthetic job.

Verify Pub/Sub redelivery and idempotent completion.

# Step 23: security verification

After deployment verify:

1. GPU VM has no external IP.
2. Port 8000 is not externally reachable.
3. vLLM listens only on `127.0.0.1`.
4. arbitrary internet HTTP requests from the production VM fail.
5. required Pub/Sub/Secret Manager/Compute API operations still work.
6. model inference works with no Hugging Face/Qwen network connection.
7. grep application/worker/vLLM logs for the synthetic SSN/EIN and confirm neither exists.
8. grep logs for known fragments of the synthetic Docling text and confirm they do not exist.
9. Pub/Sub payload inspection reveals ciphertext, not readable document text.
10. no raw parsed text was added to a database table.
11. no service-account JSON key was committed or placed on disk unnecessarily.

# Step 24: measure actual cold-start and inference behavior

Capture NONSENSITIVE timing metrics only:

* VM start requested
* VM RUNNING
* vLLM healthy
* message processing start
* inference duration
* validation duration
* completion
* shutdown

Do not attach document contents to metrics.

Report:

* cold start duration
* model-load duration
* average synthetic W-2 inference duration
* approximate docs/hour at current concurrency
* GPU memory usage
* whether `g2-standard-8` has comfortable memory headroom

Do not optimize prematurely.

# Step 25: accuracy harness

We need to be able to compare this against the existing deterministic extractor.

Create a small evaluation framework where a fixture can contain:

```ts
{
  parsedText: "...synthetic/redacted...",
  expected: {
    ...
  }
}
```

Report field-level:

* exact matches
* incorrect values
* missing values
* hallucinated values

Do not use production tax documents in committed test fixtures.

Make it easy for us to later run a private benchmark against real documents without committing or logging them.

# Step 26: infrastructure as code / reproducibility

Do not leave this as a pile of one-off terminal commands.

Use the infrastructure approach already established in the repo if there is one.

If none exists, at minimum create version-controlled provisioning/deployment scripts containing the safe/repeatable parts of:

* APIs
* service accounts/IAM
* Pub/Sub
* Cloud Tasks
* controller
* GPU VM
* startup/systemd services
* networking configuration

Secrets must not be included.

All scripts should be idempotent where practical.

# Step 27: cleanup and cost behavior

At the end of a successful test:

* leave the GPU VM STOPPED
* do not leave temporary bootstrap NAT resources running if they were created only for model installation
* do not leave a public IP
* do not leave unnecessary GPU instances
* do not delete the persistent disk/model cache, because we want future starts to avoid downloading Qwen again

Remember: stopped Compute Engine VM CPU/GPU usage stops billing, but persistent disk/storage remains billable.

The intended steady-state low-volume behavior is:

```text
No jobs
→ GPU VM STOPPED

W-2 uploaded
→ encrypted Pub/Sub publish
→ start GPU VM
→ load locally cached Qwen
→ process all waiting jobs
→ remain warm 120 seconds
→ stop VM

Another W-2
→ repeat
```

# Step 28: final deliverable

When finished, give me:

1. A concise architecture description.
2. Exact GCP resources created.
3. Exact files changed/added.
4. Model and pinned revision used.
5. Current VM machine/zone.
6. Security controls implemented.
7. Confirmation that Qwen/vLLM has no public endpoint.
8. Confirmation that the production GPU VM has no public internet access.
9. Confirmation that SSN/EIN are tokenized before the model sees the document.
10. Confirmation that readable Docling text is encrypted before Pub/Sub.
11. Confirmation that raw text/prompts/responses are not logged.
12. Confirmation that worker shuts down after 120 seconds idle.
13. Cold-start timing.
14. Synthetic W-2 inference timing.
15. Estimated documents/hour.
16. Test results.
17. Any remaining security/reliability concerns you found.

Do not claim a security property unless you actually verified it.

Do not weaken these requirements merely to get the demo working.
