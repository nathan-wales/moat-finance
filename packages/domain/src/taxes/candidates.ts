import type { TaxFact } from "@moat/contracts";
import type { TaxPlanningSources } from "@moat/data-access";
import { slugIssuer } from "./money";

const CANDIDATE_CATEGORIES: Array<{
	categoryName: string;
	factCategory: TaxFact["category"];
	type: string;
	keyPrefix: string;
}> = [
	{
		categoryName: "Gifts & Donations",
		factCategory: "deduction",
		type: "candidate.charitable",
		keyPrefix: "candidate.charitable",
	},
	{
		categoryName: "Health & Medical",
		factCategory: "healthcare",
		type: "candidate.medical",
		keyPrefix: "candidate.medical",
	},
	{
		categoryName: "Education",
		factCategory: "education",
		type: "candidate.education",
		keyPrefix: "candidate.education",
	},
];

export function generateFinancialCandidates(input: {
	taxYear: number;
	sources: TaxPlanningSources;
}): Array<Omit<TaxFact, "id" | "userId" | "createdAt" | "updatedAt">> {
	const facts: Array<
		Omit<TaxFact, "id" | "userId" | "createdAt" | "updatedAt">
	> = [];

	for (const mapping of CANDIDATE_CATEGORIES) {
		const row = input.sources.categoryTotals.find(
			(item) => item.category === mapping.categoryName,
		);
		if (!row || row.total <= 0) continue;
		facts.push({
			taxYear: input.taxYear,
			category: mapping.factCategory,
			type: mapping.type,
			key: `${mapping.keyPrefix}:${input.taxYear}`,
			value: row.total,
			valueType: "money",
			currency: "USD",
			sourceType: "financial_data",
			sourceTransactionId: row.transactionIds[0],
			confidence: 0.45,
			extractionMethod: "financial_data",
			status: "candidate",
			userConfirmed: false,
			metadata: {
				transactionCount: row.transactionCount,
				transactionIds: row.transactionIds,
			},
		});
	}

	const hsaRow = input.sources.categoryTotals.find((item) =>
		/hsa|health savings/i.test(item.category),
	);
	if (hsaRow && hsaRow.total > 0) {
		facts.push({
			taxYear: input.taxYear,
			category: "healthcare",
			type: "candidate.hsa",
			key: "hsa.contributions",
			value: hsaRow.total,
			valueType: "money",
			currency: "USD",
			sourceType: "financial_data",
			sourceTransactionId: hsaRow.transactionIds[0],
			confidence: 0.45,
			extractionMethod: "financial_data",
			status: "candidate",
			userConfirmed: false,
			metadata: {
				transactionCount: hsaRow.transactionCount,
				transactionIds: hsaRow.transactionIds,
			},
		});
	}

	for (const property of input.sources.properties) {
		if (
			property.usageType === "PRIMARY_RESIDENCE" ||
			property.usageType === "MIXED_USE"
		) {
			facts.push({
				taxYear: input.taxYear,
				category: "real_estate",
				type: "candidate.expected_1098",
				key: `candidate.expected_1098:property:${slugIssuer(property.id)}`,
				value: true,
				valueType: "boolean",
				sourceType: "financial_data",
				sourceRealEstateId: property.id,
				confidence: 0.7,
				extractionMethod: "financial_data",
				status: "candidate",
				userConfirmed: false,
				metadata: {
					propertyName: property.name,
					usageType: property.usageType,
				},
			});
		}
	}

	return facts;
}

export function financialCandidateId(taxYear: number, key: string): string {
	return `tax_cand:${taxYear}:${key}`;
}

export function parseFinancialCandidateId(
	id: string,
): { taxYear: number; key: string } | null {
	const prefix = "tax_cand:";
	if (!id.startsWith(prefix)) return null;
	const rest = id.slice(prefix.length);
	const separator = rest.indexOf(":");
	if (separator <= 0) return null;
	const taxYear = Number(rest.slice(0, separator));
	const key = rest.slice(separator + 1);
	if (!Number.isInteger(taxYear) || key.length === 0) return null;
	return { taxYear, key };
}

export function mergeFinancialCandidates(input: {
	userId: string;
	taxYear: number;
	facts: TaxFact[];
	sources: TaxPlanningSources;
}): TaxFact[] {
	const existingKeys = new Set(input.facts.map((fact) => fact.key));
	const generated = generateFinancialCandidates({
		taxYear: input.taxYear,
		sources: input.sources,
	})
		.filter((fact) => !existingKeys.has(fact.key))
		.map((fact) => ({
			id: financialCandidateId(input.taxYear, fact.key),
			userId: input.userId,
			createdAt: "1970-01-01T00:00:00.000Z",
			updatedAt: "1970-01-01T00:00:00.000Z",
			...fact,
		}));
	return [...input.facts, ...generated];
}
