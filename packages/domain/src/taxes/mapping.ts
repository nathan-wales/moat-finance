import type {
	TaxDocument,
	TaxExtractionMethod,
	TaxFact,
	TaxFactCategory,
	TaxFactConflict,
	TaxFactSourceType,
	TaxFactStatus,
	TaxFormExtraction,
	TaxValueType,
} from "@moat/contracts";
import type {
	TaxDocumentRecord,
	TaxFactConflictRecord,
	TaxFactRecord,
	TaxFormExtractionRecord,
} from "@moat/data-access";
import { getTaxDocumentByteSize } from "./storage-quota";

export function toTaxDocumentDto(
	record: TaxDocumentRecord,
	factCount = 0,
): TaxDocument {
	return {
		id: record.id,
		userId: record.userId,
		taxYear: record.taxYear,
		documentCategory: record.documentCategory,
		formType: record.formType,
		issuer: record.issuer,
		recipient: record.recipient,
		source: record.source,
		originalFilename: record.originalFilename,
		mimeType: record.mimeType,
		uploadedAt: record.uploadedAt.toISOString(),
		processingState: record.processingState,
		parserProvider: record.parserProvider,
		parserVersion: record.parserVersion,
		extractionConfidence: record.extractionConfidence,
		reviewStatus: record.reviewStatus,
		userConfirmed: record.userConfirmed,
		factCount,
		byteSize: getTaxDocumentByteSize(record),
		displayName:
			typeof record.metadata?.displayName === "string" &&
			record.metadata.displayName.trim().length > 0
				? record.metadata.displayName.trim()
				: null,
		failureReason:
			typeof record.metadata?.failureReason === "string"
				? record.metadata.failureReason
				: null,
		createdAt: record.createdAt.toISOString(),
		updatedAt: record.updatedAt.toISOString(),
	};
}

export function toTaxFactDto(record: TaxFactRecord): TaxFact {
	return {
		id: record.id,
		userId: record.userId,
		taxYear: record.taxYear,
		category: record.category,
		type: record.type,
		key: record.key,
		value: record.value,
		valueType: record.valueType,
		unit: record.unit ?? undefined,
		currency: record.currency === "USD" ? "USD" : undefined,
		sourceType: record.sourceType,
		sourceDocumentId: record.sourceDocumentId ?? undefined,
		sourceTransactionId: record.sourceTransactionId ?? undefined,
		sourceAccountId: record.sourceAccountId ?? undefined,
		sourceHoldingId: record.sourceHoldingId ?? undefined,
		sourceManualEntryId: record.sourceManualEntryId ?? undefined,
		sourceRealEstateId: record.sourceRealEstateId ?? undefined,
		sourceForm: record.sourceForm ?? undefined,
		sourceBox: record.sourceBox ?? undefined,
		sourcePage: record.sourcePage ?? undefined,
		sourceText: record.sourceText ?? undefined,
		confidence: record.confidence,
		extractionMethod: record.extractionMethod,
		status: record.status,
		userConfirmed: record.userConfirmed,
		metadata: record.metadata ?? undefined,
		createdAt: record.createdAt.toISOString(),
		updatedAt: record.updatedAt.toISOString(),
	};
}

export function toTaxFormExtractionDto(
	record: TaxFormExtractionRecord,
): TaxFormExtraction {
	return {
		id: record.id,
		userId: record.userId,
		documentId: record.documentId,
		formType: record.formType,
		schemaVersion: record.schemaVersion,
		payload: record.payload,
		createdAt: record.createdAt.toISOString(),
		updatedAt: record.updatedAt.toISOString(),
	};
}

export function toTaxConflictDto(
	record: TaxFactConflictRecord,
): TaxFactConflict {
	return {
		id: record.id,
		userId: record.userId,
		taxYear: record.taxYear,
		factKey: record.factKey,
		factIds: record.factIds,
		preferredFactId: record.preferredFactId,
		resolutionState: record.resolutionState,
		createdAt: record.createdAt.toISOString(),
		updatedAt: record.updatedAt.toISOString(),
	};
}

export function factToRecord(
	userId: string,
	fact: Omit<TaxFact, "id" | "userId" | "createdAt" | "updatedAt"> & {
		id?: string;
	},
	id: string,
	now: Date,
): TaxFactRecord {
	return {
		id,
		userId,
		taxYear: fact.taxYear,
		category: fact.category as TaxFactCategory,
		type: fact.type,
		key: fact.key,
		value: fact.value,
		valueType: fact.valueType as TaxValueType,
		unit: fact.unit ?? null,
		currency: fact.currency ?? null,
		sourceType: fact.sourceType as TaxFactSourceType,
		sourceDocumentId: fact.sourceDocumentId ?? null,
		sourceTransactionId: fact.sourceTransactionId ?? null,
		sourceAccountId: fact.sourceAccountId ?? null,
		sourceHoldingId: fact.sourceHoldingId ?? null,
		sourceManualEntryId: fact.sourceManualEntryId ?? null,
		sourceRealEstateId: fact.sourceRealEstateId ?? null,
		sourceForm: fact.sourceForm ?? null,
		sourceBox: fact.sourceBox ?? null,
		sourcePage: fact.sourcePage ?? null,
		sourceText: fact.sourceText ?? null,
		confidence: fact.confidence,
		extractionMethod: fact.extractionMethod as TaxExtractionMethod,
		status: fact.status as TaxFactStatus,
		userConfirmed: fact.userConfirmed,
		metadata: fact.metadata ?? null,
		createdAt: now,
		updatedAt: now,
	};
}
