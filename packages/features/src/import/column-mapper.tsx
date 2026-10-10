import { IMPORT_UNCATEGORIZED_WARNING } from "@moat/contracts";
import {
	Label,
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@moat/ui";
import { parseCsvPreview } from "./csv-preview";
import type { ColumnMapping } from "./types";

const COLUMN_FIELDS: Array<{ key: keyof ColumnMapping; label: string }> = [
	{ key: "date", label: "Date *" },
	{ key: "description", label: "Description *" },
	{ key: "amount", label: "Amount *" },
	{ key: "type", label: "Type (optional)" },
	{ key: "category", label: "Category (optional)" },
	{ key: "memo", label: "Memo (optional)" },
];

type ColumnMapperProps = {
	headers: string[];
	mapping: ColumnMapping;
	onChange: (mapping: ColumnMapping) => void;
};

export function sniffCsvHeaders(csvText: string): string[] {
	return parseCsvPreview(csvText, 0).headers;
}

export function autoMapColumns(headers: string[]): ColumnMapping {
	const lower = headers.map((header) => header.toLowerCase());
	function findCol(...candidates: string[]) {
		return (
			headers[
				lower.findIndex((header) =>
					candidates.some((candidate) => header.includes(candidate)),
				)
			] ?? ""
		);
	}

	return {
		date: findCol("date"),
		description: findCol("description", "name", "payee", "title"),
		amount: findCol("amount", "sum", "value"),
		type: findCol("type") || undefined,
		category: findCol("category") || undefined,
		memo: findCol("memo", "original desc", "original_description") || undefined,
	};
}

export function countCsvDataRows(csvText: string): number {
	const lines = csvText
		.split(/\r?\n/)
		.map((line) => line.trim())
		.filter(Boolean);
	if (lines.length < 2) return 0;
	return lines.length - 1;
}

export function ColumnMapper({
	headers,
	mapping,
	onChange,
}: ColumnMapperProps) {
	return (
		<div className="flex flex-col gap-3">
			{COLUMN_FIELDS.map(({ key, label }) => (
				<div
					className="grid grid-cols-[minmax(0,7.5rem)_minmax(0,1fr)] items-center gap-x-3 gap-y-1.5"
					key={key}
				>
					<Label htmlFor={`map-${key}`}>{label}</Label>
					<Select
						onValueChange={(value) => {
							const nextValue = value === "(none)" ? undefined : value;
							if (key === "date" || key === "description" || key === "amount") {
								onChange({ ...mapping, [key]: nextValue ?? "" });
								return;
							}
							onChange({ ...mapping, [key]: nextValue });
						}}
						value={mapping[key] || "(none)"}
					>
						<SelectTrigger className="w-full min-w-0" id={`map-${key}`}>
							<SelectValue />
						</SelectTrigger>
						<SelectContent>
							<SelectItem value="(none)">(none)</SelectItem>
							{headers.map((header) => (
								<SelectItem key={header} value={header}>
									{header}
								</SelectItem>
							))}
						</SelectContent>
					</Select>
					{key === "category" && !mapping.category ? (
						<p className="col-span-2 text-amber-700 text-sm dark:text-amber-400">
							{IMPORT_UNCATEGORIZED_WARNING}
						</p>
					) : null}
				</div>
			))}
		</div>
	);
}
