import type { TaxFormType } from "@moat/contracts";

export type ParsedTaxBBox = {
	page: number;
	left: number;
	top: number;
	right: number;
	bottom: number;
};

export type ParsedTaxKeyValue = {
	key: string;
	value: string;
	confidence?: number;
	page?: number;
};

export type ParsedTaxTable = {
	headers: string[];
	rows: string[][];
	page?: number;
	bbox?: ParsedTaxBBox;
};

export type ParsedTaxTextBlock = {
	page: number;
	text: string;
	type?: string;
	confidence?: number;
	bbox?: ParsedTaxBBox;
};

export type ParsedTaxDocument = {
	text: string;
	pages: Array<{ page: number; text: string }>;
	tables: ParsedTaxTable[];
	keyValues: ParsedTaxKeyValue[];
	formClassification: TaxFormType | null;
	extractedFields: Record<string, unknown>;
	confidence: number;
	sourceLocations: Array<{
		page?: number;
		label: string;
		text: string;
		bbox?: ParsedTaxBBox;
	}>;
	blocks?: ParsedTaxTextBlock[];
	formHints?: string[];
	parserName?: string;
	parserVersion?: string;
	parsedAt?: string;
	pageCount?: number;
};

export interface TaxDocumentParser {
	readonly provider: string;
	readonly version: string;
	parseDocument(input: {
		bytes: Uint8Array;
		mimeType: string;
		filename: string;
	}): Promise<ParsedTaxDocument>;
}

export type UnstructuredLikeElement = {
	type?: string;
	text?: string;
	metadata?: {
		page_number?: number;
		filename?: string;
		text_as_html?: string;
	};
};

export function normalizeUnstructuredPayload(
	elements: UnstructuredLikeElement[],
): ParsedTaxDocument {
	const pages = new Map<number, string[]>();
	const keyValues: ParsedTaxKeyValue[] = [];
	const tables: ParsedTaxTable[] = [];
	const sourceLocations: ParsedTaxDocument["sourceLocations"] = [];
	const texts: string[] = [];

	for (const element of elements) {
		const text = element.text?.trim() ?? "";
		if (!text) continue;
		const page = element.metadata?.page_number ?? 1;
		texts.push(text);
		const pageLines = pages.get(page) ?? [];
		pageLines.push(text);
		pages.set(page, pageLines);
		sourceLocations.push({ page, label: element.type ?? "text", text });

		if (element.type === "Table") {
			tables.push(parseHtmlTable(element.metadata?.text_as_html, page, text));
		}

		const kv = parseKeyValueLine(text);
		if (kv) {
			keyValues.push({ ...kv, page });
		}
	}

	const fullText = texts.join("\n");
	return {
		text: fullText,
		pages: [...pages.entries()]
			.sort((a, b) => a[0] - b[0])
			.map(([page, lines]) => ({ page, text: lines.join("\n") })),
		tables,
		keyValues,
		formClassification: null,
		extractedFields: Object.fromEntries(
			keyValues.map((item) => [item.key, item.value]),
		),
		confidence: elements.length > 0 ? 0.7 : 0,
		sourceLocations,
	};
}

function parseKeyValueLine(
	text: string,
): { key: string; value: string } | null {
	const match = text.match(/^(.{2,80}?)\s*[:–-]\s+(.+)$/);
	if (!match?.[1] || !match[2]) return null;
	return { key: match[1].trim(), value: match[2].trim() };
}

function parseHtmlTable(
	html: string | undefined,
	page: number,
	fallbackText: string,
): ParsedTaxTable {
	if (!html) {
		return {
			headers: [],
			rows: fallbackText.split("\n").map((line) => [line]),
			page,
		};
	}
	const rows = [...html.matchAll(/<tr[^>]*>([\s\S]*?)<\/tr>/gi)].map((row) => {
		const rowHtml = row[1] ?? "";
		return [...rowHtml.matchAll(/<t[dh][^>]*>([\s\S]*?)<\/t[dh]>/gi)].map(
			(cell) => (cell[1] ?? "").replace(/<[^>]+>/g, "").trim(),
		);
	});
	const headers = rows[0] ?? [];
	return { headers, rows: rows.slice(1), page };
}
