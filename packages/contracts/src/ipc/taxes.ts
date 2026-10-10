import {
	TaxConfirmFactInputSchema,
	TaxCreateManualFactInputSchema,
	TaxGetDocumentInputSchema,
	TaxIdInputSchema,
	TaxListFactsInputSchema,
	TaxRenameDocumentInputSchema,
	TaxResolveConflictInputSchema,
	TaxSearchInputSchema,
	TaxUpdateFactInputSchema,
	TaxUploadDocumentInputSchema,
	TaxYearInputSchema,
} from "../taxes";

export const TAX_CHANNELS = {
	listYears: "taxes:listYears",
	getOverview: "taxes:getOverview",
	getReadiness: "taxes:getReadiness",
	getYearProfile: "taxes:getYearProfile",
	getAgentContext: "taxes:getAgentContext",
	listDocuments: "taxes:listDocuments",
	getDocument: "taxes:getDocument",
	uploadDocument: "taxes:uploadDocument",
	reprocessDocument: "taxes:reprocessDocument",
	renameDocument: "taxes:renameDocument",
	deleteDocument: "taxes:deleteDocument",
	listFacts: "taxes:listFacts",
	getFact: "taxes:getFact",
	createManualFact: "taxes:createManualFact",
	updateFact: "taxes:updateFact",
	confirmFact: "taxes:confirmFact",
	listConflicts: "taxes:listConflicts",
	resolveConflict: "taxes:resolveConflict",
	searchTaxData: "taxes:searchTaxData",
	getIncomeSummary: "taxes:getIncomeSummary",
	getWithholdingSummary: "taxes:getWithholdingSummary",
	getInvestmentSummary: "taxes:getInvestmentSummary",
	getRealEstateSummary: "taxes:getRealEstateSummary",
	getDeductionSummary: "taxes:getDeductionSummary",
	getRetirementSummary: "taxes:getRetirementSummary",
	getBusinessSummary: "taxes:getBusinessSummary",
	getEstimatedPayments: "taxes:getEstimatedPayments",
	getPriorYearCarryforwards: "taxes:getPriorYearCarryforwards",
	getMissingInformation: "taxes:getMissingInformation",
	getItemsNeedingReview: "taxes:getItemsNeedingReview",
} as const;

export type IpcTaxChannel = (typeof TAX_CHANNELS)[keyof typeof TAX_CHANNELS];

export const IpcTaxYearInputSchema = TaxYearInputSchema;
export const IpcTaxListFactsInputSchema = TaxListFactsInputSchema;
export const IpcTaxIdInputSchema = TaxIdInputSchema;
export const IpcTaxGetDocumentInputSchema = TaxGetDocumentInputSchema;
export const IpcTaxUploadDocumentInputSchema = TaxUploadDocumentInputSchema;
export const IpcTaxRenameDocumentInputSchema = TaxRenameDocumentInputSchema;
export const IpcTaxCreateManualFactInputSchema = TaxCreateManualFactInputSchema;
export const IpcTaxUpdateFactInputSchema = TaxUpdateFactInputSchema;
export const IpcTaxConfirmFactInputSchema = TaxConfirmFactInputSchema;
export const IpcTaxResolveConflictInputSchema = TaxResolveConflictInputSchema;
export const IpcTaxSearchInputSchema = TaxSearchInputSchema;
