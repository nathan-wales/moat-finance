import type { TaxFact } from "@moat/contracts";
import {
	getTaxAgentContext,
	getTaxBusinessSummary,
	getTaxDeductionSummary,
	getTaxDocument,
	getTaxEstimatedPayments,
	getTaxFact,
	getTaxFactDocumentLabel,
	getTaxIncomeSummary,
	getTaxInvestmentSummary,
	getTaxItemsNeedingReview,
	getTaxMissingInformation,
	getTaxOverview,
	getTaxPriorYearCarryforwards,
	getTaxReadiness,
	getTaxRealEstateSummary,
	getTaxRetirementSummary,
	getTaxWithholdingSummary,
	listTaxDocuments,
	listTaxFacts,
	searchTaxData,
} from "@moat/domain";
import { mcpToolContracts } from "@moat/mcp-contracts";
import type { LocalToolContext, LocalToolImplementation } from "./types";
import { localSchemaEnvelope } from "./types";

function taxesUrl(taxYear: number): string {
	return `/taxes?year=${taxYear}`;
}

function confidenceLabel(
	fact: TaxFact,
): "low" | "medium" | "high" | "verified" {
	if (fact.userConfirmed || fact.status === "confirmed") return "verified";
	if (fact.confidence >= 0.8) return "high";
	if (fact.confidence >= 0.5) return "medium";
	return "low";
}

function factView(fact: TaxFact) {
	return {
		id: fact.id,
		taxYear: fact.taxYear,
		category: fact.category,
		type: fact.type,
		key: fact.key,
		value: fact.value,
		status: fact.status,
		userConfirmed: fact.userConfirmed,
		source: {
			sourceType: fact.sourceType,
			documentId: fact.sourceDocumentId,
			form: fact.sourceForm,
			box: fact.sourceBox,
			transactionId: fact.sourceTransactionId,
			accountId: fact.sourceAccountId,
			realEstateId: fact.sourceRealEstateId,
		},
		confidence: confidenceLabel(fact),
	};
}

export const getTaxYearSummaryTool: LocalToolImplementation = {
	contract: mcpToolContracts["moat.getTaxYearSummary"],
	async execute(input, ctx: LocalToolContext) {
		const year = input as { taxYear: number };
		const [overview, agent, income, withholding, deductions] =
			await Promise.all([
				getTaxOverview(ctx.appRuntime, year),
				getTaxAgentContext(ctx.appRuntime, year),
				getTaxIncomeSummary(ctx.appRuntime, year),
				getTaxWithholdingSummary(ctx.appRuntime, year),
				getTaxDeductionSummary(ctx.appRuntime, year),
			]);
		return localSchemaEnvelope("taxes.yearSummary", {
			taxYear: year.taxYear,
			url: taxesUrl(year.taxYear),
			readinessScore: overview.readiness.score,
			documentsPresent: overview.documentsPresent,
			documentsExpected: overview.documentsExpected,
			income: {
				confirmed: income.confirmed,
				potential: income.potential,
				potentialTransactionCount: income.potentialTransactionCount,
			},
			withholding: {
				confirmed: withholding.confirmed,
				potential: withholding.potential,
			},
			deductions: {
				confirmed: deductions.confirmed,
				potential: deductions.potential,
				potentialTransactionCount: deductions.potentialTransactionCount,
			},
			estimate: overview.estimate,
			attentionCount: overview.attention.length,
			missingCount: overview.readiness.missingItems.length,
			reviewCount: overview.readiness.reviewItems.length,
			filingStatus: agent.filingStatus,
		});
	},
};

export const getTaxReadinessTool: LocalToolImplementation = {
	contract: mcpToolContracts["moat.getTaxReadiness"],
	async execute(input, ctx: LocalToolContext) {
		const year = input as { taxYear: number };
		return localSchemaEnvelope(
			"taxes.readiness",
			await getTaxReadiness(ctx.appRuntime, year),
		);
	},
};

export const listTaxDocumentsTool: LocalToolImplementation = {
	contract: mcpToolContracts["moat.listTaxDocuments"],
	async execute(input, ctx: LocalToolContext) {
		const year = input as { taxYear: number };
		const documents = await listTaxDocuments(ctx.appRuntime, year);
		return localSchemaEnvelope("taxes.documents", {
			taxYear: year.taxYear,
			documents: documents.map((document) => ({
				id: document.id,
				formType: document.formType,
				issuer: document.issuer,
				documentCategory: document.documentCategory,
				processingState: document.processingState,
				reviewStatus: document.reviewStatus,
				factCount: document.factCount,
				uploadedAt: document.uploadedAt,
			})),
		});
	},
};

export const getTaxDocumentTool: LocalToolImplementation = {
	contract: mcpToolContracts["moat.getTaxDocument"],
	async execute(input, ctx: LocalToolContext) {
		const parsed = input as {
			id: string;
			includeParsedText?: boolean;
			includeOriginal?: boolean;
		};
		const taxRuntime = parsed.includeParsedText
			? (await import("../../ipc/taxes")).getDesktopTaxRuntime()
			: undefined;
		const document = await getTaxDocument(ctx.appRuntime, parsed, taxRuntime);
		return localSchemaEnvelope("taxes.document", {
			id: document.id,
			taxYear: document.taxYear,
			formType: document.formType,
			issuer: document.issuer,
			documentCategory: document.documentCategory,
			processingState: document.processingState,
			reviewStatus: document.reviewStatus,
			factCount: document.factCount,
			facts: document.facts.map(factView),
			hasOriginalFile: document.hasOriginalFile,
			hasParsedText: document.hasParsedText,
			originalAvailable: Boolean(
				parsed.includeOriginal && document.hasOriginalFile,
			),
			parsedText: parsed.includeParsedText ? document.parsedText : undefined,
		});
	},
};

export const listTaxFactsTool: LocalToolImplementation = {
	contract: mcpToolContracts["moat.listTaxFacts"],
	async execute(input, ctx: LocalToolContext) {
		const parsed = input as { taxYear: number };
		const facts = await listTaxFacts(ctx.appRuntime, parsed);
		return localSchemaEnvelope("taxes.facts", {
			taxYear: parsed.taxYear,
			facts: facts.map(factView),
		});
	},
};

export const getTaxFactTool: LocalToolImplementation = {
	contract: mcpToolContracts["moat.getTaxFact"],
	async execute(input, ctx: LocalToolContext) {
		const parsed = input as { id: string };
		const fact = await getTaxFact(ctx.appRuntime, parsed);
		const documentLabel = await getTaxFactDocumentLabel(ctx.appRuntime, fact);
		return localSchemaEnvelope("taxes.fact", {
			id: fact.id,
			taxYear: fact.taxYear,
			value: fact.value,
			status: fact.status,
			type: fact.type,
			key: fact.key,
			category: fact.category,
			source: {
				sourceType: fact.sourceType,
				document: documentLabel ?? fact.sourceForm,
				form: fact.sourceForm,
				box: fact.sourceBox,
				documentId: fact.sourceDocumentId,
				transactionId: fact.sourceTransactionId,
				accountId: fact.sourceAccountId,
				realEstateId: fact.sourceRealEstateId,
			},
			confidence: confidenceLabel(fact),
		});
	},
};

function moneyTool(
	name:
		| "moat.getTaxIncomeSummary"
		| "moat.getTaxWithholdingSummary"
		| "moat.getTaxInvestmentSummary"
		| "moat.getTaxRealEstateSummary"
		| "moat.getTaxDeductionSummary"
		| "moat.getTaxRetirementSummary"
		| "moat.getTaxBusinessSummary"
		| "moat.getTaxEstimatedPayments",
	kind: string,
	loader: typeof getTaxIncomeSummary,
): LocalToolImplementation {
	return {
		contract: mcpToolContracts[name],
		async execute(input, ctx: LocalToolContext) {
			const year = input as { taxYear: number };
			const group = await loader(ctx.appRuntime, year);
			return localSchemaEnvelope(kind, {
				taxYear: year.taxYear,
				confirmed: group.confirmed,
				potential: group.potential,
				potentialTransactionCount: group.potentialTransactionCount,
				items: group.items,
			});
		},
	};
}

export const getTaxIncomeSummaryTool = moneyTool(
	"moat.getTaxIncomeSummary",
	"taxes.income",
	getTaxIncomeSummary,
);
export const getTaxWithholdingSummaryTool = moneyTool(
	"moat.getTaxWithholdingSummary",
	"taxes.withholding",
	getTaxWithholdingSummary,
);
export const getTaxInvestmentSummaryTool = moneyTool(
	"moat.getTaxInvestmentSummary",
	"taxes.investment",
	getTaxInvestmentSummary,
);
export const getTaxRealEstateSummaryTool = moneyTool(
	"moat.getTaxRealEstateSummary",
	"taxes.realEstate",
	getTaxRealEstateSummary,
);
export const getTaxDeductionSummaryTool = moneyTool(
	"moat.getTaxDeductionSummary",
	"taxes.deduction",
	getTaxDeductionSummary,
);
export const getTaxRetirementSummaryTool = moneyTool(
	"moat.getTaxRetirementSummary",
	"taxes.retirement",
	getTaxRetirementSummary,
);
export const getTaxBusinessSummaryTool = moneyTool(
	"moat.getTaxBusinessSummary",
	"taxes.business",
	getTaxBusinessSummary,
);
export const getTaxEstimatedPaymentsTool = moneyTool(
	"moat.getTaxEstimatedPayments",
	"taxes.estimatedPayments",
	getTaxEstimatedPayments,
);

export const getTaxPriorYearCarryforwardsTool: LocalToolImplementation = {
	contract: mcpToolContracts["moat.getTaxPriorYearCarryforwards"],
	async execute(input, ctx: LocalToolContext) {
		const year = input as { taxYear: number };
		const facts = await getTaxPriorYearCarryforwards(ctx.appRuntime, year);
		return localSchemaEnvelope("taxes.priorYear", {
			taxYear: year.taxYear,
			facts: facts.map(factView),
		});
	},
};

export const getTaxMissingInformationTool: LocalToolImplementation = {
	contract: mcpToolContracts["moat.getTaxMissingInformation"],
	async execute(input, ctx: LocalToolContext) {
		const year = input as { taxYear: number };
		return localSchemaEnvelope("taxes.missing", {
			taxYear: year.taxYear,
			items: await getTaxMissingInformation(ctx.appRuntime, year),
		});
	},
};

export const getTaxItemsNeedingReviewTool: LocalToolImplementation = {
	contract: mcpToolContracts["moat.getTaxItemsNeedingReview"],
	async execute(input, ctx: LocalToolContext) {
		const year = input as { taxYear: number };
		return localSchemaEnvelope("taxes.review", {
			taxYear: year.taxYear,
			items: await getTaxItemsNeedingReview(ctx.appRuntime, year),
		});
	},
};

export const searchTaxDataTool: LocalToolImplementation = {
	contract: mcpToolContracts["moat.searchTaxData"],
	async execute(input, ctx: LocalToolContext) {
		const parsed = input as { taxYear: number; query: string };
		const facts = await searchTaxData(ctx.appRuntime, parsed);
		return localSchemaEnvelope("taxes.search", {
			taxYear: parsed.taxYear,
			query: parsed.query,
			facts: facts.map(factView),
		});
	},
};
