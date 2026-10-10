import type { FieldConfig } from "./components";

const US_STATES = [
	"Alabama",
	"Alaska",
	"Arizona",
	"Arkansas",
	"California",
	"Colorado",
	"Connecticut",
	"Delaware",
	"Florida",
	"Georgia",
	"Hawaii",
	"Idaho",
	"Illinois",
	"Indiana",
	"Iowa",
	"Kansas",
	"Kentucky",
	"Louisiana",
	"Maine",
	"Maryland",
	"Massachusetts",
	"Michigan",
	"Minnesota",
	"Mississippi",
	"Missouri",
	"Montana",
	"Nebraska",
	"Nevada",
	"New Hampshire",
	"New Jersey",
	"New Mexico",
	"New York",
	"North Carolina",
	"North Dakota",
	"Ohio",
	"Oklahoma",
	"Oregon",
	"Pennsylvania",
	"Rhode Island",
	"South Carolina",
	"South Dakota",
	"Tennessee",
	"Texas",
	"Utah",
	"Vermont",
	"Virginia",
	"Washington",
	"West Virginia",
	"Wisconsin",
	"Wyoming",
];

export const profileFields: FieldConfig[] = [
	{
		name: "householdType",
		label: "Household type",
		type: "select",
		options: ["Individual", "Couple", "Family"],
		helpText:
			"This describes who is included in the plan. Moat Finance uses it to frame taxes, dependents, insurance, and household-level assumptions.",
	},
	{
		name: "location",
		label: "State / country",
		type: "autocomplete",
		options: US_STATES,
		allowCreate: false,
		emptyMessage: "No matching states",
		helpText:
			"For now this is limited to US states. Moat Finance uses it for state tax defaults and location-sensitive planning assumptions.",
	},
	{
		name: "lifeStage",
		label: "Life stage",
		type: "select",
		options: ["Early career", "Family", "Pre-retirement", "Retired", "Other"],
		helpText:
			"Life stage helps Moat Finance choose relevant planning prompts, such as retirement, family protection, or early-career savings priorities.",
	},
	{
		name: "employmentType",
		label: "Employment type",
		type: "select",
		options: [
			"W-2",
			"Freelancer",
			"Business owner",
			"Retired",
			"Student",
			"Other",
		],
		helpText:
			"Employment type helps estimate income stability, tax complexity, and whether self-employment assumptions may apply.",
	},
	{
		name: "planningHorizon",
		label: "Planning horizon",
		type: "select",
		options: ["1 year", "5 years", "10 years", "20+ years"],
		helpText:
			"Planning horizon is the default time window Moat Finance uses when summarizing goals and tradeoffs.",
	},
	{
		name: "riskTolerance",
		label: "Risk tolerance",
		type: "select",
		options: ["Conservative", "Balanced", "Aggressive"],
		helpText:
			"Risk tolerance describes how comfortable you are with volatility and uncertainty. It influences investment and forecast defaults, not guarantees.",
	},
	{
		name: "dependentsCount",
		label: "Dependents count",
		type: "number",
		helpText:
			"An IRS dependent is a qualifying child or relative who meets relationship, age, residency, and support tests. They generally receive over half their support from you, cannot file a joint return, and are not you or your spouse.",
	},
	{
		name: "housingStatus",
		label: "Housing status",
		type: "select",
		options: ["Homeowner", "Renter", "Other"],
		helpText:
			"Housing status helps Moat Finance decide whether to prioritize rent, mortgage, property, insurance, or relocation assumptions.",
	},
];

export const accountTypeOptions = [
	"Checking",
	"Savings",
	"Credit Card",
	"Loan",
	"Mortgage",
	"Brokerage",
	"Investment",
	"Stocks",
	"Roth IRA",
	"IRA",
	"401(k)",
	"HSA",
	"529",
	"Other",
] as const;

const CASH_ACCOUNT_TYPE_LABELS = new Set([
	"checking",
	"savings",
	"depository",
	"cash",
	"money market",
	"cd",
	"hysa",
]);

export function isCashAccountType(type: string): boolean {
	const normalized = type.toLowerCase().trim();
	if (CASH_ACCOUNT_TYPE_LABELS.has(normalized)) return true;
	return (
		normalized.includes("checking") ||
		normalized.includes("savings") ||
		normalized.includes("money market")
	);
}

export const accountFields: FieldConfig[] = [
	{
		name: "type",
		label: "Type",
		type: "select",
		options: [...accountTypeOptions],
		helpText:
			"The account category, such as checking, savings, credit card, loan, brokerage, retirement, or 529.",
	},
	{
		name: "name",
		label: "Name",
		type: "text",
		helpText:
			"Use the account name you recognize, such as Main Checking or Visa.",
	},
	{
		name: "institution",
		label: "Institution",
		type: "text",
		placeholder: "Ex: Wells Fargo",
		helpText:
			"The bank, brokerage, lender, or manual source that holds the account.",
	},
	{
		name: "balance",
		label: "Balance",
		type: "number",
		helpText:
			"Use the current account balance. Debt balances should be entered as positive numbers here; Moat Finance handles linked liabilities separately.",
	},
	{
		name: "connectionStatus",
		label: "Status",
		type: "select",
		options: ["Manual", "Synced"],
		helpText:
			"Manual accounts were entered by you. Synced accounts come from a connected institution.",
	},
	{
		name: "lastSynced",
		label: "Last synced",
		type: "text",
		helpText:
			"The date this account balance was last refreshed or manually confirmed.",
	},
	{
		name: "includedInNetWorth",
		label: "Include in net worth",
		type: "checkbox",
		helpText: "Count this balance toward your total net worth.",
	},
];

export const incomeFields: FieldConfig[] = [
	{
		name: "name",
		label: "Name",
		type: "text",
		helpText:
			"A recognizable name for the income source, such as Salary or Consulting.",
	},
	{
		name: "type",
		label: "Type",
		type: "text",
		helpText:
			"The income category, such as W-2, freelance, rental, pension, or business income.",
	},
	{
		name: "amount",
		label: "Amount",
		type: "number",
		helpText:
			"The income amount for the selected frequency before forecast growth assumptions.",
	},
	{
		name: "frequency",
		label: "Frequency",
		type: "select",
		options: ["Monthly", "Annual", "Quarterly", "One-time"],
		helpText: "How often this income amount is received.",
	},
	{
		name: "growthAssumption",
		label: "Growth",
		type: "text",
		helpText:
			"A short note or rate describing how this income may change over time.",
	},
	{
		name: "startDate",
		label: "Start date",
		type: "text",
		placeholder: "YYYY-MM-DD",
		helpText: "The date this income should begin in planning and forecasts.",
	},
	{
		name: "endDate",
		label: "End date",
		type: "text",
		placeholder: "YYYY-MM-DD",
		helpText:
			"Optional date when this income should stop being included in forecasts.",
	},
	{
		name: "includeInForecast",
		label: "Include in forecast",
		type: "checkbox",
		helpText: "Use this income in future projections.",
	},
];

export const assetFields: FieldConfig[] = [
	{
		name: "name",
		label: "Name",
		type: "text",
		helpText:
			"A recognizable asset name, such as Home, Tesla, or Emergency cash.",
	},
	{
		name: "type",
		label: "Type",
		type: "select",
		options: [
			"Real estate",
			"Vehicle",
			"Boat",
			"Business",
			"Personal property",
			"Collectible",
			"Cash-like asset",
			"Other",
		],
		helpText:
			"The asset type helps Moat Finance decide whether to treat the item as property, a vehicle, cash-like value, or another asset class.",
	},
	{
		name: "estimatedValue",
		label: "Estimated value",
		type: "number",
		helpText: "Your best current estimate of what the asset is worth today.",
	},
	{
		name: "linkedLiability",
		label: "Linked liability",
		type: "autocomplete",
		emptyMessage: "No matching liabilities",
		helpText:
			"Connect debt tied to this asset, such as a mortgage on a property or a loan on a vehicle.",
	},
	{
		name: "linkedInsurance",
		label: "Linked insurance",
		type: "autocomplete",
		emptyMessage: "No matching policies",
		helpText:
			"Connect insurance that protects this asset, such as homeowners or auto coverage.",
	},
	{
		name: "includeInNetWorth",
		label: "Include in net worth",
		type: "checkbox",
		helpText: "Count this asset toward your total net worth.",
	},
	{
		name: "includeInForecast",
		label: "Include in forecast",
		type: "checkbox",
		helpText: "Include this asset in future financial projections.",
	},
];

export const otherAssetFields: FieldConfig[] = assetFields.map((field) => {
	if (field.name !== "type" || !Array.isArray(field.options)) {
		return field;
	}
	return {
		...field,
		options: field.options.filter((option) => option !== "Real estate"),
	};
});

export const liabilityFields: FieldConfig[] = [
	{
		name: "name",
		label: "Name",
		type: "text",
		helpText:
			"A recognizable debt name, such as Mortgage, Auto loan, or Visa balance.",
	},
	{
		name: "type",
		label: "Type",
		type: "select",
		options: [
			"Mortgage",
			"Auto loan",
			"Student loan",
			"Personal loan",
			"Credit card",
			"HELOC",
			"Other",
		],
		helpText:
			"The liability category used to filter linked assets and model payoff.",
	},
	{
		name: "balance",
		label: "Current Balance",
		type: "number",
		helpText: "The current amount owed on this liability.",
	},
	{
		name: "interestRate",
		label: "Interest Rate",
		type: "number",
		step: "0.1",
		helpText:
			"The annual interest rate for this debt, entered as a percentage.",
	},
	{
		name: "monthlyPayment",
		label: "Monthly Payment",
		type: "number",
		helpText:
			"The regular monthly payment used for payoff and cash-flow projections.",
	},
	{
		name: "loanStartDate",
		label: "Loan Start Date",
		type: "date",
		helpText:
			"When this loan originated. Used for remaining term and monthly balance updates.",
	},
	{
		name: "loanTermYears",
		label: "Loan Term",
		type: "number",
		step: "1",
		placeholder: "30",
		helpText:
			"Original loan term in years. Leave blank for revolving debt like credit cards.",
	},
	{
		name: "linkedAsset",
		label: "Linked Asset (optional)",
		type: "autocomplete",
		emptyMessage: "No matching assets",
		colSpan: "full",
		helpText:
			"Connect the asset this debt belongs to, such as a home or vehicle.",
	},
	{
		name: "includeInNetWorth",
		label: "Include in net worth",
		type: "checkbox",
		helpText: "Count this debt against your total net worth.",
	},
	{
		name: "includeInForecast",
		label: "Include in forecast",
		type: "checkbox",
		helpText: "Include this debt in payoff and forecast modeling.",
	},
	{
		name: "autoUpdateBalance",
		label: "Auto-update loan balance",
		type: "checkbox",
		helpText:
			"On the monthly anniversary, Moat applies interest and your payment to the remaining balance. Turn off to keep the balance fixed until you edit it.",
	},
];

export const investmentFields: FieldConfig[] = [
	{
		name: "name",
		label: "Name",
		type: "text",
		helpText:
			"A recognizable investment name, such as Roth IRA, 401(k), Brokerage, or HSA.",
	},
	{
		name: "type",
		label: "Type",
		type: "select",
		options: [
			"Stocks",
			"Roth IRA",
			"IRA",
			"401(k)",
			"HSA",
			"529",
			"Real Estate",
			"Brokerage",
			"Other",
		],
		helpText:
			"The investment category, such as brokerage, Roth IRA, IRA, 401(k), HSA, 529, or real estate.",
	},
	{
		name: "currentValue",
		label: "Current value",
		type: "number",
		helpText:
			"The current market value or account balance for this investment.",
	},
	{
		name: "monthlyContribution",
		label: "Monthly contribution",
		type: "number",
		helpText: "The amount you expect to add to this investment each month.",
	},
	{
		name: "expectedReturn",
		label: "Expected annual ROI",
		type: "number",
		step: "0.01",
		helpText:
			"The annual return or ROI assumption for forecasts, entered as a percentage.",
	},
	{
		name: "accountLink",
		label: "Account link",
		type: "text",
		helpText:
			"Optional link or note identifying the connected account behind this investment.",
	},
	{
		name: "includeInForecast",
		label: "Include in forecast",
		type: "checkbox",
		helpText: "Include this investment in future balance projections.",
	},
	{
		name: "notes",
		label: "Notes",
		type: "textarea",
		helpText: "Optional freeform notes about this investment.",
	},
];

export const insuranceFields: FieldConfig[] = [
	{
		name: "name",
		label: "Name",
		type: "text",
		helpText:
			"A recognizable policy name, such as Homeowners, Auto, or Term life.",
	},
	{
		name: "type",
		label: "Type",
		type: "select",
		options: [
			"Health",
			"Dental",
			"Vision",
			"Auto",
			"Home",
			"Renters",
			"Life",
			"Disability",
			"Umbrella",
			"Boat",
			"Other",
		],
		helpText: "The type of coverage provided by this policy.",
	},
	{
		name: "provider",
		label: "Provider",
		type: "text",
		helpText: "The insurer or company providing the policy.",
	},
	{
		name: "premium",
		label: "Premium",
		type: "number",
		helpText: "The amount you pay for this policy at the selected frequency.",
	},
	{
		name: "frequency",
		label: "Frequency",
		type: "select",
		options: ["Monthly", "Quarterly", "Semiannual", "Annual"],
		helpText: "How often the premium is paid.",
	},
	{
		name: "coverageAmount",
		label: "Coverage amount",
		type: "number",
		helpText:
			"The maximum or primary benefit amount covered by the policy, when applicable.",
	},
	{
		name: "linkedAsset",
		label: "Linked asset",
		type: "autocomplete",
		emptyMessage: "No matching assets",
		helpText:
			"Connect the asset protected by this policy, such as a home, car, or boat.",
	},
	{
		name: "renewalDate",
		label: "Renewal date",
		type: "text",
		placeholder: "YYYY-MM-DD",
		helpText: "The next date the policy renews or should be reviewed.",
	},
];

export const taxFields: FieldConfig[] = [
	{
		name: "filingStatus",
		label: "Filing status",
		type: "select",
		options: [
			"Single",
			"Married filing jointly",
			"Married filing separately",
			"Head of household",
		],
		helpText:
			"Your tax filing status affects deductions, brackets, and dependent-related assumptions.",
	},
	{
		name: "taxYear",
		label: "Tax year",
		type: "number",
		useGrouping: false,
		helpText: "The tax year these estimates are based on.",
	},
	{
		name: "estimatedFederalTaxBracket",
		label: "Federal bracket",
		type: "text",
		helpText:
			"Your estimated marginal federal income tax bracket, such as 22% or 24%.",
	},
	{
		name: "estimatedStateTaxRate",
		label: "State tax rate",
		type: "text",
		helpText: "Your estimated state income tax rate, if applicable.",
	},
	{
		name: "totalAnnualIncome",
		label: "Total annual income",
		type: "number",
		helpText: "Estimated gross annual income across all sources.",
	},
	{
		name: "taxableIncomeEstimate",
		label: "Taxable income estimate",
		type: "number",
		helpText:
			"Estimated income after deductions and adjustments that may be subject to income tax.",
	},
	{
		name: "deductionStrategy",
		label: "Deduction strategy",
		type: "select",
		options: ["Standard", "Itemized"],
		helpText:
			"Choose whether your plan assumes the standard deduction or itemized deductions.",
	},
	{
		name: "selfEmployedIncome",
		label: "Self-employed income",
		type: "checkbox",
		helpText:
			"You have 1099, freelance, business, or other self-employment income.",
	},
	{
		name: "rentalIncome",
		label: "Rental income",
		type: "checkbox",
		helpText:
			"Rental property income should be considered in tax and forecast context.",
	},
];

export const assumptionFields: FieldConfig[] = [
	{
		name: "inflationRate",
		label: "Inflation rate",
		type: "number",
		step: "0.1",
		helpText: "The annual inflation assumption used to grow future costs.",
	},
	{
		name: "incomeGrowthRate",
		label: "Income growth rate",
		type: "number",
		step: "0.1",
		helpText: "The annual default growth assumption for income forecasts.",
	},
	{
		name: "expenseGrowthRate",
		label: "Expense growth rate",
		type: "number",
		step: "0.1",
		helpText: "The annual default growth assumption for recurring expenses.",
	},
	{
		name: "investmentReturnRate",
		label: "Investment return rate",
		type: "number",
		step: "0.1",
		helpText:
			"The default annual return assumption for investments when no account-specific rate is set.",
	},
	{
		name: "realEstateAppreciationRate",
		label: "Real estate appreciation",
		type: "number",
		step: "0.1",
		helpText:
			"The default annual appreciation assumption for real estate values.",
	},
	{
		name: "defaultCashYield",
		label: "Default cash yield",
		type: "number",
		step: "0.1",
		helpText:
			"The assumed annual yield for cash-like balances when an account-specific rate is unavailable.",
	},
	{
		name: "retirementAge",
		label: "Retirement age",
		type: "number",
		helpText:
			"The age at which retirement-focused forecasts should assume work income changes or stops.",
	},
	{
		name: "forecastStyle",
		label: "Forecast style",
		type: "select",
		options: ["Conservative", "Balanced", "Aggressive"],
		helpText:
			"Drives Monte Carlo volatility even when investment return comes from a scenario (Conservative 8%, Balanced 13%, Aggressive 18%).",
	},
];

export const planningNoteFields: FieldConfig[] = [
	{
		name: "title",
		label: "Title",
		type: "text",
		helpText: "A short name for this planning note.",
	},
	{
		name: "tag",
		label: "Tags",
		type: "text",
		helpText:
			"Optional comma-separated categories that help group notes by topic (e.g. retirement, taxes).",
	},
	{
		name: "body",
		label: "Note",
		type: "textarea",
		helpText:
			"The detail Moat Finance should remember when giving guidance or summarizing tradeoffs.",
	},
];
