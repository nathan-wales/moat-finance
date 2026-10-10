import type { TaxFact } from "@moat/contracts";
import type { DbClient } from "@moat/db-postgres";
import { createPostgresAppContext } from "@moat/db-postgres";
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
	TAX_CLOUD_DOCUMENT_STORAGE_LIMIT_BYTES,
} from "@moat/domain";
import type {
	TaxGetDocumentInput,
	TaxIdInput,
	TaxListFactsInput,
	TaxSearchInput,
	TaxYearInput,
} from "@moat/mcp-contracts";
import { mcpToolContracts } from "@moat/mcp-contracts";
import type { McpAuthContext } from "~/auth/types";
import { createTaxFileStorage } from "../../../api/src/server/services/taxes-file-storage";
import { createTaxDocumentParser } from "../../../api/src/server/services/taxes-parser";
import { schemaEnvelope } from "./format";
import type { McpToolImplementation } from "./types";

function appContext(context: McpAuthContext) {
	return createPostgresAppContext(
		context.userId,
		context.db as unknown as DbClient,
	);
}

function appBaseUrl(): string {
	return (process.env.MOAT_APP_URL ?? "https://app.moatfinance.com").replace(
		/\/$/,
		"",
	);
}

function taxesUrl(taxYear: number): string {
	return `${appBaseUrl()}/taxes?year=${taxYear}`;
}

function taxRuntime() {
	return {
		storage: createTaxFileStorage(),
		parser: createTaxDocumentParser(),
		documentStorageLimitBytes: TAX_CLOUD_DOCUMENT_STORAGE_LIMIT_BYTES,
	};
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

function moneyGroupView(
	taxYear: number,
	group: {
		confirmed: number;
		potential: number;
		potentialTransactionCount: number;
		items: Array<Record<string, unknown> | object>;
	},
) {
	return {
		taxYear,
		confirmed: group.confirmed,
		potential: group.potential,
		potentialTransactionCount: group.potentialTransactionCount,
		items: group.items,
	};
}

export const getTaxYearSummaryTool: McpToolImplementation<TaxYearInput> = {
	contract: mcpToolContracts["moat.getTaxYearSummary"],
	async execute(input, context: McpAuthContext) {
		const ctx = appContext(context);
		const [overview, agent, income, withholding, deductions] =
			await Promise.all([
				getTaxOverview(ctx, input, taxRuntime()),
				getTaxAgentContext(ctx, input),
				getTaxIncomeSummary(ctx, input),
				getTaxWithholdingSummary(ctx, input),
				getTaxDeductionSummary(ctx, input),
			]);
		return schemaEnvelope("taxes.yearSummary", {
			taxYear: input.taxYear,
			url: taxesUrl(input.taxYear),
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

export const getTaxReadinessTool: McpToolImplementation<TaxYearInput> = {
	contract: mcpToolContracts["moat.getTaxReadiness"],
	async execute(input, context: McpAuthContext) {
		const readiness = await getTaxReadiness(appContext(context), input);
		return schemaEnvelope("taxes.readiness", readiness);
	},
};

export const listTaxDocumentsTool: McpToolImplementation<TaxYearInput> = {
	contract: mcpToolContracts["moat.listTaxDocuments"],
	async execute(input, context: McpAuthContext) {
		const documents = await listTaxDocuments(appContext(context), input);
		return schemaEnvelope("taxes.documents", {
			taxYear: input.taxYear,
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

export const getTaxDocumentTool: McpToolImplementation<TaxGetDocumentInput> = {
	contract: mcpToolContracts["moat.getTaxDocument"],
	async execute(input, context: McpAuthContext) {
		const runtime = input.includeParsedText ? taxRuntime() : undefined;
		const document = await getTaxDocument(appContext(context), input, runtime);
		return schemaEnvelope("taxes.document", {
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
				input.includeOriginal && document.hasOriginalFile,
			),
			parsedText: input.includeParsedText ? document.parsedText : undefined,
		});
	},
};

export const listTaxFactsTool: McpToolImplementation<TaxListFactsInput> = {
	contract: mcpToolContracts["moat.listTaxFacts"],
	async execute(input, context: McpAuthContext) {
		const facts = await listTaxFacts(appContext(context), input);
		return schemaEnvelope("taxes.facts", {
			taxYear: input.taxYear,
			facts: facts.map(factView),
		});
	},
};

export const getTaxFactTool: McpToolImplementation<TaxIdInput> = {
	contract: mcpToolContracts["moat.getTaxFact"],
	async execute(input, context: McpAuthContext) {
		const ctx = appContext(context);
		const fact = await getTaxFact(ctx, input);
		const documentLabel = await getTaxFactDocumentLabel(ctx, fact);
		return schemaEnvelope("taxes.fact", {
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
	loader: (
		ctx: ReturnType<typeof appContext>,
		input: TaxYearInput,
	) => ReturnType<typeof getTaxIncomeSummary>,
): McpToolImplementation<TaxYearInput> {
	return {
		contract: mcpToolContracts[name],
		async execute(input, context: McpAuthContext) {
			const group = await loader(appContext(context), input);
			return schemaEnvelope(kind, moneyGroupView(input.taxYear, group));
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

export const getTaxPriorYearCarryforwardsTool: McpToolImplementation<TaxYearInput> =
	{
		contract: mcpToolContracts["moat.getTaxPriorYearCarryforwards"],
		async execute(input, context: McpAuthContext) {
			const facts = await getTaxPriorYearCarryforwards(
				appContext(context),
				input,
			);
			return schemaEnvelope("taxes.priorYear", {
				taxYear: input.taxYear,
				facts: facts.map(factView),
			});
		},
	};

export const getTaxMissingInformationTool: McpToolImplementation<TaxYearInput> =
	{
		contract: mcpToolContracts["moat.getTaxMissingInformation"],
		async execute(input, context: McpAuthContext) {
			const items = await getTaxMissingInformation(appContext(context), input);
			return schemaEnvelope("taxes.missing", {
				taxYear: input.taxYear,
				items,
			});
		},
	};

export const getTaxItemsNeedingReviewTool: McpToolImplementation<TaxYearInput> =
	{
		contract: mcpToolContracts["moat.getTaxItemsNeedingReview"],
		async execute(input, context: McpAuthContext) {
			const items = await getTaxItemsNeedingReview(appContext(context), input);
			return schemaEnvelope("taxes.review", {
				taxYear: input.taxYear,
				items,
			});
		},
	};

export const searchTaxDataTool: McpToolImplementation<TaxSearchInput> = {
	contract: mcpToolContracts["moat.searchTaxData"],
	async execute(input, context: McpAuthContext) {
		const facts = await searchTaxData(appContext(context), input);
		return schemaEnvelope("taxes.search", {
			taxYear: input.taxYear,
			query: input.query,
			facts: facts.map(factView),
		});
	},
};
