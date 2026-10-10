import type {
	TaxConfirmFactInput,
	TaxCreateManualFactInput,
	TaxGetDocumentInput,
	TaxListFactsInput,
	TaxParseDocumentInput,
	TaxRenameDocumentInput,
	TaxResolveConflictInput,
	TaxSearchInput,
	TaxUpdateFactInput,
	TaxUploadDocumentInput,
	TaxYearInput,
} from "@moat/contracts";
import type { AppContext, TaxRuntime } from "@moat/domain";
import {
	confirmTaxFact,
	createManualTaxFact,
	deleteTaxDocument,
	getTaxAgentContext,
	getTaxBusinessSummary,
	getTaxDeductionSummary,
	getTaxDocument,
	getTaxEstimatedPayments,
	getTaxFact,
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
	getTaxYearProfile,
	listTaxConflicts,
	listTaxDocuments,
	listTaxFacts,
	listTaxYears,
	renameTaxDocument,
	reprocessTaxDocument,
	resolveTaxConflict,
	searchTaxData,
	TAX_CLOUD_DOCUMENT_STORAGE_LIMIT_BYTES,
	TAX_CLOUD_MAX_DOCUMENT_BYTES,
	updateTaxFact,
	uploadTaxDocument,
} from "@moat/domain";
import { logger } from "~/lib/logger";
import {
	applyInlineTaxLlmExtraction,
	parseDocumentWithOptionalLlm,
} from "./tax-llm-jobs.service";
import { createTaxFileStorage } from "./taxes-file-storage";
import {
	createTaxDocumentParser,
	isAsyncTaxParseEnabled,
} from "./taxes-parser";

let runtime: TaxRuntime | null = null;

function taxRuntime(): TaxRuntime {
	if (!runtime) {
		runtime = {
			storage: createTaxFileStorage(),
			parser: createTaxDocumentParser(),
			documentStorageLimitBytes: TAX_CLOUD_DOCUMENT_STORAGE_LIMIT_BYTES,
			documentMaxBytes: TAX_CLOUD_MAX_DOCUMENT_BYTES,
			parseMode: isAsyncTaxParseEnabled() ? "async" : "inline",
			onParsedDocument: async ({ ctx, documentId, filename, parsed }) =>
				applyInlineTaxLlmExtraction({
					userId: ctx.userId,
					documentId,
					filename,
					parsed,
				}),
			logError: (message, context) => {
				logger.error(message, context);
			},
		};
	}
	return runtime;
}

export function getTaxRuntime(): TaxRuntime {
	return taxRuntime();
}

export const taxesService = {
	listYears: (ctx: AppContext) => listTaxYears(ctx),
	getOverview: (ctx: AppContext, input: TaxYearInput) =>
		getTaxOverview(ctx, input, taxRuntime()),
	getReadiness: (ctx: AppContext, input: TaxYearInput) =>
		getTaxReadiness(ctx, input),
	getYearProfile: (ctx: AppContext, input: TaxYearInput) =>
		getTaxYearProfile(ctx, input),
	getAgentContext: (ctx: AppContext, input: TaxYearInput) =>
		getTaxAgentContext(ctx, input),
	listDocuments: (ctx: AppContext, input: TaxYearInput) =>
		listTaxDocuments(ctx, input),
	getDocument: (ctx: AppContext, input: TaxGetDocumentInput) =>
		getTaxDocument(ctx, input, taxRuntime()),
	uploadDocument: async (ctx: AppContext, input: TaxUploadDocumentInput) => {
		const runtime = taxRuntime();
		const result = await uploadTaxDocument(ctx, runtime, input);
		logger.info("tax_document_uploaded", {
			feature: "tax-parse",
			operation: "uploadDocument",
			parserProvider: runtime.parser.provider,
			parseMode: runtime.parseMode ?? "inline",
			processingState: result.processingState,
			factCount: result.factCount,
		});
		return result;
	},
	parseDocument: (ctx: AppContext, input: TaxParseDocumentInput) =>
		parseDocumentWithOptionalLlm(ctx, input),
	reprocessDocument: (ctx: AppContext, input: { id: string }) =>
		reprocessTaxDocument(ctx, taxRuntime(), input),
	renameDocument: (ctx: AppContext, input: TaxRenameDocumentInput) =>
		renameTaxDocument(ctx, input),
	deleteDocument: (ctx: AppContext, input: { id: string }) =>
		deleteTaxDocument(ctx, taxRuntime(), input),
	listFacts: (ctx: AppContext, input: TaxListFactsInput) =>
		listTaxFacts(ctx, input),
	getFact: (ctx: AppContext, input: { id: string }) => getTaxFact(ctx, input),
	createManualFact: (ctx: AppContext, input: TaxCreateManualFactInput) =>
		createManualTaxFact(ctx, input),
	updateFact: (ctx: AppContext, input: TaxUpdateFactInput) =>
		updateTaxFact(ctx, input),
	confirmFact: (ctx: AppContext, input: TaxConfirmFactInput) =>
		confirmTaxFact(ctx, input),
	listConflicts: (ctx: AppContext, input: TaxYearInput) =>
		listTaxConflicts(ctx, input),
	resolveConflict: (ctx: AppContext, input: TaxResolveConflictInput) =>
		resolveTaxConflict(ctx, input),
	searchTaxData: (ctx: AppContext, input: TaxSearchInput) =>
		searchTaxData(ctx, input),
	getIncomeSummary: (ctx: AppContext, input: TaxYearInput) =>
		getTaxIncomeSummary(ctx, input),
	getWithholdingSummary: (ctx: AppContext, input: TaxYearInput) =>
		getTaxWithholdingSummary(ctx, input),
	getInvestmentSummary: (ctx: AppContext, input: TaxYearInput) =>
		getTaxInvestmentSummary(ctx, input),
	getRealEstateSummary: (ctx: AppContext, input: TaxYearInput) =>
		getTaxRealEstateSummary(ctx, input),
	getDeductionSummary: (ctx: AppContext, input: TaxYearInput) =>
		getTaxDeductionSummary(ctx, input),
	getRetirementSummary: (ctx: AppContext, input: TaxYearInput) =>
		getTaxRetirementSummary(ctx, input),
	getBusinessSummary: (ctx: AppContext, input: TaxYearInput) =>
		getTaxBusinessSummary(ctx, input),
	getEstimatedPayments: (ctx: AppContext, input: TaxYearInput) =>
		getTaxEstimatedPayments(ctx, input),
	getPriorYearCarryforwards: (ctx: AppContext, input: TaxYearInput) =>
		getTaxPriorYearCarryforwards(ctx, input),
	getMissingInformation: (ctx: AppContext, input: TaxYearInput) =>
		getTaxMissingInformation(ctx, input),
	getItemsNeedingReview: (ctx: AppContext, input: TaxYearInput) =>
		getTaxItemsNeedingReview(ctx, input),
};
