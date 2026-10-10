import {
	applyParsedTaxDocument,
	failTaxDocumentParse,
	type ParsedTaxDocument,
} from "@moat/domain";
import { z } from "zod";
import { logger } from "~/lib/logger";
import { db } from "~/server/db";
import { Prisma } from "../../../generated/prisma";
import { createApiAppContext } from "../createApiAppContext";
import {
	enqueueTaxLlmExtraction,
	shouldEnqueueTaxLlmExtraction,
} from "./tax-llm-jobs.service";
import { getTaxRuntime } from "./taxes.service";

const DRAIN_BATCH_SIZE = 3;
const PARSE_CLAIM_TTL_MS = 20 * 60 * 1000;

const ParsedTaxBBoxSchema = z.object({
	page: z.number(),
	left: z.number(),
	top: z.number(),
	right: z.number(),
	bottom: z.number(),
});

const ParsedTaxDocumentSchema = z
	.object({
		text: z.string(),
		pages: z.array(
			z.object({
				page: z.number().int().positive(),
				text: z.string(),
			}),
		),
		tables: z.array(
			z.object({
				headers: z.array(z.string()),
				rows: z.array(z.array(z.string())),
				page: z.number().int().positive().optional(),
				bbox: ParsedTaxBBoxSchema.optional(),
			}),
		),
		keyValues: z.array(
			z.object({
				key: z.string(),
				value: z.string(),
				confidence: z.number().optional(),
				page: z.number().optional(),
			}),
		),
		formClassification: z.string().nullable(),
		extractedFields: z.record(z.string(), z.unknown()),
		confidence: z.number(),
		sourceLocations: z.array(
			z.object({
				page: z.number().optional(),
				label: z.string(),
				text: z.string(),
				bbox: ParsedTaxBBoxSchema.optional(),
			}),
		),
		blocks: z
			.array(
				z.object({
					page: z.number(),
					text: z.string(),
					type: z.string().optional(),
					confidence: z.number().optional(),
					bbox: ParsedTaxBBoxSchema.optional(),
				}),
			)
			.optional(),
		formHints: z.array(z.string()).optional(),
		parserName: z.string().optional(),
		parserVersion: z.string().optional(),
		parsedAt: z.string().optional(),
		pageCount: z.number().int().nonnegative().optional(),
	})
	.passthrough();

export type PendingTaxParseJob = {
	documentId: string;
	userId: string;
	taxYear: number;
	mimeType: string;
	byteSize: number | null;
};

type ClaimedTaxParseRow = {
	id: string;
	userId: string;
	taxYear: number;
	mimeType: string;
	metadata: unknown;
};

export function parseClaimedTaxDocument(input: unknown): ParsedTaxDocument {
	return ParsedTaxDocumentSchema.parse(input) as ParsedTaxDocument;
}

export async function listPendingTaxParseJobs(): Promise<PendingTaxParseJob[]> {
	const rows = await db.$queryRaw<ClaimedTaxParseRow[]>(Prisma.sql`
		UPDATE "TaxDocument" AS claimed
		SET
			metadata = jsonb_set(
				COALESCE(claimed.metadata, '{}'::jsonb),
				'{parseClaimedAt}',
				to_jsonb((EXTRACT(EPOCH FROM CLOCK_TIMESTAMP()) * 1000)::bigint)
			),
			"updatedAt" = CLOCK_TIMESTAMP()
		FROM (
			SELECT id
			FROM "TaxDocument"
			WHERE "processingState" = 'processing'
				AND (
					metadata->>'parseClaimedAt' IS NULL
					OR (metadata->>'parseClaimedAt')::double precision < (
						EXTRACT(EPOCH FROM CLOCK_TIMESTAMP()) * 1000 - ${PARSE_CLAIM_TTL_MS}
					)
				)
			ORDER BY "uploadedAt" ASC
			LIMIT ${DRAIN_BATCH_SIZE}
			FOR UPDATE SKIP LOCKED
		) AS pending
		WHERE claimed.id = pending.id
		RETURNING
			claimed.id,
			claimed."userId",
			claimed."taxYear",
			claimed."mimeType",
			claimed.metadata
	`);
	return rows.map((row) => ({
		documentId: row.id,
		userId: row.userId,
		taxYear: row.taxYear,
		mimeType: row.mimeType,
		byteSize: byteSizeFromMetadata(row.metadata),
	}));
}

export async function readTaxParseSource(input: {
	userId: string;
	documentId: string;
}): Promise<{ bytes: Uint8Array; mimeType: string } | null> {
	const document = await db.taxDocument.findFirst({
		where: { id: input.documentId, userId: input.userId },
		select: {
			originalStorageKey: true,
			mimeType: true,
			processingState: true,
		},
	});
	if (!document || document.processingState !== "processing") {
		return null;
	}
	return getTaxRuntime().storage.get(document.originalStorageKey);
}

export async function applyTaxParseResult(input: {
	userId: string;
	documentId: string;
	parsed?: unknown;
	failed?: boolean;
}): Promise<{ status: string }> {
	const document = await db.taxDocument.findFirst({
		where: { id: input.documentId, userId: input.userId },
		select: { processingState: true },
	});
	if (!document) {
		return { status: "not_found" };
	}
	if (document.processingState !== "processing") {
		return { status: "ignored" };
	}

	const ctx = createApiAppContext(input.userId, db);
	const runtime = getTaxRuntime();
	if (input.failed || !input.parsed) {
		await failTaxDocumentParse(ctx, runtime, input.documentId);
		return { status: "failed" };
	}
	const parsed = parseClaimedTaxDocument(input.parsed);
	const documentMeta = await db.taxDocument.findFirst({
		where: { id: input.documentId, userId: input.userId },
		select: { originalFilename: true },
	});
	if (
		documentMeta &&
		shouldEnqueueTaxLlmExtraction({
			filename: documentMeta.originalFilename,
			parsed,
		})
	) {
		try {
			await enqueueTaxLlmExtraction({
				userId: input.userId,
				documentId: input.documentId,
				parsed,
			});
			logger.info("tax_parse_result_queued_llm", {
				feature: "tax-llm",
				operation: "applyTaxParseResult",
				documentId: input.documentId,
				pageCount: parsed.pageCount ?? parsed.pages.length,
			});
			return { status: "processing" };
		} catch {
			logger.warn("tax_llm_fallback_deterministic", {
				feature: "tax-llm",
				operation: "applyTaxParseResult",
				documentId: input.documentId,
			});
		}
	}
	const result = await applyParsedTaxDocument(
		ctx,
		runtime,
		input.documentId,
		parsed,
	);
	logger.info("tax_parse_result_applied", {
		feature: "tax-parse",
		operation: "applyTaxParseResult",
		documentId: input.documentId,
		processingState: result.processingState,
		pageCount: parsed.pageCount ?? parsed.pages.length,
		parserVersion: parsed.parserVersion ?? runtime.parser.version,
	});
	return { status: result.processingState };
}

function byteSizeFromMetadata(metadata: unknown): number | null {
	if (
		metadata &&
		typeof metadata === "object" &&
		"byteSize" in metadata &&
		typeof metadata.byteSize === "number"
	) {
		return metadata.byteSize;
	}
	return null;
}
