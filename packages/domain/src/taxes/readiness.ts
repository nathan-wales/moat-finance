import type {
	TaxDocument,
	TaxFact,
	TaxReadiness,
	TaxReadinessCategory,
	TaxReadinessCategoryId,
	TaxReadinessItem,
} from "@moat/contracts";
import type { TaxPlanningSources } from "@moat/data-access";

export function computeTaxReadiness(input: {
	taxYear: number;
	facts: TaxFact[];
	documents: TaxDocument[];
	sources: TaxPlanningSources;
}): TaxReadiness {
	const categories = buildCategories(input);
	const relevant = categories.filter((category) => category.relevant);
	const completeCount = relevant.filter((category) => category.complete).length;
	const score =
		relevant.length === 0
			? 0
			: Math.round((completeCount / relevant.length) * 100);

	const missingItems: TaxReadinessItem[] = [];
	const unresolvedItems: TaxReadinessItem[] = [];
	const reviewItems: TaxReadinessItem[] = [];

	for (const category of relevant) {
		if (category.complete) continue;
		if (category.id === "employment" && !hasForm(input.documents, "W-2")) {
			missingItems.push({
				id: "missing-w2",
				categoryId: "employment",
				severity: "missing",
				title: "Missing W-2",
				detail: "Employment income is expected but no W-2 is on file.",
				reason: category.relevanceReason,
			});
		}
		if (
			category.id === "investment" &&
			!hasAnyForm(input.documents, ["1099-B", "1099-DIV", "1099-INT"])
		) {
			missingItems.push({
				id: "missing-brokerage-1099",
				categoryId: "investment",
				severity: "missing",
				title: "Brokerage 1099 has not been uploaded",
				detail:
					"Investment accounts are present, but no brokerage tax form is on file.",
				reason: category.relevanceReason,
			});
		}
		if (category.id === "real_estate" && !hasForm(input.documents, "1098")) {
			missingItems.push({
				id: "missing-1098",
				categoryId: "real_estate",
				severity: "missing",
				title: "Mortgage interest document expected but not found",
				detail: "A home or rental with a mortgage usually produces Form 1098.",
				reason: category.relevanceReason,
			});
		}
		if (category.id === "healthcare" && !hasForm(input.documents, "5498-SA")) {
			missingItems.push({
				id: "missing-5498-sa",
				categoryId: "healthcare",
				severity: "missing",
				title: "Form 5498-SA has not been uploaded",
				detail:
					"An HSA account is present, but the contribution form is missing.",
				reason: category.relevanceReason,
			});
		}
		if (
			category.id === "education" &&
			!hasAnyForm(input.documents, ["1098-E", "1098-T"])
		) {
			missingItems.push({
				id: "missing-education-form",
				categoryId: "education",
				severity: "missing",
				title: "Education tax form is missing",
				detail:
					"Education spending is on file, but no 1098-E or 1098-T was uploaded.",
				reason: category.relevanceReason,
			});
		}
		if (
			category.id === "business" &&
			!hasAnyForm(input.documents, ["1099-NEC", "1099-MISC", "1099-K", "K-1"])
		) {
			missingItems.push({
				id: "missing-business-1099",
				categoryId: "business",
				severity: "missing",
				title: "Self-employment tax form is missing",
				detail:
					"Self-employed income is flagged, but no 1099-NEC, 1099-MISC, 1099-K, or K-1 is on file.",
				reason: category.relevanceReason,
			});
		}
		if (category.id === "retirement" && !hasForm(input.documents, "5498")) {
			missingItems.push({
				id: "missing-5498",
				categoryId: "retirement",
				severity: "missing",
				title: "Form 5498 has not been uploaded",
				detail: "Retirement accounts are present, but no 5498 is on file.",
				reason: category.relevanceReason,
			});
		}
	}

	const hasRentalProperty =
		input.sources.rentalIncome ||
		input.sources.properties.some(
			(property) => property.usageType === "RENTAL",
		);
	if (hasRentalProperty) {
		const hasRentalReview = input.facts.some(
			(fact) =>
				fact.category === "real_estate" &&
				(fact.status === "confirmed" || fact.status === "extracted"),
		);
		if (!hasRentalReview) {
			reviewItems.push({
				id: "rental-expenses-review",
				categoryId: "real_estate",
				severity: "review",
				title: "Rental property expenses need review",
				detail:
					"A rental is on file. Confirm income and expenses before treating them as tax facts.",
				reason: "rental_review",
			});
		}
	}

	for (const fact of input.facts) {
		if (fact.status === "candidate") {
			reviewItems.push({
				id: `review-${fact.id}`,
				categoryId: categoryForFact(fact),
				severity: "review",
				title: reviewTitle(fact),
				detail:
					"This amount comes from Moat transactions and still needs confirmation.",
				reason: "financial_data_candidate",
			});
		}
		if (fact.status === "conflicting") {
			unresolvedItems.push({
				id: `conflict-${fact.id}`,
				categoryId: categoryForFact(fact),
				severity: "unresolved",
				title: `Conflicting values for ${fact.type}`,
				detail:
					"Moat kept both values. Pick a source before treating this as confirmed.",
				reason: "open_conflict",
			});
		}
		if (
			fact.type.startsWith("1099b.lot") &&
			fact.metadata?.missingBasis === true
		) {
			reviewItems.push({
				id: `basis-${fact.id}`,
				categoryId: "investment",
				severity: "review",
				title: "Cost basis missing for a 1099-B lot",
				detail:
					"Moat did not invent a basis. Review the lot before estimating gains.",
				reason: "missing_basis",
			});
		}
	}

	return {
		taxYear: input.taxYear,
		score,
		formula:
			"Equal weight across relevant categories: complete relevant categories / relevant categories.",
		categories,
		missingItems: uniqueItems(missingItems),
		unresolvedItems: uniqueItems(unresolvedItems),
		reviewItems: uniqueItems(reviewItems),
	};
}

function buildCategories(input: {
	facts: TaxFact[];
	documents: TaxDocument[];
	sources: TaxPlanningSources;
}): TaxReadinessCategory[] {
	const hasEmployment =
		input.sources.accounts.some((account) =>
			/payroll|salary|wages/i.test(
				`${account.type} ${account.subtype ?? ""} ${account.name}`,
			),
		) ||
		input.facts.some(
			(fact) =>
				fact.type.startsWith("w2.") ||
				(fact.category === "income" && fact.sourceType === "reported"),
		);
	const hasBrokerage = input.sources.accounts.some((account) => {
		const label = `${account.type} ${account.subtype ?? ""} ${account.name}`;
		if (/401|ira|hsa|retirement/i.test(label) && !/brokerage/i.test(label)) {
			return false;
		}
		return /brokerage|investment/i.test(label);
	});
	const hasHome = input.sources.properties.some((property) =>
		["PRIMARY_RESIDENCE", "MIXED_USE"].includes(property.usageType),
	);
	const hasRental =
		input.sources.rentalIncome ||
		input.sources.properties.some(
			(property) => property.usageType === "RENTAL",
		);
	const hasHsa = input.sources.accounts.some((account) =>
		/hsa/i.test(`${account.type} ${account.subtype ?? ""}`),
	);
	const hasDonationCandidate = input.facts.some(
		(fact) => fact.type === "candidate.charitable",
	);

	return [
		category(
			"identity",
			"Identity / family",
			true,
			Boolean(input.sources.filingStatus),
			"Always relevant.",
			"Filing status has not been confirmed.",
		),
		category(
			"employment",
			"Employment income",
			hasEmployment,
			hasForm(input.documents, "W-2") || hasConfirmed(input.facts, "w2.wages"),
			"Wages, payroll, or a W-2 is already in Moat.",
			"No confirmed W-2 wages.",
		),
		category(
			"investment",
			"Investment income",
			hasBrokerage,
			hasAnyForm(input.documents, ["1099-B", "1099-DIV", "1099-INT"]),
			"Brokerage or investment accounts are on file.",
			"Expected brokerage tax form is missing.",
		),
		category(
			"retirement",
			"Retirement",
			input.sources.accounts.some((account) =>
				/ira|401/i.test(`${account.type} ${account.subtype ?? ""}`),
			),
			hasAnyForm(input.documents, ["5498"]) ||
				hasConfirmed(input.facts, "5498.ira_contributions"),
			"Retirement accounts are present.",
			"No 5498 or confirmed retirement contribution.",
		),
		category(
			"real_estate",
			"Real estate",
			hasHome || hasRental,
			hasForm(input.documents, "1098") ||
				hasConfirmed(input.facts, "1098.mortgage_interest"),
			"A home or rental property is on file.",
			"Expected 1098 or rental review is incomplete.",
		),
		category(
			"business",
			"Business income",
			input.sources.selfEmployedIncome,
			hasAnyForm(input.documents, ["1099-NEC", "1099-MISC", "1099-K", "K-1"]),
			"Self-employed income is flagged on the financial profile.",
			"No 1099-NEC/MISC/K or K-1.",
		),
		category(
			"healthcare",
			"Healthcare / HSA",
			hasHsa,
			hasForm(input.documents, "5498-SA") ||
				hasConfirmed(input.facts, "5498sa.hsa_contributions"),
			"An HSA account is present.",
			"Form 5498-SA is missing.",
		),
		category(
			"education",
			"Education",
			input.facts.some((fact) => fact.category === "education"),
			hasAnyForm(input.documents, ["1098-E", "1098-T"]),
			"Education facts or loans were found.",
			"Education documents still needed.",
		),
		category(
			"deductions",
			"Deductions",
			hasDonationCandidate || hasHome,
			input.facts.some(
				(fact) => fact.category === "deduction" && fact.status === "confirmed",
			),
			"Potential deductions were inferred or a mortgage exists.",
			"Inferred deductions are still candidates.",
		),
		category(
			"credits",
			"Credits",
			false,
			false,
			"No credit-specific evidence yet.",
			undefined,
		),
		category(
			"estimated_payments",
			"Estimated payments",
			input.sources.selfEmployedIncome,
			input.facts.some(
				(fact) => fact.category === "estimated_payment" && fact.userConfirmed,
			),
			"Self-employed filers often make estimated payments.",
			"No confirmed estimated payments.",
		),
	];
}

function category(
	id: TaxReadinessCategoryId,
	label: string,
	relevant: boolean,
	complete: boolean,
	relevanceReason: string,
	withheldReason: string | undefined,
): TaxReadinessCategory {
	return {
		id,
		label,
		relevant,
		complete: relevant ? complete : true,
		relevanceReason,
		withheldReason: relevant && !complete ? withheldReason : undefined,
	};
}

function hasForm(documents: TaxDocument[], formType: string): boolean {
	return documents.some((document) => document.formType === formType);
}

function hasAnyForm(documents: TaxDocument[], formTypes: string[]): boolean {
	return documents.some(
		(document) => document.formType && formTypes.includes(document.formType),
	);
}

function hasConfirmed(facts: TaxFact[], type: string): boolean {
	return facts.some(
		(fact) =>
			fact.type === type &&
			(fact.status === "confirmed" || fact.status === "extracted"),
	);
}

function categoryForFact(fact: TaxFact): TaxReadinessCategoryId {
	if (fact.category === "healthcare") return "healthcare";
	if (fact.category === "investment") return "investment";
	if (fact.category === "real_estate") return "real_estate";
	if (fact.category === "education") return "education";
	if (fact.category === "business") return "business";
	if (fact.category === "retirement") return "retirement";
	if (fact.category === "estimated_payment") return "estimated_payments";
	if (fact.category === "deduction") return "deductions";
	if (fact.category === "income") return "employment";
	return "identity";
}

function reviewTitle(fact: TaxFact): string {
	if (fact.type === "candidate.charitable") {
		const count =
			typeof fact.metadata?.transactionCount === "number"
				? fact.metadata.transactionCount
				: 0;
		return `Possible charitable donations found in transactions${count ? ` (${count})` : ""}`;
	}
	if (fact.type === "candidate.medical") return "Medical spending needs review";
	if (fact.type === "candidate.hsa") {
		return "Possible HSA contributions found in transactions";
	}
	if (fact.type === "5498sa.hsa_contributions") {
		return "HSA contribution amount may differ from Form 5498-SA";
	}
	return `Review ${fact.type}`;
}

const EVIDENCE_DOCUMENT_CATEGORIES: ReadonlySet<TaxReadinessCategoryId> =
	new Set([
		"employment",
		"investment",
		"retirement",
		"real_estate",
		"business",
		"healthcare",
		"education",
	]);

export function expectedEvidenceDocumentCount(
	categories: TaxReadinessCategory[],
): number {
	return categories.filter(
		(category) =>
			category.relevant && EVIDENCE_DOCUMENT_CATEGORIES.has(category.id),
	).length;
}

function uniqueItems(items: TaxReadinessItem[]): TaxReadinessItem[] {
	const seen = new Set<string>();
	return items.filter((item) => {
		if (seen.has(item.id)) return false;
		seen.add(item.id);
		return true;
	});
}
