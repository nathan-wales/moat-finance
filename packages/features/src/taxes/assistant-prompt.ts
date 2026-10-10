export const TAX_DOCUMENT_REVIEW_PROMPT_ID = "tax-document-review";

export function taxDocumentReviewPrompt(taxYear: number): string {
	return `Use the Moat MCP tools moat.getTaxYearSummary, moat.getTaxReadiness, moat.getTaxMissingInformation, and moat.getTaxItemsNeedingReview. Then: (1) Summarize my tax picture from the documents I have uploaded. (2) Tell me whether I am ready to file and why. (3) List missing documents and items that need review. (4) Draft a short summary I could send my CPA.\n\nContext: Review tax year ${taxYear}.`;
}
