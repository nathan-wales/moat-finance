import type { TaxFact } from "@moat/contracts";

export function countsTowardConfirmedTaxTotal(fact: TaxFact): boolean {
	return fact.status === "confirmed" || fact.status === "extracted";
}

export function countsTowardPotentialTaxTotal(fact: TaxFact): boolean {
	return fact.status === "candidate";
}

export type TaxMoneyGroup = {
	confirmed: number;
	potential: number;
	potentialTransactionCount: number;
	items: Array<{
		type: string;
		value: number;
		status: TaxFact["status"];
		sourceForm?: string;
		sourceBox?: string;
		sourceDocumentId?: string;
	}>;
};

export function summarizeMoneyFacts(
	facts: TaxFact[],
	predicate: (fact: TaxFact) => boolean,
): TaxMoneyGroup {
	const items = facts.filter(
		(fact) => predicate(fact) && typeof fact.value === "number",
	);
	const confirmed = items
		.filter(countsTowardConfirmedTaxTotal)
		.reduce((sum, fact) => sum + Number(fact.value), 0);
	const potentialItems = items.filter(countsTowardPotentialTaxTotal);
	const potential = potentialItems.reduce(
		(sum, fact) => sum + Number(fact.value),
		0,
	);
	const potentialTransactionCount = potentialItems.reduce((sum, fact) => {
		const count =
			typeof fact.metadata?.transactionCount === "number"
				? fact.metadata.transactionCount
				: 0;
		return sum + count;
	}, 0);
	return {
		confirmed,
		potential,
		potentialTransactionCount,
		items: items.map((fact) => ({
			type: fact.type,
			value: Number(fact.value),
			status: fact.status,
			sourceForm: fact.sourceForm,
			sourceBox: fact.sourceBox,
			sourceDocumentId: fact.sourceDocumentId,
		})),
	};
}
