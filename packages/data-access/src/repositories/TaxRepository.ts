import type {
	TaxConflictResolution,
	TaxDocumentCategory,
	TaxDocumentProcessingState,
	TaxDocumentSource,
	TaxExtractionMethod,
	TaxFactCategory,
	TaxFactSourceType,
	TaxFactStatus,
	TaxFormType,
	TaxReviewStatus,
	TaxValueType,
} from "@moat/contracts";

export type TaxDocumentRecord = {
	id: string;
	userId: string;
	taxYear: number;
	documentCategory: TaxDocumentCategory;
	formType: TaxFormType | null;
	issuer: string | null;
	recipient: string | null;
	source: TaxDocumentSource;
	originalFilename: string;
	mimeType: string;
	uploadedAt: Date;
	processingState: TaxDocumentProcessingState;
	parserProvider: string | null;
	parserVersion: string | null;
	extractionConfidence: number | null;
	originalStorageKey: string;
	parsedStorageKey: string | null;
	reviewStatus: TaxReviewStatus;
	userConfirmed: boolean;
	metadata: Record<string, unknown> | null;
	createdAt: Date;
	updatedAt: Date;
};

export type TaxFactRecord = {
	id: string;
	userId: string;
	taxYear: number;
	category: TaxFactCategory;
	type: string;
	key: string;
	value: unknown;
	valueType: TaxValueType;
	unit: string | null;
	currency: string | null;
	sourceType: TaxFactSourceType;
	sourceDocumentId: string | null;
	sourceTransactionId: string | null;
	sourceAccountId: string | null;
	sourceHoldingId: string | null;
	sourceManualEntryId: string | null;
	sourceRealEstateId: string | null;
	sourceForm: string | null;
	sourceBox: string | null;
	sourcePage: number | null;
	sourceText: string | null;
	confidence: number;
	extractionMethod: TaxExtractionMethod;
	status: TaxFactStatus;
	userConfirmed: boolean;
	metadata: Record<string, unknown> | null;
	createdAt: Date;
	updatedAt: Date;
};

export type TaxFormExtractionRecord = {
	id: string;
	userId: string;
	documentId: string;
	formType: TaxFormType;
	schemaVersion: string;
	payload: Record<string, unknown>;
	createdAt: Date;
	updatedAt: Date;
};

export type TaxFactConflictRecord = {
	id: string;
	userId: string;
	taxYear: number;
	factKey: string;
	factIds: string[];
	preferredFactId: string | null;
	resolutionState: TaxConflictResolution;
	createdAt: Date;
	updatedAt: Date;
};

export type CreateTaxDocumentInput = Omit<
	TaxDocumentRecord,
	"createdAt" | "updatedAt" | "uploadedAt"
> & {
	uploadedAt?: Date;
};

export type UpdateTaxDocumentInput = Partial<
	Omit<TaxDocumentRecord, "id" | "userId" | "createdAt">
>;

export type CreateTaxFactInput = Omit<TaxFactRecord, "createdAt" | "updatedAt">;

export type UpdateTaxFactInput = Partial<
	Omit<TaxFactRecord, "id" | "userId" | "createdAt">
>;

export type TaxPlanningAccount = {
	id: string;
	name: string;
	type: string;
	subtype: string | null;
};

export type TaxPlanningProperty = {
	id: string;
	name: string;
	usageType: string;
	address: string | null;
};

export type TaxPlanningCategoryTotal = {
	category: string;
	total: number;
	transactionCount: number;
	transactionIds: string[];
};

export type TaxPlanningSources = {
	filingStatus: string | null;
	profileTaxYear: number | null;
	selfEmployedIncome: boolean;
	rentalIncome: boolean;
	dependentsCount: number | null;
	householdType: string | null;
	accounts: TaxPlanningAccount[];
	properties: TaxPlanningProperty[];
	categoryTotals: TaxPlanningCategoryTotal[];
};

export interface TaxRepository {
	listDocuments(input: {
		userId: string;
		taxYear: number;
	}): Promise<TaxDocumentRecord[]>;
	findDocument(input: {
		userId: string;
		id: string;
	}): Promise<TaxDocumentRecord | null>;
	createDocument(input: CreateTaxDocumentInput): Promise<TaxDocumentRecord>;
	updateDocument(input: {
		userId: string;
		id: string;
		data: UpdateTaxDocumentInput;
	}): Promise<TaxDocumentRecord>;
	deleteDocument(input: { userId: string; id: string }): Promise<void>;
	listFacts(input: {
		userId: string;
		taxYear: number;
		category?: TaxFactCategory;
		status?: TaxFactStatus;
		documentId?: string;
	}): Promise<TaxFactRecord[]>;
	findFact(input: {
		userId: string;
		id: string;
	}): Promise<TaxFactRecord | null>;
	createFacts(input: CreateTaxFactInput[]): Promise<TaxFactRecord[]>;
	updateFact(input: {
		userId: string;
		id: string;
		data: UpdateTaxFactInput;
	}): Promise<TaxFactRecord>;
	deleteFactsForDocument(input: {
		userId: string;
		documentId: string;
	}): Promise<void>;
	listFormExtractions(input: {
		userId: string;
		documentId: string;
	}): Promise<TaxFormExtractionRecord[]>;
	replaceFormExtractions(input: {
		userId: string;
		documentId: string;
		extractions: Omit<TaxFormExtractionRecord, "createdAt" | "updatedAt">[];
	}): Promise<TaxFormExtractionRecord[]>;
	listConflicts(input: {
		userId: string;
		taxYear: number;
	}): Promise<TaxFactConflictRecord[]>;
	upsertConflict(
		input: Omit<TaxFactConflictRecord, "createdAt" | "updatedAt">,
	): Promise<TaxFactConflictRecord>;
	updateConflict(input: {
		userId: string;
		id: string;
		data: {
			resolutionState: TaxConflictResolution;
			preferredFactId?: string | null;
		};
	}): Promise<TaxFactConflictRecord>;
	listYears(input: { userId: string }): Promise<number[]>;
	loadPlanningSources(input: {
		userId: string;
		taxYear: number;
	}): Promise<TaxPlanningSources>;
}
