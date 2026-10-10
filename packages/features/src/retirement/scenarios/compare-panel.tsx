import { RetirementComparisonChart } from "@moat/charts";
import {
	RETIREMENT_COMPARISON_MAX_SCENARIOS,
	type RetirementComparisonColumn,
} from "@moat/contracts";
import { Checkbox } from "@moat/ui";
import { useEffect } from "react";
import { formatMoney, formatPercent } from "../format";
import { useRetirementCapture } from "../retirement-analytics";
import { useRetirementStore } from "../retirement-store";
import {
	useRetirementComparison,
	useRetirementScenarios,
} from "../use-retirement-queries";

export function ComparePanel() {
	const compareIds = useRetirementStore((state) => state.compareIds);
	const toggleCompareId = useRetirementStore((state) => state.toggleCompareId);
	const isDirty = useRetirementStore((state) => state.isDirty);
	const savedScenarioId = useRetirementStore((state) => state.savedScenarioId);
	const { data: scenarios = [] } = useRetirementScenarios();
	const comparison = useRetirementComparison(compareIds);
	const capture = useRetirementCapture();
	const remaining = RETIREMENT_COMPARISON_MAX_SCENARIOS - compareIds.length;
	const dirtyHint =
		isDirty && savedScenarioId
			? "Save this stack to include the latest changes in the comparison."
			: isDirty
				? "Save this stack to add it to the comparison."
				: null;

	useEffect(() => {
		if (!comparison.data) return;
		capture("retirement_scenario_compared", {
			scenarioCount: compareIds.length,
		});
	}, [capture, compareIds.length, comparison.data]);

	return (
		<div className="space-y-4">
			<div className="space-y-2">
				<p className="font-medium text-sm">Compare saved scenarios</p>
				<p className="text-muted-foreground text-xs">
					Select up to {RETIREMENT_COMPARISON_MAX_SCENARIOS} against the live
					baseline.
				</p>
				<ul className="space-y-2">
					{scenarios.map((scenario) => {
						const compared = compareIds.includes(scenario.id);
						const atLimit = !compared && remaining <= 0;
						return (
							<li key={scenario.id}>
								<label
									className="flex items-center gap-2 text-sm"
									htmlFor={`compare-${scenario.id}`}
								>
									<Checkbox
										checked={compared}
										disabled={atLimit}
										id={`compare-${scenario.id}`}
										onCheckedChange={() => toggleCompareId(scenario.id)}
									/>
									{scenario.name}
								</label>
							</li>
						);
					})}
				</ul>
				{dirtyHint ? (
					<p className="text-muted-foreground text-xs">{dirtyHint}</p>
				) : null}
			</div>
			{compareIds.length > 0 ? (
				<>
					<RetirementComparisonChart
						columns={comparison.data?.columns ?? []}
						isLoading={comparison.isLoading}
					/>
					{comparison.data ? (
						<ComparisonTable columns={comparison.data.columns} />
					) : null}
				</>
			) : (
				<p className="text-muted-foreground text-sm">
					Choose a saved scenario to overlay it on the baseline.
				</p>
			)}
		</div>
	);
}

function ComparisonTable({
	columns,
}: {
	columns: RetirementComparisonColumn[];
}) {
	return (
		<div className="overflow-x-auto rounded-lg border">
			<table className="w-full text-sm">
				<thead className="bg-muted/40 text-muted-foreground text-xs">
					<tr>
						<th className="px-3 py-2 text-left"> </th>
						{columns.map((column) => (
							<th
								className="px-3 py-2 text-right"
								key={column.scenarioId ?? "baseline"}
							>
								{column.name}
							</th>
						))}
					</tr>
				</thead>
				<tbody>
					<CompareRow
						columns={columns}
						label="Confidence"
						value={(column) =>
							column.confidence === null
								? "—"
								: formatPercent(column.confidence)
						}
					/>
					<CompareRow
						columns={columns}
						label="Safe spending"
						value={(column) =>
							formatMoney(column.summary.safeMonthlySpending ?? 0)
						}
					/>
					<CompareRow
						columns={columns}
						label="At retirement"
						value={(column) => formatMoney(column.summary.assetsAtRetirement)}
					/>
					<CompareRow
						columns={columns}
						label="Legacy"
						value={(column) => formatMoney(column.summary.legacyAtLongevity)}
					/>
					<CompareRow
						columns={columns}
						label="Runs out"
						value={(column) => (column.runsOut ? "Yes" : "No")}
					/>
				</tbody>
			</table>
		</div>
	);
}

function CompareRow({
	label,
	columns,
	value,
}: {
	label: string;
	columns: RetirementComparisonColumn[];
	value: (column: RetirementComparisonColumn) => string;
}) {
	return (
		<tr className="border-t">
			<td className="px-3 py-2">{label}</td>
			{columns.map((column) => (
				<td
					className="px-3 py-2 text-right"
					key={`${label}-${column.scenarioId ?? "baseline"}`}
				>
					{value(column)}
				</td>
			))}
		</tr>
	);
}
