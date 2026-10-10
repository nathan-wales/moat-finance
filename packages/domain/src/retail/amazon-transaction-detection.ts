export const AMAZON_TRANSACTION_KEYWORD_PATTERNS = [
	"Amazon.com",
	"AMAZON MKTPLACE PMTS",
	"AMAZON MKTPL*",
] as const;

export type AmazonTransactionKeywordPattern =
	(typeof AMAZON_TRANSACTION_KEYWORD_PATTERNS)[number];

export type RetailTransactionDetectionInput = {
	description?: string | null;
	originalDescription?: string | null;
	merchantName?: string | null;
};

export type RetailTransactionDetectionResult = {
	retailer: "amazon";
	matched: boolean;
	matchedKeyword?: AmazonTransactionKeywordPattern;
	confidence: "high" | "medium" | "low";
};

function normalizeTransactionText(value: string | null | undefined): string {
	return (value ?? "")
		.toLowerCase()
		.replace(/[^a-z0-9*]+/g, " ")
		.replace(/\s+/g, " ")
		.trim();
}

function isAmazonMarketplacePrefixMatch(value: string): boolean {
	return /(^|\s)amazon\s+mktpl\w*/.test(value);
}

function findMatchedKeyword(
	value: string,
): AmazonTransactionKeywordPattern | null {
	if (!value) return null;
	if (value.includes("amazon com")) return "Amazon.com";
	if (value.includes("amazon mktplace pmts")) return "AMAZON MKTPLACE PMTS";
	if (isAmazonMarketplacePrefixMatch(value)) return "AMAZON MKTPL*";
	return null;
}

export function detectAmazonRetailTransaction(
	input: RetailTransactionDetectionInput,
): RetailTransactionDetectionResult {
	const values = [
		input.description,
		input.originalDescription,
		input.merchantName,
	].map(normalizeTransactionText);

	for (const value of values) {
		const matchedKeyword = findMatchedKeyword(value);
		if (matchedKeyword) {
			return {
				retailer: "amazon",
				matched: true,
				matchedKeyword,
				confidence: "high",
			};
		}
	}

	return {
		retailer: "amazon",
		matched: false,
		confidence: "low",
	};
}
