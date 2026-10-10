import { type Message, PubSub } from "@google-cloud/pubsub";
import { SecretManagerServiceClient } from "@google-cloud/secret-manager";
import {
	createIdleDeadline,
	decryptTaxExtractionPayload,
	encryptJsonBytes,
	isIdle,
	parseTaxLlmKeyBase64,
	parseTaxLlmQueueMessage,
	TAX_LLM_IDLE_MS,
	TAX_LLM_INFERENCE_SERVER,
	TAX_LLM_MAX_ATTEMPTS,
	TAX_LLM_MODEL,
	TAX_LLM_MODEL_REVISION,
	TAX_LLM_PROVIDER,
	TAX_LLM_SERVED_MODEL_NAME,
	type TaxLlmErrorCode,
	type TaxLlmKeyResolver,
	taxLlmErrorCodeFrom,
	tokenizeSsnsAndEins,
	validateAndRestoreW2,
	W2_EXTRACTION_SYSTEM_PROMPT,
	w2ExtractionJsonSchema,
	w2ExtractionUserPrompt,
} from "@moat/domain";
import { GoogleAuth } from "google-auth-library";
import { requiredEnv, taxLlmConfig } from "../config";
import { taxLlmLog, taxLlmWarn } from "../safe-log";
import { withTimeout } from "../with-timeout";
import { computeErrorName, stopThisInstance } from "./stop-instance";

const HEALTH_POLL_MS = 2000;
const HEALTH_TIMEOUT_MS = 15 * 60 * 1000;
const INFERENCE_TIMEOUT_MS = 120_000;
const FINAL_DRAIN_MS = 2000;

type JobClaim = {
	status: string;
	attemptCount: number;
	maxAttempts: number;
};

function secretKeyResolver(key: Buffer, keyVersion: string): TaxLlmKeyResolver {
	return {
		activeKey: () => ({ keyVersion, key }),
		keyForVersion: (version: string) => {
			if (version !== keyVersion) {
				throw new Error("Tax LLM encryption key version is not configured");
			}
			return { keyVersion, key };
		},
	};
}

async function loadEncryptionKey(): Promise<TaxLlmKeyResolver> {
	const config = taxLlmConfig();
	const secrets = new SecretManagerServiceClient();
	const [version] = await secrets.accessSecretVersion({
		name: `projects/${config.projectId}/secrets/${config.secretName}/versions/latest`,
	});
	const payload = version.payload?.data;
	if (!payload) {
		throw new Error("Tax LLM encryption secret is empty");
	}
	const raw = Buffer.isBuffer(payload)
		? payload.toString("utf8")
		: Buffer.from(payload as Uint8Array).toString("utf8");
	return secretKeyResolver(
		parseTaxLlmKeyBase64(raw.trim(), config.keyVersion),
		config.keyVersion,
	);
}

async function waitForVllm(): Promise<void> {
	const config = taxLlmConfig();
	const deadline = Date.now() + HEALTH_TIMEOUT_MS;
	while (Date.now() < deadline) {
		try {
			const response = await fetch(`${config.vllmUrl}/health`);
			if (response.ok) {
				taxLlmLog("model healthy");
				return;
			}
		} catch {
			// vLLM is still loading weights; this is not idle time.
		}
		await new Promise((resolve) => setTimeout(resolve, HEALTH_POLL_MS));
	}
	throw new Error("MODEL_STARTING");
}

async function extractW2(redactedText: string): Promise<unknown> {
	const config = taxLlmConfig();
	const controller = new AbortController();
	const timeout = setTimeout(() => controller.abort(), INFERENCE_TIMEOUT_MS);
	try {
		const response = await fetch(`${config.vllmUrl}/v1/chat/completions`, {
			method: "POST",
			headers: { "content-type": "application/json" },
			signal: controller.signal,
			body: JSON.stringify({
				model: TAX_LLM_SERVED_MODEL_NAME,
				temperature: 0.1,
				max_tokens: 2048,
				messages: [
					{ role: "system", content: W2_EXTRACTION_SYSTEM_PROMPT },
					{ role: "user", content: w2ExtractionUserPrompt(redactedText) },
				],
				chat_template_kwargs: { enable_thinking: false },
				response_format: {
					type: "json_schema",
					json_schema: {
						name: "w2_extraction",
						strict: true,
						schema: w2ExtractionJsonSchema(),
					},
				},
			}),
		});
		if (!response.ok) {
			throw new Error("MODEL_INVALID_JSON");
		}
		const payload = (await response.json()) as {
			choices?: Array<{
				message?: { content?: unknown };
			}>;
		};
		const content = completionContent(payload.choices?.[0]?.message?.content);
		try {
			return JSON.parse(content);
		} catch {
			throw new Error("MODEL_INVALID_JSON");
		}
	} catch (error) {
		if (error instanceof Error && error.name === "AbortError") {
			throw new Error("MODEL_TIMEOUT");
		}
		throw error;
	} finally {
		clearTimeout(timeout);
	}
}

function completionContent(content: unknown): string {
	if (typeof content === "string" && content.trim()) return content;
	if (Array.isArray(content)) {
		const joined = content
			.map((part) => {
				if (typeof part === "string") return part;
				if (
					part &&
					typeof part === "object" &&
					"text" in part &&
					typeof part.text === "string"
				) {
					return part.text;
				}
				return "";
			})
			.join("");
		if (joined.trim()) return joined;
	}
	throw new Error("MODEL_INVALID_JSON");
}

async function identityToken(audience: string): Promise<string> {
	const auth = new GoogleAuth();
	const client = await auth.getIdTokenClient(audience);
	const headers = await client.getRequestHeaders();
	const authorization =
		typeof headers.get === "function"
			? headers.get("Authorization")
			: (headers as unknown as Record<string, string>).Authorization;
	if (
		typeof authorization !== "string" ||
		!authorization.startsWith("Bearer ")
	) {
		throw new Error("Unable to obtain identity token");
	}
	return authorization.slice("Bearer ".length);
}

async function controllerRequest(
	path: string,
	body: Record<string, unknown>,
): Promise<Record<string, unknown>> {
	const controllerUrl = requiredEnv("TAX_LLM_CONTROLLER_URL").replace(
		/\/$/,
		"",
	);
	const token = await identityToken(controllerUrl);
	const response = await fetch(`${controllerUrl}${path}`, {
		method: "POST",
		headers: {
			authorization: `Bearer ${token}`,
			"content-type": "application/json",
		},
		body: JSON.stringify(body),
	});
	if (!response.ok) {
		throw new Error("PERSISTENCE_FAILED");
	}
	return (await response.json()) as Record<string, unknown>;
}

async function claimJob(jobId: string): Promise<JobClaim> {
	return (await controllerRequest("/v1/claim", { jobId })) as JobClaim;
}

async function failJob(
	jobId: string,
	errorCode: TaxLlmErrorCode,
): Promise<{ status: string }> {
	const payload = await controllerRequest("/v1/fail", { jobId, errorCode });
	return {
		status: typeof payload.status === "string" ? payload.status : "retrying",
	};
}

async function persistResult(envelope: unknown): Promise<string> {
	const payload = await controllerRequest("/v1/persist", { envelope });
	return typeof payload.status === "string" ? payload.status : "ok";
}

async function main(): Promise<void> {
	taxLlmLog("worker starting");
	const config = taxLlmConfig();
	const keys = await loadEncryptionKey();
	await waitForVllm();

	const pubsub = new PubSub();
	const subscription = pubsub.subscription(config.subscription, {
		flowControl: { maxMessages: 1, allowExcessMessages: false },
	});

	let inFlight = 0;
	let idleDeadline = createIdleDeadline(Date.now(), TAX_LLM_IDLE_MS);
	let shutdownInProgress = false;

	function bumpIdle(): void {
		idleDeadline = createIdleDeadline(Date.now(), TAX_LLM_IDLE_MS);
	}

	async function handleMessage(message: Message): Promise<void> {
		inFlight += 1;
		bumpIdle();
		let jobId = "";
		try {
			const queueMessage = parseTaxLlmQueueMessage(
				JSON.parse(message.data.toString("utf8")),
			);
			jobId = queueMessage.jobId;
			taxLlmLog("job processing", { jobId });
			const claim = await claimJob(jobId);
			if (claim.status === "COMPLETED") {
				message.ack();
				taxLlmLog("job completed", { jobId, status: "already_completed" });
				return;
			}
			if (
				claim.status === "FAILED" ||
				claim.status === "not_found" ||
				claim.attemptCount > (claim.maxAttempts || TAX_LLM_MAX_ATTEMPTS)
			) {
				message.ack();
				return;
			}
			const plaintext = decryptTaxExtractionPayload({
				message: queueMessage,
				keys,
			});
			const tokenized = tokenizeSsnsAndEins(plaintext.parsedText);
			const raw = await extractW2(tokenized.redactedText);
			const restored = validateAndRestoreW2({
				raw,
				tokenMap: tokenized.tokenMap,
			});
			const resultEnvelope = {
				version: 1 as const,
				jobId,
				documentType: "W2" as const,
				schemaVersion: queueMessage.schemaVersion,
				encryption: encryptJsonBytes({
					jobId,
					documentType: "W2",
					schemaVersion: queueMessage.schemaVersion,
					value: restored,
					keys,
				}),
				model: {
					provider: TAX_LLM_PROVIDER,
					model: TAX_LLM_MODEL,
					modelRevision: TAX_LLM_MODEL_REVISION,
					inferenceServer: TAX_LLM_INFERENCE_SERVER,
					vllmVersion: process.env.VLLM_VERSION?.trim() || undefined,
				},
			};
			const persistStatus = await persistResult(resultEnvelope);
			if (
				persistStatus !== "completed" &&
				persistStatus !== "already_completed"
			) {
				throw new Error("PERSISTENCE_FAILED");
			}
			message.ack();
			taxLlmLog("job completed", { jobId });
		} catch (error) {
			const code = taxLlmErrorCodeFrom(error);
			if (jobId) {
				try {
					const failed = await failJob(jobId, code);
					if (failed.status === "failed") message.ack();
					else message.nack();
				} catch {
					message.nack();
				}
			} else {
				message.nack();
			}
			taxLlmWarn("job_failed", {
				jobId,
				operation: code,
				errorName: error instanceof Error ? error.name : "unknown",
			});
		} finally {
			inFlight = Math.max(0, inFlight - 1);
			bumpIdle();
		}
	}

	subscription.on("message", (message: Message) => {
		void handleMessage(message);
	});
	subscription.on("error", (error) => {
		taxLlmWarn("pubsub_error", {
			errorName: error instanceof Error ? error.name : "unknown",
			operation: "subscribe",
		});
	});

	const idleTimer = setInterval(() => {
		void maybeShutdown();
	}, 1000);

	async function maybeShutdown(): Promise<void> {
		if (shutdownInProgress) return;
		if (
			!isIdle({
				nowMs: Date.now(),
				idleDeadlineMs: idleDeadline,
				inFlightCount: inFlight,
			})
		) {
			return;
		}
		shutdownInProgress = true;
		taxLlmLog("worker idle");
		await new Promise((resolve) => setTimeout(resolve, FINAL_DRAIN_MS));
		if (
			!isIdle({
				nowMs: Date.now(),
				idleDeadlineMs: idleDeadline,
				inFlightCount: inFlight,
			})
		) {
			shutdownInProgress = false;
			return;
		}
		try {
			await withTimeout(subscription.close(), 5_000, "subscription_close");
		} catch (error) {
			taxLlmWarn("subscription_close_failed", {
				operation: "close",
				errorName: computeErrorName(error),
			});
		}
		while (inFlight > 0) {
			await new Promise((resolve) => setTimeout(resolve, 100));
		}
		if (
			!isIdle({
				nowMs: Date.now(),
				idleDeadlineMs: idleDeadline,
				inFlightCount: inFlight,
			})
		) {
			process.exit(1);
		}
		taxLlmLog("worker shutting down", { operation: "stop" });
		clearInterval(idleTimer);
		try {
			const status = await stopThisInstance();
			taxLlmLog("worker shutting down", {
				operation: "stop",
				status,
			});
			process.exit(0);
		} catch (error) {
			taxLlmWarn("worker_stop_failed", {
				operation: "stop",
				errorName: computeErrorName(error),
			});
			process.exit(1);
		}
	}
}

void main().catch((error) => {
	taxLlmWarn("worker_boot_failed", {
		errorName: error instanceof Error ? error.name : "unknown",
		operation: "boot",
	});
	process.exit(1);
});
