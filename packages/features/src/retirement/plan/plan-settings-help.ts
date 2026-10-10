import {
	getLatestOfficialHsaLimits,
	getLatestOfficialIraLimits,
	getLatestOfficialWorkplaceLimits,
	getTaxYear,
} from "@moat/domain/federal-rules";
import {
	ASSUMED_MEDICARE_MONTHLY_COST,
	CATCH_UP_AGE,
	DEFAULT_LONGEVITY_AGE,
	DEFAULT_TARGET_RETIREMENT_AGE,
	HEALTHCARE_INFLATION_PREMIUM,
	HSA_CATCH_UP_AGE,
	MEDICARE_AGE,
	PRE_MEDICARE_MONTHLY_PREMIUM,
	RMD_START_AGE,
	RMD_START_AGE_POST_1959,
	SOCIAL_SECURITY_DELAYED_CREDIT_PER_YEAR,
	SOCIAL_SECURITY_EARLIEST_CLAIM_AGE,
	SOCIAL_SECURITY_FRA,
	SOCIAL_SECURITY_LATEST_CLAIM_AGE,
} from "@moat/domain/retirement-constants";
import { formatExactMoney, formatPercent } from "../format";

function buildContributionHelp(taxYear: number) {
	const workplace = getLatestOfficialWorkplaceLimits();
	const ira = getLatestOfficialIraLimits();
	const hsa = getLatestOfficialHsaLimits();
	// UI cites the latest official year for each dataset — never an estimated
	// future year labeled as an IRS fact.
	const workplaceYear = String(workplace.taxYear);
	const iraYear = String(ira.taxYear);
	const hsaYear = String(hsa.taxYear);
	const employee401k = formatExactMoney(workplace.employeeDeferral);
	const employee401kWithCatchUp = formatExactMoney(
		workplace.employeeDeferral + workplace.catchUp,
	);
	const employeeCatchUp = formatExactMoney(workplace.catchUp);
	const iraLimit = formatExactMoney(ira.contribution);
	const iraWithCatchUp = formatExactMoney(ira.contribution + ira.catchUp);
	const iraCatchUp = formatExactMoney(ira.catchUp);
	const hsaSelf = formatExactMoney(hsa.selfOnly);
	const hsaFamily = formatExactMoney(hsa.family);
	const hsaCatchUp = formatExactMoney(hsa.catchUp);

	return {
		employerPlanMode: `How much you put in a workplace plan (401(k), 403(b), or 457). Choose a dollar amount, a percent of salary, or the IRS maximum each year. The ${workplaceYear} employee limit is ${employee401k} (${employee401kWithCatchUp} at age ${CATCH_UP_AGE}+). None means you aren't contributing through work.`,
		employerAnnualAmount: `How much you defer this year. The ${workplaceYear} employee limit is ${employee401k} (${employee401kWithCatchUp} at age ${CATCH_UP_AGE}+). A common target is 10–15% of pay, at least enough to get the full employer match.`,
		employerPercentOfSalary: `Share of gross pay you defer. 10–15% is a common target; 6% is often enough to capture a typical match. Capped at the ${workplaceYear} employee limit of ${employee401k} (${employee401kWithCatchUp} at ${CATCH_UP_AGE}+).`,
		iraMode: `Contributions to an IRA outside work. The ${iraYear} limit is ${iraLimit} (${iraWithCatchUp} at age ${CATCH_UP_AGE}+). Max allowed uses that limit each year. Roth IRAs phase out at higher incomes; Traditional IRAs have no contribution income cap, but deductibility may phase out if you have a workplace plan.`,
		iraAmount: `Dollars you contribute this year. The ${iraYear} limit is ${iraLimit} (${iraWithCatchUp} at age ${CATCH_UP_AGE}+).`,
		hsaMode: `A Health Savings Account (HSA) — contributions can be pre-tax or tax-deductible, growth is tax-free, and withdrawals for qualified medical expenses are tax-free. ${hsaYear} contribution limit: ${hsaSelf} self-only / ${hsaFamily} family, plus a ${hsaCatchUp} catch-up beginning at age ${HSA_CATCH_UP_AGE}. None if you aren't HSA-eligible.`,
		hsaEmployer: `Amount your employer deposits into the HSA. It counts toward the same IRS limit (${hsaSelf} self / ${hsaFamily} family). $0 if they don't contribute.`,
		catchUp: `Adds the extra IRS catch-up automatically once you hit the age. 401(k) and IRA catch-up starts at ${CATCH_UP_AGE} (${employeeCatchUp} / ${iraCatchUp} in ${workplaceYear}). HSA catch-up starts at ${HSA_CATCH_UP_AGE} (${hsaCatchUp}).`,
		_taxYear: taxYear,
	};
}

const contributionHelp = buildContributionHelp(getTaxYear());
const healthcareInflationPoints = formatPercent(
	HEALTHCARE_INFLATION_PREMIUM,
	0,
);
const delayedCredit = formatPercent(SOCIAL_SECURITY_DELAYED_CREDIT_PER_YEAR, 0);

export const PLAN_SETTINGS_HELP = {
	birthYear:
		"Used to compute your current age, when catch-up contributions start, Medicare, and required minimum distributions. RMDs begin at 73, or 75 if you were born in 1960 or later.",
	retirementAge: `The age work income stops and retirement withdrawals begin. ${DEFAULT_TARGET_RETIREMENT_AGE} is the most common planning default and when Medicare typically starts. Social Security can be claimed at a different age.`,
	longevityAge: `How long the plan should last. ${DEFAULT_LONGEVITY_AGE} is a common conservative default so the projection isn't cut short if you live longer than average.`,
	includeSpouse:
		"Adds a second person for Social Security, workplace savings, healthcare, and longevity. Leave off if you're planning as a single household.",
	spouseBirthYear:
		"Used for your spouse's age, catch-up eligibility, Medicare, and RMDs — same rules as your birth year.",
	spouseRetirementAge: `When your spouse stops working. ${DEFAULT_TARGET_RETIREMENT_AGE} is typical; it can differ from yours.`,
	spouseLongevityAge: `How long your spouse's benefits and spending should run. ${DEFAULT_LONGEVITY_AGE} is the usual conservative default.`,
	employmentIncome:
		"Your share of household take-home from work, as an annual amount. With a spouse, the two fields should sum to the Insights household figure above.",
	spouseEmploymentIncome:
		"Your spouse's share of household take-home from work, as an annual amount. It should sum with yours to the Insights household figure.",
	ssClaimAge: `Age you start Social Security. Earliest is ${SOCIAL_SECURITY_EARLIEST_CLAIM_AGE} (about 30% less than full retirement), full retirement age is usually ${SOCIAL_SECURITY_FRA}, and delaying to ${SOCIAL_SECURITY_LATEST_CLAIM_AGE} adds about ${delayedCredit} per year. ${SOCIAL_SECURITY_FRA} is a typical starting point.`,
	spouseSsClaimAge: `When your spouse starts Social Security. Same window: ${SOCIAL_SECURITY_EARLIEST_CLAIM_AGE} earliest, ${SOCIAL_SECURITY_FRA} full retirement, ${SOCIAL_SECURITY_LATEST_CLAIM_AGE} latest. ${SOCIAL_SECURITY_FRA} is a typical starting point.`,
	grossCompensation:
		"Your pre-tax annual pay, before 401(k) deferrals and taxes. Percent-of-salary contributions and employer match are calculated from this. If you don't have a W-2 figure, we estimate from take-home deposits — replace it with the salary on your offer letter or last pay stub × pay periods.",
	employerPlanMode: contributionHelp.employerPlanMode,
	employerAnnualAmount: contributionHelp.employerAnnualAmount,
	employerPercentOfSalary: contributionHelp.employerPercentOfSalary,
	rothShare:
		"Percent of your 401(k) deferral that goes Roth (after-tax now, tax-free later) instead of Traditional (pre-tax now, taxed later). 0% is all Traditional — the usual default. Roth and Traditional share the same employee limit.",
	matchFirst:
		"How much of your deferral the employer matches on the first 3% of pay. 100% (dollar-for-dollar) is the most common first tier. Check your plan documents — some match 50% of 6% instead.",
	matchNext:
		"The second match tier, on the next 2% of pay. 50% is typical. Together with 100% of the first 3%, that's a 4%-of-pay match — the most common US formula.",
	iraMode: contributionHelp.iraMode,
	iraKind:
		"Roth: after-tax now, tax-free later — usually better if you expect a higher tax rate in retirement. Traditional: deductible now, taxed later. Roth is a common default for younger savers.",
	iraAmount: contributionHelp.iraAmount,
	hsaMode: contributionHelp.hsaMode,
	hsaEmployer: contributionHelp.hsaEmployer,
	catchUp: contributionHelp.catchUp,
	spendPercent:
		"Share of today's spending you expect in retirement. 70–80% is a common rule of thumb; we default to 90% because commuting and work costs drop but healthcare often rises.",
	spendPhases:
		"Flat keeps spending level after inflation. Go-go / slow-go / no-go tapers: 100% in early retirement, about 85% in the middle, 75% later — the usual retirement smile.",
	preMedicare: `Marketplace or COBRA coverage from retirement until Medicare. About ${formatExactMoney(PRE_MEDICARE_MONTHLY_PREMIUM)}/month per adult is a typical premium.`,
	medicareAge: `Medicare eligibility is ${MEDICARE_AGE} for almost everyone. Change this only if you qualify earlier (disability) or later.`,
	medicareCost: `Part B + Part D + a Medigap or Medicare Advantage supplement. About ${formatExactMoney(ASSUMED_MEDICARE_MONTHLY_COST)}/month per adult is a typical all-in figure. Medicare is not free.`,
	healthcareInflation: `How much faster medical costs grow than general inflation. 1.5–2.5 extra points is typical; we default to ${healthcareInflationPoints} above CPI.`,
	hsaHealthcare:
		"Keeps HSA dollars earmarked for medical costs instead of treating them as general retirement savings. On is the usual default.",
	cashReserve:
		"Cash you keep on hand for surprises. 3–6 months of expenses is the standard range; 6 months is the default.",
	cashDestination:
		"Where leftover cash goes after the reserve is full. Keeping it as cash is conservative (today's behavior). Investing in taxable puts the excess to work.",
	rmdDestination: `Required minimum distributions start at ${RMD_START_AGE} (${RMD_START_AGE_POST_1959} if born in 1960 or later). Choose whether leftover RMD cash stays in cash or is invested in taxable. Keep as cash is the default.`,
	currentState:
		"Your state of residence for income tax. Used to pick a typical effective rate. Confirm even if we detected it from spending.",
	retirementState:
		"Where you expect to live after you stop working. Defaults to your current state. Moving to a no-income-tax state (FL, TX, NV, WA, and others) can change the projection a lot.",
	stateChangeAge:
		"Age the state change takes effect. Often the same as your retirement age.",
	rothConversion:
		"Moving Traditional IRA/401(k) dollars to Roth and paying tax now. None is the default. Filling the 12% or 22% bracket in the years between retirement and RMDs is the most common strategy.",
	rothAmount:
		"Fixed dollars converted each year. There is no IRS cap on conversions, but the amount is taxed as ordinary income that year.",
	rothBracket:
		"Converts just enough to fill this federal marginal bracket. 22% or 24% is typical for gap-year conversions.",
	rothFromAge: `When conversions start. A typical window is retirement through the year before RMDs (${RMD_START_AGE}).`,
	rothToAge: `Last age conversions run. A typical window ends the year before RMDs (${RMD_START_AGE}).`,
	targetEquity:
		"Share of the portfolio in stocks. A common rule of thumb is 110 minus your age (about 60% at 50). 60/40 is the classic balanced default.",
	glidePath:
		"Gradually reduces stock exposure from retirement to your planning horizon. Typical path: about 60% stocks at retirement, 40% at longevity.",
	equityAtRetirement:
		"Stock share on the day you retire. 50–70% is common; 60% is a typical default.",
	equityAtLongevity:
		"Stock share at the end of the plan. 30–50% is common; 40% is the default.",
	filingStatus:
		"How you file federal taxes. Shared with Financial Profile and the Taxes workspace — changing it here updates both. Married filing jointly is typical for couples and usually has the widest brackets and standard deduction.",
	stateRateOverride:
		"Optional override when you know your effective state rate. Leave blank to use the rate implied by the state picker. 0% in states with no income tax; 4–6% is a common blended rate elsewhere.",
	inflation:
		"Annual rise in living costs. 2–3% is the usual long-run US range; 3% is a common planning default.",
	incomeGrowth:
		"How fast employment income rises before retirement. Matching inflation (about 3%) is a typical default unless you expect promotions.",
	investmentReturn:
		"Default annual return when an account doesn't have its own rate. 7% is a common balanced-portfolio assumption (about 4% real after 3% inflation).",
	realEstateGrowth:
		"How fast property values grow. 3% (about inflation) is a typical long-run default.",
	cashYield:
		"Interest on cash-like balances. 4–5% is typical for high-yield savings in a normal rate environment; 4.5% is the default.",
	forecastStyle:
		"Drives Monte Carlo volatility even when the investment return comes from a scenario (Conservative 8%, Balanced 13%, Aggressive 18%). Balanced is the usual default.",
	monthlyContribution:
		"Extra you add to this account each month, on top of workplace-plan contributions in Savings. $0 if this account isn't being funded separately.",
	accountExpectedReturn:
		"This account's assumed annual return. 7% is typical for a diversified stock/bond mix; cash-like accounts should be closer to the cash yield.",
	propertyValue:
		"What the property would sell for today. Used for net worth and, if you sell later, the proceeds.",
	appreciationOverride:
		"Leave blank to use the household real estate growth rate (typically about 3%). Set this only when this property should grow faster or slower.",
	loanBalance:
		"Principal still owed. Payoff year is projected from this, the rate, and the payment.",
	mortgageRate:
		"Annual interest rate on the loan. 6–7% is typical for recent mortgages; older loans are often 3–4%.",
	loanTermYears:
		"Original length of the loan. 30 years is the standard US mortgage; 15 years is the common shorter option.",
	remainingMonths:
		"Months left until payoff at the current payment. Used instead of the original term when the loan is already underway.",
	mortgagePayment:
		"What you pay the lender each month (principal and interest). Property tax and insurance are separate if you itemize them.",
	monthlyRent:
		"Gross rent before vacancy. A common rule of thumb is about 0.6% of property value per month (roughly 7% annually).",
	vacancyRate:
		"Share of the year the unit sits empty. 5% (about 2–3 weeks) is a typical default.",
	rentalExpenses:
		"Operating costs: tax, insurance, maintenance, HOA, management. 30–50% of rent (or about 1–2% of value per year) is a common range.",
	debtRate:
		"Annual interest on this balance. Credit cards are often 18–25%; auto and personal loans 6–12%; student loans 4–8%.",
	debtPayment:
		"The payment that goes toward this balance each month. Extra principal is modeled as a larger payment here.",
	loanStart:
		"When the loan began (YYYY-MM-DD). Used with the term to estimate payoff if remaining months aren't set.",
	debtTerm:
		"Original length in years. Credit cards and personal loans are often 3–5 years; auto loans 5–7.",
	ruleLabel:
		"A name you'll recognize later, like 'CalPERS pension' or 'travel budget.'",
	pensionBenefit:
		"The monthly check at the start age, before any cost-of-living increase. Use the amount from your pension statement.",
	pensionStart:
		"When payments begin. 65 is typical; some public plans allow 55–62.",
	pensionCola:
		"Annual cost-of-living increase. Many private pensions have 0%; public plans often 1–3%. 2% is a common planning default if unknown.",
	pensionSurvivor:
		"Percent that continues to a spouse after death. 50% is the most common joint-and-survivor election.",
	annuityPayout: "Guaranteed monthly income once the annuity starts.",
	annuityStart: "When payouts begin. Often the same as your retirement age.",
	annuityPremium:
		"What you paid (or will pay) for the contract. Used for context; the projection is driven by the payout.",
	flowAmount:
		"Yearly amount in today's dollars. If it inflates, it grows with the plan's inflation rate.",
	flowFromAge:
		"Age this starts. For retirement-only items, use your retirement age.",
	flowToAge: "Last age it applies. Leave blank if it continues for life.",
} as const;

/** Build contribution-limit help for an explicit tax year (tests / future UI). */
export function planSettingsContributionHelp(taxYear: number) {
	return buildContributionHelp(taxYear);
}

export function employerAmountHelpText(
	mode: "none" | "fixedAnnual" | "percentOfSalary" | "maxAllowed",
): string {
	if (mode === "percentOfSalary") {
		return PLAN_SETTINGS_HELP.employerPercentOfSalary;
	}
	return PLAN_SETTINGS_HELP.employerAnnualAmount;
}
