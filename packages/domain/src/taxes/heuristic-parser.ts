import { classifyTaxForm } from "./classify-form";
import type { ParsedTaxDocument, TaxDocumentParser } from "./parser";

export class HeuristicTaxDocumentParser implements TaxDocumentParser {
	readonly provider = "heuristic";
	readonly version = "1";

	async parseDocument(input: {
		bytes: Uint8Array;
		mimeType: string;
		filename: string;
	}): Promise<ParsedTaxDocument> {
		const text = decodeText(input.bytes, input.mimeType);
		const keyValues = extractLabeledAmounts(text);
		const parsed: ParsedTaxDocument = {
			text,
			pages: [{ page: 1, text }],
			tables: [],
			keyValues,
			formClassification: null,
			extractedFields: Object.fromEntries(
				keyValues.map((item) => [item.key, item.value]),
			),
			confidence: keyValues.length > 0 ? 0.55 : 0.2,
			sourceLocations: keyValues.map((item) => ({
				page: 1,
				label: item.key,
				text: `${item.key}: ${item.value}`,
			})),
		};
		parsed.formClassification = classifyTaxForm({
			filename: input.filename,
			parsed,
		}).formType;
		return parsed;
	}
}

function decodeText(bytes: Uint8Array, mimeType: string): string {
	if (mimeType.startsWith("text/") || mimeType === "application/json") {
		return new TextDecoder().decode(bytes);
	}
	const decoded = new TextDecoder("utf-8", { fatal: false }).decode(bytes);
	const printable = decoded.replace(/[^\x09\x0a\x0d\x20-\x7e]/g, " ");
	return printable.replace(/\s+/g, " ").trim();
}

function extractLabeledAmounts(
	text: string,
): Array<{ key: string; value: string; page: number }> {
	const lines = text.split(/\n|(?=\bBox\s+\d)/g);
	const results: Array<{ key: string; value: string; page: number }> = [];
	for (const line of lines) {
		const match = line.match(
			/(Box\s+\d+[a-z]?|Wages|Federal income tax withheld|Interest income|Ordinary dividends|Qualified dividends|Mortgage interest|HSA contributions|Nonemployee compensation|Gross amount|Student loan interest)[^\d$]*([$]?\s?-?[\d,]+(?:\.\d{2})?)/i,
		);
		if (!match?.[1] || !match[2]) continue;
		results.push({ key: match[1].trim(), value: match[2].trim(), page: 1 });
	}
	return results;
}
