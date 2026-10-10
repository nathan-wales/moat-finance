import { TAX_FORM_TYPES, type TaxFormType } from "@moat/contracts";
import type {
	ParsedTaxBBox,
	ParsedTaxDocument,
	ParsedTaxKeyValue,
	ParsedTaxTable,
	ParsedTaxTextBlock,
} from "./parser";

const FORM_HINT_PATTERNS: Array<{ form: TaxFormType; pattern: RegExp }> = [
	{ form: "W-2", pattern: /\bW-?2\b|Wage and Tax Statement/i },
	{ form: "1099-INT", pattern: /\b1099-?INT\b/i },
	{ form: "1099-DIV", pattern: /\b1099-?DIV\b/i },
	{ form: "1099-B", pattern: /\b1099-?B\b/i },
	{ form: "1099-NEC", pattern: /\b1099-?NEC\b/i },
	{ form: "1099-MISC", pattern: /\b1099-?MISC\b/i },
	{ form: "1099-K", pattern: /\b1099-?K\b/i },
	{ form: "1098", pattern: /\b1098\b(?!-)/i },
	{ form: "1098-E", pattern: /\b1098-?E\b/i },
	{ form: "1098-T", pattern: /\b1098-?T\b/i },
	{ form: "5498-SA", pattern: /\b5498-?SA\b/i },
	{ form: "5498", pattern: /\b5498\b(?!-)/i },
	{ form: "K-1", pattern: /\bK-?1\b|Schedule K-1/i },
	{ form: "1040", pattern: /\bForm 1040\b|\b1040\b/i },
];

export function detectFormHints(text: string): TaxFormType[] {
	const hints: TaxFormType[] = [];
	for (const { form, pattern } of FORM_HINT_PATTERNS) {
		if (pattern.test(text) && !hints.includes(form)) {
			hints.push(form);
		}
	}
	return hints;
}

export function parseKeyValueLine(
	text: string,
): { key: string; value: string } | null {
	const match = text.match(/^(.{2,80}?)\s*[:–-]\s+(.+)$/);
	if (!match?.[1] || !match[2]) return null;
	return { key: match[1].trim(), value: match[2].trim() };
}

export function emptyParsedTaxDocument(
	overrides: Partial<ParsedTaxDocument> = {},
): ParsedTaxDocument {
	return {
		text: "",
		pages: [],
		tables: [],
		keyValues: [],
		formClassification: null,
		extractedFields: {},
		confidence: 0,
		sourceLocations: [],
		blocks: [],
		formHints: [],
		parserName: "docling",
		parserVersion: "unknown",
		parsedAt: new Date().toISOString(),
		pageCount: 0,
		...overrides,
	};
}

export function assembleParsedTaxDocument(input: {
	blocks: ParsedTaxTextBlock[];
	tables: ParsedTaxTable[];
	parserName: string;
	parserVersion: string;
	parsedAt?: string;
	pageCount?: number;
	confidence?: number;
}): ParsedTaxDocument {
	const pages = new Map<number, string[]>();
	const keyValues: ParsedTaxKeyValue[] = [];
	const sourceLocations: ParsedTaxDocument["sourceLocations"] = [];
	const texts: string[] = [];

	for (const block of input.blocks) {
		const text = block.text.trim();
		if (!text) continue;
		texts.push(text);
		const pageLines = pages.get(block.page) ?? [];
		pageLines.push(text);
		pages.set(block.page, pageLines);
		sourceLocations.push({
			page: block.page,
			label: block.type ?? "text",
			text,
			bbox: block.bbox,
		});
		const kv = parseKeyValueLine(text);
		if (kv) {
			keyValues.push({
				...kv,
				page: block.page,
				confidence: block.confidence,
			});
		}
	}

	for (const table of input.tables) {
		if (table.page !== undefined) {
			sourceLocations.push({
				page: table.page,
				label: "table",
				text: table.headers.join(" | "),
				bbox: table.bbox,
			});
		}
	}

	const fullText = texts.join("\n");
	const pageCount =
		input.pageCount ??
		(pages.size > 0
			? Math.max(...pages.keys())
			: input.tables.length > 0
				? 1
				: 0);

	return {
		text: fullText,
		pages: [...pages.entries()]
			.sort((a, b) => a[0] - b[0])
			.map(([page, lines]) => ({ page, text: lines.join("\n") })),
		tables: input.tables,
		keyValues,
		formClassification: null,
		extractedFields: Object.fromEntries(
			keyValues.map((item) => [item.key, item.value]),
		),
		confidence: input.confidence ?? (texts.length > 0 ? 0.75 : 0),
		sourceLocations,
		blocks: input.blocks,
		formHints: detectFormHints(fullText),
		parserName: input.parserName,
		parserVersion: input.parserVersion,
		parsedAt: input.parsedAt ?? new Date().toISOString(),
		pageCount,
	};
}

export function isTaxFormType(value: string): value is TaxFormType {
	return (TAX_FORM_TYPES as readonly string[]).includes(value);
}

export function bboxFromUnknown(
	value: unknown,
	page: number,
): ParsedTaxBBox | undefined {
	if (!value || typeof value !== "object") return undefined;
	const record = value as Record<string, unknown>;
	const left = numberOr(record.left ?? record.l);
	const top = numberOr(record.top ?? record.t);
	const right = numberOr(record.right ?? record.r);
	const bottom = numberOr(record.bottom ?? record.b);
	if (
		left === undefined ||
		top === undefined ||
		right === undefined ||
		bottom === undefined
	) {
		return undefined;
	}
	return { page, left, top, right, bottom };
}

function numberOr(value: unknown): number | undefined {
	if (typeof value !== "number" || !Number.isFinite(value)) return undefined;
	return value;
}
