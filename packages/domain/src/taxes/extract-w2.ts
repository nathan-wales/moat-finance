import { parseMoney } from "./money";
import type { ParsedTaxDocument, ParsedTaxTable } from "./parser";

export type W2ExtractedFields = {
	employerName?: string;
	employeeName?: string;
	wages?: number;
	federalWithholding?: number;
	socialSecurityWages?: number;
	socialSecurityTax?: number;
	medicareWages?: number;
	medicareTax?: number;
	stateWages?: number;
	stateTax?: number;
};

type W2MoneyField = Exclude<
	keyof W2ExtractedFields,
	"employerName" | "employeeName"
>;

const BOX_FIELDS = {
	"1": "wages",
	"2": "federalWithholding",
	"3": "socialSecurityWages",
	"4": "socialSecurityTax",
	"5": "medicareWages",
	"6": "medicareTax",
	"16": "stateWages",
	"17": "stateTax",
} as const satisfies Record<string, W2MoneyField>;

type TrackedBox = keyof typeof BOX_FIELDS;

const BOX_LABELS: Record<TrackedBox, RegExp> = {
	"1": /wages,\s*tips,\s*other compensation/i,
	"2": /federal income tax withheld/i,
	"3": /social security wages/i,
	"4": /social security tax withheld/i,
	"5": /medicare wages(?:\s+and\s+tips)?/i,
	"6": /medicare tax withheld/i,
	"16": /state wages/i,
	"17": /state income tax/i,
};

const MONEY_PATTERN = /\$?\s*-?[\d,]+\.\d{2}/g;
const BOX_HEADER = /(?:^|[\s])(?:box\s*)?(\d{1,2}[a-z]?)\s+(?=[A-Za-z])/gi;

type BoxSlot = {
	box: string;
	field?: W2MoneyField;
	amounts: number[];
};

export function extractW2Fields(parsed: ParsedTaxDocument): W2ExtractedFields {
	const fromText = assignW2Boxes(parsed.text);
	const fromTables = assignW2Boxes(tablesToText(parsed.tables));
	const amounts = { ...fromTables, ...definedAmounts(fromText) };
	return {
		...amounts,
		employerName:
			fromText.employerName ??
			fromTables.employerName ??
			guessW2Employer(parsed.text) ??
			undefined,
		employeeName: fromText.employeeName ?? fromTables.employeeName,
	};
}

export function isTaxFormChrome(value: string): boolean {
	return /social security number|employee['\u2019]?s name|wage and tax statement|^form\s+w-?2\b|omb no|department of the treasury|internal revenue|copy [a-d]\b|^[a-f]\s+employee|^[a-f]\s+employer['\u2019]?s name|employer['\u2019]?s name, address|employer identification|control number|^void\b|visit the irs|for privacy act|safe, accurate|wages,\s*tips,\s*other compensation|federal income tax withheld|medicare wages|state wages/i.test(
		value,
	);
}

function assignW2Boxes(text: string): W2ExtractedFields {
	const slots = boxSlots(text);
	const fields: W2ExtractedFields = {};
	let index = 0;
	while (index < slots.length) {
		if (!slots[index]?.field) {
			index += 1;
			continue;
		}
		const runStart = index;
		while (
			index < slots.length &&
			slots[index]?.field &&
			(slots[index]?.amounts.length ?? 0) === 0
		) {
			index += 1;
		}
		if (index >= slots.length) break;
		const lead = slots.slice(runStart, index);
		const current = slots[index];
		if (!current?.field) {
			index += 1;
			continue;
		}
		const run = [...lead, current];
		if (current.amounts.length === run.length) {
			for (const [offset, slot] of run.entries()) {
				const amount = current.amounts[offset];
				if (slot.field && amount !== undefined) {
					fields[slot.field] = amount;
				}
			}
			index += 1;
			continue;
		}
		if (current.amounts.length === 1 && lead.length === 0) {
			fields[current.field] = current.amounts[0];
		}
		index += 1;
	}
	const employerName = guessW2Employer(text) ?? undefined;
	return { ...fields, employerName };
}

function boxSlots(text: string): BoxSlot[] {
	const headerPattern = new RegExp(BOX_HEADER.source, "gi");
	const headers = [...text.matchAll(headerPattern)].flatMap((match) => {
		const box = (match[1] ?? "").toLowerCase();
		if (match.index === undefined) return [];
		return [
			{
				box,
				end: match.index + match[0].length,
				index: match.index,
			},
		];
	});
	return headers.map((header, headerIndex) => {
		const next = headers[headerIndex + 1];
		const windowText = text.slice(header.end, next?.index ?? text.length);
		const tracked = isTrackedBox(header.box) ? header.box : null;
		if (
			tracked &&
			!new RegExp(BOX_LABELS[tracked].source, "i").test(windowText)
		) {
			return { box: header.box, amounts: moneyAmounts(windowText) };
		}
		return {
			box: header.box,
			field: tracked ? BOX_FIELDS[tracked] : undefined,
			amounts: moneyAmounts(windowText),
		};
	});
}

function isTrackedBox(box: string): box is TrackedBox {
	return box in BOX_FIELDS;
}

function moneyAmounts(text: string): number[] {
	const amounts: number[] = [];
	for (const match of text.matchAll(new RegExp(MONEY_PATTERN.source, "g"))) {
		const money = parseMoney(match[0]);
		if (money !== null) amounts.push(money);
	}
	return amounts;
}

function tablesToText(tables: ParsedTaxTable[]): string {
	return tables
		.map((table) =>
			[
				table.headers.join("\t"),
				...table.rows.map((row) => row.join("\t")),
			].join("\n"),
		)
		.join("\n");
}

function definedAmounts(fields: W2ExtractedFields): W2ExtractedFields {
	const next: W2ExtractedFields = {};
	for (const [key, value] of Object.entries(fields)) {
		if (value !== undefined) {
			(next as Record<string, unknown>)[key] = value;
		}
	}
	return next;
}

function guessW2Employer(text: string): string | null {
	const labeled = text.match(
		/(?:^|[\n\r])\s*c\s+employer['\u2019]?s\s+name[^\n\r]*/i,
	);
	if (labeled?.index === undefined) return null;
	const after = text.slice(labeled.index + labeled[0].length);
	for (const rawLine of after.split(/\n|\r/)) {
		const line = stripTrailingAmounts(rawLine.trim());
		if (!line) continue;
		if (
			isBoxHeaderLine(line) ||
			isTaxFormChrome(line) ||
			isIdentifierLine(line)
		) {
			continue;
		}
		if (line.length >= 3 && line.length <= 80) return line;
	}
	return null;
}

function stripTrailingAmounts(line: string): string {
	return line.split(new RegExp(MONEY_PATTERN.source, "g"))[0]?.trim() ?? line;
}

function isBoxHeaderLine(line: string): boolean {
	return /^(?:box\s*)?\d{1,2}[a-z]?\s+[A-Za-z]/i.test(line);
}

function isIdentifierLine(line: string): boolean {
	return /^\d{3}-\d{2}-\d{4}$/.test(line) || /^\d{2}-\d{7}$/.test(line);
}
