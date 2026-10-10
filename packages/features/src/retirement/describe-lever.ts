import type { RetirementLever } from "@moat/contracts";
import { formatMoney, formatSignedMoney, formatYears } from "./format";
import { formatWithdrawalOrder } from "./retirement-copy";

const money = formatMoney;

function percent(rate: number): string {
	const scaled = rate * 100;
	return `${scaled.toFixed(scaled % 1 === 0 ? 0 : 1)}%`;
}

function plural(count: number, noun: string): string {
	if (noun === "year") return formatYears(count);
	return `${count} ${noun}${count === 1 ? "" : "s"}`;
}

function describeSpendingCategoryChange(
	params: Extract<
		RetirementLever,
		{ type: "spending_category_change" }
	>["params"],
): string {
	const kind =
		params.lineItemType === "expense"
			? "spending"
			: params.lineItemType === "income"
				? "income"
				: params.lineItemType === "savings"
					? "savings"
					: "debt";
	return `${params.label} ${kind} ${formatSignedMoney(params.monthlyDelta)}/mo`;
}

export function describeRetirementLever(lever: RetirementLever): string {
	switch (lever.type) {
		case "retire_earlier":
			return `Retire ${plural(lever.params.years, "year")} earlier`;
		case "retire_later":
			return `Retire ${plural(lever.params.years, "year")} later`;
		case "retire_at_age":
			return `Retire at ${lever.params.age}`;
		case "stop_working_at_age":
			return `Stop working at ${lever.params.age}`;
		case "part_time_before_retirement":
			return `Work part-time for ${money(lever.params.annualIncome)} a year from ${lever.params.fromAge} to ${lever.params.toAge}`;
		case "spouse_retire_at_age":
			return `Spouse retires at ${lever.params.age}`;
		case "spouse_stops_working":
			return `Spouse stops working at ${lever.params.atAge}`;
		case "income_change": {
			const who = lever.params.whom === "spouse" ? "Spouse income" : "Income";
			if (lever.params.percentDelta !== undefined) {
				return `${who} changes by ${percent(lever.params.percentDelta)}`;
			}
			return `${who} changes by ${money(lever.params.annualDelta ?? 0)} a year`;
		}
		case "job_loss":
			return `Lose job at ${lever.params.atAge} for ${plural(lever.params.monthsOut, "month")}`;
		case "career_break":
			return `Career break from ${lever.params.fromAge} to ${lever.params.toAge}`;
		case "annual_bonus":
			return `${money(lever.params.amount)} annual bonus`;
		case "side_business_income":
			return `${money(lever.params.annualAmount)} a year of side income`;
		case "rental_income_change":
			return `Rental income changes by ${money(lever.params.monthlyAmount)} a month`;
		case "contribution_change":
			return `Contributions change by ${money(lever.params.monthlyDelta)} a month`;
		case "max_401k":
			return "Max the 401(k)";
		case "max_roth_ira":
			return "Max the Roth IRA";
		case "max_spousal_iras":
			return "Max both IRAs";
		case "employer_match":
			return `Employer matches ${percent(lever.params.matchPercent)} up to ${percent(lever.params.upToPercentOfSalary)} of pay`;
		case "max_hsa":
			return `Max the HSA (${lever.params.coverageType})`;
		case "taxable_investing":
			return `Invest ${money(lever.params.monthlyAmount)} a month in a brokerage`;
		case "stop_contributions_at_age":
			return `Stop contributing at ${lever.params.age}`;
		case "retirement_spending_change":
			return `Retirement spending changes by ${money(lever.params.monthlyDelta)} a month`;
		case "retirement_spending_set":
			return `Spend ${money(lever.params.monthlyAmount)} a month in retirement`;
		case "retirement_spending_stages":
			return `Staged retirement spending (${plural(lever.params.stages.length, "stage")})`;
		case "spending_category_change":
			return describeSpendingCategoryChange(lever.params);
		case "return_rate_delta":
			return `Returns ${lever.params.delta >= 0 ? "up" : "down"} ${percent(Math.abs(lever.params.delta))}`;
		case "return_rate_set":
			return `Expect ${percent(lever.params.rate)} returns`;
		case "inflation_delta":
			return `Inflation ${lever.params.delta >= 0 ? "up" : "down"} ${percent(Math.abs(lever.params.delta))}`;
		case "portfolio_shift":
			return `Shift to a ${lever.params.target} portfolio`;
		case "market_crash":
			return `${percent(lever.params.dropPercent)} market drop at ${lever.params.atAge}`;
		case "sequence_risk":
			return `${percent(lever.params.annualReturn)} returns for the first ${plural(lever.params.years, "year")} of retirement`;
		case "social_security_claim_age":
			return `Claim Social Security at ${lever.params.age}`;
		case "spouse_social_security_claim_age":
			return `Spouse claims Social Security at ${lever.params.age}`;
		case "social_security_haircut":
			return `Social Security cut by ${percent(lever.params.percent)}`;
		case "mortgage_payoff_early":
			return lever.params.atAge !== undefined
				? `Pay the mortgage off by ${lever.params.atAge}`
				: `Pay ${money(lever.params.extraMonthlyPayment ?? 0)} extra on the mortgage`;
		case "mortgage_extra_payment":
			return `Pay ${money(lever.params.monthlyAmount)} extra on the mortgage`;
		case "mortgage_payoff_cancel":
			return "Stop paying the mortgage down early";
		case "buy_home":
			return `Buy a ${money(lever.params.price)} home at ${lever.params.atAge}`;
		case "upsize_home":
			return `Upsize by ${money(lever.params.priceDelta)} at ${lever.params.atAge}`;
		case "downsize_home":
			return `Downsize to ${money(lever.params.newHomePrice)} at ${lever.params.atAge}`;
		case "sell_primary_home":
			return `Sell the home at ${lever.params.atAge}`;
		case "rent_instead":
			return `Rent for ${money(lever.params.monthlyRent)} a month from ${lever.params.fromAge}`;
		case "add_rental_property":
			return `Buy a ${money(lever.params.price)} rental at ${lever.params.atAge}`;
		case "sell_rental_property":
			return `Sell a rental at ${lever.params.atAge}`;
		case "move_state":
			return `Move to ${lever.params.stateCode.toUpperCase()} at ${lever.params.atAge}`;
		case "add_dependent":
			return `Support a dependent for ${plural(lever.params.years, "year")} from ${lever.params.atAge}`;
		case "fund_college":
			return `Fund ${plural(lever.params.years, "year")} of college from ${lever.params.startAge}`;
		case "charitable_gift":
			return `Give ${money(lever.params.amount)} at ${lever.params.atAge}`;
		case "recurring_purchase":
			return `${lever.params.label} every ${plural(lever.params.everyNYears, "year")}`;
		case "healthcare_cost_delta":
			return lever.params.percentDelta !== undefined
				? `Healthcare costs change ${percent(lever.params.percentDelta)}`
				: `Healthcare costs change ${money(lever.params.monthlyDelta ?? 0)} a month`;
		case "pre_medicare_coverage":
			return `${money(lever.params.monthlyPremium)} a month of coverage from ${lever.params.fromAge} to ${lever.params.toAge}`;
		case "long_term_care_event":
			return `${plural(lever.params.years, "year")} of long-term care at ${lever.params.atAge}`;
		case "life_insurance_change":
			return lever.params.remove
				? "Drop life insurance"
				: `Life insurance of ${money(lever.params.deathBenefit ?? 0)}`;
		case "policy_expires":
			return `Policy expires at ${lever.params.atAge}`;
		case "ltc_policy_change":
			return lever.params.remove
				? "Drop the long-term care policy"
				: `Long-term care policy paying ${money(lever.params.monthlyBenefit ?? 0)} a month`;
		case "annuity_begins":
			return `Annuity paying ${money(lever.params.monthlyPayout)} a month from ${lever.params.atAge}`;
		case "disability_event":
			return `Disability at ${lever.params.atAge} for ${plural(lever.params.durationYears, "year")}`;
		case "spouse_death":
			return `Spouse passes at ${lever.params.atAge}`;
		case "roth_conversion":
			return `Roth conversions from ${lever.params.fromAge} to ${lever.params.toAge}`;
		case "withdrawal_order":
			return `Withdraw in order: ${formatWithdrawalOrder(lever.params.order)}`;
		case "custom_income":
		case "custom_expense":
		case "custom_one_time":
			return lever.params.label;
	}
}
