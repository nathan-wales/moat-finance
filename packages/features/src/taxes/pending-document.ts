import { isTaxDocumentProcessing, type TaxDocument } from "@moat/contracts";

const PENDING_TAX_DOCUMENT_ID_PREFIX = "pending-";

export function createPendingTaxDocumentId() {
	return `${PENDING_TAX_DOCUMENT_ID_PREFIX}${crypto.randomUUID()}`;
}

export function isPendingTaxDocumentId(id: string) {
	return id.startsWith(PENDING_TAX_DOCUMENT_ID_PREFIX);
}

export function createPendingTaxDocument(input: {
	id: string;
	taxYear: number;
	filename: string;
	mimeType: string;
	byteSize: number;
}): TaxDocument {
	const now = new Date().toISOString();
	return {
		id: input.id,
		userId: "pending",
		taxYear: input.taxYear,
		documentCategory: "other",
		formType: null,
		issuer: null,
		recipient: null,
		source: "upload",
		originalFilename: input.filename,
		mimeType: input.mimeType,
		uploadedAt: now,
		processingState: "processing",
		parserProvider: null,
		parserVersion: null,
		extractionConfidence: null,
		reviewStatus: "pending",
		userConfirmed: false,
		factCount: 0,
		byteSize: input.byteSize,
		displayName: null,
		failureReason: null,
		createdAt: now,
		updatedAt: now,
	};
}

export function mergeTaxDocuments(
	server: TaxDocument[] | undefined,
	pending: TaxDocument[],
	taxYear: number,
): TaxDocument[] {
	const list = server ?? [];
	const yearPending = pending.filter(
		(document) => document.taxYear === taxYear,
	);
	if (yearPending.length === 0) return list;

	const unresolved = yearPending.filter((document) =>
		isPendingTaxDocumentId(document.id),
	);
	const resolvedById = new Map(
		yearPending
			.filter((document) => !isPendingTaxDocumentId(document.id))
			.map((document) => [document.id, document]),
	);
	const unresolvedNames = new Set(
		unresolved.map((document) => document.originalFilename),
	);
	const visibleServer = list
		.filter((document) => {
			if (resolvedById.has(document.id)) return true;
			return !(
				unresolvedNames.has(document.originalFilename) &&
				isTaxDocumentProcessing(document.processingState)
			);
		})
		.map((document) => {
			const pendingDocument = resolvedById.get(document.id);
			if (!pendingDocument) return document;
			if (!isTaxDocumentProcessing(document.processingState)) return document;
			return pendingDocument;
		});
	const extras = [
		...unresolved,
		...[...resolvedById.values()].filter(
			(document) => !visibleServer.some((item) => item.id === document.id),
		),
	];
	if (extras.length === 0) return visibleServer;
	return [...extras, ...visibleServer];
}
