import {
	Badge,
	Card,
	CardContent,
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@moat/ui";
import { formatMonthly } from "../format";
import { useRetirementCapture } from "../retirement-analytics";
import {
	useRetirementMutations,
	useRetirementSpendingPlan,
} from "../use-retirement-queries";

export function SpendingTab() {
	const { data } = useRetirementSpendingPlan();
	const { updateSpending } = useRetirementMutations();
	const capture = useRetirementCapture();

	if (!data) return null;

	return (
		<div className="space-y-4">
			<Card>
				<CardContent className="grid gap-3 p-4 sm:grid-cols-3">
					<div>
						<p className="text-muted-foreground text-xs">Current monthly</p>
						<p className="font-semibold">
							{formatMonthly(data.currentMonthlySpending)}
						</p>
					</div>
					<div>
						<p className="text-muted-foreground text-xs">Retirement monthly</p>
						<p className="font-semibold">
							{formatMonthly(data.estimatedRetirementMonthly)}
						</p>
					</div>
					<div>
						<p className="text-muted-foreground text-xs">Essential share</p>
						<p className="font-semibold">
							{Math.round(
								(data.categories
									.filter((row) => row.essentiality === "essential")
									.reduce((sum, row) => sum + row.retirementMonthlyAmount, 0) /
									Math.max(1, data.estimatedRetirementMonthly)) *
									100,
							)}
							%
						</p>
					</div>
				</CardContent>
			</Card>
			<div className="overflow-x-auto rounded-lg border">
				<table className="w-full text-sm">
					<thead className="bg-muted/40 text-muted-foreground text-xs">
						<tr>
							<th className="px-3 py-2 text-left">Category</th>
							<th className="px-3 py-2 text-right">Today</th>
							<th className="px-3 py-2 text-right">Retirement</th>
							<th className="px-3 py-2 text-left">Treatment</th>
							<th className="px-3 py-2 text-left">Need</th>
						</tr>
					</thead>
					<tbody>
						{data.categories.map((row) => (
							<tr className="border-t" key={row.categoryId}>
								<td className="px-3 py-2">
									{row.categoryName}
									{row.isUserEdited ? (
										<Badge className="ml-2" variant="outline">
											Edited
										</Badge>
									) : null}
								</td>
								<td className="px-3 py-2 text-right">
									{formatMonthly(row.currentMonthlyAmount)}
								</td>
								<td className="px-3 py-2 text-right">
									{formatMonthly(row.retirementMonthlyAmount)}
								</td>
								<td className="px-3 py-2">
									<Select
										onValueChange={(treatment) => {
											updateSpending.mutate({
												categories: [
													{
														categoryId: row.categoryId,
														treatment: treatment as typeof row.treatment,
													},
												],
											});
											capture("retirement_spending_plan_edited", {
												field: "treatment",
											});
										}}
										value={row.treatment}
									>
										<SelectTrigger className="h-8 w-32">
											<SelectValue />
										</SelectTrigger>
										<SelectContent>
											<SelectItem value="remains">Remains</SelectItem>
											<SelectItem value="disappears">Disappears</SelectItem>
											<SelectItem value="changes">Changes</SelectItem>
										</SelectContent>
									</Select>
								</td>
								<td className="px-3 py-2">
									<Select
										onValueChange={(essentiality) => {
											updateSpending.mutate({
												categories: [
													{
														categoryId: row.categoryId,
														essentiality:
															essentiality as typeof row.essentiality,
													},
												],
											});
											capture("retirement_spending_plan_edited", {
												field: "essentiality",
											});
										}}
										value={row.essentiality}
									>
										<SelectTrigger className="h-8 w-28">
											<SelectValue />
										</SelectTrigger>
										<SelectContent>
											<SelectItem value="essential">Essential</SelectItem>
											<SelectItem value="flexible">Flexible</SelectItem>
										</SelectContent>
									</Select>
								</td>
							</tr>
						))}
					</tbody>
				</table>
			</div>
		</div>
	);
}
