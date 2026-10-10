import { randomUUID } from "node:crypto";
import type {
	CreateTaxDocumentInput,
	CreateTaxFactInput,
	TaxDocumentRecord,
	TaxFactConflictRecord,
	TaxFactRecord,
	TaxFormExtractionRecord,
	TaxPlanningSources,
	TaxRepository,
	UpdateTaxDocumentInput,
	UpdateTaxFactInput,
} from "@moat/data-access";
import { splitParentExclusionWhere } from "@moat/data-access";
import type { DbClient } from "../db-client";

type DocumentRow = TaxDocumentRecord & { metadata: unknown };
type FactRow = Omit<TaxFactRecord, "value" | "metadata"> & {
	value: unknown;
	metadata: unknown;
};
type ExtractionRow = Omit<TaxFormExtractionRecord, "payload"> & {
	payload: unknown;
};
type ConflictRow = Omit<TaxFactConflictRecord, "factIds"> & {
	factIds: string[];
};

export class PostgresTaxRepository implements TaxRepository {
	constructor(private db: DbClient) {}

	async listDocuments(input: {
		userId: string;
		taxYear: number;
	}): Promise<TaxDocumentRecord[]> {
		const rows = (await this.db.taxDocument.findMany({
			where: { userId: input.userId, taxYear: input.taxYear },
			orderBy: { uploadedAt: "desc" },
		})) as DocumentRow[];
		return rows.map(toDocument);
	}

	async findDocument(input: {
		userId: string;
		id: string;
	}): Promise<TaxDocumentRecord | null> {
		const row = (await this.db.taxDocument.findFirst({
			where: { id: input.id, userId: input.userId },
		})) as DocumentRow | null;
		return row ? toDocument(row) : null;
	}

	async createDocument(
		input: CreateTaxDocumentInput,
	): Promise<TaxDocumentRecord> {
		const row = (await this.db.taxDocument.create({
			data: {
				...input,
				uploadedAt: input.uploadedAt ?? new Date(),
			},
		})) as DocumentRow;
		return toDocument(row);
	}

	async updateDocument(input: {
		userId: string;
		id: string;
		data: UpdateTaxDocumentInput;
	}): Promise<TaxDocumentRecord> {
		const existing = await this.findDocument(input);
		if (!existing) throw new Error("Tax document not found");
		const row = (await this.db.taxDocument.update({
			where: { id: input.id },
			data: input.data,
		})) as DocumentRow;
		return toDocument(row);
	}

	async deleteDocument(input: { userId: string; id: string }): Promise<void> {
		const existing = await this.findDocument(input);
		if (!existing) throw new Error("Tax document not found");
		await this.deleteFactsForDocument({
			userId: input.userId,
			documentId: input.id,
		});
		await this.db.taxFormExtraction.deleteMany({
			where: { userId: input.userId, documentId: input.id },
		});
		await this.db.taxDocument.delete({ where: { id: input.id } });
	}

	async listFacts(
		input: Parameters<TaxRepository["listFacts"]>[0],
	): Promise<TaxFactRecord[]> {
		const rows = (await this.db.taxFact.findMany({
			where: {
				userId: input.userId,
				taxYear: input.taxYear,
				...(input.category ? { category: input.category } : {}),
				...(input.status ? { status: input.status } : {}),
				...(input.documentId ? { sourceDocumentId: input.documentId } : {}),
			},
			orderBy: { createdAt: "asc" },
		})) as FactRow[];
		return rows.map(toFact);
	}

	async findFact(input: {
		userId: string;
		id: string;
	}): Promise<TaxFactRecord | null> {
		const row = (await this.db.taxFact.findFirst({
			where: { id: input.id, userId: input.userId },
		})) as FactRow | null;
		return row ? toFact(row) : null;
	}

	async createFacts(input: CreateTaxFactInput[]): Promise<TaxFactRecord[]> {
		const created: TaxFactRecord[] = [];
		for (const fact of input) {
			const row = (await this.db.taxFact.create({ data: fact })) as FactRow;
			created.push(toFact(row));
		}
		return created;
	}

	async updateFact(input: {
		userId: string;
		id: string;
		data: UpdateTaxFactInput;
	}): Promise<TaxFactRecord> {
		const existing = await this.findFact(input);
		if (!existing) throw new Error("Tax fact not found");
		const row = (await this.db.taxFact.update({
			where: { id: input.id },
			data: input.data,
		})) as FactRow;
		return toFact(row);
	}

	async deleteFactsForDocument(input: {
		userId: string;
		documentId: string;
	}): Promise<void> {
		await this.db.taxFact.deleteMany({
			where: { userId: input.userId, sourceDocumentId: input.documentId },
		});
	}

	async listFormExtractions(input: {
		userId: string;
		documentId: string;
	}): Promise<TaxFormExtractionRecord[]> {
		const rows = (await this.db.taxFormExtraction.findMany({
			where: { userId: input.userId, documentId: input.documentId },
		})) as ExtractionRow[];
		return rows.map(toExtraction);
	}

	async replaceFormExtractions(input: {
		userId: string;
		documentId: string;
		extractions: Omit<TaxFormExtractionRecord, "createdAt" | "updatedAt">[];
	}): Promise<TaxFormExtractionRecord[]> {
		await this.db.taxFormExtraction.deleteMany({
			where: { userId: input.userId, documentId: input.documentId },
		});
		const created: TaxFormExtractionRecord[] = [];
		for (const extraction of input.extractions) {
			const row = (await this.db.taxFormExtraction.create({
				data: extraction,
			})) as ExtractionRow;
			created.push(toExtraction(row));
		}
		return created;
	}

	async listConflicts(input: {
		userId: string;
		taxYear: number;
	}): Promise<TaxFactConflictRecord[]> {
		const rows = (await this.db.taxFactConflict.findMany({
			where: { userId: input.userId, taxYear: input.taxYear },
		})) as ConflictRow[];
		return rows.map(toConflict);
	}

	async upsertConflict(
		input: Omit<TaxFactConflictRecord, "createdAt" | "updatedAt">,
	): Promise<TaxFactConflictRecord> {
		const existing = (await this.db.taxFactConflict.findFirst({
			where: {
				userId: input.userId,
				taxYear: input.taxYear,
				factKey: input.factKey,
			},
		})) as ConflictRow | null;
		if (existing) {
			const row = (await this.db.taxFactConflict.update({
				where: { id: existing.id },
				data: {
					factIds: input.factIds,
					preferredFactId: input.preferredFactId,
					resolutionState: input.resolutionState,
				},
			})) as ConflictRow;
			return toConflict(row);
		}
		const row = (await this.db.taxFactConflict.create({
			data: { ...input, id: input.id || randomUUID() },
		})) as ConflictRow;
		return toConflict(row);
	}

	async updateConflict(
		input: Parameters<TaxRepository["updateConflict"]>[0],
	): Promise<TaxFactConflictRecord> {
		const existing = (await this.db.taxFactConflict.findFirst({
			where: { id: input.id, userId: input.userId },
		})) as ConflictRow | null;
		if (!existing) throw new Error("Tax conflict not found");
		const row = (await this.db.taxFactConflict.update({
			where: { id: input.id },
			data: input.data,
		})) as ConflictRow;
		return toConflict(row);
	}

	async listYears(input: { userId: string }): Promise<number[]> {
		const documents = (await this.db.taxDocument.findMany({
			where: { userId: input.userId },
			select: { taxYear: true },
		})) as Array<{ taxYear: number }>;
		const facts = (await this.db.taxFact.findMany({
			where: { userId: input.userId },
			select: { taxYear: true },
		})) as Array<{ taxYear: number }>;
		return [
			...new Set([...documents, ...facts].map((row) => row.taxYear)),
		].sort((a, b) => b - a);
	}

	async loadPlanningSources(input: {
		userId: string;
		taxYear: number;
	}): Promise<TaxPlanningSources> {
		const start = new Date(Date.UTC(input.taxYear, 0, 1));
		const end = new Date(Date.UTC(input.taxYear + 1, 0, 1));
		const [profile, properties, accounts, transactions] = await Promise.all([
			this.db.financialProfileData.findUnique({
				where: { userId: input.userId },
			}) as Promise<{
				profile?: unknown;
				taxProfile?: unknown;
			} | null>,
			this.db.realEstateInvestment.findMany({
				where: { userId: input.userId },
			}) as Promise<
				Array<{
					id: string;
					name: string;
					usageType: string;
					address?: string | null;
				}>
			>,
			this.db.investment.findMany({
				where: { userId: input.userId },
			}) as Promise<
				Array<{
					id: string;
					name: string;
					type?: string;
					subtype?: string | null;
				}>
			>,
			this.db.transaction.findMany({
				where: {
					userId: input.userId,
					date: { gte: start, lt: end },
					category: {
						in: ["Gifts & Donations", "Health & Medical", "Education"],
					},
					AND: [splitParentExclusionWhere()],
				},
				select: {
					id: true,
					category: true,
					amount: true,
				},
			}) as Promise<Array<{ id: string; category: string; amount: unknown }>>,
		]);

		const taxProfile = isRecord(profile?.taxProfile) ? profile.taxProfile : {};
		const person = isRecord(profile?.profile) ? profile.profile : {};
		const totals = new Map<
			string,
			{ total: number; transactionIds: string[] }
		>();
		for (const txn of transactions) {
			const current = totals.get(txn.category) ?? {
				total: 0,
				transactionIds: [],
			};
			current.total += Math.abs(Number(txn.amount ?? 0));
			current.transactionIds.push(txn.id);
			totals.set(txn.category, current);
		}

		return {
			filingStatus:
				typeof taxProfile.filingStatus === "string"
					? taxProfile.filingStatus
					: null,
			profileTaxYear:
				typeof taxProfile.taxYear === "number" ? taxProfile.taxYear : null,
			selfEmployedIncome: taxProfile.selfEmployedIncome === true,
			rentalIncome: taxProfile.rentalIncome === true,
			dependentsCount:
				typeof person.dependentsCount === "number"
					? person.dependentsCount
					: null,
			householdType:
				typeof person.householdType === "string" ? person.householdType : null,
			accounts: accounts.map((account) => ({
				id: account.id,
				name: account.name,
				type: account.type ?? "investment",
				subtype: account.subtype ?? null,
			})),
			properties: properties.map((property) => ({
				id: property.id,
				name: property.name,
				usageType: property.usageType,
				address: property.address ?? null,
			})),
			categoryTotals: [...totals.entries()].map(([category, value]) => ({
				category,
				total: value.total,
				transactionCount: value.transactionIds.length,
				transactionIds: value.transactionIds,
			})),
		};
	}
}

function toDocument(row: DocumentRow): TaxDocumentRecord {
	return {
		...row,
		metadata: isRecord(row.metadata) ? row.metadata : null,
	};
}

function toFact(row: FactRow): TaxFactRecord {
	return {
		...row,
		metadata: isRecord(row.metadata) ? row.metadata : null,
	};
}

function toExtraction(row: ExtractionRow): TaxFormExtractionRecord {
	return {
		...row,
		payload: isRecord(row.payload) ? row.payload : {},
	};
}

function toConflict(row: ConflictRow): TaxFactConflictRecord {
	return row;
}

function isRecord(value: unknown): value is Record<string, unknown> {
	return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}
