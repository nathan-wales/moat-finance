import type { AiPrompt } from "../types";

export const taxPrompts: AiPrompt[] = [
	{
		id: "tax-document-review",
		title: "Review My Tax Documents",
		prompt:
			"Use the Moat MCP tools moat.getTaxYearSummary, moat.getTaxReadiness, moat.getTaxMissingInformation, and moat.getTaxItemsNeedingReview. Then: (1) Summarize my tax picture from the documents I have uploaded. (2) Tell me whether I am ready to file and why. (3) List missing documents and items that need review. (4) Draft a short summary I could send my CPA.",
		tags: ["tax"],
		surfaces: ["taxes.overview", "prompt-library"],
	},
	{
		id: "tax-strategy-annual",
		title: "Build My Tax Strategy Report",
		prompt:
			"Use the Moat MCP tools to get my spending breakdown, budget status, and account overview for the current year. Then build a personalized tax strategy report: (1) Identify categories with the highest deduction potential — home office, business expenses, charitable giving, healthcare. (2) Flag retirement contribution headroom I haven't fully used (IRA, 401k, HSA). (3) Highlight any obvious tax-loss harvesting opportunities in my investment accounts. (4) Give me three high-priority moves I should make before December 31st, ranked by estimated dollar impact.",
		tags: ["tax"],
		surfaces: ["prompt-library"],
	},
	{
		id: "rental-write-off-prep",
		title: "Prepare My Rental for Tax Season",
		prompt:
			"Use the Moat MCP tools to pull my transactions and spending breakdown, focusing on real-estate and property-related categories. Then: (1) List all likely deductible rental expenses I've captured this year — repairs, insurance, utilities, management fees, mortgage interest. (2) Identify gaps: expenses I probably have but aren't yet categorized (depreciation schedule, mileage, capital improvements). (3) Suggest specific Moat Finance hashtag rules I should create to automate this categorization going forward. (4) Give me a tax-season prep checklist ordered by deadline urgency.",
		tags: ["tax", "real-estate", "rules"],
		surfaces: ["prompt-library"],
	},
	{
		id: "rule-setup-for-taxes",
		title: "Set Up Rules and Hashtags for Tax Season",
		prompt:
			"Use the Moat MCP tools to pull my recent transactions and current rule configuration. Then: (1) Identify merchant and category patterns that are likely tax-deductible but have no hashtag rule yet. (2) Suggest 5–10 specific Moat Finance hashtag rules I should create, with exact hashtag names (e.g. #home-office, #charitable, #business-travel, #medical). (3) For each rule, explain what it captures and why it matters at tax time. (4) Give me a prioritized setup order based on my spending patterns, starting with the highest-value rules.",
		tags: ["tax", "rules"],
		surfaces: ["transactions.empty", "prompt-library"],
	},
];
