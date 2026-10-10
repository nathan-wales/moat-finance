import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type {
	FinancialProfileData,
	TaxDocumentProcessingState,
	TaxFact,
	TaxProfile,
} from "@moat/contracts";
import {
	isManageableTaxDocument,
	isTaxDocumentProcessing,
	resolveTaxUploadMimeType,
	taxDocumentTitle,
} from "@moat/contracts";
import type { TaxPlanningSources } from "@moat/data-access";
import { buildTaxAgentContext } from "./agent-context";
import {
	financialCandidateId,
	generateFinancialCandidates,
	mergeFinancialCandidates,
} from "./candidates";
import { classifyTaxForm } from "./classify-form";
import { estimateTaxResult } from "./estimate";
import { extractFactsFromParsed } from "./extract-facts";
import { MemoryFileStorage } from "./file-storage";
import { HeuristicTaxDocumentParser } from "./heuristic-parser";
import {
	deleteTaxDocument,
	renameTaxDocument,
	uploadTaxDocument,
} from "./operations";
import { buildOverviewMetricBreakdowns } from "./overview-breakdowns";
import { decodeStoredParsedText } from "./parsed-text";
import { normalizeUnstructuredPayload } from "./parser";
import {
	computeTaxReadiness,
	expectedEvidenceDocumentCount,
} from "./readiness";
import { reconcileTaxFacts } from "./reconcile";
import {
	assertTaxDocumentFileSizeLimit,
	assertTaxDocumentStorageLimit,
	sumTaxDocumentStorageBytes,
	TaxDocumentFileTooLargeError,
	TaxDocumentStorageLimitError,
} from "./storage-quota";
import { summarizeMoneyFacts } from "./summaries";
import {
	applyPlanningSeedToProfile,
	parsePlanningFilingStatus,
	planningPatchFromFact,
} from "./sync-planning-profile";
import { buildTaxYearProfile } from "./year-profile";

function fact(
	overrides: Partial<TaxFact> & Pick<TaxFact, "type" | "key" | "value">,
): TaxFact {
	return {
		id: overrides.id ?? overrides.key,
		userId: "user-1",
		taxYear: 2026,
		category: "income",
		valueType: "money",
		currency: "USD",
		sourceType: "reported",
		confidence: 0.9,
		extractionMethod: "parser",
		status: "extracted",
		userConfirmed: false,
		createdAt: "2026-02-03T00:00:00.000Z",
		updatedAt: "2026-02-03T00:00:00.000Z",
		...overrides,
	};
}

const emptySources: TaxPlanningSources = {
	filingStatus: "Single",
	profileTaxYear: 2026,
	selfEmployedIncome: false,
	rentalIncome: false,
	dependentsCount: 0,
	householdType: "Individual",
	accounts: [],
	properties: [],
	categoryTotals: [],
};

describe("normalizeUnstructuredPayload", () => {
	it("maps Unstructured-like elements into ParsedTaxDocument", () => {
		const parsed = normalizeUnstructuredPayload([
			{
				type: "Title",
				text: "W-2 Wage and Tax Statement",
				metadata: { page_number: 1 },
			},
			{
				type: "NarrativeText",
				text: "Employer: SchoolAI",
				metadata: { page_number: 1 },
			},
			{
				type: "NarrativeText",
				text: "Box 1: $180,420.00",
				metadata: { page_number: 1 },
			},
		]);
		assert.match(parsed.text, /SchoolAI/);
		assert.equal(parsed.pages[0]?.page, 1);
		assert.ok(parsed.keyValues.some((item) => item.key.includes("Employer")));
	});
});

describe("extractFactsFromParsed", () => {
	it("produces W-2 Box 1/2 facts with document provenance", () => {
		const parsed = normalizeUnstructuredPayload([
			{
				type: "Title",
				text: "Form W-2 Wage and Tax Statement",
				metadata: { page_number: 1 },
			},
			{
				type: "NarrativeText",
				text: "Employer: SchoolAI",
				metadata: { page_number: 1 },
			},
			{
				type: "NarrativeText",
				text: "Box 1: 180420.22",
				metadata: { page_number: 1 },
			},
			{
				type: "NarrativeText",
				text: "Federal income tax withheld: 31224.00",
				metadata: { page_number: 1 },
			},
		]);
		const extracted = extractFactsFromParsed({
			taxYear: 2026,
			documentId: "doc-w2",
			filename: "schoolai-w2.pdf",
			parsed,
		});
		const wages = extracted.facts.find((item) => item.type === "w2.wages");
		const withholding = extracted.facts.find(
			(item) => item.type === "w2.federal_withholding",
		);
		assert.equal(extracted.formType, "W-2");
		assert.equal(wages?.value, 180420.22);
		assert.equal(wages?.sourceDocumentId, "doc-w2");
		assert.equal(wages?.sourceForm, "W-2");
		assert.equal(wages?.sourceBox, "1");
		assert.equal(wages?.sourceType, "reported");
		assert.equal(withholding?.sourceBox, "2");
	});

	it("extracts W-2 boxes from layout text without colon key-values", () => {
		const extracted = extractFactsFromParsed({
			taxYear: 2026,
			documentId: "doc-w2-layout",
			filename: "w2.pdf",
			parsed: {
				text: "a Employee's social security number\nForm W-2 Wage and Tax Statement\nc Employer's name, address, and ZIP code\nSchoolAI\n1 Wages, tips, other compensation 180420.22\n2 Federal income tax withheld 31224.00\n3 Social security wages 180420.22\n4 Social security tax withheld 11186.05\n5 Medicare wages and tips 180420.22\n6 Medicare tax withheld 2616.09",
				pages: [{ page: 1, text: "Form W-2 Wage and Tax Statement" }],
				tables: [],
				keyValues: [],
				formClassification: null,
				extractedFields: {},
				confidence: 0.55,
				sourceLocations: [],
			},
		});
		assert.equal(extracted.formType, "W-2");
		assert.equal(extracted.issuer, "SchoolAI");
		assert.equal(
			extracted.facts.find((item) => item.type === "w2.wages")?.value,
			180420.22,
		);
		assert.equal(
			extracted.facts.find((item) => item.type === "w2.federal_withholding")
				?.value,
			31224.0,
		);
	});

	it("keeps 1099-B lots and missing basis instead of inventing cost", () => {
		const parsed = normalizeUnstructuredPayload([
			{
				type: "Title",
				text: "Form 1099-B Proceeds From Broker",
				metadata: { page_number: 1 },
			},
			{
				type: "Table",
				text: "AAPL",
				metadata: {
					page_number: 1,
					text_as_html:
						"<table><tr><th>Description</th><th>Proceeds</th><th>Cost basis</th></tr><tr><td>AAPL</td><td>1200</td><td></td></tr></table>",
				},
			},
		]);
		const extracted = extractFactsFromParsed({
			taxYear: 2026,
			documentId: "doc-b",
			filename: "robinhood-1099b.pdf",
			parsed,
		});
		const lot = extracted.facts.find(
			(item) => item.type === "1099b.lot.proceeds",
		);
		assert.equal(extracted.formType, "1099-B");
		assert.equal(lot?.value, 1200);
		assert.equal(lot?.metadata?.missingBasis, true);
	});

	it("marks prior-year return facts as prior_year, not current wages", () => {
		const parsed = normalizeUnstructuredPayload([
			{
				type: "Title",
				text: "Form 1040 U.S. Individual Income Tax Return",
				metadata: { page_number: 1 },
			},
			{
				type: "NarrativeText",
				text: "Filing status: Married filing jointly",
				metadata: { page_number: 1 },
			},
			{
				type: "NarrativeText",
				text: "Adjusted gross income: 210000",
				metadata: { page_number: 1 },
			},
		]);
		const extracted = extractFactsFromParsed({
			taxYear: 2026,
			documentId: "doc-1040",
			filename: "2025-1040.pdf",
			parsed,
		});
		assert.equal(extracted.formType, "1040");
		assert.ok(
			extracted.facts.every((item) => item.sourceType === "prior_year"),
		);
		assert.equal(
			extracted.facts.some((item) => item.type === "w2.wages"),
			false,
		);
	});
});

describe("generateFinancialCandidates", () => {
	it("turns HSA-labeled spending into a candidate that can conflict with 5498-SA", () => {
		const candidates = generateFinancialCandidates({
			taxYear: 2026,
			sources: {
				...emptySources,
				categoryTotals: [
					{
						category: "HSA Contributions",
						total: 8000,
						transactionCount: 6,
						transactionIds: ["tx-hsa"],
					},
				],
			},
		});
		const hsa = candidates.find((item) => item.type === "candidate.hsa");
		assert.equal(hsa?.status, "candidate");
		assert.equal(hsa?.key, "hsa.contributions");
		assert.equal(hsa?.value, 8000);
	});

	it("turns donation transactions into candidates, not confirmed deductions", () => {
		const candidates = generateFinancialCandidates({
			taxYear: 2026,
			sources: {
				...emptySources,
				categoryTotals: [
					{
						category: "Gifts & Donations",
						total: 7230,
						transactionCount: 34,
						transactionIds: ["tx-1"],
					},
				],
			},
		});
		assert.equal(candidates[0]?.status, "candidate");
		assert.equal(candidates[0]?.sourceType, "financial_data");
		assert.equal(candidates[0]?.userConfirmed, false);
		assert.equal(candidates[0]?.value, 7230);
	});
});

describe("reconcileTaxFacts", () => {
	it("keeps HSA mismatches open instead of overwriting", () => {
		const result = reconcileTaxFacts([
			fact({
				id: "txn",
				category: "healthcare",
				type: "candidate.hsa",
				key: "hsa.contributions",
				value: 8000,
				sourceType: "financial_data",
				status: "candidate",
			}),
			fact({
				id: "form",
				category: "healthcare",
				type: "5498sa.hsa_contributions",
				key: "5498sa.hsa:trustee:fidelity",
				value: 8300,
				sourceForm: "5498-SA",
			}),
		]);
		assert.equal(result.conflicts.length, 1);
		assert.equal(result.conflicts[0]?.resolutionState, "open");
		assert.ok(
			result.facts.every(
				(item) =>
					item.status === "conflicting" ||
					item.status === "candidate" ||
					item.status === "extracted",
			),
		);
	});
});

describe("computeTaxReadiness", () => {
	it("expects W-2, 1099, and 1098 for salary plus brokerage plus a home", () => {
		const readiness = computeTaxReadiness({
			taxYear: 2026,
			facts: [],
			documents: [],
			sources: {
				...emptySources,
				accounts: [
					{ id: "a0", name: "Payroll", type: "depository", subtype: "payroll" },
					{
						id: "a1",
						name: "Robinhood",
						type: "investment",
						subtype: "brokerage",
					},
				],
				properties: [
					{
						id: "p1",
						name: "Home",
						usageType: "PRIMARY_RESIDENCE",
						address: null,
					},
				],
			},
		});
		const missing = readiness.missingItems.map((item) => item.id);
		assert.ok(missing.includes("missing-w2"));
		assert.ok(missing.includes("missing-brokerage-1099"));
		assert.ok(missing.includes("missing-1098"));
		assert.equal(expectedEvidenceDocumentCount(readiness.categories), 3);
		assert.ok(readiness.formula.includes("Equal weight"));
	});

	it("does not treat an HSA-only account as a missing brokerage 1099", () => {
		const readiness = computeTaxReadiness({
			taxYear: 2026,
			facts: [],
			documents: [],
			sources: {
				...emptySources,
				accounts: [
					{ id: "hsa-1", name: "HSA", type: "depository", subtype: "hsa" },
				],
			},
		});
		assert.equal(
			readiness.missingItems.some(
				(item) => item.id === "missing-brokerage-1099",
			),
			false,
		);
		assert.equal(
			readiness.missingItems.some((item) => item.id === "missing-5498-sa"),
			true,
		);
	});

	it("does not treat employment as relevant without wage or payroll context", () => {
		const readiness = computeTaxReadiness({
			taxYear: 2026,
			facts: [],
			documents: [],
			sources: emptySources,
		});
		const employment = readiness.categories.find(
			(category) => category.id === "employment",
		);
		assert.equal(employment?.relevant, false);
		assert.equal(
			readiness.missingItems.some((item) => item.id === "missing-w2"),
			false,
		);
	});
});

describe("mergeFinancialCandidates", () => {
	it("keeps generated candidates in memory without requiring a write", () => {
		const facts = mergeFinancialCandidates({
			userId: "user-1",
			taxYear: 2026,
			facts: [],
			sources: {
				...emptySources,
				categoryTotals: [
					{
						category: "Gifts & Donations",
						total: 1200,
						transactionCount: 4,
						transactionIds: ["tx-1"],
					},
				],
			},
		});
		assert.equal(facts.length, 1);
		assert.equal(facts[0]?.status, "candidate");
		assert.equal(
			facts[0]?.id,
			financialCandidateId(2026, "candidate.charitable:2026"),
		);
	});
});

describe("decodeStoredParsedText", () => {
	it("unwraps JSON { text } storage", () => {
		const bytes = new TextEncoder().encode(
			JSON.stringify({ text: "Box 1: 10" }),
		);
		assert.equal(decodeStoredParsedText(bytes), "Box 1: 10");
	});
});

describe("resolveTaxUploadMimeType", () => {
	it("infers HEIC from the filename when the browser omits file.type", () => {
		assert.equal(resolveTaxUploadMimeType("scan.heic", ""), "image/heic");
		assert.equal(
			resolveTaxUploadMimeType("w2.pdf", "application/pdf"),
			"application/pdf",
		);
	});
});

describe("estimateTaxResult", () => {
	it("hides the estimate when confirmed wages and withholding are missing", () => {
		const estimate = estimateTaxResult([]);
		assert.equal(estimate.direction, "insufficient");
		assert.equal(estimate.amount, null);
	});

	it("does not estimate from unconfirmed financial-data candidates", () => {
		const estimate = estimateTaxResult([
			fact({
				type: "w2.wages",
				key: "candidate.wages",
				value: 180000,
				status: "candidate",
				sourceType: "financial_data",
			}),
			fact({
				type: "w2.federal_withholding",
				key: "candidate.withholding",
				value: 50000,
				category: "withholding",
				status: "candidate",
				sourceType: "financial_data",
			}),
		]);
		assert.equal(estimate.direction, "insufficient");
	});

	it("uses extracted official form amounts as enough information to estimate", () => {
		const estimate = estimateTaxResult([
			fact({
				type: "w2.wages",
				key: "w2.wages:employer:schoolai",
				value: 180000,
				status: "extracted",
			}),
			fact({
				type: "w2.federal_withholding",
				key: "w2.federal_withholding:employer:schoolai",
				value: 50000,
				category: "withholding",
				status: "extracted",
			}),
		]);
		assert.equal(estimate.direction, "refund");
	});

	it("labels a coarse refund when confirmed W-2 facts exist", () => {
		const estimate = estimateTaxResult([
			fact({
				type: "w2.wages",
				key: "w2.wages:employer:schoolai",
				value: 180000,
				status: "confirmed",
			}),
			fact({
				type: "w2.federal_withholding",
				key: "w2.federal_withholding:employer:schoolai",
				value: 50000,
				category: "withholding",
				status: "confirmed",
			}),
		]);
		assert.equal(estimate.direction, "refund");
		assert.ok((estimate.amount ?? 0) > 0);
	});
});

describe("summarizeMoneyFacts", () => {
	it("does not collapse confirmed and potential charitable amounts", () => {
		const summary = summarizeMoneyFacts(
			[
				fact({
					id: "c1",
					category: "deduction",
					type: "manual.charitable",
					key: "manual.charitable",
					value: 4200,
					status: "confirmed",
					sourceType: "manual",
				}),
				fact({
					id: "c2",
					category: "deduction",
					type: "candidate.charitable",
					key: "candidate.charitable:2026",
					value: 2742,
					status: "candidate",
					sourceType: "financial_data",
					metadata: { transactionCount: 12 },
				}),
			],
			(item) => item.category === "deduction",
		);
		assert.equal(summary.confirmed, 4200);
		assert.equal(summary.potential, 2742);
		assert.equal(summary.potentialTransactionCount, 12);
	});
});

describe("buildOverviewMetricBreakdowns", () => {
	it("lists the facts that make up each overview total", () => {
		const breakdowns = buildOverviewMetricBreakdowns(
			[
				fact({
					id: "wages",
					type: "w2.wages",
					key: "w2.wages",
					value: 180420,
					status: "extracted",
					sourceDocumentId: "doc-w2",
					sourceForm: "W-2",
				}),
				fact({
					id: "withheld",
					category: "withholding",
					type: "w2.federal_withholding",
					key: "w2.federal_withholding",
					value: 31224,
					status: "extracted",
					sourceDocumentId: "doc-w2",
					sourceForm: "W-2",
					sourceBox: "2",
				}),
				fact({
					id: "confirmed-gift",
					category: "deduction",
					type: "manual.charitable",
					key: "manual.charitable",
					value: 4200,
					status: "confirmed",
					sourceType: "manual",
				}),
				fact({
					id: "potential-gift",
					category: "deduction",
					type: "candidate.charitable",
					key: "candidate.charitable:2026",
					value: 18517,
					status: "candidate",
					sourceType: "financial_data",
					sourceTransactionId: "txn-1",
					metadata: { transactionCount: 14 },
				}),
				fact({
					id: "gain",
					category: "investment",
					type: "1099b.lot.proceeds",
					key: "1099b.lot.proceeds",
					value: 1200,
					status: "extracted",
					metadata: { description: "AAPL" },
				}),
			],
			[
				{
					id: "doc-w2",
					userId: "user-1",
					taxYear: 2026,
					documentCategory: "wage",
					formType: "W-2",
					issuer: "SchoolAI",
					recipient: null,
					source: "upload",
					originalFilename: "w2.pdf",
					mimeType: "application/pdf",
					uploadedAt: "2026-02-03T00:00:00.000Z",
					processingState: "complete",
					parserProvider: "heuristic",
					parserVersion: null,
					extractionConfidence: 0.8,
					reviewStatus: "reviewed",
					userConfirmed: false,
					factCount: 2,
					byteSize: 0,
					createdAt: "2026-02-03T00:00:00.000Z",
					updatedAt: "2026-02-03T00:00:00.000Z",
				},
			],
		);

		assert.equal(breakdowns.incomeIdentified[0]?.label, "Employment income");
		assert.equal(breakdowns.incomeIdentified[0]?.amount, 180420);
		assert.equal(breakdowns.taxesWithheld[0]?.source.includes("Box 2"), true);
		assert.equal(breakdowns.confirmedDeductions[0]?.amount, 4200);
		assert.equal(
			breakdowns.potentialDeductions[0]?.label,
			"Potential charitable donations",
		);
		assert.equal(breakdowns.potentialDeductions[0]?.amount, 18517);
		assert.equal(breakdowns.potentialDeductions[0]?.transactionId, "txn-1");
		assert.equal(
			breakdowns.capitalGains[0]?.label,
			"AAPL · Brokerage proceeds",
		);
	});
});

describe("buildTaxAgentContext", () => {
	it("groups employment by document issuer and does not invent a taxpayer name", () => {
		const context = buildTaxAgentContext({
			taxYear: 2026,
			facts: [
				fact({
					type: "w2.wages",
					key: "w2.wages:employer:schoolai",
					value: 180420,
					sourceDocumentId: "doc-w2",
					sourceForm: "W-2",
					status: "extracted",
				}),
			],
			documents: [
				{
					id: "doc-w2",
					userId: "user-1",
					taxYear: 2026,
					documentCategory: "wage",
					formType: "W-2",
					issuer: "SchoolAI",
					recipient: null,
					source: "upload",
					originalFilename: "w2.pdf",
					mimeType: "application/pdf",
					uploadedAt: "2026-02-03T00:00:00.000Z",
					processingState: "complete",
					parserProvider: "heuristic",
					parserVersion: null,
					extractionConfidence: 0.8,
					reviewStatus: "reviewed",
					userConfirmed: false,
					factCount: 1,
					byteSize: 0,
					createdAt: "2026-02-03T00:00:00.000Z",
					updatedAt: "2026-02-03T00:00:00.000Z",
				},
			],
			readiness: computeTaxReadiness({
				taxYear: 2026,
				facts: [],
				documents: [],
				sources: emptySources,
			}),
			filingStatus: "Single",
			dependentsCount: 0,
		});
		assert.equal(context.household.taxpayer, null);
		assert.equal(context.employment[0]?.issuer, "W-2 — SchoolAI");
		assert.equal(context.employment[0]?.wages, 180420);
	});
});

describe("classifyTaxForm", () => {
	it("classifies from filename when text is sparse", () => {
		const result = classifyTaxForm({
			filename: "SchoolAI-W2-2026.pdf",
			parsed: {
				text: "",
				pages: [],
				tables: [],
				keyValues: [],
				formClassification: null,
				extractedFields: {},
				confidence: 0,
				sourceLocations: [],
			},
		});
		assert.equal(result.formType, "W-2");
		assert.equal(result.category, "wage");
	});
});

describe("planning tax profile sync", () => {
	it("maps extracted filing status onto the shared TaxProfile seed", () => {
		assert.equal(
			parsePlanningFilingStatus("Married Filing Jointly"),
			"Married filing jointly",
		);
		assert.deepEqual(
			planningPatchFromFact({
				type: "prior.filing_status",
				category: "prior_year",
				value: "Head of household",
			}),
			{ filingStatus: "Head of household" },
		);
		assert.deepEqual(
			planningPatchFromFact({
				type: "1099nec.compensation",
				category: "business",
				value: 12000,
			}),
			{ selfEmployedIncome: true },
		);
	});

	it("writes only the planning fields that actually changed", () => {
		const data = {
			taxProfile: {
				filingStatus: "Single",
				taxYear: 2026,
				estimatedFederalTaxBracket: "22%",
				estimatedStateTaxRate: "5",
				totalAnnualIncome: 0,
				taxableIncomeEstimate: 0,
				deductionStrategy: "Standard",
				selfEmployedIncome: false,
				rentalIncome: false,
				lastUpdated: "2026-01-01",
			} satisfies TaxProfile,
		} as FinancialProfileData;
		const next = applyPlanningSeedToProfile(data, {
			filingStatus: "Married filing jointly",
			selfEmployedIncome: true,
		});
		assert.equal(next?.taxProfile.filingStatus, "Married filing jointly");
		assert.equal(next?.taxProfile.selfEmployedIncome, true);
		assert.equal(
			applyPlanningSeedToProfile(data, { filingStatus: "Single" }),
			null,
		);
	});
});

describe("buildTaxYearProfile", () => {
	it("seeds household rows from the financial-profile TaxProfile", () => {
		const profile = buildTaxYearProfile({
			taxYear: 2026,
			facts: [],
			documents: [],
			missingInformation: [],
			planning: {
				filingStatus: "Single",
				selfEmployedIncome: true,
				rentalIncome: false,
			},
		});
		const household = profile.sections.find(
			(section) => section.id === "household",
		);
		assert.equal(household?.rows[0]?.id, "planning:filing_status");
		assert.equal(household?.rows[0]?.source, "Financial Profile");
		assert.equal(household?.rows[1]?.id, "planning:self_employed");
	});
});

describe("tax document storage quota", () => {
	it("sums stored original file sizes and ignores invalid metadata", () => {
		assert.equal(
			sumTaxDocumentStorageBytes([
				{ metadata: { byteSize: 100 } },
				{ metadata: { byteSize: 50.9 } },
				{ metadata: { byteSize: -1 } },
				{ metadata: { byteSize: "12" } },
				{ metadata: null },
			]),
			150,
		);
	});

	it("rejects combined cloud uploads over the limit and skips storage", async () => {
		assert.throws(
			() =>
				assertTaxDocumentStorageLimit({
					usedBytes: 80,
					incomingBytes: 30,
					limitBytes: 100,
				}),
			(error: unknown) =>
				error instanceof TaxDocumentStorageLimitError &&
				error.usedBytes === 80 &&
				error.incomingBytes === 30,
		);

		const puts: string[] = [];
		const storage = new MemoryFileStorage();
		const runtime = {
			storage: {
				put: async (input: Parameters<MemoryFileStorage["put"]>[0]) => {
					puts.push(input.key);
					return storage.put(input);
				},
				get: (key: string) => storage.get(key),
				delete: (key: string) => storage.delete(key),
			},
			parser: new HeuristicTaxDocumentParser(),
			documentStorageLimitBytes: 100,
		};
		const ctx = {
			userId: "user-1",
			repositories: {
				taxes: {
					listDocuments: async () => [
						{
							id: "existing",
							userId: "user-1",
							taxYear: 2026,
							documentCategory: "other",
							formType: null,
							issuer: null,
							recipient: null,
							source: "upload",
							originalFilename: "old.pdf",
							mimeType: "application/pdf",
							uploadedAt: new Date("2026-02-03T00:00:00.000Z"),
							processingState: "complete",
							parserProvider: null,
							parserVersion: null,
							extractionConfidence: null,
							originalStorageKey: "taxes/user-1/2026/existing/original",
							parsedStorageKey: null,
							reviewStatus: "reviewed",
							userConfirmed: false,
							metadata: { byteSize: 80 },
							createdAt: new Date("2026-02-03T00:00:00.000Z"),
							updatedAt: new Date("2026-02-03T00:00:00.000Z"),
						},
					],
				},
			},
		};

		await assert.rejects(
			() =>
				uploadTaxDocument(ctx as never, runtime, {
					taxYear: 2026,
					filename: "w2.pdf",
					mimeType: "application/pdf",
					data: Buffer.alloc(30, 1).toString("base64"),
				}),
			TaxDocumentStorageLimitError,
		);
		assert.equal(puts.length, 0);
	});

	it("allows uploads that fit and skips the check on desktop", () => {
		assert.doesNotThrow(() =>
			assertTaxDocumentStorageLimit({
				usedBytes: 70,
				incomingBytes: 30,
				limitBytes: 100,
			}),
		);
		assert.doesNotThrow(() =>
			assertTaxDocumentStorageLimit({
				usedBytes: 80,
				incomingBytes: 30,
				limitBytes: undefined,
			}),
		);
	});

	it("rejects a single file over the per-file limit", () => {
		assert.throws(
			() =>
				assertTaxDocumentFileSizeLimit({
					byteSize: 26 * 1024 * 1024,
					limitBytes: 25 * 1024 * 1024,
				}),
			TaxDocumentFileTooLargeError,
		);
	});
});

describe("tax document rename and delete", () => {
	it("uses a custom display name when present", () => {
		assert.equal(
			taxDocumentTitle({
				displayName: "My W-2",
				formType: "W-2",
				issuer: "Acme",
				originalFilename: "w2.pdf",
			}),
			"My W-2",
		);
		assert.equal(
			taxDocumentTitle({
				formType: "W-2",
				issuer: "Acme",
				originalFilename: "w2.pdf",
			}),
			"W-2 — Acme",
		);
		assert.equal(isManageableTaxDocument("complete"), true);
		assert.equal(isManageableTaxDocument("failed"), true);
		assert.equal(isManageableTaxDocument("processing"), false);
		assert.equal(isTaxDocumentProcessing("processing"), true);
		assert.equal(isTaxDocumentProcessing("uploaded"), true);
		assert.equal(isTaxDocumentProcessing("complete"), false);
		assert.equal(isTaxDocumentProcessing("failed"), false);
	});

	it("renames a finished document and refuses one still processing", async () => {
		const now = new Date("2026-02-03T00:00:00.000Z");
		const documents = new Map([
			[
				"doc-1",
				{
					id: "doc-1",
					userId: "user-1",
					taxYear: 2026,
					documentCategory: "wage" as const,
					formType: "W-2" as const,
					issuer: "Acme",
					recipient: null,
					source: "upload" as const,
					originalFilename: "w2.pdf",
					mimeType: "application/pdf",
					uploadedAt: now,
					processingState: "complete" as TaxDocumentProcessingState,
					parserProvider: null,
					parserVersion: null,
					extractionConfidence: null,
					originalStorageKey: "original",
					parsedStorageKey: null,
					reviewStatus: "reviewed" as const,
					userConfirmed: false,
					metadata: { byteSize: 12 },
					createdAt: now,
					updatedAt: now,
				},
			],
		]);
		const ctx = {
			userId: "user-1",
			repositories: {
				taxes: {
					findDocument: async ({ id }: { id: string }) =>
						documents.get(id) ?? null,
					updateDocument: async ({
						id,
						data,
					}: {
						id: string;
						data: Record<string, unknown>;
					}) => {
						const current = documents.get(id);
						if (!current) throw new Error("Tax document not found");
						const next = { ...current, ...data, updatedAt: now };
						documents.set(id, next);
						return next;
					},
					listFacts: async () => [],
				},
			},
		};

		const renamed = await renameTaxDocument(ctx as never, {
			id: "doc-1",
			displayName: "Payroll W-2",
		});
		assert.equal(renamed.displayName, "Payroll W-2");

		const current = documents.get("doc-1");
		if (!current) throw new Error("missing document");
		current.processingState = "processing";
		await assert.rejects(
			() =>
				renameTaxDocument(ctx as never, {
					id: "doc-1",
					displayName: "Nope",
				}),
			/finishes processing/,
		);
	});

	it("deletes a finished document and its stored files", async () => {
		const now = new Date("2026-02-03T00:00:00.000Z");
		const storage = new MemoryFileStorage();
		await storage.put({
			key: "original",
			bytes: new Uint8Array([1, 2, 3]),
			mimeType: "application/pdf",
			visibility: "private",
		});
		await storage.put({
			key: "parsed",
			bytes: new Uint8Array([4]),
			mimeType: "application/json",
			visibility: "private",
		});
		const documents = new Map([
			[
				"doc-1",
				{
					id: "doc-1",
					userId: "user-1",
					taxYear: 2026,
					documentCategory: "other" as const,
					formType: null,
					issuer: null,
					recipient: null,
					source: "upload" as const,
					originalFilename: "scan.pdf",
					mimeType: "application/pdf",
					uploadedAt: now,
					processingState: "failed" as const,
					parserProvider: null,
					parserVersion: null,
					extractionConfidence: null,
					originalStorageKey: "original",
					parsedStorageKey: "parsed",
					reviewStatus: "pending" as const,
					userConfirmed: false,
					metadata: { byteSize: 3 },
					createdAt: now,
					updatedAt: now,
				},
			],
		]);
		const ctx = {
			userId: "user-1",
			repositories: {
				taxes: {
					findDocument: async ({ id }: { id: string }) =>
						documents.get(id) ?? null,
					deleteDocument: async ({ id }: { id: string }) => {
						documents.delete(id);
					},
					listFacts: async () => [],
					listConflicts: async () => [],
				},
			},
		};

		await deleteTaxDocument(
			ctx as never,
			{ storage, parser: new HeuristicTaxDocumentParser() },
			{ id: "doc-1" },
		);
		assert.equal(documents.size, 0);
		await assert.rejects(() => storage.get("original"));
		await assert.rejects(() => storage.get("parsed"));
	});
});
