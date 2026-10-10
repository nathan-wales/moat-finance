import type { RetirementProjection } from "@moat/contracts";
import {
	explainProjectionDelta,
	projectionDeltaRows,
} from "../retirement-copy";

const HEADLINE_LABELS = new Set([
	"Retirement confidence",
	"Safe monthly spending",
]);

export function ImpactHeadline({
	baseline,
	whatIf,
}: {
	baseline: RetirementProjection;
	whatIf: RetirementProjection;
}) {
	const rows = projectionDeltaRows(baseline, whatIf).filter((row) =>
		HEADLINE_LABELS.has(row.label),
	);

	return (
		<dl className="space-y-2">
			{rows.map((row) => (
				<div
					className="flex items-baseline justify-between gap-4"
					key={row.label}
				>
					<dt className="text-sm">{row.label}</dt>
					<dd className="flex items-baseline gap-3 tabular-nums">
						<span className="font-semibold text-lg tracking-tight">
							{row.whatIf}
						</span>
						<span className="text-muted-foreground text-sm">{row.change}</span>
					</dd>
				</div>
			))}
		</dl>
	);
}

export function ImpactTable({
	baseline,
	whatIf,
}: {
	baseline: RetirementProjection;
	whatIf: RetirementProjection;
}) {
	const rows = projectionDeltaRows(baseline, whatIf);
	const explanation = explainProjectionDelta(
		baseline.summary,
		whatIf.summary,
		whatIf.appliedLevers[whatIf.appliedLevers.length - 1]?.type,
	);

	return (
		<div className="space-y-4">
			<p className="font-medium text-sm">Detailed comparison</p>
			<div className="overflow-x-auto rounded-lg border">
				<table className="w-full text-sm">
					<thead className="bg-muted/40 text-muted-foreground text-xs">
						<tr>
							<th className="px-3 py-2 text-left font-medium"> </th>
							<th className="px-3 py-2 text-right font-medium">Baseline</th>
							<th className="px-3 py-2 text-right font-medium">What if</th>
							<th className="px-3 py-2 text-right font-medium">Change</th>
						</tr>
					</thead>
					<tbody>
						{rows.map((row) => (
							<tr className="border-t" key={row.label}>
								<td className="px-3 py-2">{row.label}</td>
								<td className="px-3 py-2 text-right">{row.baseline}</td>
								<td className="px-3 py-2 text-right">{row.whatIf}</td>
								<td className="px-3 py-2 text-right">{row.change}</td>
							</tr>
						))}
					</tbody>
				</table>
			</div>
			<div className="space-y-1">
				<p className="font-medium text-sm">{explanation.headline}</p>
				<p className="text-muted-foreground text-sm">{explanation.body}</p>
			</div>
		</div>
	);
}
