export const CSV_MAPPING_PREVIEW_ROW_COUNT = 25;

export type CsvPreviewColumn = {
	id: string;
	name: string;
};

export type CsvPreviewRow = {
	id: string;
	cells: string[];
};

export type CsvPreviewData = {
	headers: string[];
	columns: CsvPreviewColumn[];
	rows: CsvPreviewRow[];
	totalDataRows: number;
};

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

function csvLines(csvText: string): string[] {
	return csvText
		.replace(/^\uFEFF/, "")
		.split(/\r?\n/)
		.map((line) => line.trim())
		.filter(Boolean);
}

function padCells(cells: string[], length: number): string[] {
	if (cells.length >= length) return cells.slice(0, length);
	return [...cells, ...Array(length - cells.length).fill("")];
}

export function parseCsvPreview(
	csvText: string,
	maxDataRows = CSV_MAPPING_PREVIEW_ROW_COUNT,
): CsvPreviewData {
	const lines = csvLines(csvText);
	if (lines.length === 0) {
		return { headers: [], columns: [], rows: [], totalDataRows: 0 };
	}

	const headers = parseCsvLine(lines[0] ?? "");
	const columns = headers.map((name, columnIndex) => ({
		id: `col-${columnIndex}`,
		name,
	}));
	const dataLines = lines.slice(1);
	const previewLines = dataLines.slice(0, Math.max(0, maxDataRows));
	const rows = previewLines.map((line, rowIndex) => ({
		id: `row-${rowIndex}`,
		cells: padCells(parseCsvLine(line), headers.length),
	}));

	return {
		headers,
		columns,
		rows,
		totalDataRows: dataLines.length,
	};
}
