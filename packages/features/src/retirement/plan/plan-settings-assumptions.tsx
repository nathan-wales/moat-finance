import type { AllocationPolicy, CashPolicy, TaxPolicy } from "@moat/contracts";
import {
	Accordion,
	AccordionContent,
	AccordionItem,
	AccordionTrigger,
} from "@moat/ui";
import { CreditCard, Home, Landmark, Percent, TrendingUp } from "lucide-react";
import {
	assumptionFields,
	taxFields,
} from "../../financial-profile/field-options";
import { formatExactMoney } from "../format";
import { EmptyHint } from "./plan-settings/empty-hint";
import {
	AllocationPolicyFields,
	CashPolicyFields,
	RothAndStateFields,
} from "./plan-settings/tax-cash-fields";
import {
	type DebtDraft,
	FILING_STATUS_OPTIONS,
	FORECAST_STYLE_OPTIONS,
	filingStatusValue,
	forecastStyleValue,
	type GrowthRatesForm,
	type InvestmentDraft,
	isRentalUsage,
	type PropertyDraft,
	type TaxDraft,
} from "./plan-settings-drafts";
import {
	NumberField,
	PlanSettingsSection,
	SelectField,
} from "./plan-settings-fields";
import { PLAN_SETTINGS_HELP } from "./plan-settings-help";

function fieldCopy(
	fields: Array<{ name: string; label: string; helpText?: string }>,
	name: string,
): { label: string; helpText?: string } {
	const field = fields.find((entry) => entry.name === name);
	return {
		helpText: field?.helpText,
		label: field?.label ?? name,
	};
}

export function PlanSettingsAssumptions({
	allocationPolicy,
	cashPolicy,
	debts,
	growth,
	onFinancialProfile,
	onPatchAllocation,
	onPatchCash,
	onPatchDebt,
	onPatchGrowth,
	onPatchInvestment,
	onPatchProperty,
	onPatchTax,
	onPatchTaxPolicy,
	investments,
	properties,
	scenarioName,
	tax,
	taxPolicy,
}: {
	growth: GrowthRatesForm;
	onPatchGrowth: (patch: Partial<GrowthRatesForm>) => void;
	scenarioName: string | null;
	investments: InvestmentDraft[];
	onPatchInvestment: (id: string, patch: Partial<InvestmentDraft>) => void;
	properties: PropertyDraft[];
	onPatchProperty: (id: string, patch: Partial<PropertyDraft>) => void;
	debts: DebtDraft[];
	onPatchDebt: (id: string, patch: Partial<DebtDraft>) => void;
	tax: TaxDraft;
	onPatchTax: (patch: Partial<TaxDraft>) => void;
	taxPolicy: TaxPolicy;
	onPatchTaxPolicy: (policy: TaxPolicy) => void;
	allocationPolicy: AllocationPolicy;
	onPatchAllocation: (policy: AllocationPolicy) => void;
	cashPolicy: CashPolicy;
	onPatchCash: (policy: CashPolicy) => void;
	onFinancialProfile: () => void;
}) {
	const inflation = fieldCopy(assumptionFields, "inflationRate");
	const income = fieldCopy(assumptionFields, "incomeGrowthRate");
	const investment = fieldCopy(assumptionFields, "investmentReturnRate");
	const cash = fieldCopy(assumptionFields, "defaultCashYield");
	const style = fieldCopy(assumptionFields, "forecastStyle");
	const filing = fieldCopy(taxFields, "filingStatus");

	return (
		<>
			<PlanSettingsSection
				icon={Landmark}
				title={
					<>
						Investments & cash
						{investments.length > 0 ? (
							<span className="ml-2 font-normal text-muted-foreground">
								({investments.length})
							</span>
						) : null}
					</>
				}
				value="investments"
			>
				{investments.length === 0 ? (
					<EmptyHint
						actionLabel="Financial Profile"
						onAction={onFinancialProfile}
					>
						No investment accounts yet. Add one in
					</EmptyHint>
				) : (
					<Accordion className="flex w-full flex-col gap-2" type="multiple">
						{investments.map((account) => (
							<InvestmentCard
								investment={account}
								key={account.id}
								onPatch={(patch) => onPatchInvestment(account.id, patch)}
							/>
						))}
					</Accordion>
				)}
				<div className="space-y-4 pt-2">
					<div>
						<p className="mb-3 font-medium text-sm">Cash reserve</p>
						<CashPolicyFields onChange={onPatchCash} policy={cashPolicy} />
					</div>
					<div>
						<p className="mb-3 font-medium text-sm">Allocation</p>
						<AllocationPolicyFields
							onChange={onPatchAllocation}
							policy={allocationPolicy}
						/>
					</div>
				</div>
			</PlanSettingsSection>

			<PlanSettingsSection
				icon={Home}
				title={
					<>
						Properties & mortgages
						{properties.length > 0 ? (
							<span className="ml-2 font-normal text-muted-foreground">
								({properties.length})
							</span>
						) : null}
					</>
				}
				value="properties"
			>
				{properties.length === 0 ? (
					<EmptyHint
						actionLabel="Financial Profile"
						onAction={onFinancialProfile}
					>
						No properties yet. Add one in
					</EmptyHint>
				) : (
					<Accordion className="flex w-full flex-col gap-2" type="multiple">
						{properties.map((property) => (
							<PropertyCard
								key={property.id}
								onPatch={(patch) => onPatchProperty(property.id, patch)}
								property={property}
							/>
						))}
					</Accordion>
				)}
			</PlanSettingsSection>

			<PlanSettingsSection
				icon={CreditCard}
				title={
					<>
						Debts
						{debts.length > 0 ? (
							<span className="ml-2 font-normal text-muted-foreground">
								({debts.length})
							</span>
						) : null}
					</>
				}
				value="debts"
			>
				{debts.length === 0 ? (
					<p className="text-muted-foreground text-xs">
						No other debts in this projection.
					</p>
				) : (
					<Accordion className="flex w-full flex-col gap-2" type="multiple">
						{debts.map((debt) => (
							<DebtCard
								debt={debt}
								key={debt.id}
								onPatch={(patch) => onPatchDebt(debt.id, patch)}
							/>
						))}
					</Accordion>
				)}
			</PlanSettingsSection>

			<PlanSettingsSection
				icon={Percent}
				title="Taxes & withdrawal strategy"
				value="taxes"
			>
				<div className="grid gap-4 sm:grid-cols-2">
					<SelectField
						helpText={PLAN_SETTINGS_HELP.filingStatus}
						id="plan-filing-status"
						label={filing.label}
						onChange={(value) =>
							onPatchTax({ filingStatus: filingStatusValue(value) })
						}
						options={FILING_STATUS_OPTIONS}
						value={tax.filingStatus}
					/>
					<NumberField
						helpText={PLAN_SETTINGS_HELP.stateRateOverride}
						id="plan-state-tax"
						label="Effective rate override"
						onChange={(estimatedStateTaxRate) =>
							onPatchTax({ estimatedStateTaxRate })
						}
						percent
						placeholder="5"
						value={tax.estimatedStateTaxRate}
					/>
				</div>
				<RothAndStateFields onChange={onPatchTaxPolicy} policy={taxPolicy} />
			</PlanSettingsSection>

			<PlanSettingsSection
				icon={TrendingUp}
				title="Planning assumptions"
				value="growth"
			>
				<div className="grid gap-4 sm:grid-cols-2">
					<NumberField
						helpText={PLAN_SETTINGS_HELP.inflation}
						id="plan-inflation"
						label={inflation.label}
						onChange={(inflationRate) => onPatchGrowth({ inflationRate })}
						percent
						placeholder="3"
						value={growth.inflationRate}
					/>
					<NumberField
						helpText={PLAN_SETTINGS_HELP.incomeGrowth}
						id="plan-income-growth"
						label={income.label}
						onChange={(incomeGrowthRate) => onPatchGrowth({ incomeGrowthRate })}
						percent
						placeholder="3"
						value={growth.incomeGrowthRate}
					/>
					<NumberField
						helpText={PLAN_SETTINGS_HELP.investmentReturn}
						id="plan-investment-return"
						label={investment.label}
						onChange={(investmentReturnRate) =>
							onPatchGrowth({ investmentReturnRate })
						}
						percent
						placeholder="7"
						value={growth.investmentReturnRate}
					/>
					<NumberField
						helpText={PLAN_SETTINGS_HELP.realEstateGrowth}
						id="plan-re-growth"
						label="Real estate growth"
						onChange={(realEstateAppreciationRate) =>
							onPatchGrowth({ realEstateAppreciationRate })
						}
						percent
						placeholder="3"
						value={growth.realEstateAppreciationRate}
					/>
					<NumberField
						helpText={PLAN_SETTINGS_HELP.cashYield}
						id="plan-cash-yield"
						label={cash.label}
						onChange={(defaultCashYield) => onPatchGrowth({ defaultCashYield })}
						percent
						placeholder="4.5"
						value={growth.defaultCashYield}
					/>
					<SelectField
						helpText={PLAN_SETTINGS_HELP.forecastStyle}
						id="plan-forecast-style"
						label={style.label}
						onChange={(value) =>
							onPatchGrowth({ forecastStyle: forecastStyleValue(value) })
						}
						options={FORECAST_STYLE_OPTIONS}
						value={growth.forecastStyle}
					/>
				</div>
				{scenarioName ? (
					<p className="text-muted-foreground text-xs">
						Using {scenarioName} scenario rates
					</p>
				) : null}
			</PlanSettingsSection>
		</>
	);
}

function InvestmentCard({
	investment,
	onPatch,
}: {
	investment: InvestmentDraft;
	onPatch: (patch: Partial<InvestmentDraft>) => void;
}) {
	const value = Number(investment.currentValue.replace(/,/g, "")) || 0;
	const contribution =
		Number(investment.monthlyContribution.replace(/,/g, "")) || 0;
	return (
		<AccordionItem
			className="overflow-hidden rounded-lg border px-3 last:border-b"
			value={investment.id}
		>
			<AccordionTrigger className="py-3 hover:no-underline">
				<span className="flex min-w-0 flex-1 items-baseline justify-between gap-2 pr-2">
					<span className="truncate font-medium">{investment.name}</span>
					<span className="shrink-0 text-muted-foreground text-xs">
						{formatExactMoney(value)}
						{contribution > 0 ? ` · ${formatExactMoney(contribution)}/mo` : ""}
					</span>
				</span>
			</AccordionTrigger>
			<AccordionContent>
				<div className="grid gap-4 sm:grid-cols-2">
					<NumberField
						helpText={PLAN_SETTINGS_HELP.monthlyContribution}
						id={`investment-${investment.id}-contribution`}
						label="Monthly contribution"
						money
						onChange={(monthlyContribution) => onPatch({ monthlyContribution })}
						value={investment.monthlyContribution}
					/>
					<NumberField
						helpText={PLAN_SETTINGS_HELP.accountExpectedReturn}
						id={`investment-${investment.id}-return`}
						label="Expected annual return"
						onChange={(expectedReturn) => onPatch({ expectedReturn })}
						percent
						placeholder="7"
						value={investment.expectedReturn}
					/>
				</div>
			</AccordionContent>
		</AccordionItem>
	);
}

function PropertyCard({
	onPatch,
	property,
}: {
	property: PropertyDraft;
	onPatch: (patch: Partial<PropertyDraft>) => void;
}) {
	const value = Number(property.currentEstimatedValue.replace(/,/g, "")) || 0;
	const balance = Number(property.currentLoanBalance.replace(/,/g, "")) || 0;
	const showLoan = balance > 0 || property.linkedPlaidAccountId != null;
	const showRental = isRentalUsage(property.usageType);

	return (
		<AccordionItem
			className="overflow-hidden rounded-lg border px-3 last:border-b"
			value={property.id}
		>
			<AccordionTrigger className="py-3 hover:no-underline">
				<span className="flex min-w-0 flex-1 items-baseline justify-between gap-2 pr-2">
					<span className="truncate font-medium">{property.name}</span>
					<span className="shrink-0 text-muted-foreground text-xs">
						{formatExactMoney(value)}
						{balance > 0 ? ` · ${formatExactMoney(balance)} loan` : ""}
					</span>
				</span>
			</AccordionTrigger>
			<AccordionContent className="space-y-4">
				<div className="grid gap-4 sm:grid-cols-2">
					<NumberField
						helpText={PLAN_SETTINGS_HELP.propertyValue}
						id={`property-${property.id}-value`}
						label="Estimated value"
						money
						onChange={(currentEstimatedValue) =>
							onPatch({ currentEstimatedValue })
						}
						value={property.currentEstimatedValue}
					/>
					<NumberField
						helpText={PLAN_SETTINGS_HELP.appreciationOverride}
						id={`property-${property.id}-appreciation`}
						label="Appreciation override"
						onChange={(appreciationRate) => onPatch({ appreciationRate })}
						percent
						placeholder="Household default"
						value={property.appreciationRate}
					/>
				</div>
				{property.linkedAccountName ? (
					<p className="text-muted-foreground text-xs">
						Balance from {property.linkedAccountName}
					</p>
				) : null}
				{showLoan ? (
					<Accordion collapsible type="single">
						<AccordionItem value="loan">
							<AccordionTrigger className="py-2 text-sm">
								Loan terms
							</AccordionTrigger>
							<AccordionContent className="grid gap-4 sm:grid-cols-2">
								<NumberField
									helpText={PLAN_SETTINGS_HELP.loanBalance}
									id={`property-${property.id}-balance`}
									label="Loan balance"
									money
									onChange={(currentLoanBalance) =>
										onPatch({ currentLoanBalance })
									}
									value={property.currentLoanBalance}
								/>
								<NumberField
									helpText={PLAN_SETTINGS_HELP.mortgageRate}
									id={`property-${property.id}-rate`}
									label="Interest rate"
									onChange={(interestRate) => onPatch({ interestRate })}
									percent
									value={property.interestRate}
								/>
								<NumberField
									helpText={PLAN_SETTINGS_HELP.loanTermYears}
									id={`property-${property.id}-term`}
									label="Term (years)"
									onChange={(loanTermYears) => onPatch({ loanTermYears })}
									placeholder="30"
									value={property.loanTermYears}
								/>
								<NumberField
									helpText={PLAN_SETTINGS_HELP.remainingMonths}
									id={`property-${property.id}-remaining`}
									label="Remaining months"
									onChange={(remainingTermMonths) =>
										onPatch({ remainingTermMonths })
									}
									value={property.remainingTermMonths}
								/>
								<NumberField
									helpText={PLAN_SETTINGS_HELP.mortgagePayment}
									id={`property-${property.id}-payment`}
									label="Monthly payment"
									money
									onChange={(monthlyMortgagePayment) =>
										onPatch({ monthlyMortgagePayment })
									}
									value={property.monthlyMortgagePayment}
								/>
							</AccordionContent>
						</AccordionItem>
					</Accordion>
				) : null}
				{showRental ? (
					<Accordion collapsible type="single">
						<AccordionItem value="rental">
							<AccordionTrigger className="py-2 text-sm">
								Rental
							</AccordionTrigger>
							<AccordionContent className="grid gap-4 sm:grid-cols-2">
								<NumberField
									helpText={PLAN_SETTINGS_HELP.monthlyRent}
									id={`property-${property.id}-rent`}
									label="Monthly rent"
									money
									onChange={(monthlyRent) => onPatch({ monthlyRent })}
									value={property.monthlyRent}
								/>
								<NumberField
									helpText={PLAN_SETTINGS_HELP.vacancyRate}
									id={`property-${property.id}-vacancy`}
									label="Vacancy rate"
									onChange={(vacancyRate) => onPatch({ vacancyRate })}
									percent
									value={property.vacancyRate}
								/>
								<NumberField
									helpText={PLAN_SETTINGS_HELP.rentalExpenses}
									id={`property-${property.id}-opex`}
									label="Monthly expenses"
									money
									onChange={(totalMonthlyExpenses) =>
										onPatch({ totalMonthlyExpenses })
									}
									value={property.totalMonthlyExpenses}
								/>
							</AccordionContent>
						</AccordionItem>
					</Accordion>
				) : null}
			</AccordionContent>
		</AccordionItem>
	);
}

function DebtCard({
	debt,
	onPatch,
}: {
	debt: DebtDraft;
	onPatch: (patch: Partial<DebtDraft>) => void;
}) {
	const balance = Number(debt.balance.replace(/,/g, "")) || 0;
	return (
		<AccordionItem
			className="overflow-hidden rounded-lg border px-3 last:border-b"
			value={debt.id}
		>
			<AccordionTrigger className="py-3 hover:no-underline">
				<span className="flex min-w-0 flex-1 items-baseline justify-between gap-2 pr-2">
					<span className="truncate font-medium">{debt.name}</span>
					<span className="shrink-0 text-muted-foreground text-xs">
						{formatExactMoney(balance)}
					</span>
				</span>
			</AccordionTrigger>
			<AccordionContent className="grid gap-4 sm:grid-cols-2">
				<NumberField
					helpText={PLAN_SETTINGS_HELP.debtRate}
					id={`debt-${debt.id}-rate`}
					label="Interest rate"
					onChange={(interestRate) => onPatch({ interestRate })}
					percent
					value={debt.interestRate}
				/>
				<NumberField
					helpText={PLAN_SETTINGS_HELP.debtPayment}
					id={`debt-${debt.id}-payment`}
					label="Monthly payment"
					money
					onChange={(monthlyPayment) => onPatch({ monthlyPayment })}
					value={debt.monthlyPayment}
				/>
				<NumberField
					helpText={PLAN_SETTINGS_HELP.loanStart}
					id={`debt-${debt.id}-start`}
					label="Loan start"
					onChange={(loanStartDate) => onPatch({ loanStartDate })}
					placeholder="YYYY-MM-DD"
					text
					value={debt.loanStartDate}
				/>
				<NumberField
					helpText={PLAN_SETTINGS_HELP.debtTerm}
					id={`debt-${debt.id}-term`}
					label="Term (years)"
					onChange={(loanTermYears) => onPatch({ loanTermYears })}
					placeholder="5"
					value={debt.loanTermYears}
				/>
			</AccordionContent>
		</AccordionItem>
	);
}
