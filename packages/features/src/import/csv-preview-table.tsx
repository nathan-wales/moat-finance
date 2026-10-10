import {
	cn,
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
} from "@moat/ui";
import {
	CSV_MAPPING_PREVIEW_ROW_COUNT,
	type CsvPreviewData,
} from "./csv-preview";
import type { ColumnMapping } from "./types";

const MAPPED_FIELD_LABELS: Array<{ key: keyof ColumnMapping; label: string }> =
	[
		{ key: "date", label: "Date" },
		{ key: "description", label: "Description" },
		{ key: "amount", label: "Amount" },
		{ key: "type", label: "Type" },
		{ key: "category", label: "Category" },
		{ key: "memo", label: "Memo" },
	];

function labelsForHeader(header: string, mapping: ColumnMapping): string[] {
	return MAPPED_FIELD_LABELS.filter(({ key }) => mapping[key] === header).map(
		({ label }) => label,
	);
}

export function CsvPreviewTable({
	preview,
	mapping,
}: {
	preview: CsvPreviewData;
	mapping: ColumnMapping;
}) {
	const shown = preview.rows.length;
	const total = preview.totalDataRows;
	const caption =
		total > CSV_MAPPING_PREVIEW_ROW_COUNT
			? `First ${shown} of ${total} rows`
			: `${shown} ${shown === 1 ? "row" : "rows"}`;

	if (preview.columns.length === 0) {
		return (
			<div className="flex min-h-48 items-center justify-center rounded-lg border border-dashed p-6">
				<p className="text-muted-foreground text-sm">No CSV rows to preview.</p>
			</div>
		);
	}

	return (
		<div className="flex min-h-0 min-w-0 flex-col overflow-hidden rounded-lg border">
			<div className="flex shrink-0 items-baseline justify-between gap-3 border-b bg-muted/30 px-3 py-2">
				<p className="font-medium text-sm">CSV preview</p>
				<p className="text-muted-foreground text-xs">{caption}</p>
			</div>
			<Table>
				<TableHeader>
					<TableRow className="hover:bg-transparent">
						{preview.columns.map((column) => {
							const mappedAs = labelsForHeader(column.name, mapping);
							const isMapped = mappedAs.length > 0;
							return (
								<TableHead
									className={cn(
										"align-bottom",
										isMapped && "bg-primary/5 text-foreground",
									)}
									key={column.id}
								>
									<div className="flex flex-col gap-0.5">
										<span>{column.name || "(empty)"}</span>
										{isMapped ? (
											<span className="font-normal text-[11px] text-primary">
												{mappedAs.join(", ")}
											</span>
										) : null}
									</div>
								</TableHead>
							);
						})}
					</TableRow>
				</TableHeader>
				<TableBody>
					{preview.rows.map((row) => (
						<TableRow key={row.id}>
							{preview.columns.map((column, cellIndex) => {
								const value = row.cells[cellIndex] ?? "";
								const isMapped =
									labelsForHeader(column.name, mapping).length > 0;
								return (
									<TableCell
										className={cn(
											"max-w-[14rem] truncate text-xs",
											isMapped && "bg-primary/5",
										)}
										key={`${row.id}-${column.id}`}
										title={value}
									>
										{value}
									</TableCell>
								);
							})}
						</TableRow>
					))}
				</TableBody>
			</Table>
		</div>
	);
}
