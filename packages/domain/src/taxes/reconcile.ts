import type { TaxFact, TaxFactConflict } from "@moat/contracts";

export type ReconcileTaxFactsResult = {
	facts: TaxFact[];
	conflicts: Array<
		Omit<TaxFactConflict, "id" | "userId" | "createdAt" | "updatedAt">
	>;
};

export function reconcileTaxFacts(facts: TaxFact[]): ReconcileTaxFactsResult {
	const grouped = new Map<string, TaxFact[]>();
	for (const fact of facts) {
		if (fact.status === "rejected" || fact.status === "superseded") {
			continue;
		}
		const bucketKey = reconciliationKey(fact);
		const bucket = grouped.get(bucketKey) ?? [];
		bucket.push(fact);
		grouped.set(bucketKey, bucket);
	}

	const nextFacts = facts.map((fact) => ({ ...fact }));
	const conflicts: ReconcileTaxFactsResult["conflicts"] = [];

	for (const [factKey, group] of grouped) {
		if (group.length < 2) continue;
		const values = new Set(group.map((fact) => serializeValue(fact.value)));
		if (values.size < 2) continue;

		const taxYear = group[0]?.taxYear;
		if (taxYear === undefined) continue;
		const groupIds = new Set(group.map((fact) => fact.id));

		for (const fact of nextFacts) {
			if (!groupIds.has(fact.id)) continue;
			if (fact.status === "confirmed") continue;
			fact.status = "conflicting";
		}

		conflicts.push({
			taxYear,
			factKey,
			factIds: group.map((fact) => fact.id),
			preferredFactId: null,
			resolutionState: "open",
		});
	}

	return { facts: nextFacts, conflicts };
}

export function reconciliationKey(fact: Pick<TaxFact, "key" | "type">): string {
	if (
		fact.type === "5498sa.hsa_contributions" ||
		fact.type === "candidate.hsa"
	) {
		return "hsa.contributions";
	}
	return fact.key;
}

function serializeValue(value: unknown): string {
	if (typeof value === "number") return value.toFixed(2);
	return JSON.stringify(value);
}
