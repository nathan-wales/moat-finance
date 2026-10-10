import type { RetirementProjection } from "@moat/contracts";
import { Card, CardContent } from "@moat/ui";
import { formatMoney } from "../format";

export function SavingsPathTable({
	projection,
}: {
	projection?: RetirementProjection;
}) {
	if (!projection) return null;
	const workingYears = projection.years.filter((year) => !year.isRetired);
	if (workingYears.length === 0) return null;

	const sampled = workingYears.filter(
		(year, index) =>
			index === 0 || index === workingYears.length - 1 || year.age % 5 === 0,
	);
	const first = workingYears[0];
	if (!first) return null;

	const firstYearPlanned =
		first.contributionsTaxable +
		first.contributionsTaxDeferred +
		first.contributionsTaxFree;
	const firstYearResidual = first.contributionsCash;

	return (
		<Card>
			<CardContent className="space-y-3 p-4">
				<div>
					<p className="font-medium text-sm">Savings path</p>
					<p className="text-muted-foreground text-xs">
						Planned contributions are invested each year until retirement while
						take-home covers them. Leftover cash flow after those contributions
						stays in savings at cash yield. A shortfall draws cash then stocks —
						it is not a negative "Added to savings." This year's planned
						contributions are {formatMoney(firstYearPlanned)}; leftover added to
						savings is {formatMoney(firstYearResidual)}.
					</p>
				</div>
				<div className="overflow-x-auto">
					<table className="w-full text-sm">
						<thead className="text-muted-foreground text-xs">
							<tr>
								<th className="py-1 text-left">Age</th>
								<th className="py-1 text-right">Saved</th>
								<th className="py-1 text-right">Investable</th>
							</tr>
						</thead>
						<tbody>
							{sampled.map((year) => (
								<tr className="border-t" key={year.age}>
									<td className="py-1">{year.age}</td>
									<td className="py-1 text-right">
										{formatMoney(
											year.contributionsTaxable +
												year.contributionsTaxDeferred +
												year.contributionsTaxFree +
												year.contributionsCash,
										)}
									</td>
									<td className="py-1 text-right">
										{formatMoney(year.liquidAssets)}
									</td>
								</tr>
							))}
						</tbody>
					</table>
				</div>
			</CardContent>
		</Card>
	);
}
