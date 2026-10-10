import {
	type TaxAgentContext,
	type TaxDocument,
	type TaxFact,
	type TaxReadiness,
	taxDocumentTitle,
} from "@moat/contracts";

export function buildTaxAgentContext(input: {
	taxYear: number;
	facts: TaxFact[];
	documents: TaxDocument[];
	readiness: TaxReadiness;
	filingStatus: string | null;
	dependentsCount: number | null;
}): TaxAgentContext {
	const officialFacts = input.facts.filter(isOfficialFact);
	const w2s = groupByIssuer(
		officialFacts.filter((fact) => fact.type.startsWith("w2.")),
		input.documents,
	);
	const investments = groupByIssuer(
		officialFacts.filter((fact) => fact.category === "investment"),
		input.documents,
	);

	return {
		taxYear: input.taxYear,
		filingStatus:
			input.filingStatus ?? firstString(officialFacts, "prior.filing_status"),
		household: {
			taxpayer:
				firstString(officialFacts, "prior.taxpayer_name") ??
				firstString(officialFacts, "identity.taxpayer_name"),
			spouse:
				firstString(officialFacts, "prior.spouse_name") ??
				firstString(officialFacts, "identity.spouse_name"),
			dependentsCount: input.dependentsCount,
		},
		employment: [...w2s.entries()].map(([issuer, facts]) => ({
			issuer,
			wages: numberValue(facts, "w2.wages"),
			federalWithholding: numberValue(facts, "w2.federal_withholding"),
		})),
		investments: [...investments.entries()].map(([issuer, facts]) => ({
			issuer,
			dividends: numberValue(facts, "1099div.ordinary"),
			interest: numberValue(facts, "1099int.interest"),
			shortTermGain: numberValue(facts, "1099b.short_term"),
			longTermGain: numberValue(facts, "1099b.long_term"),
		})),
		realEstate: officialFacts
			.filter((fact) => fact.type === "1098.mortgage_interest")
			.map((fact) => ({
				label:
					documentLabel(fact, input.documents) ?? fact.sourceForm ?? "Property",
				usageType: null,
				mortgageInterest: typeof fact.value === "number" ? fact.value : null,
			})),
		deductions: {
			confirmed: sum(
				input.facts,
				(fact) =>
					fact.category === "deduction" &&
					(fact.status === "confirmed" || fact.status === "extracted"),
			),
			potential: sum(
				input.facts,
				(fact) => fact.status === "candidate" && fact.category === "deduction",
			),
		},
		documentsPresent: input.documents.map((document) =>
			[document.formType, document.issuer].filter(Boolean).join(" — "),
		),
		missingExpected: input.readiness.missingItems.map((item) => item.title),
		unresolvedQuestions: [
			...input.readiness.unresolvedItems.map((item) => item.title),
			...input.readiness.reviewItems.map((item) => item.title),
		],
	};
}

function isOfficialFact(fact: TaxFact): boolean {
	return (
		fact.status === "confirmed" ||
		fact.status === "extracted" ||
		fact.status === "conflicting"
	);
}

function groupByIssuer(
	facts: TaxFact[],
	documents: TaxDocument[],
): Map<string, TaxFact[]> {
	const groups = new Map<string, TaxFact[]>();
	for (const fact of facts) {
		const issuer =
			documentLabel(fact, documents) ?? fact.key.split(":").at(-1) ?? "unknown";
		const bucket = groups.get(issuer) ?? [];
		bucket.push(fact);
		groups.set(issuer, bucket);
	}
	return groups;
}

function documentLabel(fact: TaxFact, documents: TaxDocument[]): string | null {
	if (!fact.sourceDocumentId) return null;
	const document = documents.find((item) => item.id === fact.sourceDocumentId);
	if (!document) return null;
	const label = taxDocumentTitle(document);
	return label === "Document" ? null : label;
}

function numberValue(facts: TaxFact[], type: string): number | null {
	const match =
		facts.find((fact) => fact.type === type && fact.status === "confirmed") ??
		facts.find((fact) => fact.type === type && fact.status === "extracted") ??
		facts.find((fact) => fact.type === type && isOfficialFact(fact));
	return typeof match?.value === "number" ? match.value : null;
}

function firstString(facts: TaxFact[], type: string): string | null {
	const match = facts.find((fact) => fact.type === type);
	return typeof match?.value === "string" ? match.value : null;
}

function sum(facts: TaxFact[], predicate: (fact: TaxFact) => boolean): number {
	return facts
		.filter(predicate)
		.reduce(
			(total, fact) =>
				total + (typeof fact.value === "number" ? fact.value : 0),
			0,
		);
}
