import { randomUUID } from "node:crypto";
import {
	isManageableTaxDocument,
	type TaxAgentContext,
	type TaxConfirmFactInput,
	type TaxCreateManualFactInput,
	type TaxDocumentDetail,
	type TaxFact,
	type TaxGetDocumentInput,
	type TaxListFactsInput,
	type TaxOverview,
	type TaxParseDocumentInput,
	type TaxReadiness,
	type TaxRenameDocumentInput,
	type TaxResolveConflictInput,
	type TaxSearchInput,
	type TaxUpdateFactInput,
	type TaxUploadDocumentInput,
	type TaxYearInput,
	type TaxYearProfile,
	type TaxYearsResponse,
	taxDocumentTitle,
} from "@moat/contracts";
import type { AppContext } from "../context";
import { getTaxYear } from "../federal-rules/tax-year";
import { buildTaxAgentContext } from "./agent-context";
import {
	generateFinancialCandidates,
	mergeFinancialCandidates,
	parseFinancialCandidateId,
} from "./candidates";
import { estimateTaxResult } from "./estimate";
import {
	type ExtractedTaxDraft,
	extractFactsFromParsed,
} from "./extract-facts";
import {
	type FileStorageProvider,
	taxOriginalStorageKey,
	taxParsedStorageKey,
} from "./file-storage";
import {
	factToRecord,
	toTaxConflictDto,
	toTaxDocumentDto,
	toTaxFactDto,
	toTaxFormExtractionDto,
} from "./mapping";
import {
	buildOverviewMetricBreakdowns,
	isCapitalGainFact,
	isDeductionFact,
	isIncomeIdentifiedFact,
	isTaxesWithheldFact,
} from "./overview-breakdowns";
import { decodeStoredParsedText } from "./parsed-text";
import type { ParsedTaxDocument, TaxDocumentParser } from "./parser";
import {
	computeTaxReadiness,
	expectedEvidenceDocumentCount,
} from "./readiness";
import { reconcileTaxFacts } from "./reconcile";
import { requireTaxRepository } from "./require-repo";
import {
	assertTaxDocumentFileSizeLimit,
	assertTaxDocumentStorageLimit,
	getTaxDocumentByteSize,
	sumTaxDocumentStorageBytes,
	taxDocumentMetadataWithByteSize,
} from "./storage-quota";
import { summarizeMoneyFacts } from "./summaries";
import { syncPlanningTaxProfileFromFact } from "./sync-planning-profile";
import { buildTaxYearProfile } from "./year-profile";

export type TaxRuntime = {
	storage: FileStorageProvider;
	parser: TaxDocumentParser;
	documentStorageLimitBytes?: number;
	documentMaxBytes?: number;
	parseMode?: "inline" | "async";
	onParsedDocument?: (input: {
		ctx: AppContext;
		documentId: string;
		filename: string;
		parsed: ParsedTaxDocument;
	}) => Promise<boolean>;
	logError?: (
		message: string,
		context: Record<string, string | number | boolean | null>,
	) => void;
};

export async function listTaxYears(ctx: AppContext): Promise<TaxYearsResponse> {
	const repo = requireTaxRepository(ctx);
	const years = await repo.listYears({ userId: ctx.userId });
	const defaultYear = getTaxYear();
	const chromeYears = [defaultYear, defaultYear - 1, defaultYear - 2];
	const unique = [...new Set([...chromeYears, ...years])].sort((a, b) => b - a);
	const summaries = await Promise.all(
		unique.map(async (taxYear) => {
			const [documents, facts] = await Promise.all([
				repo.listDocuments({ userId: ctx.userId, taxYear }),
				repo.listFacts({ userId: ctx.userId, taxYear }),
			]);
			return {
				taxYear,
				hasDocuments: documents.length > 0,
				hasFacts: facts.length > 0,
				documentCount: documents.length,
				factCount: facts.length,
			};
		}),
	);
	return { defaultYear, years: summaries };
}

export async function getTaxOverview(
	ctx: AppContext,
	input: TaxYearInput,
	runtime?: Pick<TaxRuntime, "documentStorageLimitBytes">,
): Promise<TaxOverview> {
	const { facts, documents, readiness } = await loadYear(ctx, input.taxYear);
	const income = summarizeMoneyFacts(facts, isIncomeIdentifiedFact);
	const withholding = summarizeMoneyFacts(facts, isTaxesWithheldFact);
	const deductions = summarizeMoneyFacts(facts, isDeductionFact);
	const gains = summarizeMoneyFacts(facts, isCapitalGainFact);
	const lastUpdated =
		[...documents, ...facts]
			.map((item) => ("updatedAt" in item ? item.updatedAt : null))
			.filter((value): value is string => typeof value === "string")
			.sort()
			.at(-1) ?? null;

	return {
		taxYear: input.taxYear,
		lastUpdated,
		readiness,
		documentsPresent: documents.length,
		documentsExpected: expectedEvidenceDocumentCount(readiness.categories),
		incomeIdentified: income.confirmed,
		taxesWithheld: withholding.confirmed,
		potentialDeductions: deductions.potential,
		confirmedDeductions: deductions.confirmed,
		capitalGains: gains.confirmed,
		breakdowns: buildOverviewMetricBreakdowns(facts, documents),
		estimate: estimateTaxResult(facts),
		attention: [
			...readiness.missingItems,
			...readiness.unresolvedItems,
			...readiness.reviewItems,
		].map((item) => ({
			id: item.id,
			title: item.title,
			detail: item.detail,
			severity: item.severity,
		})),
		recentDocuments: documents.slice(0, 8),
		hasAnyFacts: facts.length > 0,
		hasAnyDocuments: documents.length > 0,
		documentStorage: {
			usedBytes: documents.reduce(
				(sum, document) => sum + document.byteSize,
				0,
			),
			limitBytes: runtime?.documentStorageLimitBytes ?? null,
		},
	};
}

export async function getTaxReadiness(
	ctx: AppContext,
	input: TaxYearInput,
): Promise<TaxReadiness> {
	const year = await loadYear(ctx, input.taxYear);
	return year.readiness;
}

export async function getTaxYearProfile(
	ctx: AppContext,
	input: TaxYearInput,
): Promise<TaxYearProfile> {
	const { facts, documents, readiness, sources } = await loadYear(
		ctx,
		input.taxYear,
	);
	return buildTaxYearProfile({
		taxYear: input.taxYear,
		facts,
		documents,
		missingInformation: readiness.missingItems.map((item) => item.title),
		planning: {
			filingStatus: sources.filingStatus,
			selfEmployedIncome: sources.selfEmployedIncome,
			rentalIncome: sources.rentalIncome,
		},
	});
}

export async function getTaxAgentContext(
	ctx: AppContext,
	input: TaxYearInput,
): Promise<TaxAgentContext> {
	const { facts, documents, sources, readiness } = await loadYear(
		ctx,
		input.taxYear,
	);
	return buildTaxAgentContext({
		taxYear: input.taxYear,
		facts,
		documents,
		readiness,
		filingStatus: sources.filingStatus,
		dependentsCount: sources.dependentsCount,
	});
}

export async function listTaxDocuments(ctx: AppContext, input: TaxYearInput) {
	const repo = requireTaxRepository(ctx);
	const [documents, facts] = await Promise.all([
		repo.listDocuments({ userId: ctx.userId, taxYear: input.taxYear }),
		repo.listFacts({ userId: ctx.userId, taxYear: input.taxYear }),
	]);
	return documents.map((document) =>
		toTaxDocumentDto(
			document,
			facts.filter((fact) => fact.sourceDocumentId === document.id).length,
		),
	);
}

export async function getTaxDocument(
	ctx: AppContext,
	input: TaxGetDocumentInput,
	runtime?: TaxRuntime,
): Promise<TaxDocumentDetail> {
	const repo = requireTaxRepository(ctx);
	const document = await repo.findDocument({
		userId: ctx.userId,
		id: input.id,
	});
	if (!document) {
		throw new Error("Tax document not found");
	}
	const [facts, extractions] = await Promise.all([
		repo.listFacts({
			userId: ctx.userId,
			taxYear: document.taxYear,
			documentId: document.id,
		}),
		repo.listFormExtractions({ userId: ctx.userId, documentId: document.id }),
	]);
	let parsedText: string | undefined;
	if (input.includeParsedText && document.parsedStorageKey && runtime) {
		const parsed = await runtime.storage.get(document.parsedStorageKey);
		parsedText = decodeStoredParsedText(parsed.bytes);
	}
	const dto = toTaxDocumentDto(document, facts.length);
	return {
		...dto,
		facts: facts.map(toTaxFactDto),
		formExtractions: extractions.map(toTaxFormExtractionDto),
		hasOriginalFile: Boolean(document.originalStorageKey),
		hasParsedText: Boolean(document.parsedStorageKey),
		parsedText,
	};
}

export async function uploadTaxDocument(
	ctx: AppContext,
	runtime: TaxRuntime,
	input: TaxUploadDocumentInput,
) {
	const repo = requireTaxRepository(ctx);
	const documentId = randomUUID();
	const bytes = decodeBase64(input.data);
	assertTaxDocumentFileSizeLimit({
		byteSize: bytes.byteLength,
		limitBytes: runtime.documentMaxBytes,
	});
	const existing = await repo.listDocuments({
		userId: ctx.userId,
		taxYear: input.taxYear,
	});
	assertTaxDocumentStorageLimit({
		usedBytes: sumTaxDocumentStorageBytes(existing),
		incomingBytes: bytes.byteLength,
		limitBytes: runtime.documentStorageLimitBytes,
	});
	const originalKey = taxOriginalStorageKey({
		userId: ctx.userId,
		taxYear: input.taxYear,
		documentId,
	});
	try {
		await runtime.storage.put({
			key: originalKey,
			bytes,
			mimeType: input.mimeType,
			visibility: "private",
		});
	} catch (error) {
		runtime.logError?.("tax_document_upload_failed", {
			userId: ctx.userId,
			documentId,
			operation: "storage_put",
			errorName: error instanceof Error ? error.name : "unknown",
		});
		throw error;
	}
	try {
		const created = await repo.createDocument({
			id: documentId,
			userId: ctx.userId,
			taxYear: input.taxYear,
			documentCategory: input.documentCategory ?? "other",
			formType: input.formType ?? null,
			issuer: null,
			recipient: null,
			source: "upload",
			originalFilename: input.filename,
			mimeType: input.mimeType,
			processingState: "processing",
			parserProvider: null,
			parserVersion: null,
			extractionConfidence: null,
			originalStorageKey: originalKey,
			parsedStorageKey: null,
			reviewStatus: "pending",
			userConfirmed: false,
			metadata: taxDocumentMetadataWithByteSize(null, bytes.byteLength),
		});
		if (runtime.parseMode === "async") {
			return toTaxDocumentDto(created, 0);
		}
		return processTaxDocument(ctx, runtime, created.id);
	} catch (error) {
		runtime.logError?.("tax_document_upload_failed", {
			userId: ctx.userId,
			documentId,
			operation: "create_document",
			errorName: error instanceof Error ? error.name : "unknown",
		});
		try {
			await runtime.storage.delete(originalKey);
		} catch (cleanupError) {
			runtime.logError?.("tax_document_upload_cleanup_failed", {
				userId: ctx.userId,
				documentId,
				operation: "storage_delete",
				errorName:
					cleanupError instanceof Error ? cleanupError.name : "unknown",
			});
		}
		throw error;
	}
}

export async function reprocessTaxDocument(
	ctx: AppContext,
	runtime: TaxRuntime,
	input: { id: string },
) {
	if (runtime.parseMode === "async") {
		const repo = requireTaxRepository(ctx);
		const document = await repo.findDocument({
			userId: ctx.userId,
			id: input.id,
		});
		if (!document) throw new Error("Tax document not found");
		const updated = await repo.updateDocument({
			userId: ctx.userId,
			id: input.id,
			data: {
				processingState: "processing",
				metadata: taxDocumentMetadataWithByteSize(
					document.metadata,
					getTaxDocumentByteSize(document),
					{ parseClaimedAt: null },
				),
			},
		});
		return toTaxDocumentDto(updated, 0);
	}
	return processTaxDocument(ctx, runtime, input.id);
}

export async function renameTaxDocument(
	ctx: AppContext,
	input: TaxRenameDocumentInput,
) {
	const repo = requireTaxRepository(ctx);
	const document = await repo.findDocument({
		userId: ctx.userId,
		id: input.id,
	});
	if (!document) throw new Error("Tax document not found");
	if (!isManageableTaxDocument(document.processingState)) {
		throw new Error("Wait until this document finishes processing.");
	}
	const updated = await repo.updateDocument({
		userId: ctx.userId,
		id: input.id,
		data: {
			metadata: taxDocumentMetadataWithByteSize(
				document.metadata,
				getTaxDocumentByteSize(document),
				{ displayName: input.displayName },
			),
		},
	});
	const facts = await repo.listFacts({
		userId: ctx.userId,
		taxYear: document.taxYear,
		documentId: document.id,
	});
	return toTaxDocumentDto(updated, facts.length);
}

export async function deleteTaxDocument(
	ctx: AppContext,
	runtime: TaxRuntime,
	input: { id: string },
) {
	const repo = requireTaxRepository(ctx);
	const document = await repo.findDocument({
		userId: ctx.userId,
		id: input.id,
	});
	if (!document) throw new Error("Tax document not found");
	if (!isManageableTaxDocument(document.processingState)) {
		throw new Error("Wait until this document finishes processing.");
	}
	await repo.deleteDocument({
		userId: ctx.userId,
		id: input.id,
	});
	await persistConflicts(ctx, document.taxYear);
	const keys = [document.originalStorageKey, document.parsedStorageKey].filter(
		(key): key is string => Boolean(key),
	);
	for (const key of keys) {
		try {
			await runtime.storage.delete(key);
		} catch (error) {
			runtime.logError?.("tax_document_delete_cleanup_failed", {
				userId: ctx.userId,
				documentId: document.id,
				operation: "storage_delete",
				errorName: error instanceof Error ? error.name : "unknown",
			});
		}
	}
}

export async function listTaxFacts(ctx: AppContext, input: TaxListFactsInput) {
	const repo = requireTaxRepository(ctx);
	const [facts, sources] = await Promise.all([
		repo.listFacts({
			userId: ctx.userId,
			taxYear: input.taxYear,
			documentId: input.documentId,
		}),
		input.documentId
			? Promise.resolve(null)
			: repo.loadPlanningSources({
					userId: ctx.userId,
					taxYear: input.taxYear,
				}),
	]);
	const merged = sources
		? mergeFinancialCandidates({
				userId: ctx.userId,
				taxYear: input.taxYear,
				facts: facts.map(toTaxFactDto),
				sources,
			})
		: facts.map(toTaxFactDto);
	return merged.filter((fact) => {
		if (input.category && fact.category !== input.category) return false;
		if (input.status && fact.status !== input.status) return false;
		return true;
	});
}

export async function getTaxFact(ctx: AppContext, input: { id: string }) {
	const repo = requireTaxRepository(ctx);
	const fact = await repo.findFact({ userId: ctx.userId, id: input.id });
	if (!fact) throw new Error("Tax fact not found");
	return toTaxFactDto(fact);
}

export async function getTaxFactDocumentLabel(
	ctx: AppContext,
	fact: TaxFact,
): Promise<string | undefined> {
	if (!fact.sourceDocumentId) return fact.sourceForm ?? undefined;
	const document = await requireTaxRepository(ctx).findDocument({
		userId: ctx.userId,
		id: fact.sourceDocumentId,
	});
	if (!document) return fact.sourceForm ?? undefined;
	return taxDocumentTitle(toTaxDocumentDto(document));
}

export async function createManualTaxFact(
	ctx: AppContext,
	input: TaxCreateManualFactInput,
): Promise<TaxFact> {
	const repo = requireTaxRepository(ctx);
	const now = new Date();
	const id = randomUUID();
	const key = `manual.${input.type}:${id}`;
	const [created] = await repo.createFacts([
		factToRecord(
			ctx.userId,
			{
				taxYear: input.taxYear,
				category: input.category,
				type: input.type,
				key,
				value: input.value,
				valueType: input.valueType,
				unit: input.unit,
				currency: input.currency,
				sourceType: "manual",
				sourceManualEntryId: id,
				sourceForm: input.sourceForm,
				sourceBox: input.sourceBox,
				sourceRealEstateId: input.sourceRealEstateId,
				confidence: 1,
				extractionMethod: "manual",
				status: "confirmed",
				userConfirmed: true,
				metadata: input.metadata,
			},
			id,
			now,
		),
	]);
	if (!created) throw new Error("Failed to create tax fact");
	await persistConflicts(ctx, input.taxYear);
	return toTaxFactDto(created);
}

export async function updateTaxFact(
	ctx: AppContext,
	input: TaxUpdateFactInput,
): Promise<TaxFact> {
	const repo = requireTaxRepository(ctx);
	const updated = await repo.updateFact({
		userId: ctx.userId,
		id: input.id,
		data: {
			value: input.value,
			status: input.status,
			userConfirmed: input.userConfirmed,
			taxYear: input.taxYear,
		},
	});
	await persistConflicts(ctx, updated.taxYear);
	return toTaxFactDto(updated);
}

export async function confirmTaxFact(
	ctx: AppContext,
	input: TaxConfirmFactInput,
): Promise<TaxFact> {
	const existing = await requireTaxRepository(ctx).findFact({
		userId: ctx.userId,
		id: input.id,
	});
	const factId = existing
		? existing.id
		: (await persistInMemoryCandidate(ctx, input.id))?.id;
	if (!factId) throw new Error("Tax fact not found");
	const updated = await updateTaxFact(ctx, {
		id: factId,
		status: input.confirmed ? "confirmed" : "rejected",
		userConfirmed: input.confirmed,
	});
	if (input.confirmed) {
		await syncPlanningTaxProfileFromFact(ctx, updated);
	}
	return updated;
}

export async function listTaxConflicts(ctx: AppContext, input: TaxYearInput) {
	const repo = requireTaxRepository(ctx);
	const conflicts = await repo.listConflicts({
		userId: ctx.userId,
		taxYear: input.taxYear,
	});
	return conflicts.map(toTaxConflictDto);
}

export async function resolveTaxConflict(
	ctx: AppContext,
	input: TaxResolveConflictInput,
) {
	const repo = requireTaxRepository(ctx);
	const updated = await repo.updateConflict({
		userId: ctx.userId,
		id: input.id,
		data: {
			resolutionState: input.resolutionState,
			preferredFactId: input.preferredFactId ?? null,
		},
	});
	if (input.preferredFactId) {
		await repo.updateFact({
			userId: ctx.userId,
			id: input.preferredFactId,
			data: { status: "confirmed", userConfirmed: true },
		});
		const remainingIds = updated.factIds.filter(
			(factId) => factId !== input.preferredFactId,
		);
		for (const factId of remainingIds) {
			await repo.updateFact({
				userId: ctx.userId,
				id: factId,
				data: { status: "superseded", userConfirmed: false },
			});
		}
		const preferred = await repo.findFact({
			userId: ctx.userId,
			id: input.preferredFactId,
		});
		if (preferred) {
			await syncPlanningTaxProfileFromFact(ctx, toTaxFactDto(preferred));
		}
	}
	return toTaxConflictDto(updated);
}

const TAX_SEARCH_LIMIT = 50;

export async function searchTaxData(ctx: AppContext, input: TaxSearchInput) {
	const facts = await listTaxFacts(ctx, { taxYear: input.taxYear });
	const query = input.query.toLowerCase();
	return facts
		.filter((fact) =>
			[fact.type, fact.key, fact.sourceForm, fact.sourceBox, String(fact.value)]
				.filter(Boolean)
				.join(" ")
				.toLowerCase()
				.includes(query),
		)
		.slice(0, TAX_SEARCH_LIMIT);
}

export async function getTaxIncomeSummary(
	ctx: AppContext,
	input: TaxYearInput,
) {
	const facts = await listTaxFacts(ctx, input);
	return summarizeMoneyFacts(facts, (fact) => fact.category === "income");
}

export async function getTaxWithholdingSummary(
	ctx: AppContext,
	input: TaxYearInput,
) {
	const facts = await listTaxFacts(ctx, input);
	return summarizeMoneyFacts(facts, (fact) => fact.category === "withholding");
}

export async function getTaxInvestmentSummary(
	ctx: AppContext,
	input: TaxYearInput,
) {
	const facts = await listTaxFacts(ctx, input);
	return summarizeMoneyFacts(facts, (fact) => fact.category === "investment");
}

export async function getTaxRealEstateSummary(
	ctx: AppContext,
	input: TaxYearInput,
) {
	const facts = await listTaxFacts(ctx, input);
	return summarizeMoneyFacts(facts, (fact) => fact.category === "real_estate");
}

export async function getTaxDeductionSummary(
	ctx: AppContext,
	input: TaxYearInput,
) {
	const facts = await listTaxFacts(ctx, input);
	return summarizeMoneyFacts(facts, (fact) => fact.category === "deduction");
}

export async function getTaxRetirementSummary(
	ctx: AppContext,
	input: TaxYearInput,
) {
	const facts = await listTaxFacts(ctx, input);
	return summarizeMoneyFacts(facts, (fact) => fact.category === "retirement");
}

export async function getTaxBusinessSummary(
	ctx: AppContext,
	input: TaxYearInput,
) {
	const facts = await listTaxFacts(ctx, input);
	return summarizeMoneyFacts(facts, (fact) => fact.category === "business");
}

export async function getTaxEstimatedPayments(
	ctx: AppContext,
	input: TaxYearInput,
) {
	const facts = await listTaxFacts(ctx, input);
	return summarizeMoneyFacts(
		facts,
		(fact) => fact.category === "estimated_payment",
	);
}

export async function getTaxPriorYearCarryforwards(
	ctx: AppContext,
	input: TaxYearInput,
) {
	const facts = await listTaxFacts(ctx, input);
	return facts.filter((fact) => fact.sourceType === "prior_year");
}

export async function getTaxMissingInformation(
	ctx: AppContext,
	input: TaxYearInput,
) {
	const readiness = await getTaxReadiness(ctx, input);
	return readiness.missingItems;
}

export async function getTaxItemsNeedingReview(
	ctx: AppContext,
	input: TaxYearInput,
) {
	const readiness = await getTaxReadiness(ctx, input);
	return [...readiness.reviewItems, ...readiness.unresolvedItems];
}

export async function parseTaxDocument(
	runtime: TaxRuntime,
	input: TaxParseDocumentInput,
): Promise<ParsedTaxDocument> {
	const bytes = decodeBase64(input.data);
	assertTaxDocumentFileSizeLimit({
		byteSize: bytes.byteLength,
		limitBytes: runtime.documentMaxBytes,
	});
	return runtime.parser.parseDocument({
		bytes,
		mimeType: input.mimeType,
		filename: input.filename,
	});
}

async function processTaxDocument(
	ctx: AppContext,
	runtime: TaxRuntime,
	documentId: string,
) {
	const repo = requireTaxRepository(ctx);
	const document = await repo.findDocument({
		userId: ctx.userId,
		id: documentId,
	});
	if (!document) throw new Error("Tax document not found");

	try {
		const original = await runtime.storage.get(document.originalStorageKey);
		const parsed = await runtime.parser.parseDocument({
			bytes: original.bytes,
			mimeType: document.mimeType,
			filename: document.originalFilename,
		});
		const handled = await runtime.onParsedDocument?.({
			ctx,
			documentId,
			filename: document.originalFilename,
			parsed,
		});
		if (handled) {
			const updated = await repo.findDocument({
				userId: ctx.userId,
				id: documentId,
			});
			if (!updated) throw new Error("Tax document not found");
			const facts = await repo.listFacts({
				userId: ctx.userId,
				taxYear: updated.taxYear,
				documentId,
			});
			return toTaxDocumentDto(updated, facts.length);
		}
		return applyParsedTaxDocument(ctx, runtime, documentId, parsed);
	} catch (error) {
		return failTaxDocumentParse(ctx, runtime, documentId, error);
	}
}

export async function persistParsedTaxDocumentText(
	ctx: AppContext,
	runtime: TaxRuntime,
	documentId: string,
	parsed: ParsedTaxDocument,
): Promise<{
	parsedStorageKey: string;
	originalFilename: string;
	taxYear: number;
}> {
	const repo = requireTaxRepository(ctx);
	const document = await repo.findDocument({
		userId: ctx.userId,
		id: documentId,
	});
	if (!document) throw new Error("Tax document not found");

	const parsedKey = taxParsedStorageKey({
		userId: ctx.userId,
		taxYear: document.taxYear,
		documentId,
	});
	await runtime.storage.put({
		key: parsedKey,
		bytes: new TextEncoder().encode(JSON.stringify({ text: parsed.text })),
		mimeType: "application/json",
		visibility: "private",
	});
	await repo.updateDocument({
		userId: ctx.userId,
		id: documentId,
		data: {
			parsedStorageKey: parsedKey,
			parserProvider: parsed.parserName ?? runtime.parser.provider,
			parserVersion: parsed.parserVersion ?? runtime.parser.version,
			metadata: taxDocumentMetadataWithByteSize(
				document.metadata,
				getTaxDocumentByteSize(document),
			),
		},
	});
	return {
		parsedStorageKey: parsedKey,
		originalFilename: document.originalFilename,
		taxYear: document.taxYear,
	};
}

export async function applyStructuredTaxExtraction(
	ctx: AppContext,
	runtime: TaxRuntime,
	documentId: string,
	extracted: ExtractedTaxDraft,
	parsed?: Pick<ParsedTaxDocument, "parserName" | "parserVersion" | "text">,
) {
	const repo = requireTaxRepository(ctx);
	const document = await repo.findDocument({
		userId: ctx.userId,
		id: documentId,
	});
	if (!document) throw new Error("Tax document not found");

	const existingFacts = await repo.listFacts({
		userId: ctx.userId,
		taxYear: document.taxYear,
		documentId,
	});
	const confirmedByKey = new Map(
		existingFacts
			.filter((fact) => fact.userConfirmed || fact.status === "confirmed")
			.map((fact) => [fact.key, fact]),
	);
	await repo.deleteFactsForDocument({ userId: ctx.userId, documentId });
	const now = new Date();
	if (extracted.facts.length > 0) {
		await repo.createFacts(
			extracted.facts.map((fact) => {
				const previous = confirmedByKey.get(fact.key);
				const valueUnchanged =
					previous !== undefined &&
					serializeFactValue(previous.value) === serializeFactValue(fact.value);
				return factToRecord(
					ctx.userId,
					valueUnchanged
						? {
								...fact,
								status: "confirmed",
								userConfirmed: true,
							}
						: fact,
					randomUUID(),
					now,
				);
			}),
		);
	}
	if (extracted.formPayload) {
		await repo.replaceFormExtractions({
			userId: ctx.userId,
			documentId,
			extractions: [
				{
					id: randomUUID(),
					userId: ctx.userId,
					documentId,
					formType: extracted.formType,
					schemaVersion: extracted.schemaVersion,
					payload: extracted.formPayload,
				},
			],
		});
	}
	const hasFacts = extracted.facts.length > 0;
	const hasParsedText =
		(parsed?.text ?? "").trim().length > 0 ||
		Boolean(document.parsedStorageKey);
	const needsReview =
		!hasFacts ||
		extracted.facts.some((fact) => fact.metadata?.missingBasis === true) ||
		extracted.extractionConfidence < 0.3;
	const processingState =
		!hasFacts && !hasParsedText
			? "failed"
			: needsReview
				? "needs_review"
				: "complete";
	const updated = await repo.updateDocument({
		userId: ctx.userId,
		id: documentId,
		data: {
			processingState,
			parserProvider:
				parsed?.parserName ??
				document.parserProvider ??
				runtime.parser.provider,
			parserVersion:
				parsed?.parserVersion ??
				document.parserVersion ??
				runtime.parser.version,
			extractionConfidence: extracted.extractionConfidence,
			formType: extracted.formType,
			documentCategory: extracted.documentCategory,
			issuer: extracted.issuer,
			recipient: extracted.recipient,
			reviewStatus: needsReview ? "pending" : "reviewed",
			metadata: taxDocumentMetadataWithByteSize(
				document.metadata,
				getTaxDocumentByteSize(document),
				processingState === "failed"
					? { failureReason: "No tax facts could be extracted" }
					: {},
			),
		},
	});
	await persistConflicts(ctx, document.taxYear);
	const facts = await repo.listFacts({
		userId: ctx.userId,
		taxYear: document.taxYear,
		documentId,
	});
	return toTaxDocumentDto(updated, facts.length);
}

export async function applyParsedTaxDocument(
	ctx: AppContext,
	runtime: TaxRuntime,
	documentId: string,
	parsed: ParsedTaxDocument,
) {
	await persistParsedTaxDocumentText(ctx, runtime, documentId, parsed);
	const repo = requireTaxRepository(ctx);
	const document = await repo.findDocument({
		userId: ctx.userId,
		id: documentId,
	});
	if (!document) throw new Error("Tax document not found");
	const extracted = extractFactsFromParsed({
		taxYear: document.taxYear,
		documentId,
		filename: document.originalFilename,
		parsed,
	});
	return applyStructuredTaxExtraction(
		ctx,
		runtime,
		documentId,
		extracted,
		parsed,
	);
}

export async function failTaxDocumentParse(
	ctx: AppContext,
	runtime: TaxRuntime,
	documentId: string,
	error?: unknown,
) {
	const repo = requireTaxRepository(ctx);
	const document = await repo.findDocument({
		userId: ctx.userId,
		id: documentId,
	});
	if (!document) throw new Error("Tax document not found");
	runtime.logError?.("tax_document_parse_failed", {
		userId: ctx.userId,
		documentId,
		parserProvider: runtime.parser.provider,
		errorName: error instanceof Error ? error.name : "unknown",
		errorMessage: error instanceof Error ? error.message : "unknown",
	});
	const failed = await repo.updateDocument({
		userId: ctx.userId,
		id: documentId,
		data: {
			processingState: "failed",
			metadata: taxDocumentMetadataWithByteSize(
				document.metadata,
				getTaxDocumentByteSize(document),
				{ failureReason: "Document parsing failed" },
			),
		},
	});
	return toTaxDocumentDto(failed, 0);
}

async function persistConflicts(ctx: AppContext, taxYear: number) {
	const repo = requireTaxRepository(ctx);
	const facts = (await repo.listFacts({ userId: ctx.userId, taxYear })).map(
		toTaxFactDto,
	);
	const existingConflicts = await repo.listConflicts({
		userId: ctx.userId,
		taxYear,
	});
	const existingByKey = new Map(
		existingConflicts.map((conflict) => [conflict.factKey, conflict]),
	);
	const { facts: reconciled, conflicts } = reconcileTaxFacts(facts);
	for (const fact of reconciled) {
		const original = facts.find((item) => item.id === fact.id);
		if (!original || original.status === fact.status) continue;
		await repo.updateFact({
			userId: ctx.userId,
			id: fact.id,
			data: { status: fact.status },
		});
	}
	for (const conflict of conflicts) {
		const previous = existingByKey.get(conflict.factKey);
		const factIdsChanged =
			previous !== undefined &&
			sortedIds(previous.factIds) !== sortedIds(conflict.factIds);
		const preserveResolution =
			previous !== undefined &&
			previous.resolutionState !== "open" &&
			!factIdsChanged;
		await repo.upsertConflict({
			id: previous?.id ?? randomUUID(),
			userId: ctx.userId,
			taxYear: conflict.taxYear,
			factKey: conflict.factKey,
			factIds: conflict.factIds,
			preferredFactId: preserveResolution
				? previous.preferredFactId
				: conflict.preferredFactId,
			resolutionState: preserveResolution
				? previous.resolutionState
				: conflict.resolutionState,
		});
	}
}

async function loadYear(ctx: AppContext, taxYear: number) {
	const repo = requireTaxRepository(ctx);
	const [documentRows, factRows, sources] = await Promise.all([
		repo.listDocuments({ userId: ctx.userId, taxYear }),
		repo.listFacts({ userId: ctx.userId, taxYear }),
		repo.loadPlanningSources({ userId: ctx.userId, taxYear }),
	]);
	const merged = mergeFinancialCandidates({
		userId: ctx.userId,
		taxYear,
		facts: factRows.map(toTaxFactDto),
		sources,
	});
	const { facts } = reconcileTaxFacts(merged);
	const documents = documentRows.map((document) =>
		toTaxDocumentDto(
			document,
			facts.filter((fact) => fact.sourceDocumentId === document.id).length,
		),
	);
	const readiness = computeTaxReadiness({
		taxYear,
		facts,
		documents,
		sources,
	});
	return { facts, documents, sources, readiness };
}

async function persistInMemoryCandidate(ctx: AppContext, factId: string) {
	const parsed = parseFinancialCandidateId(factId);
	if (!parsed) return null;
	const repo = requireTaxRepository(ctx);
	const [existing, sources] = await Promise.all([
		repo.listFacts({ userId: ctx.userId, taxYear: parsed.taxYear }),
		repo.loadPlanningSources({ userId: ctx.userId, taxYear: parsed.taxYear }),
	]);
	const alreadyStored = existing.find(
		(fact) => fact.id === factId || fact.key === parsed.key,
	);
	if (alreadyStored) return alreadyStored;
	const draft = generateFinancialCandidates({
		taxYear: parsed.taxYear,
		sources,
	}).find((fact) => fact.key === parsed.key);
	if (!draft) return null;
	const [created] = await repo.createFacts([
		factToRecord(ctx.userId, draft, factId, new Date()),
	]);
	return created ?? null;
}

function decodeBase64(data: string): Uint8Array {
	const cleaned = data.includes(",") ? data.slice(data.indexOf(",") + 1) : data;
	return Uint8Array.from(Buffer.from(cleaned, "base64"));
}

function serializeFactValue(value: unknown): string {
	if (typeof value === "number") return value.toFixed(2);
	return JSON.stringify(value);
}

function sortedIds(ids: string[]): string {
	return [...ids].sort().join(",");
}
