import type { TableBlock } from "../../schema/moat-report-document.schema";

interface Props {
	block: TableBlock;
}

export function TableBlock({ block }: Props) {
	return (
		<div className="space-y-2">
			{block.title && (
				<p className="font-medium text-foreground text-sm">{block.title}</p>
			)}
			<div className="overflow-x-auto rounded-lg border">
				<table className="w-full text-sm">
					<thead className="bg-muted/50">
						<tr>
							{block.columns.map((col, i) => (
								<th
									className="px-3 py-2 text-left font-medium text-muted-foreground text-xs"
									key={`col-${i}`}
								>
									{col}
								</th>
							))}
						</tr>
					</thead>
					<tbody className="divide-y divide-border">
						{block.rows.map((row, ri) => (
							<tr className="hover:bg-muted/30" key={`row-${ri}`}>
								{row.map((cell, ci) => (
									<td
										className="px-3 py-2 text-foreground"
										key={`cell-${ri}-${ci}`}
									>
										{cell}
									</td>
								))}
							</tr>
						))}
					</tbody>
				</table>
			</div>
		</div>
	);
}
