import type { TaxEstimate, TaxFact } from "@moat/contracts";

export function estimateTaxResult(facts: TaxFact[]): TaxEstimate {
	const wages = sumConfirmed(facts, ["w2.wages"]);
	const withholding = sumConfirmed(facts, [
		"w2.federal_withholding",
		"1099int.federal_withholding",
		"1099div.federal_withholding",
	]);
	const documentedDeductions = sumConfirmed(facts, [
		"1098.mortgage_interest",
		"1098.property_tax",
		"1098e.student_loan_interest",
	]);

	if (wages === null || withholding === null) {
		return {
			direction: "insufficient",
			amount: null,
			label: "Not enough information to estimate",
			confidence: "low",
		};
	}

	const taxableProxy = Math.max(wages - (documentedDeductions ?? 0), 0);
	const roughTax = taxableProxy * 0.22;
	const delta = Math.round((withholding - roughTax) * 100) / 100;
	if (Math.abs(delta) < 25) {
		return {
			direction: "even",
			amount: 0,
			label: "Likely close to even",
			confidence: "low",
		};
	}
	if (delta > 0) {
		return {
			direction: "refund",
			amount: delta,
			label: "Likely refund",
			confidence: "low",
		};
	}
	return {
		direction: "owed",
		amount: Math.abs(delta),
		label: "Likely amount owed",
		confidence: "low",
	};
}

function sumConfirmed(facts: TaxFact[], types: string[]): number | null {
	const matches = facts.filter(
		(fact) =>
			types.includes(fact.type) &&
			(fact.status === "confirmed" || fact.status === "extracted") &&
			typeof fact.value === "number",
	);
	if (matches.length === 0) return null;
	return matches.reduce((sum, fact) => sum + Number(fact.value), 0);
}
