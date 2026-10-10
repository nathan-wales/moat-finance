import type {
	RetirementPlanOverview,
	RetirementProjection,
} from "@moat/contracts";
import { Button, Card, CardContent } from "@moat/ui";
import { useMoatNavigation } from "../../navigation-context";
import { formatAge, formatExactMoney, formatPercent } from "../format";
import { followRetirementHref } from "../url-state";

export function PlanOverviewSection({
	overview,
	projection,
}: {
	overview?: RetirementPlanOverview;
	projection?: RetirementProjection;
}) {
	const nav = useMoatNavigation();
	const plan = overview?.plan;
	const milestones = projection?.milestones ?? [];
	const gaps =
		overview?.planConfidence?.signals.filter((signal) => !signal.satisfied) ??
		[];

	return (
		<div className="grid @md:grid-cols-2 grid-cols-1 gap-6">
			{plan && overview ? (
				<Card className="h-full min-w-0">
					<CardContent className="space-y-3 p-4">
						<div className="flex items-start justify-between gap-3">
							<div>
								<p className="font-medium text-sm">Plan settings</p>
								<p className="text-muted-foreground text-xs">
									Ages and assumptions the projection uses.
								</p>
							</div>
							<Button
								onClick={() => nav.setSearchParam("edit", "plan")}
								size="sm"
								variant="outline"
							>
								Edit
							</Button>
						</div>
						<dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
							<Row
								label="Retire at"
								value={formatAge(plan.targetRetirementAge)}
							/>
							<Row label="Longevity" value={formatAge(plan.longevityAge)} />
							<Row
								label="Social Security"
								value={`Age ${plan.socialSecurityClaimAge}`}
							/>
							<Row
								label="Your income"
								value={`${formatExactMoney(overview.baseline.annualEmploymentIncome)}/year · Insights`}
							/>
							{plan.hasSpouse ? (
								<Row
									label="Spouse income"
									value={`${formatExactMoney(overview.baseline.annualSpouseEmploymentIncome)}/year · Insights`}
								/>
							) : null}
							<Row
								label="Confidence target"
								value={formatPercent(plan.confidenceTarget)}
							/>
						</dl>
						{gaps.length > 0 ? (
							<div className="space-y-2 border-t pt-3">
								<p className="text-muted-foreground text-xs">Still needed</p>
								<ul className="space-y-1 text-sm">
									{gaps.map((signal) => (
										<li key={signal.id}>
											⚠ {signal.label}
											{signal.actionHref ? (
												<>
													{" * "}
													<Button
														className="h-auto p-0 text-blue-700"
														onClick={() =>
															followRetirementHref(
																nav,
																signal.actionHref ?? "/",
															)
														}
														size="sm"
														variant="link"
													>
														{signal.actionLabel}
													</Button>
												</>
											) : null}
										</li>
									))}
								</ul>
							</div>
						) : null}
					</CardContent>
				</Card>
			) : null}
			{milestones.length > 0 ? (
				<Card className="h-full min-w-0">
					<CardContent className="space-y-3 p-4">
						<p className="font-medium text-sm">Milestones</p>
						<ul className="space-y-1 text-sm">
							{milestones.map((milestone) => (
								<li
									className="flex justify-between gap-3"
									key={`${milestone.kind}-${milestone.age}`}
								>
									<span>{milestone.label}</span>
									<span className="text-muted-foreground">
										Age {milestone.age} · {milestone.year}
									</span>
								</li>
							))}
						</ul>
					</CardContent>
				</Card>
			) : null}
		</div>
	);
}

function Row({ label, value }: { label: string; value: string }) {
	return (
		<>
			<dt className="text-muted-foreground">{label}</dt>
			<dd className="text-right font-medium">{value}</dd>
		</>
	);
}
