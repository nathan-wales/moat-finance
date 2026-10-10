import type { RetirementProjectionYear } from "@moat/contracts";
import {
	SidePanel,
	SidePanelBody,
	SidePanelContent,
	SidePanelHeader,
	SidePanelTitle,
} from "@moat/ui";
import {
	formatAnnual,
	formatExactMonthly,
	formatMoney,
	formatMonthly,
	formatPercent,
	formatTodayDollarsLabel,
	shouldShowTodayDollars,
} from "../format";

export function YearInspector({
	year,
	onClose,
}: {
	year: RetirementProjectionYear | null;
	onClose: () => void;
}) {
	return (
		<SidePanel onOpenChange={(open) => !open && onClose()} open={year !== null}>
			<SidePanelContent>
				<SidePanelHeader>
					<SidePanelTitle>
						{year ? `Age ${year.age} · ${year.year}` : "Year"}
					</SidePanelTitle>
				</SidePanelHeader>
				<SidePanelBody>
					{year ? (
						<div className="space-y-3">
							{!year.isRetired ? (
								<p className="text-muted-foreground text-xs">
									Working years use take-home income minus spending. Housing,
									healthcare, and debt lines reallocate trailing Insights spend
									— they are not added on top. A leftover goes to planned 401(k)
									/ Roth / brokerage first, then savings at cash yield. A
									shortfall draws cash, then stocks, then deferred, then Roth.
									Taxes paid is estimated from projected income and brackets for
									this chart; it is not withdrawn again from take-home.
								</p>
							) : (
								<p className="text-muted-foreground text-xs">
									Survivor Social Security and pension reductions currently
									apply when a spouse dies. The plan does not yet model the
									primary&apos;s death, so a primary pension&apos;s survivor
									percentage has no effect until that is supported.
								</p>
							)}
							<dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
								<Row
									label="Gross income"
									value={formatAnnual(year.grossIncome)}
								/>
								<Row
									label="Employment"
									value={formatAnnual(year.employmentIncome)}
								/>
								<Row
									label="Social Security"
									value={formatAnnual(
										year.socialSecurityIncome + year.spouseSocialSecurityIncome,
									)}
								/>
								<Row
									label="Living expenses"
									value={formatAnnual(year.livingExpenses)}
								/>
								<Row
									label="Healthcare"
									value={formatAnnual(year.healthcareExpenses)}
								/>
								<Row
									label="Housing"
									value={formatAnnual(year.housingExpenses)}
								/>
								<Row
									label="Spendable income"
									value={formatAnnual(year.spendableIncome)}
								/>
								<Row
									label="Monthly cash flow"
									value={formatExactMonthly(year.cashFlowLeftover / 12)}
								/>
								{year.isRetired ? (
									<Row
										label="Monthly spendable"
										value={formatMonthly(year.spendableIncome / 12)}
									/>
								) : null}
								<Row label="Taxes paid" value={formatAnnual(year.taxesPaid)} />
								<Row
									label="Marginal rate"
									value={formatPercent(year.marginalRate, 1)}
								/>
								<Row
									label="Taxable withdrawals"
									value={formatAnnual(year.withdrawalsTaxable)}
								/>
								<Row
									label="Tax-deferred withdrawals"
									value={formatAnnual(year.withdrawalsTaxDeferred)}
								/>
								<Row
									label="Tax-free withdrawals"
									value={formatAnnual(year.withdrawalsTaxFree)}
								/>
								<Row
									label="RMD"
									value={formatAnnual(year.requiredMinimumDistribution)}
								/>
								<Row
									label="Taxable savings"
									value={formatAnnual(year.contributionsTaxable)}
								/>
								<Row
									label="Tax-deferred savings"
									value={formatAnnual(year.contributionsTaxDeferred)}
								/>
								<Row
									label="Tax-free savings"
									value={formatAnnual(year.contributionsTaxFree)}
								/>
								<Row
									label="Added to savings"
									value={formatAnnual(year.contributionsCash)}
								/>
								<Row label="Cash" value={formatMoney(year.cashBalance)} />
								<Row
									label="Liquid assets"
									value={formatMoney(year.liquidAssets)}
								/>
								{shouldShowTodayDollars(
									year.liquidAssets,
									year.liquidAssetsTodayDollars,
								) ? (
									<Row
										label="Liquid in today's $"
										value={formatTodayDollarsLabel(
											year.liquidAssetsTodayDollars,
										)}
									/>
								) : null}
								<Row
									label="Real estate equity"
									value={formatMoney(year.realEstateEquity)}
								/>
								<Row label="Net worth" value={formatMoney(year.netWorth)} />
								{shouldShowTodayDollars(
									year.netWorth,
									year.netWorthTodayDollars,
								) ? (
									<Row
										label="Net worth in today's $"
										value={formatTodayDollarsLabel(year.netWorthTodayDollars)}
									/>
								) : null}
								<Row label="Shortfall" value={formatAnnual(year.shortfall)} />
							</dl>
							{year.withdrawalsTaxFree > 0 && year.age < 65 ? (
								<p className="text-muted-foreground text-xs">
									Tax-free withdrawals before 65 can include HSA dollars. Those
									are treated like Roth here and are not limited to qualified
									medical expenses.
								</p>
							) : null}
						</div>
					) : null}
				</SidePanelBody>
			</SidePanelContent>
		</SidePanel>
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
