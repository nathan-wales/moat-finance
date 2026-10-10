import type { CsvColumnMapping, ParsedCsvRow } from "./types";

export function stripUtf8Bom(value: string): string {
	return value.charCodeAt(0) === 0xfeff ? value.slice(1) : value;
}

export function parseCsv(
	csvText: string,
	mapping: CsvColumnMapping,
): { headers: string[]; rows: ParsedCsvRow[] } {
	const lines = stripUtf8Bom(csvText)
		.split(/\r?\n/)
		.map((l) => l.trim())
		.filter(Boolean);

	if (lines.length < 2) return { headers: [], rows: [] };

	const headers = parseCsvLine(lines[0] ?? "");
	const colIndex = (name: string) => {
		const idx = headers.findIndex(
			(h) => h.toLowerCase() === name.toLowerCase(),
		);
		return idx;
	};

	const dateIdx = colIndex(mapping.date);
	const amountIdx = colIndex(mapping.amount);
	const descIdx = mapping.description ? colIndex(mapping.description) : -1;
	const typeIdx = mapping.type ? colIndex(mapping.type) : -1;
	const catIdx = mapping.category ? colIndex(mapping.category) : -1;
	const memoIdx = mapping.memo ? colIndex(mapping.memo) : -1;
	const acctIdx = mapping.account ? colIndex(mapping.account) : -1;

	const rows: ParsedCsvRow[] = [];

	for (let i = 1; i < lines.length; i++) {
		const cells = parseCsvLine(lines[i] ?? "");
		const dateVal = cells[dateIdx] ?? "";
		const amountVal = cells[amountIdx] ?? "";

		if (!dateVal || !amountVal) continue;

		rows.push({
			date: dateVal,
			amount: amountVal,
			description: descIdx >= 0 ? (cells[descIdx] ?? "") : "",
			type: typeIdx >= 0 ? cells[typeIdx] : undefined,
			category: catIdx >= 0 ? cells[catIdx] : undefined,
			memo: memoIdx >= 0 ? cells[memoIdx] : undefined,
			account: acctIdx >= 0 ? cells[acctIdx] : undefined,
		});
	}

	return { headers, rows };
}

function cellValue(row: Record<string, string | number>, key: string): string {
	const found = Object.keys(row).find(
		(candidate) => candidate.toLowerCase() === key.toLowerCase(),
	);
	if (!found) return "";
	const value = row[found];
	return value == null ? "" : String(value);
}

export function mapKeyedRows(
	mapping: CsvColumnMapping,
	rawRows: Array<Record<string, string | number>>,
): { headers: string[]; rows: ParsedCsvRow[] } {
	const headers =
		rawRows.length === 0
			? [mapping.date, mapping.amount]
			: Object.keys(rawRows[0] ?? {});

	const rows: ParsedCsvRow[] = [];
	for (const raw of rawRows) {
		const dateVal = cellValue(raw, mapping.date);
		const amountVal = cellValue(raw, mapping.amount);
		if (!dateVal || !amountVal) continue;
		rows.push({
			date: dateVal,
			amount: amountVal,
			description: mapping.description
				? cellValue(raw, mapping.description)
				: "",
			type: mapping.type ? cellValue(raw, mapping.type) : undefined,
			category: mapping.category ? cellValue(raw, mapping.category) : undefined,
			memo: mapping.memo ? cellValue(raw, mapping.memo) : undefined,
			account: mapping.account ? cellValue(raw, mapping.account) : undefined,
		});
	}

	return { headers, rows };
}

/**
 * Splits a single CSV line respecting quoted fields.
 */
function parseCsvLine(line: string): string[] {
	const cells: string[] = [];
	let current = "";
	let inQuote = false;

	for (let i = 0; i < line.length; i++) {
		const ch = line[i];
		if (ch === '"') {
			if (inQuote && line[i + 1] === '"') {
				current += '"';
				i++;
			} else {
				inQuote = !inQuote;
			}
		} else if (ch === "," && !inQuote) {
			cells.push(current.trim());
			current = "";
		} else {
			current += ch;
		}
	}
	cells.push(current.trim());
	return cells;
}

/**
 * Auto-detects likely column mappings from a CSV header row.
 * Returns a partial mapping — only fields it can guess with confidence.
 */
export function autoDetectColumns(
	headers: string[],
): Partial<CsvColumnMapping> {
	const lower = headers.map((h) => h.toLowerCase());
	const find = (...candidates: string[]) =>
		headers[lower.findIndex((h) => candidates.some((c) => h.includes(c)))] ??
		undefined;

	return {
		date: find("date", "transaction date", "posted date", "trans date"),
		amount: find("amount", "debit", "credit", "transaction amount"),
		description: find(
			"description",
			"merchant",
			"payee",
			"name",
			"title",
			"details",
		),
		type: find("type", "transaction type", "credit/debit"),
		category: find("category"),
		memo: find("memo", "original desc", "original_description"),
		account: find("account", "account name"),
	};
}
