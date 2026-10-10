import type {
	TaxDocumentCategory,
	TaxExtractionMethod,
	TaxFact,
	TaxFormType,
	W2Form,
} from "@moat/contracts";
import {
	FORM_SCHEMA_VERSION,
	TAX_FORM_SCHEMAS,
	W2FormSchema,
} from "@moat/contracts";
import { classifyTaxForm } from "./classify-form";
import { extractW2Fields, isTaxFormChrome } from "./extract-w2";
import {
	lookupKeyValue,
	lookupMoney,
	lookupMoneyInText,
	parseMoney,
	slugIssuer,
} from "./money";
import type { ParsedTaxDocument } from "./parser";

export type ExtractedTaxDraft = {
	facts: Array<
		Omit<TaxFact, "id" | "createdAt" | "updatedAt" | "userId"> & {
			id?: string;
		}
	>;
	formType: TaxFormType;
	documentCategory: TaxDocumentCategory;
	issuer: string | null;
	recipient: string | null;
	extractionConfidence: number;
	formPayload: Record<string, unknown> | null;
	schemaVersion: string;
	extractionMethod?: TaxExtractionMethod;
};

export function extractFactsFromParsed(input: {
	taxYear: number;
	documentId: string;
	filename: string;
	parsed: ParsedTaxDocument;
	now?: Date;
}): ExtractedTaxDraft {
	const classified = classifyTaxForm({
		filename: input.filename,
		parsed: input.parsed,
	});
	const extractor = FORM_EXTRACTORS[classified.formType] ?? extractGenericFacts;
	return extractor({
		taxYear: input.taxYear,
		documentId: input.documentId,
		filename: input.filename,
		parsed: input.parsed,
		formType: classified.formType,
		documentCategory: classified.category,
		now: input.now ?? new Date(),
	});
}

type ExtractorInput = {
	taxYear: number;
	documentId: string;
	filename: string;
	parsed: ParsedTaxDocument;
	formType: TaxFormType;
	documentCategory: TaxDocumentCategory;
	now: Date;
};

const FORM_EXTRACTORS: Partial<
	Record<TaxFormType, (input: ExtractorInput) => ExtractedTaxDraft>
> = {
	"W-2": extractW2,
	"1099-INT": extract1099Int,
	"1099-DIV": extract1099Div,
	"1099-B": extract1099B,
	"1099-NEC": extract1099Nec,
	"1099-MISC": extract1099Misc,
	"1099-K": extract1099K,
	"1098": extract1098,
	"1098-E": extract1098E,
	"5498": extract5498,
	"5498-SA": extract5498Sa,
	"K-1": extractK1,
	"1040": extractPriorReturn,
};

function extractW2(input: ExtractorInput): ExtractedTaxDraft {
	const llmPayload = W2FormSchema.safeParse(input.parsed.extractedFields);
	if (llmPayload.success && input.parsed.parserName === "docling+qwen") {
		return draftFromW2Form({
			...input,
			payload: llmPayload.data,
			issuer: llmPayload.data.employerName ?? null,
			extractionMethod: "llm",
		});
	}
	const kv = input.parsed.keyValues;
	const text = input.parsed.text;
	const grid = extractW2Fields(input.parsed);
	const gridFoundAmounts = w2GridFoundAmounts(grid);
	const employer =
		grid.employerName ??
		lookupKeyValue(kv, [/employer'?s?\s+name/i, /^c\s+employer/i]) ??
		guessIssuer(text, input.filename);
	const wages = firstW2Amount(
		grid.wages,
		lookupMoney(kv, [/box\s*1\b/i, /wages.*tips.*compensation/i]),
		gridFoundAmounts
			? undefined
			: lookupMoneyInText(text, [
					/box\s*1\b/i,
					/wages,\s*tips,\s*other compensation/i,
					/\b1\s+wages/i,
				]),
	);
	const federalWithholding = firstW2Amount(
		grid.federalWithholding,
		lookupMoney(kv, [/box\s*2\b/i, /federal income tax withheld/i]),
		gridFoundAmounts
			? undefined
			: lookupMoneyInText(text, [
					/box\s*2\b/i,
					/federal income tax withheld/i,
					/\b2\s+federal income tax withheld/i,
				]),
	);
	const payload: W2Form = {
		employerName: employer ?? undefined,
		wages,
		federalWithholding,
		socialSecurityWages: firstW2Amount(
			grid.socialSecurityWages,
			lookupMoney(kv, [/box\s*3\b/i, /social security wages/i]),
			gridFoundAmounts
				? undefined
				: lookupMoneyInText(text, [/box\s*3\b/i, /social security wages/i]),
		),
		socialSecurityTax: firstW2Amount(
			grid.socialSecurityTax,
			lookupMoney(kv, [/box\s*4\b/i, /social security tax/i]),
			gridFoundAmounts
				? undefined
				: lookupMoneyInText(text, [
						/box\s*4\b/i,
						/social security tax withheld/i,
					]),
		),
		medicareWages: firstW2Amount(
			grid.medicareWages,
			lookupMoney(kv, [/box\s*5\b/i, /medicare wages/i]),
			gridFoundAmounts
				? undefined
				: lookupMoneyInText(text, [/box\s*5\b/i, /medicare wages/i]),
		),
		medicareTax: firstW2Amount(
			grid.medicareTax,
			lookupMoney(kv, [/box\s*6\b/i, /medicare tax/i]),
			gridFoundAmounts
				? undefined
				: lookupMoneyInText(text, [/box\s*6\b/i, /medicare tax withheld/i]),
		),
		stateWages: firstW2Amount(
			grid.stateWages,
			lookupMoney(kv, [/state wages/i]),
		),
		stateTax: firstW2Amount(
			grid.stateTax,
			lookupMoney(kv, [/state income tax/i]),
		),
		employeeName:
			grid.employeeName ?? lookupKeyValue(kv, [/employee'?s?\s+name/i]),
	};
	return draftFromW2Form({
		...input,
		payload,
		issuer: employer ?? null,
		extractionMethod: "parser",
	});
}

export function draftFromW2Form(input: {
	taxYear: number;
	documentId: string;
	filename: string;
	formType: TaxFormType;
	documentCategory: TaxDocumentCategory;
	now: Date;
	payload: W2Form;
	issuer?: string | null;
	extractionMethod?: TaxExtractionMethod;
}): ExtractedTaxDraft {
	const issuer = input.issuer ?? input.payload.employerName ?? null;
	const issuerSlug = slugIssuer(issuer);
	const method = input.extractionMethod ?? "parser";
	const facts = [
		moneyFact(input, {
			category: "income",
			type: "w2.wages",
			key: `w2.wages:employer:${issuerSlug}`,
			value: input.payload.wages,
			box: "1",
			form: "W-2",
			extractionMethod: method,
		}),
		moneyFact(input, {
			category: "withholding",
			type: "w2.federal_withholding",
			key: `w2.federal_withholding:employer:${issuerSlug}`,
			value: input.payload.federalWithholding,
			box: "2",
			form: "W-2",
			extractionMethod: method,
		}),
		moneyFact(input, {
			category: "income",
			type: "w2.social_security_wages",
			key: `w2.ss_wages:employer:${issuerSlug}`,
			value: input.payload.socialSecurityWages,
			box: "3",
			form: "W-2",
			extractionMethod: method,
		}),
		moneyFact(input, {
			category: "withholding",
			type: "w2.social_security_tax",
			key: `w2.ss_tax:employer:${issuerSlug}`,
			value: input.payload.socialSecurityTax,
			box: "4",
			form: "W-2",
			extractionMethod: method,
		}),
		moneyFact(input, {
			category: "income",
			type: "w2.medicare_wages",
			key: `w2.medicare_wages:employer:${issuerSlug}`,
			value: input.payload.medicareWages,
			box: "5",
			form: "W-2",
			extractionMethod: method,
		}),
		moneyFact(input, {
			category: "withholding",
			type: "w2.medicare_tax",
			key: `w2.medicare_tax:employer:${issuerSlug}`,
			value: input.payload.medicareTax,
			box: "6",
			form: "W-2",
			extractionMethod: method,
		}),
		moneyFact(input, {
			category: "income",
			type: "w2.state_wages",
			key: `w2.state_wages:employer:${issuerSlug}`,
			value: input.payload.stateWages,
			box: "16",
			form: "W-2",
			extractionMethod: method,
		}),
		moneyFact(input, {
			category: "withholding",
			type: "w2.state_tax",
			key: `w2.state_tax:employer:${issuerSlug}`,
			value: input.payload.stateTax,
			box: "17",
			form: "W-2",
			extractionMethod: method,
		}),
		moneyFact(input, {
			category: "income",
			type: "w2.local_wages",
			key: `w2.local_wages:employer:${issuerSlug}`,
			value: input.payload.localWages,
			form: "W-2",
			extractionMethod: method,
		}),
		moneyFact(input, {
			category: "withholding",
			type: "w2.local_tax",
			key: `w2.local_tax:employer:${issuerSlug}`,
			value: input.payload.localTax,
			form: "W-2",
			extractionMethod: method,
		}),
		moneyFact(input, {
			category: "income",
			type: "w2.dependent_care_benefits",
			key: `w2.dependent_care:employer:${issuerSlug}`,
			value: input.payload.dependentCareBenefits,
			box: "10",
			form: "W-2",
			extractionMethod: method,
		}),
		...(input.payload.box12 ?? []).map((entry, index) =>
			moneyFact(input, {
				category: "income",
				type: "w2.box12",
				key: `w2.box12:${entry.code}:employer:${issuerSlug}:${index}`,
				value: entry.amount,
				box: "12",
				form: "W-2",
				extractionMethod: method,
				metadata: { box12Code: entry.code },
			}),
		),
		...(input.payload.box14 ?? []).map((entry, index) =>
			moneyFact(input, {
				category: "income",
				type: "w2.box14",
				key: `w2.box14:${slugIssuer(entry.label)}:employer:${issuerSlug}:${index}`,
				value: entry.amount,
				box: "14",
				form: "W-2",
				extractionMethod: method,
				metadata: { box14Label: entry.label },
			}),
		),
	].filter((fact) => fact !== null);

	return {
		...draftFromPayload(input, {
			issuer,
			recipient: input.payload.employeeName ?? null,
			payload: input.payload,
			facts,
		}),
		extractionMethod: method,
	};
}

function firstW2Amount(
	...values: Array<number | undefined>
): number | undefined {
	return values.find((value) => value !== undefined);
}

function w2GridFoundAmounts(grid: ReturnType<typeof extractW2Fields>): boolean {
	return (
		grid.wages !== undefined ||
		grid.federalWithholding !== undefined ||
		grid.socialSecurityWages !== undefined ||
		grid.socialSecurityTax !== undefined ||
		grid.medicareWages !== undefined ||
		grid.medicareTax !== undefined ||
		grid.stateWages !== undefined ||
		grid.stateTax !== undefined
	);
}

function extract1099Int(input: ExtractorInput): ExtractedTaxDraft {
	const kv = input.parsed.keyValues;
	const payer =
		lookupKeyValue(kv, [/payer/i]) ??
		guessIssuer(input.parsed.text, input.filename);
	const payload = {
		payerName: payer,
		interestIncome: lookupMoney(kv, [/box\s*1/i, /interest income/i]),
		earlyWithdrawalPenalty: lookupMoney(kv, [/early withdrawal/i]),
		usSavingsBondInterest: lookupMoney(kv, [/savings bond/i]),
		federalWithholding: lookupMoney(kv, [/federal income tax withheld/i]),
		taxExemptInterest: lookupMoney(kv, [/tax-exempt interest/i]),
	};
	const slug = slugIssuer(payer);
	return draftFromPayload(input, {
		issuer: payer ?? null,
		recipient: null,
		payload,
		facts: [
			moneyFact(input, {
				category: "income",
				type: "1099int.interest",
				key: `1099int.interest:payer:${slug}`,
				value: payload.interestIncome,
				box: "1",
				form: "1099-INT",
			}),
			moneyFact(input, {
				category: "withholding",
				type: "1099int.federal_withholding",
				key: `1099int.federal_withholding:payer:${slug}`,
				value: payload.federalWithholding,
				form: "1099-INT",
			}),
		].filter((fact) => fact !== null),
	});
}

function extract1099Div(input: ExtractorInput): ExtractedTaxDraft {
	const kv = input.parsed.keyValues;
	const payer =
		lookupKeyValue(kv, [/payer/i]) ??
		guessIssuer(input.parsed.text, input.filename);
	const payload = {
		payerName: payer,
		ordinaryDividends: lookupMoney(kv, [/ordinary dividends/i, /box\s*1a/i]),
		qualifiedDividends: lookupMoney(kv, [/qualified dividends/i, /box\s*1b/i]),
		capitalGainDistributions: lookupMoney(kv, [/capital gain/i]),
		section199ADividends: lookupMoney(kv, [/199a/i]),
		foreignTaxPaid: lookupMoney(kv, [/foreign tax/i]),
		federalWithholding: lookupMoney(kv, [/federal income tax withheld/i]),
	};
	const slug = slugIssuer(payer);
	return draftFromPayload(input, {
		issuer: payer ?? null,
		recipient: null,
		payload,
		facts: [
			moneyFact(input, {
				category: "investment",
				type: "1099div.ordinary",
				key: `1099div.ordinary:payer:${slug}`,
				value: payload.ordinaryDividends,
				box: "1a",
				form: "1099-DIV",
			}),
			moneyFact(input, {
				category: "investment",
				type: "1099div.qualified",
				key: `1099div.qualified:payer:${slug}`,
				value: payload.qualifiedDividends,
				box: "1b",
				form: "1099-DIV",
			}),
		].filter((fact) => fact !== null),
	});
}

function extract1099B(input: ExtractorInput): ExtractedTaxDraft {
	const kv = input.parsed.keyValues;
	const payer =
		lookupKeyValue(kv, [/payer/i, /broker/i]) ??
		guessIssuer(input.parsed.text, input.filename);
	const lots = extractLots(input.parsed);
	const payload = {
		payerName: payer,
		lots,
		shortTermProceeds: lookupMoney(kv, [/short-term.*proceeds/i]),
		longTermProceeds: lookupMoney(kv, [/long-term.*proceeds/i]),
		federalWithholding: lookupMoney(kv, [/federal income tax withheld/i]),
	};
	const slug = slugIssuer(payer);
	const facts = lots.flatMap((lot, index) => {
		const missingBasis =
			lot.missingBasis === true || lot.costBasis === undefined;
		return [
			moneyFact(input, {
				category: "investment",
				type: "1099b.lot.proceeds",
				key: `1099b.lot.proceeds:payer:${slug}:${index}`,
				value: lot.proceeds,
				form: "1099-B",
				metadata: {
					lotIndex: index,
					description: lot.description,
					missingBasis,
				},
			}),
			moneyFact(input, {
				category: "investment",
				type: "1099b.lot.basis",
				key: `1099b.lot.basis:payer:${slug}:${index}`,
				value: lot.costBasis,
				form: "1099-B",
				metadata: { lotIndex: index, missingBasis },
			}),
		].filter((fact) => fact !== null);
	});
	return draftFromPayload(input, {
		issuer: payer ?? null,
		recipient: null,
		payload,
		facts,
	});
}

function extract1099Nec(input: ExtractorInput): ExtractedTaxDraft {
	const kv = input.parsed.keyValues;
	const payer =
		lookupKeyValue(kv, [/payer/i]) ??
		guessIssuer(input.parsed.text, input.filename);
	const amount = lookupMoney(kv, [/nonemployee compensation/i, /box\s*1/i]);
	return draftFromPayload(input, {
		issuer: payer ?? null,
		recipient: null,
		payload: { payerName: payer, nonemployeeCompensation: amount },
		facts: [
			moneyFact(input, {
				category: "business",
				type: "1099nec.compensation",
				key: `1099nec.compensation:payer:${slugIssuer(payer)}`,
				value: amount,
				box: "1",
				form: "1099-NEC",
			}),
		].filter((fact) => fact !== null),
	});
}

function extract1099Misc(input: ExtractorInput): ExtractedTaxDraft {
	const kv = input.parsed.keyValues;
	const payer =
		lookupKeyValue(kv, [/payer/i]) ??
		guessIssuer(input.parsed.text, input.filename);
	const rents = lookupMoney(kv, [/^rents$/i, /box\s*1/i]);
	const other = lookupMoney(kv, [/other income/i]);
	return draftFromPayload(input, {
		issuer: payer ?? null,
		recipient: null,
		payload: { payerName: payer, rents, otherIncome: other },
		facts: [
			moneyFact(input, {
				category: "business",
				type: "1099misc.other",
				key: `1099misc.other:payer:${slugIssuer(payer)}`,
				value: other ?? rents,
				form: "1099-MISC",
			}),
		].filter((fact) => fact !== null),
	});
}

function extract1099K(input: ExtractorInput): ExtractedTaxDraft {
	const kv = input.parsed.keyValues;
	const payer =
		lookupKeyValue(kv, [/payer/i]) ??
		guessIssuer(input.parsed.text, input.filename);
	const gross = lookupMoney(kv, [/gross amount/i, /box\s*1a/i]);
	return draftFromPayload(input, {
		issuer: payer ?? null,
		recipient: null,
		payload: { payerName: payer, grossAmount: gross },
		facts: [
			moneyFact(input, {
				category: "business",
				type: "1099k.gross",
				key: `1099k.gross:payer:${slugIssuer(payer)}`,
				value: gross,
				box: "1a",
				form: "1099-K",
			}),
		].filter((fact) => fact !== null),
	});
}

function extract1098(input: ExtractorInput): ExtractedTaxDraft {
	const kv = input.parsed.keyValues;
	const lender =
		lookupKeyValue(kv, [/lender/i, /recipient/i]) ??
		guessIssuer(input.parsed.text, input.filename);
	const interest = lookupMoney(kv, [/mortgage interest/i, /box\s*1/i]);
	const taxes = lookupMoney(kv, [/real property taxes/i]);
	return draftFromPayload(input, {
		issuer: lender ?? null,
		recipient: null,
		payload: {
			lenderName: lender,
			mortgageInterest: interest,
			propertyTaxes: taxes,
			propertyAddress: lookupKeyValue(kv, [/property address/i]),
		},
		facts: [
			moneyFact(input, {
				category: "real_estate",
				type: "1098.mortgage_interest",
				key: `1098.mortgage_interest:lender:${slugIssuer(lender)}`,
				value: interest,
				box: "1",
				form: "1098",
			}),
			moneyFact(input, {
				category: "deduction",
				type: "1098.property_tax",
				key: `1098.property_tax:lender:${slugIssuer(lender)}`,
				value: taxes,
				form: "1098",
			}),
		].filter((fact) => fact !== null),
	});
}

function extract1098E(input: ExtractorInput): ExtractedTaxDraft {
	const kv = input.parsed.keyValues;
	const lender =
		lookupKeyValue(kv, [/lender/i]) ??
		guessIssuer(input.parsed.text, input.filename);
	const interest = lookupMoney(kv, [/student loan interest/i, /box\s*1/i]);
	return draftFromPayload(input, {
		issuer: lender ?? null,
		recipient: null,
		payload: { lenderName: lender, studentLoanInterest: interest },
		facts: [
			moneyFact(input, {
				category: "education",
				type: "1098e.student_loan_interest",
				key: `1098e.interest:lender:${slugIssuer(lender)}`,
				value: interest,
				box: "1",
				form: "1098-E",
			}),
		].filter((fact) => fact !== null),
	});
}

function extract5498(input: ExtractorInput): ExtractedTaxDraft {
	const kv = input.parsed.keyValues;
	const trustee =
		lookupKeyValue(kv, [/trustee/i]) ??
		guessIssuer(input.parsed.text, input.filename);
	const contrib = lookupMoney(kv, [/ira contributions/i, /box\s*1/i]);
	return draftFromPayload(input, {
		issuer: trustee ?? null,
		recipient: null,
		payload: { trusteeName: trustee, iraContributions: contrib },
		facts: [
			moneyFact(input, {
				category: "retirement",
				type: "5498.ira_contributions",
				key: `5498.ira:trustee:${slugIssuer(trustee)}`,
				value: contrib,
				box: "1",
				form: "5498",
			}),
		].filter((fact) => fact !== null),
	});
}

function extract5498Sa(input: ExtractorInput): ExtractedTaxDraft {
	const kv = input.parsed.keyValues;
	const trustee =
		lookupKeyValue(kv, [/trustee/i]) ??
		guessIssuer(input.parsed.text, input.filename);
	const contrib = lookupMoney(kv, [
		/hsa contributions/i,
		/box\s*2/i,
		/box\s*1/i,
	]);
	return draftFromPayload(input, {
		issuer: trustee ?? null,
		recipient: null,
		payload: { trusteeName: trustee, hsaContributions: contrib },
		facts: [
			moneyFact(input, {
				category: "healthcare",
				type: "5498sa.hsa_contributions",
				key: `5498sa.hsa:trustee:${slugIssuer(trustee)}`,
				value: contrib,
				form: "5498-SA",
			}),
		].filter((fact) => fact !== null),
	});
}

function extractK1(input: ExtractorInput): ExtractedTaxDraft {
	const kv = input.parsed.keyValues;
	const entity =
		lookupKeyValue(kv, [/partnership/i, /entity/i]) ??
		guessIssuer(input.parsed.text, input.filename);
	const ordinary = lookupMoney(kv, [/ordinary business income/i]);
	return draftFromPayload(input, {
		issuer: entity ?? null,
		recipient: null,
		payload: { entityName: entity, ordinaryIncome: ordinary },
		facts: [
			moneyFact(input, {
				category: "business",
				type: "k1.ordinary_income",
				key: `k1.ordinary:entity:${slugIssuer(entity)}`,
				value: ordinary,
				form: "K-1",
			}),
		].filter((fact) => fact !== null),
	});
}

function extractPriorReturn(input: ExtractorInput): ExtractedTaxDraft {
	const kv = input.parsed.keyValues;
	const filingStatus = lookupKeyValue(kv, [/filing status/i]);
	const priorAgi = lookupMoney(kv, [/adjusted gross income/i, /\bagi\b/i]);
	const capitalLossCarryforward = lookupMoney(kv, [/capital loss carry/i]);
	const facts = [
		filingStatus
			? stringFact(input, {
					category: "prior_year",
					type: "prior.filing_status",
					key: "prior.filing_status",
					value: filingStatus,
					form: "1040",
				})
			: null,
		moneyFact(input, {
			category: "prior_year",
			type: "prior.agi",
			key: "prior.agi",
			value: priorAgi,
			form: "1040",
		}),
		moneyFact(input, {
			category: "prior_year",
			type: "prior.capital_loss_carryforward",
			key: "prior.capital_loss_carryforward",
			value: capitalLossCarryforward,
			form: "1040",
		}),
	].filter((fact) => fact !== null);
	return {
		...draftFromPayload(input, {
			issuer: "Prior-year return",
			recipient: null,
			payload: { filingStatus, priorAgi, capitalLossCarryforward },
			facts,
		}),
		documentCategory: "prior_return",
	};
}

function extractGenericFacts(input: ExtractorInput): ExtractedTaxDraft {
	const moneyFacts = input.parsed.keyValues
		.map((entry) => {
			const amount = parseMoney(entry.value);
			if (amount === null) return null;
			return moneyFact(input, {
				category: "income",
				type: "document.unclassified_amount",
				key: `document.unclassified:${slugIssuer(entry.key)}`,
				value: amount,
				form: input.formType,
				sourceText: `${entry.key}: ${entry.value}`,
			});
		})
		.filter((fact) => fact !== null);
	return draftFromPayload(input, {
		issuer: guessIssuer(input.parsed.text, input.filename),
		recipient: null,
		payload: null,
		facts: moneyFacts,
	});
}

function extractLots(parsed: ParsedTaxDocument) {
	const lots: Array<{
		description?: string;
		proceeds?: number;
		costBasis?: number;
		missingBasis?: boolean;
	}> = [];
	for (const table of parsed.tables) {
		const header = table.headers.map((cell) => cell.toLowerCase());
		const proceedsIdx = header.findIndex((cell) => /proceeds/.test(cell));
		const basisIdx = header.findIndex((cell) => /basis|cost/.test(cell));
		const descIdx = header.findIndex((cell) => /desc|symbol/.test(cell));
		if (proceedsIdx < 0) continue;
		for (const row of table.rows) {
			const proceeds = parseMoney(row[proceedsIdx]);
			if (proceeds === null) continue;
			const costBasis = basisIdx >= 0 ? parseMoney(row[basisIdx]) : null;
			lots.push({
				description: descIdx >= 0 ? row[descIdx] : undefined,
				proceeds,
				costBasis: costBasis ?? undefined,
				missingBasis: costBasis === null,
			});
		}
	}
	return lots;
}

function guessIssuer(text: string, filename: string): string | null {
	const fromName = filename
		.replace(/\.[a-z0-9]+$/i, "")
		.replace(/[_-]+/g, " ")
		.trim();
	if (fromName && !/w-?2|1099|1098|5498|tax/i.test(fromName)) {
		return fromName;
	}
	const firstLine = text
		.split("\n")
		.map((line) => line.trim())
		.find((line) => line.length > 2 && !isTaxFormChrome(line));
	return firstLine ?? null;
}

function draftFromPayload(
	input: Pick<ExtractorInput, "formType" | "documentCategory">,
	args: {
		issuer: string | null;
		recipient: string | null;
		payload: Record<string, unknown> | null;
		facts: ExtractedTaxDraft["facts"];
	},
): ExtractedTaxDraft {
	const schema =
		input.formType in TAX_FORM_SCHEMAS
			? FORM_SCHEMA_VERSION
			: FORM_SCHEMA_VERSION;
	return {
		facts: args.facts,
		formType: input.formType,
		documentCategory: input.documentCategory,
		issuer: args.issuer,
		recipient: args.recipient,
		extractionConfidence: args.facts.length > 0 ? 0.8 : 0.4,
		formPayload: args.payload,
		schemaVersion: schema,
	};
}

function moneyFact(
	input: Pick<ExtractorInput, "taxYear" | "documentId" | "documentCategory">,
	args: {
		category: TaxFact["category"];
		type: string;
		key: string;
		value: number | undefined;
		box?: string;
		form: string;
		sourceText?: string;
		metadata?: Record<string, unknown>;
		extractionMethod?: TaxExtractionMethod;
	},
): ExtractedTaxDraft["facts"][number] | null {
	if (args.value === undefined) return null;
	const isPrior =
		args.form === "1040" || input.documentCategory === "prior_return";
	return {
		taxYear: input.taxYear,
		category: args.category,
		type: args.type,
		key: args.key,
		value: args.value,
		valueType: "money",
		currency: "USD",
		sourceType: isPrior ? "prior_year" : "reported",
		sourceDocumentId: input.documentId,
		sourceForm: args.form,
		sourceBox: args.box,
		sourceText: args.sourceText,
		confidence: args.extractionMethod === "llm" ? 0.9 : 0.86,
		extractionMethod: args.extractionMethod ?? "parser",
		status: "extracted",
		userConfirmed: false,
		metadata: args.metadata,
	};
}

function stringFact(
	input: ExtractorInput,
	args: {
		category: TaxFact["category"];
		type: string;
		key: string;
		value: string;
		form: string;
	},
): ExtractedTaxDraft["facts"][number] {
	return {
		taxYear: input.taxYear,
		category: args.category,
		type: args.type,
		key: args.key,
		value: args.value,
		valueType: "string",
		sourceType: "prior_year",
		sourceDocumentId: input.documentId,
		sourceForm: args.form,
		confidence: 0.75,
		extractionMethod: "parser",
		status: "extracted",
		userConfirmed: false,
	};
}
