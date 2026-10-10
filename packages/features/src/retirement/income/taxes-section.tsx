import {
	type RetirementProjection,
	TAXES_PRODUCT_ENABLED,
} from "@moat/contracts";
import { findRothConversionWindow } from "@moat/domain/retirement-taxes";
import { Button, Card, CardContent } from "@moat/ui";
import { useMemo } from "react";
import { useMoatNavigation } from "../../navigation-context";
import { formatMoney, formatPercent } from "../format";

export function TaxesSection({
	projection,
}: {
	projection?: RetirementProjection;
}) {
	const retiredYears = projection?.years.filter((year) => year.isRetired) ?? [];
	const window = useMemo(
		() =>
			projection
				? findRothConversionWindow({
						years: projection.years,
						rmdStartAge: projection.assumptions.rmdStartAge,
					})
				: null,
		[projection],
	);

	const nav = useMoatNavigation();
	const thisYearTaxesButton = TAXES_PRODUCT_ENABLED ? (
		<Button onClick={() => nav.push("/taxes")} size="sm" variant="outline">
			This year's taxes
		</Button>
	) : null;
	const planningTaxesCopy = TAXES_PRODUCT_ENABLED
		? "Estimated from projected income and brackets across the plan, including working years. Working-year tax is not taken again out of take-home. Filing status and rates come from Financial Profile — the same seed Taxes uses for this year's documents."
		: "Estimated from projected income and brackets across the plan, including working years. Working-year tax is not taken again out of take-home. Filing status and rates come from Financial Profile.";

	if (!projection) return null;

	return (
		<div className="space-y-4">
			<Card>
				<CardContent className="space-y-3 p-4">
					<div className="space-y-1">
						<p className="text-muted-foreground text-xs">Lifetime taxes</p>
						<p className="font-semibold">
							{formatMoney(projection.summary.lifetimeTaxes)}
						</p>
						<p className="text-muted-foreground text-xs leading-snug">
							{planningTaxesCopy}
						</p>
					</div>
					<div className="flex flex-wrap gap-2">
						{thisYearTaxesButton}
						<Button
							onClick={() => nav.push("/financial-profile?highlight=taxes")}
							size="sm"
							variant="ghost"
						>
							Edit planning taxes
						</Button>
					</div>
				</CardContent>
			</Card>
			{window ? (
				<Card>
					<CardContent className="space-y-1 p-4">
						<p className="font-medium text-sm">
							Potential Roth conversion window
						</p>
						<p className="text-muted-foreground text-sm">
							Ages {window.fromAge} – {window.toAge}. You're projected to be in
							the {formatPercent(window.lowBracket, 0)} bracket for{" "}
							{window.toAge - window.fromAge + 1} years between retirement and
							RMDs, below the {formatPercent(window.postRmdBracket, 0)} post-RMD
							rate. Converting up to the top of that bracket could reduce
							lifetime taxes.
						</p>
					</CardContent>
				</Card>
			) : null}
			<div className="overflow-x-auto rounded-lg border">
				<table className="w-full text-sm">
					<thead className="bg-muted/40 text-muted-foreground text-xs">
						<tr>
							<th className="px-3 py-2 text-left">Age</th>
							<th className="px-3 py-2 text-right">Income</th>
							<th className="px-3 py-2 text-right">Tax</th>
							<th className="px-3 py-2 text-right">Marginal</th>
						</tr>
					</thead>
					<tbody>
						{retiredYears.slice(0, 20).map((entry) => (
							<tr className="border-t" key={entry.age}>
								<td className="px-3 py-2">{entry.age}</td>
								<td className="px-3 py-2 text-right">
									{formatMoney(entry.grossIncome)}
								</td>
								<td className="px-3 py-2 text-right">
									{formatMoney(entry.taxesPaid)}
								</td>
								<td className="px-3 py-2 text-right">
									{formatPercent(entry.marginalRate, 0)}
								</td>
							</tr>
						))}
					</tbody>
				</table>
			</div>
		</div>
	);
}
