import type { TaxDocumentCategory, TaxFormType } from "@moat/contracts";
import type { ParsedTaxDocument } from "./parser";

const FORM_PATTERNS: Array<{
	formType: TaxFormType;
	category: TaxDocumentCategory;
	patterns: RegExp[];
}> = [
	{
		formType: "W-2",
		category: "wage",
		patterns: [/\bw-?2\b/i, /wage and tax statement/i],
	},
	{
		formType: "1099-INT",
		category: "investment",
		patterns: [/\b1099-?int\b/i],
	},
	{
		formType: "1099-DIV",
		category: "investment",
		patterns: [/\b1099-?div\b/i],
	},
	{
		formType: "1099-B",
		category: "investment",
		patterns: [/\b1099-?b\b/i, /proceeds from broker/i],
	},
	{ formType: "1099-NEC", category: "business", patterns: [/\b1099-?nec\b/i] },
	{
		formType: "1099-MISC",
		category: "business",
		patterns: [/\b1099-?misc\b/i],
	},
	{ formType: "1099-K", category: "business", patterns: [/\b1099-?k\b/i] },
	{
		formType: "1098",
		category: "mortgage",
		patterns: [/\b1098\b/i, /mortgage interest statement/i],
	},
	{
		formType: "1098-E",
		category: "education",
		patterns: [/\b1098-?e\b/i, /student loan interest/i],
	},
	{ formType: "1098-T", category: "education", patterns: [/\b1098-?t\b/i] },
	{ formType: "5498-SA", category: "healthcare", patterns: [/\b5498-?sa\b/i] },
	{ formType: "5498", category: "retirement", patterns: [/\b5498\b/i] },
	{
		formType: "K-1",
		category: "business",
		patterns: [/\bschedule k-?1\b/i, /\bk-?1\b/i],
	},
	{
		formType: "1040",
		category: "prior_return",
		patterns: [/\bform 1040\b/i, /u\.?s\.? individual income tax return/i],
	},
];

export function classifyTaxForm(input: {
	filename: string;
	parsed: ParsedTaxDocument;
}): {
	formType: TaxFormType;
	category: TaxDocumentCategory;
	confidence: number;
} {
	const haystack = `${input.filename}\n${input.parsed.text}`;
	for (const candidate of FORM_PATTERNS) {
		if (candidate.patterns.some((pattern) => pattern.test(haystack))) {
			return {
				formType: candidate.formType,
				category: candidate.category,
				confidence: 0.85,
			};
		}
	}
	return { formType: "other", category: "other", confidence: 0.2 };
}
