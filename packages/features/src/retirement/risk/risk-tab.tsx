import { RetirementConeChart } from "@moat/charts";
import type { RetirementLeverInput } from "@moat/contracts";
import { Button, Card, CardContent } from "@moat/ui";
import { useEffect } from "react";
import { useMoatNavigation } from "../../navigation-context";
import { formatMoney, formatPercent, formatSignedPoints } from "../format";
import { useRetirementCapture } from "../retirement-analytics";
import { followRetirementHref } from "../url-state";
import {
	useRetirementMonteCarlo,
	useRetirementOverview,
	useRetirementStressTests,
} from "../use-retirement-queries";

export function RiskTab({
	levers,
	scenarioId,
}: {
	levers: RetirementLeverInput[];
	scenarioId: string | null;
}) {
	const nav = useMoatNavigation();
	const capture = useRetirementCapture();
	const overview = useRetirementOverview();
	const monteCarlo = useRetirementMonteCarlo(levers, scenarioId, {
		includeCone: true,
		includeSafeSpending: true,
	});
	const stress = useRetirementStressTests(
		levers,
		scenarioId,
		monteCarlo.isSuccess,
	);

	useEffect(() => {
		if (!monteCarlo.data) return;
		capture("retirement_monte_carlo_run", {
			trials: monteCarlo.data.trials,
			leverCount: levers.length,
		});
	}, [capture, levers.length, monteCarlo.data]);

	useEffect(() => {
		if (!stress.data) return;
		capture("retirement_stress_test_run", {
			testCount: stress.data.results.length,
		});
	}, [capture, stress.data]);

	return (
		<div className="space-y-4">
			<RetirementConeChart
				isLoading={monteCarlo.isLoading}
				points={monteCarlo.data?.cone ?? []}
			/>
			{monteCarlo.data ? (
				<div className="space-y-3">
					<div className="grid gap-3 sm:grid-cols-3">
						<Stat
							label={`Retirement confidence at age ${overview.data?.projection.summary.retirementAgeUsed ?? "target"}`}
							value={formatPercent(monteCarlo.data.confidence)}
						/>
						<Stat
							label="Median depletion"
							value={
								monteCarlo.data.medianDepletionAge === null
									? "Never"
									: `Age ${monteCarlo.data.medianDepletionAge}`
							}
						/>
						<Stat
							label="Safe monthly"
							value={
								monteCarlo.data.safeMonthlySpending === null
									? "—"
									: `$${Math.round(monteCarlo.data.safeMonthlySpending).toLocaleString()}`
							}
						/>
						<Stat
							label="Median legacy"
							value={formatMoney(monteCarlo.data.medianLegacy)}
						/>
						<Stat
							label="Worst-decile legacy"
							value={formatMoney(monteCarlo.data.worstDecileLegacy)}
						/>
					</div>
					<p className="text-muted-foreground text-sm">
						Out of {monteCarlo.data.trials.toLocaleString()} simulated market
						futures: {monteCarlo.data.fundedTrials.toLocaleString()} funded your
						complete plan
						{monteCarlo.data.depletedTrials > 0
							? `; ${monteCarlo.data.depletedTrials.toLocaleString()} exhausted liquid assets${monteCarlo.data.earliestDepletionAge !== null ? ` (earliest at age ${monteCarlo.data.earliestDepletionAge})` : ""}`
							: ""}
						.
					</p>
					<p className="text-muted-foreground text-xs">
						Each year draws an iid normal return around{" "}
						{overview.data?.projection.assumptions.investmentReturnRate !==
						undefined
							? formatPercent(
									overview.data.projection.assumptions.investmentReturnRate,
									1,
								)
							: "the scenario return"}{" "}
						with{" "}
						{overview.data?.projection.assumptions.volatility !== undefined
							? formatPercent(
									overview.data.projection.assumptions.volatility,
									0,
								)
							: "balanced"}{" "}
						volatility. Cash grows at the cash yield; homes are not randomized.
						Inflation stays deterministic in every trial.
					</p>
				</div>
			) : null}
			<div className="overflow-x-auto rounded-lg border">
				<table className="w-full text-sm">
					<thead className="bg-muted/40 text-muted-foreground text-xs">
						<tr>
							<th className="px-3 py-2 text-left">Stress test</th>
							<th className="px-3 py-2 text-right">Confidence</th>
							<th className="px-3 py-2 text-right">Change</th>
						</tr>
					</thead>
					<tbody>
						{(stress.data?.results ?? []).map((result) => (
							<tr className="border-t" key={result.id}>
								<td className="px-3 py-2">{result.label}</td>
								<td className="px-3 py-2 text-right">
									{formatPercent(result.confidence)}
								</td>
								<td className="px-3 py-2 text-right">
									{formatSignedPoints(result.confidenceDelta)}
								</td>
							</tr>
						))}
					</tbody>
				</table>
			</div>
			{stress.data?.biggestVulnerability ? (
				<Card>
					<CardContent className="space-y-2 p-4">
						<p className="font-medium text-sm">
							{stress.data.biggestVulnerability.label}
						</p>
						<p className="text-muted-foreground text-sm">
							{stress.data.biggestVulnerability.narrative}
						</p>
						{stress.data.biggestVulnerability.actionHref ? (
							<Button
								onClick={() =>
									followRetirementHref(
										nav,
										stress.data?.biggestVulnerability?.actionHref ?? "/",
									)
								}
								size="sm"
								variant="outline"
							>
								{stress.data.biggestVulnerability.actionLabel ?? "Review"}
							</Button>
						) : null}
					</CardContent>
				</Card>
			) : null}
		</div>
	);
}

function Stat({ label, value }: { label: string; value: string }) {
	return (
		<Card>
			<CardContent className="space-y-1 p-4">
				<p className="text-muted-foreground text-xs">{label}</p>
				<p className="font-semibold">{value}</p>
			</CardContent>
		</Card>
	);
}
