import type {
	TaxDocument,
	TaxFact,
	TaxFactProvenance,
	TaxProfileRow,
	TaxProfileSection,
	TaxYearProfile,
} from "@moat/contracts";

const SECTION_DEFS: Array<{
	id: string;
	label: string;
	categories: TaxFact["category"][];
}> = [
	{ id: "household", label: "Personal / household", categories: ["identity"] },
	{ id: "income", label: "Income", categories: ["income"] },
	{
		id: "employment",
		label: "Employment",
		categories: ["income", "withholding"],
	},
	{ id: "investments", label: "Investments", categories: ["investment"] },
	{ id: "retirement", label: "Retirement", categories: ["retirement"] },
	{ id: "real-estate", label: "Real estate", categories: ["real_estate"] },
	{ id: "business", label: "Business", categories: ["business"] },
	{ id: "deductions", label: "Deductions", categories: ["deduction"] },
	{ id: "credits", label: "Credits", categories: ["credit"] },
	{ id: "education", label: "Education", categories: ["education"] },
	{ id: "healthcare", label: "Healthcare", categories: ["healthcare"] },
	{
		id: "estimated",
		label: "Estimated payments",
		categories: ["estimated_payment"],
	},
	{
		id: "prior-year",
		label: "Prior-year carryforwards",
		categories: ["prior_year"],
	},
];

export function buildTaxYearProfile(input: {
	taxYear: number;
	facts: TaxFact[];
	documents: TaxDocument[];
	missingInformation: string[];
	planning?: {
		filingStatus: string | null;
		selfEmployedIncome: boolean;
		rentalIncome: boolean;
	};
}): TaxYearProfile {
	const sections = SECTION_DEFS.map((section) => {
		const rows = input.facts
			.filter((fact) => section.categories.includes(fact.category))
			.filter((fact) => {
				if (section.id === "employment") {
					return fact.type.startsWith("w2.");
				}
				if (section.id === "income") {
					return !fact.type.startsWith("w2.");
				}
				return true;
			})
			.map((fact) => toRow(fact, input.documents));
		return { id: section.id, label: section.label, rows };
	}).filter((section) => section.rows.length > 0);

	const seedRows = planningSeedRows(input.facts, input.planning);
	if (seedRows.length > 0) {
		const household = sections.find((section) => section.id === "household");
		if (household) {
			household.rows = [...seedRows, ...household.rows];
		} else {
			sections.unshift({
				id: "household",
				label: "Personal / household",
				rows: seedRows,
			});
		}
	}

	return {
		taxYear: input.taxYear,
		sections,
		facts: input.facts,
		documents: input.documents,
		missingInformation: input.missingInformation,
	};
}

export function toRow(fact: TaxFact, documents: TaxDocument[]): TaxProfileRow {
	const document = documents.find((item) => item.id === fact.sourceDocumentId);
	return {
		id: fact.id,
		label: rowLabel(fact),
		value: fact.value,
		valueType: fact.valueType,
		displayValue: displayValue(fact),
		status: fact.status,
		source: sourceLabel(fact, document),
		provenance: toProvenance(fact, document),
	};
}

export function toProvenance(
	fact: TaxFact,
	document?: TaxDocument,
): TaxFactProvenance {
	const confidenceLabel =
		fact.status === "confirmed" || fact.userConfirmed
			? "verified"
			: fact.confidence >= 0.8
				? "high"
				: fact.confidence >= 0.5
					? "medium"
					: "low";
	return {
		sourceType: fact.sourceType,
		documentId: fact.sourceDocumentId,
		documentLabel: document
			? `${document.formType ?? "Document"}${document.issuer ? ` — ${document.issuer}` : ""}`
			: undefined,
		form: fact.sourceForm,
		box: fact.sourceBox,
		page: fact.sourcePage,
		transactionId: fact.sourceTransactionId,
		accountId: fact.sourceAccountId,
		holdingId: fact.sourceHoldingId,
		manualEntryId: fact.sourceManualEntryId,
		realEstateId: fact.sourceRealEstateId,
		confidenceLabel,
	};
}

const TAX_FACT_LABELS: Record<string, string> = {
	"w2.wages": "Employment income",
	"w2.federal_withholding": "Federal withholding",
	"w2.social_security_wages": "Social Security wages",
	"w2.social_security_tax": "Social Security tax",
	"w2.medicare_wages": "Medicare wages",
	"w2.medicare_tax": "Medicare tax",
	"w2.state_wages": "State wages",
	"w2.state_tax": "State tax",
	"1098.mortgage_interest": "Mortgage interest",
	"1098.property_tax": "Property tax",
	"1098e.student_loan_interest": "Student loan interest",
	"candidate.charitable": "Potential charitable donations",
	"candidate.medical": "Potential medical expenses",
	"candidate.education": "Potential education expenses",
	"candidate.hsa": "Potential HSA contributions",
	"candidate.expected_1098": "Expected Form 1098",
	"manual.charitable": "Charitable donations",
	"5498.ira_contributions": "IRA contributions",
	"5498sa.hsa_contributions": "HSA contributions",
	"1099div.ordinary": "Ordinary dividends",
	"1099div.qualified": "Qualified dividends",
	"1099int.interest": "Interest income",
	"1099int.federal_withholding": "Federal withholding (1099-INT)",
	"1099nec.compensation": "Nonemployee compensation",
	"1099misc.other": "Other income (1099-MISC)",
	"1099k.gross": "1099-K gross receipts",
	"1099b.lot.proceeds": "Brokerage proceeds",
	"1099b.lot.basis": "Cost basis",
	"k1.ordinary_income": "K-1 ordinary income",
	"prior.filing_status": "Filing status",
	"identity.filing_status": "Filing status",
	"prior.agi": "Prior-year AGI",
	"prior.capital_loss_carryforward": "Capital loss carryforward",
	"document.unclassified_amount": "Unclassified document amount",
};

export function taxFactLabel(
	fact: Pick<TaxFact, "type"> & Pick<Partial<TaxFact>, "metadata">,
): string {
	const known = TAX_FACT_LABELS[fact.type];
	const description =
		typeof fact.metadata?.description === "string"
			? fact.metadata.description.trim()
			: "";
	if (known && description && fact.type.startsWith("1099b.lot.")) {
		return `${description} · ${known}`;
	}
	if (known) return known;
	return humanizeTaxFactType(fact.type);
}

function humanizeTaxFactType(type: string): string {
	return type
		.split(/[._]/)
		.filter((part) => part.length > 0)
		.map((part) => part.charAt(0).toUpperCase() + part.slice(1))
		.join(" ");
}

function planningSeedRows(
	facts: TaxFact[],
	planning:
		| {
				filingStatus: string | null;
				selfEmployedIncome: boolean;
				rentalIncome: boolean;
		  }
		| undefined,
): TaxProfileRow[] {
	if (!planning) return [];
	const rows: TaxProfileRow[] = [];
	const hasFilingFact = facts.some(
		(fact) =>
			fact.type === "prior.filing_status" ||
			fact.type === "identity.filing_status",
	);
	if (planning.filingStatus && !hasFilingFact) {
		rows.push(
			planningRow(
				"planning:filing_status",
				"Filing status",
				planning.filingStatus,
			),
		);
	}
	if (planning.selfEmployedIncome) {
		rows.push(
			planningRow("planning:self_employed", "Self-employed income", "Yes"),
		);
	}
	if (planning.rentalIncome) {
		rows.push(planningRow("planning:rental_income", "Rental income", "Yes"));
	}
	return rows;
}

function planningRow(id: string, label: string, value: string): TaxProfileRow {
	return {
		id,
		label,
		value,
		valueType: "string",
		displayValue: value,
		status: "confirmed",
		source: "Financial Profile",
		provenance: {
			sourceType: "financial_data",
			confidenceLabel: "verified",
		},
	};
}

function rowLabel(fact: TaxFact): string {
	return taxFactLabel(fact);
}

function displayValue(fact: TaxFact): string {
	if (fact.valueType === "money" && typeof fact.value === "number") {
		return fact.value.toLocaleString("en-US", {
			style: "currency",
			currency: "USD",
		});
	}
	if (typeof fact.value === "boolean") return fact.value ? "Yes" : "No";
	if (fact.value === null || fact.value === undefined) return "—";
	return String(fact.value);
}

function sourceLabel(fact: TaxFact, document?: TaxDocument): string {
	if (fact.status === "candidate") {
		const count =
			typeof fact.metadata?.transactionCount === "number"
				? fact.metadata.transactionCount
				: 0;
		return count > 0
			? `${count} Moat transactions · Needs confirmation`
			: "Moat transactions · Needs confirmation";
	}
	if (document) {
		const box = fact.sourceBox ? ` · Box ${fact.sourceBox}` : "";
		return `${document.issuer ?? document.formType ?? "Document"}${document.formType ? ` ${document.formType}` : ""}${box}`;
	}
	if (fact.sourceType === "manual") return "Entered manually";
	return fact.sourceType;
}

export type { TaxProfileSection };
