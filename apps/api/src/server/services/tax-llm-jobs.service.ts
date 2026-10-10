import { randomUUID } from "node:crypto";
import {
	FORM_SCHEMA_VERSION,
	type TaxParseDocumentInput,
	type W2Form,
	W2FormSchema,
} from "@moat/contracts";
import {
	type AppContext,
	applyParsedTaxDocument,
	applyStructuredTaxExtraction,
	classifyTaxForm,
	createEnvTaxLlmKeyResolver,
	decodeStoredParsedText,
	decryptJsonBytes,
	draftFromW2Form,
	emptyParsedTaxDocument,
	encryptTaxExtractionPayload,
	failTaxDocumentParse,
	type ParsedTaxDocument,
	parseTaxDocument,
	persistParsedTaxDocumentText,
	TAX_LLM_DOCUMENT_TYPE_W2,
	TAX_LLM_INFERENCE_SERVER,
	TAX_LLM_INLINE_WAIT_MS,
	TAX_LLM_MAX_ATTEMPTS,
	TAX_LLM_MODEL,
	TAX_LLM_MODEL_REVISION,
	TAX_LLM_PROVIDER,
	type TaxLlmErrorCode,
	type TaxLlmQueueMessageV1,
	taxLlmInlineWaitOutcome,
	taxOriginalStorageKey,
} from "@moat/domain";
import { z } from "zod";
import { logger } from "~/lib/logger";
import { db } from "~/server/db";
import {
	isDatabaseActorContextEnabled,
	userDatabaseActor,
	withDatabaseActor,
} from "~/server/db-actor";
import { getDatabaseActorClient } from "~/server/db-actor-store";
import { createApiAppContext } from "../createApiAppContext";
import {
	isTaxLlmExtractionEnabled,
	taxLlmModelMetadata,
} from "./tax-llm-config";
import {
	ensureTaxLlmWorkerRunning,
	publishTaxLlmQueueMessage,
} from "./tax-llm-controller-client";
import { getTaxRuntime } from "./taxes.service";

const MAX_SANITIZED_ERROR = 120;
const TAX_LLM_POLL_MS = 5_000;

export function shouldEnqueueTaxLlmExtraction(input: {
	filename: string;
	parsed: ParsedTaxDocument;
}): boolean {
	if (!isTaxLlmExtractionEnabled()) return false;
	const classified = classifyTaxForm({
		filename: input.filename,
		parsed: input.parsed,
	});
	return classified.formType === "W-2";
}

export async function parseDocumentWithOptionalLlm(
	ctx: AppContext,
	input: TaxParseDocumentInput,
): Promise<ParsedTaxDocument> {
	const runtime = getTaxRuntime();
	const parseStarted = Date.now();
	const parsed = await parseTaxDocument(runtime, input);
	const willEnqueueLlm = shouldEnqueueTaxLlmExtraction({
		filename: input.filename,
		parsed,
	});
	logger.info("tax_parse_document_ready", {
		feature: "tax-llm",
		operation: "parseDocumentWithOptionalLlm",
		durationMs: Date.now() - parseStarted,
		willEnqueueLlm,
		parserName: parsed.parserName,
	});
	if (!willEnqueueLlm) {
		return parsed;
	}

	const documentId = randomUUID();
	const taxYear = taxYearFromFilename(input.filename);
	const bytes = new Uint8Array(Buffer.from(input.data, "base64"));
	const originalKey = taxOriginalStorageKey({
		userId: ctx.userId,
		taxYear,
		documentId,
	});
	await runtime.storage.put({
		key: originalKey,
		bytes,
		mimeType: input.mimeType,
		visibility: "private",
	});

	try {
		const queued = await withTaxUserActor(ctx.userId, async () => {
			await db.taxDocument.create({
				data: {
					id: documentId,
					userId: ctx.userId,
					taxYear,
					documentCategory: "wage",
					formType: "W-2",
					source: "upload",
					originalFilename: input.filename,
					mimeType: input.mimeType,
					processingState: "processing",
					originalStorageKey: originalKey,
					reviewStatus: "pending",
					userConfirmed: false,
					metadata: { byteSize: bytes.byteLength, parseSession: true },
				},
			});
			return enqueueTaxLlmExtraction({
				userId: ctx.userId,
				documentId,
				parsed,
			});
		});
		if (!queued.jobId) {
			logger.warn("tax_llm_parse_document_without_llm", {
				feature: "tax-llm",
				operation: "parseDocumentWithOptionalLlm",
				documentId,
				llmStatus: queued.status || "not_queued",
			});
			return parsed;
		}
		const status = await waitForTaxLlmJob(ctx.userId, queued.jobId);
		if (status !== "completed") {
			logger.warn("tax_llm_parse_document_without_llm", {
				feature: "tax-llm",
				operation: "parseDocumentWithOptionalLlm",
				documentId,
				jobId: queued.jobId,
				llmStatus: status,
			});
			return parsed;
		}
		const extraction = await withTaxUserActor(ctx.userId, () =>
			db.taxFormExtraction.findFirst({
				where: { documentId, userId: ctx.userId },
				select: { payload: true },
			}),
		);
		const payload = W2FormSchema.safeParse(extraction?.payload);
		if (!payload.success) {
			logger.warn("tax_llm_parse_document_payload_invalid", {
				feature: "tax-llm",
				operation: "parseDocumentWithOptionalLlm",
				documentId,
				jobId: queued.jobId,
			});
			return parsed;
		}
		logger.info("tax_llm_parse_document_completed", {
			feature: "tax-llm",
			operation: "parseDocumentWithOptionalLlm",
			documentId,
			jobId: queued.jobId,
			durationMs: Date.now() - parseStarted,
		});
		return {
			...parsed,
			parserName: "docling+qwen",
			parserVersion: TAX_LLM_MODEL_REVISION,
			formClassification: "W-2",
			extractedFields: payload.data,
			confidence: 0.9,
		};
	} catch (error) {
		logger.warn("tax_llm_parse_document_failed", {
			feature: "tax-llm",
			operation: "parseDocumentWithOptionalLlm",
			documentId,
			errorName: error instanceof Error ? error.name : "unknown",
			errorMessage: error instanceof Error ? error.message : "unknown",
		});
		return parsed;
	} finally {
		await withTaxUserActor(ctx.userId, () =>
			db.taxDocument.delete({ where: { id: documentId } }),
		).catch(() => {
			logger.warn("tax_llm_parse_session_cleanup_failed", {
				feature: "tax-llm",
				operation: "parseDocumentWithOptionalLlm",
				documentId,
			});
		});
		await runtime.storage.delete(originalKey).catch(() => undefined);
	}
}

export async function applyInlineTaxLlmExtraction(input: {
	userId: string;
	documentId: string;
	filename: string;
	parsed: ParsedTaxDocument;
}): Promise<boolean> {
	if (
		!shouldEnqueueTaxLlmExtraction({
			filename: input.filename,
			parsed: input.parsed,
		})
	) {
		return false;
	}
	try {
		await withTaxUserActor(input.userId, () =>
			enqueueTaxLlmExtraction({
				userId: input.userId,
				documentId: input.documentId,
				parsed: input.parsed,
			}),
		);
		return false;
	} catch (error) {
		logger.warn("tax_llm_inline_failed", {
			feature: "tax-llm",
			operation: "applyInlineTaxLlmExtraction",
			documentId: input.documentId,
			errorName: error instanceof Error ? error.name : "unknown",
		});
		return false;
	}
}

async function waitForTaxLlmJob(
	userId: string,
	jobId: string,
): Promise<"completed" | "failed" | "timeout"> {
	const started = Date.now();
	const deadline = started + TAX_LLM_INLINE_WAIT_MS;
	let firstStatus: string | null = null;
	let lastStatus: string | null = null;
	let lastErrorCode: string | null = null;
	let attemptCount = 0;
	logger.info("tax_llm_wait_started", {
		feature: "tax-llm",
		operation: "waitForTaxLlmJob",
		jobId,
		waitMs: TAX_LLM_INLINE_WAIT_MS,
	});
	while (Date.now() < deadline) {
		const job = await withTaxUserActor(userId, () =>
			db.taxLlmExtractionJob.findFirst({
				where: { id: jobId },
				select: {
					status: true,
					lastErrorCode: true,
					attemptCount: true,
				},
			}),
		);
		lastStatus = job?.status ?? "missing";
		lastErrorCode = job?.lastErrorCode ?? null;
		attemptCount = job?.attemptCount ?? 0;
		if (firstStatus === null) firstStatus = lastStatus;
		const outcome = taxLlmInlineWaitOutcome({
			status: lastStatus,
			lastErrorCode,
		});
		if (outcome === "completed") {
			logger.info("tax_llm_wait_completed", {
				feature: "tax-llm",
				operation: "waitForTaxLlmJob",
				jobId,
				elapsedMs: Date.now() - started,
				attemptCount,
			});
			return "completed";
		}
		if (outcome === "failed") {
			logger.warn("tax_llm_wait_job_failed", {
				feature: "tax-llm",
				operation: "waitForTaxLlmJob",
				jobId,
				elapsedMs: Date.now() - started,
				attemptCount,
				lastErrorCode,
				lastStatus,
			});
			return "failed";
		}
		await new Promise((resolve) => setTimeout(resolve, TAX_LLM_POLL_MS));
	}
	logger.warn("tax_llm_wait_timeout", {
		feature: "tax-llm",
		operation: "waitForTaxLlmJob",
		jobId,
		firstStatus,
		lastStatus,
		lastErrorCode,
		attemptCount,
		elapsedMs: Date.now() - started,
		waitMs: TAX_LLM_INLINE_WAIT_MS,
	});
	return "timeout";
}

function taxYearFromFilename(filename: string): number {
	const match = filename.match(/(?:^|[^\d])(20\d{2})(?:[^\d]|$)/);
	if (match?.[1]) return Number(match[1]);
	return new Date().getFullYear();
}

async function withTaxUserActor<T>(
	userId: string,
	callback: () => Promise<T>,
): Promise<T> {
	if (!isDatabaseActorContextEnabled()) return callback();
	if (getDatabaseActorClient()) return callback();
	return withDatabaseActor(userDatabaseActor({ userId }), callback);
}

export async function enqueueTaxLlmExtraction(input: {
	userId: string;
	documentId: string;
	parsed: ParsedTaxDocument;
}): Promise<{ jobId: string; status: string }> {
	const document = await db.taxDocument.findFirst({
		where: { id: input.documentId, userId: input.userId },
		select: {
			id: true,
			taxYear: true,
			originalFilename: true,
			processingState: true,
		},
	});
	if (!document) {
		return { jobId: "", status: "not_found" };
	}

	const ctx = createApiAppContext(input.userId, db);
	const runtime = getTaxRuntime();
	await persistParsedTaxDocumentText(
		ctx,
		runtime,
		input.documentId,
		input.parsed,
	);

	const metadata = taxLlmModelMetadata();
	const job = await db.taxLlmExtractionJob.create({
		data: {
			userId: input.userId,
			documentId: input.documentId,
			status: "QUEUED",
			attemptCount: 0,
			maxAttempts: TAX_LLM_MAX_ATTEMPTS,
			documentType: TAX_LLM_DOCUMENT_TYPE_W2,
			schemaVersion: FORM_SCHEMA_VERSION,
			provider: TAX_LLM_PROVIDER,
			model: TAX_LLM_MODEL,
			modelRevision: TAX_LLM_MODEL_REVISION,
			inferenceServer: TAX_LLM_INFERENCE_SERVER,
		},
	});

	const keys = createEnvTaxLlmKeyResolver();
	try {
		const message = encryptTaxExtractionPayload({
			jobId: job.id,
			documentType: TAX_LLM_DOCUMENT_TYPE_W2,
			schemaVersion: FORM_SCHEMA_VERSION,
			plaintext: {
				documentId: input.documentId,
				taxYear: document.taxYear,
				filename: document.originalFilename,
				parsedText: input.parsed.text,
			},
			keys,
		});
		await publishTaxLlmQueueMessage(message);
		await ensureTaxLlmWorkerRunning();
		logger.info("tax_llm_job_queued", {
			feature: "tax-llm",
			operation: "enqueue",
			jobId: job.id,
			documentId: input.documentId,
			model: metadata.model,
		});
		return { jobId: job.id, status: "queued" };
	} catch (error) {
		await db.taxLlmExtractionJob.update({
			where: { id: job.id },
			data: {
				status: "FAILED",
				lastErrorCode: "WORKER_UNAVAILABLE",
				lastErrorMessage: sanitizeTaxLlmError(error),
				completedAt: new Date(),
			},
		});
		logger.error("tax_llm_enqueue_failed", {
			feature: "tax-llm",
			operation: "enqueue",
			jobId: job.id,
			errorName: error instanceof Error ? error.name : "unknown",
		});
		throw error;
	}
}

export async function markTaxLlmJobProcessing(input: {
	jobId: string;
}): Promise<{ status: string; attemptCount: number; maxAttempts: number }> {
	const job = await db.taxLlmExtractionJob.findFirst({
		where: { id: input.jobId },
	});
	if (!job) return { status: "not_found", attemptCount: 0, maxAttempts: 0 };
	if (job.status === "COMPLETED" || job.status === "FAILED") {
		return {
			status: job.status,
			attemptCount: job.attemptCount,
			maxAttempts: job.maxAttempts,
		};
	}
	if (job.attemptCount >= job.maxAttempts) {
		return {
			status: "FAILED",
			attemptCount: job.attemptCount,
			maxAttempts: job.maxAttempts,
		};
	}
	const updated = await db.taxLlmExtractionJob.updateMany({
		where: {
			id: job.id,
			status: { in: ["QUEUED", "PROCESSING"] },
			attemptCount: job.attemptCount,
		},
		data: {
			status: "PROCESSING",
			attemptCount: job.attemptCount + 1,
			startedAt: job.startedAt ?? new Date(),
		},
	});
	if (updated.count === 0) {
		const current = await db.taxLlmExtractionJob.findFirst({
			where: { id: job.id },
		});
		return {
			status: current?.status ?? "not_found",
			attemptCount: current?.attemptCount ?? job.attemptCount,
			maxAttempts: current?.maxAttempts ?? job.maxAttempts,
		};
	}
	return {
		status: "PROCESSING",
		attemptCount: job.attemptCount + 1,
		maxAttempts: job.maxAttempts,
	};
}

export async function markTaxLlmJobFailed(input: {
	jobId: string;
	errorCode: TaxLlmErrorCode;
	ack?: boolean;
}): Promise<{ status: string }> {
	const job = await db.taxLlmExtractionJob.findFirst({
		where: { id: input.jobId },
	});
	if (!job) return { status: "not_found" };
	if (job.status === "COMPLETED") return { status: "already_completed" };
	if (job.status === "FAILED") return { status: "failed" };
	const failed = job.attemptCount >= job.maxAttempts;
	await db.taxLlmExtractionJob.update({
		where: { id: job.id },
		data: {
			status: failed ? "FAILED" : "QUEUED",
			lastErrorCode: input.errorCode,
			lastErrorMessage: input.errorCode,
			completedAt: failed ? new Date() : null,
		},
	});
	if (failed) {
		await fallbackTaxLlmToDeterministic({
			userId: job.userId,
			documentId: job.documentId,
		});
	}
	return { status: failed ? "failed" : "retrying" };
}

export async function applyTaxLlmExtractionResult(input: {
	envelope: unknown;
}): Promise<{ status: string }> {
	const envelope = z
		.object({
			version: z.literal(1),
			jobId: z.string().min(1),
			documentType: z.literal("W2"),
			schemaVersion: z.string().min(1),
			encryption: z.object({
				algorithm: z.literal("aes-256-gcm"),
				keyVersion: z.string().min(1),
				iv: z.string().min(1),
				authTag: z.string().min(1),
				ciphertext: z.string().min(1),
			}),
			model: z
				.object({
					provider: z.string(),
					model: z.string(),
					modelRevision: z.string(),
					inferenceServer: z.string().optional(),
					vllmVersion: z.string().optional(),
				})
				.optional(),
		})
		.parse(input.envelope);

	const job = await db.taxLlmExtractionJob.findFirst({
		where: { id: envelope.jobId },
	});
	if (!job) return { status: "not_found" };
	if (job.status === "COMPLETED") return { status: "already_completed" };

	const keys = createEnvTaxLlmKeyResolver();
	const decrypted = decryptJsonBytes({
		jobId: envelope.jobId,
		documentType: envelope.documentType,
		schemaVersion: envelope.schemaVersion,
		encryption: envelope.encryption,
		keys,
	});
	const payload = W2FormSchema.parse(decrypted) as W2Form;
	const document = await db.taxDocument.findFirst({
		where: { id: job.documentId, userId: job.userId },
		select: { originalFilename: true, taxYear: true, formType: true },
	});
	if (!document) return { status: "not_found" };

	const ctx = createApiAppContext(job.userId, db);
	const runtime = getTaxRuntime();
	const draft = draftFromW2Form({
		taxYear: document.taxYear,
		documentId: job.documentId,
		filename: document.originalFilename,
		formType: "W-2",
		documentCategory: "wage",
		now: new Date(),
		payload,
		extractionMethod: "llm",
	});
	await applyStructuredTaxExtraction(ctx, runtime, job.documentId, draft, {
		parserName: "docling+qwen",
		parserVersion: envelope.model?.modelRevision ?? TAX_LLM_MODEL_REVISION,
		text: "",
	});
	await db.taxLlmExtractionJob.update({
		where: { id: job.id },
		data: {
			status: "COMPLETED",
			completedAt: new Date(),
			modelRevision: envelope.model?.modelRevision ?? job.modelRevision,
			vllmVersion: envelope.model?.vllmVersion ?? job.vllmVersion,
			lastErrorCode: null,
			lastErrorMessage: null,
		},
	});
	logger.info("tax_llm_job_completed", {
		feature: "tax-llm",
		operation: "applyResult",
		jobId: job.id,
		documentId: job.documentId,
	});
	return { status: "completed" };
}

async function fallbackTaxLlmToDeterministic(job: {
	userId: string;
	documentId: string;
}): Promise<void> {
	const ctx = createApiAppContext(job.userId, db);
	const runtime = getTaxRuntime();
	const document = await db.taxDocument.findFirst({
		where: { id: job.documentId, userId: job.userId },
		select: {
			parsedStorageKey: true,
			processingState: true,
			parserProvider: true,
			parserVersion: true,
		},
	});
	if (!document || document.processingState !== "processing") return;
	if (!document.parsedStorageKey) {
		await failTaxDocumentParse(ctx, runtime, job.documentId);
		return;
	}
	try {
		const stored = await runtime.storage.get(document.parsedStorageKey);
		const text = decodeStoredParsedText(stored.bytes);
		const parsed = emptyParsedTaxDocument({
			text,
			pages: [{ page: 1, text }],
			pageCount: 1,
			parserName: document.parserProvider ?? "docling",
			parserVersion: document.parserVersion ?? "unknown",
			formClassification: "W-2",
			formHints: ["W-2"],
		});
		await applyParsedTaxDocument(ctx, runtime, job.documentId, parsed);
		logger.warn("tax_llm_fallback_deterministic", {
			feature: "tax-llm",
			operation: "fallbackTaxLlmToDeterministic",
			documentId: job.documentId,
		});
	} catch (error) {
		logger.error("tax_llm_fallback_failed", {
			feature: "tax-llm",
			operation: "fallbackTaxLlmToDeterministic",
			documentId: job.documentId,
			errorName: error instanceof Error ? error.name : "unknown",
		});
		await failTaxDocumentParse(ctx, runtime, job.documentId);
	}
}

export function sanitizeTaxLlmError(error: unknown): string {
	const message = error instanceof Error ? error.message : "unknown";
	return message.replace(/\s+/g, " ").slice(0, MAX_SANITIZED_ERROR);
}

export type { TaxLlmQueueMessageV1 };
