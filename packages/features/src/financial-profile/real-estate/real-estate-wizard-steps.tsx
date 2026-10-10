import {
	Accordion,
	AccordionContent,
	AccordionItem,
	AccordionTrigger,
	Card,
	CardContent,
	Input,
	Label,
	NumericInput,
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
	Switch,
} from "@moat/ui";
import type React from "react";
import { formatCurrency } from "../components";
import {
	computeRealEstatePreview,
	formatRealEstateRoiPercent,
	type RealEstateFormValues,
} from "./real-estate-form-state";

type SetForm = <K extends keyof RealEstateFormValues>(
	key: K,
	value: RealEstateFormValues[K],
) => void;

type MortgageLinkerProps = {
	value: string;
	onChange: (accountId: string) => void;
	onBalanceSync: (balance: number) => void;
	onUnlink: () => void;
};

function AdvancedMortgageLabel({
	children,
	estimated,
}: {
	children: string;
	estimated: boolean;
}) {
	return (
		<Label>
			{children}
			{estimated ? (
				<span className="font-normal text-muted-foreground">· Estimated</span>
			) : null}
		</Label>
	);
}

const SUBHEADER_CLASSNAME =
	"font-semibold text-[12px] uppercase text-muted-foreground pb-2";

export function PropertyStep({
	form,
	set,
}: {
	form: RealEstateFormValues;
	set: SetForm;
}) {
	return (
		<section className="space-y-4">
			<p className={SUBHEADER_CLASSNAME}>Property details</p>
			<div className="space-y-1">
				<Label>Property Name</Label>
				<Input
					onChange={(e) => set("name", e.target.value)}
					placeholder="e.g. 123 Main St"
					value={form.name}
				/>
			</div>
			<div className="grid gap-3 sm:grid-cols-2">
				<div className="space-y-1">
					<Label>Property Type</Label>
					<Select
						onValueChange={(v) =>
							set("propertyType", v as RealEstateFormValues["propertyType"])
						}
						value={form.propertyType}
					>
						<SelectTrigger>
							<SelectValue />
						</SelectTrigger>
						<SelectContent>
							<SelectItem value="SINGLE_FAMILY">Single Family</SelectItem>
							<SelectItem value="MULTI_FAMILY">Multi Family</SelectItem>
							<SelectItem value="CONDO">Condo / Townhome</SelectItem>
							<SelectItem value="COMMERCIAL">Commercial</SelectItem>
							<SelectItem value="LAND">Land</SelectItem>
							<SelectItem value="OTHER">Other</SelectItem>
						</SelectContent>
					</Select>
				</div>
				<div className="space-y-1">
					<Label>Usage Type</Label>
					<Select
						onValueChange={(v) => {
							const usageType = v as RealEstateFormValues["usageType"];
							set("usageType", usageType);
							if (usageType === "RENTAL") {
								set("isRented", true);
							} else if (usageType === "PRIMARY_RESIDENCE") {
								set("isRented", false);
								set("monthlyRent", "");
								set("otherMonthlyIncome", "");
								set("vacancyRate", "");
							}
						}}
						value={form.usageType}
					>
						<SelectTrigger>
							<SelectValue />
						</SelectTrigger>
						<SelectContent>
							<SelectItem value="PRIMARY_RESIDENCE">
								Primary Residence
							</SelectItem>
							<SelectItem value="RENTAL">Rental Property</SelectItem>
							<SelectItem value="VACATION_HOME">Vacation Home</SelectItem>
							<SelectItem value="MIXED_USE">Mixed Use</SelectItem>
						</SelectContent>
					</Select>
				</div>
			</div>
			<div className="space-y-1">
				<Label>Current Estimated Value ($)</Label>
				<NumericInput
					onChange={(value) => set("currentEstimatedValue", value)}
					placeholder="400,000"
					value={form.currentEstimatedValue}
				/>
			</div>
		</section>
	);
}

export function MortgageStep({
	form,
	set,
	renderMortgageLinker,
}: {
	form: RealEstateFormValues;
	set: SetForm;
	renderMortgageLinker?: (props: MortgageLinkerProps) => React.ReactNode;
}) {
	return (
		<section className="space-y-4">
			<p className={SUBHEADER_CLASSNAME}>Mortgage details</p>
			<div className="flex items-center gap-2">
				<Switch
					checked={form.hasMortgage}
					id="has-mortgage"
					onCheckedChange={(v) => {
						set("hasMortgage", v);
						if (!v) {
							set("currentLoanBalance", "0");
							set("linkedPlaidAccountId", "");
							set("purchaseDate", "");
							set("loanTermYears", "");
							set("interestRate", "");
							set("purchasePrice", "");
							set("downPayment", "");
							set("closingCosts", "");
							set("rehabCosts", "");
							set("remainingTermMonths", "");
							set("monthlyMortgagePayment", "");
						}
					}}
				/>
				<Label htmlFor="has-mortgage">I have a mortgage</Label>
			</div>
			{form.hasMortgage ? (
				<>
					<div className="grid gap-3 sm:grid-cols-2">
						<div className="space-y-1">
							<Label>
								Purchase Price ($) <span className="text-destructive">*</span>
							</Label>
							<NumericInput
								onChange={(value) => set("purchasePrice", value)}
								placeholder="380,000"
								value={form.purchasePrice}
							/>
						</div>
						<div className="space-y-1">
							<Label>
								Date Purchased <span className="text-destructive">*</span>
							</Label>
							<Input
								onChange={(e) => set("purchaseDate", e.target.value)}
								type="date"
								value={form.purchaseDate}
							/>
						</div>
						<div className="space-y-1">
							<Label>
								Loan Term (Years) <span className="text-destructive">*</span>
							</Label>
							<Input
								onChange={(e) => set("loanTermYears", e.target.value)}
								placeholder="30"
								type="number"
								value={form.loanTermYears}
							/>
						</div>
						<div className="space-y-1">
							<Label>
								Interest Rate (%) <span className="text-destructive">*</span>
							</Label>
							<Input
								onChange={(e) => set("interestRate", e.target.value)}
								placeholder="6.5"
								type="number"
								value={form.interestRate}
							/>
						</div>
					</div>
					<div className="space-y-1">
						<div className="flex items-center justify-between">
							<Label>
								Current Loan Balance ($){" "}
								<span className="text-destructive">*</span>
							</Label>
							{renderMortgageLinker
								? renderMortgageLinker({
										value: form.linkedPlaidAccountId,
										onChange: (accountId) =>
											set("linkedPlaidAccountId", accountId),
										onBalanceSync: (balance) =>
											set("currentLoanBalance", String(Math.round(balance))),
										onUnlink: () => set("linkedPlaidAccountId", ""),
									})
								: null}
						</div>
						{form.linkedPlaidAccountId ? (
							<p className="text-muted-foreground text-xs">
								Balance synced from linked account — updated automatically.
							</p>
						) : null}
						<NumericInput
							onChange={(value) => set("currentLoanBalance", value)}
							placeholder="300,000"
							readOnly={!!form.linkedPlaidAccountId}
							value={form.currentLoanBalance}
						/>
					</div>
					<Accordion collapsible type="single">
						<AccordionItem value="mortgage-advanced">
							<AccordionTrigger className="text-sm">
								Advanced mortgage details
							</AccordionTrigger>
							<AccordionContent className="space-y-3 pt-2">
								<div className="grid gap-3 sm:grid-cols-2">
									<div className="space-y-1">
										<AdvancedMortgageLabel
											estimated={
												form.downPaymentEstimated && !!form.downPayment
											}
										>
											Down Payment ($)
										</AdvancedMortgageLabel>
										<NumericInput
											onChange={(value) => set("downPayment", value)}
											placeholder="80,000"
											value={form.downPayment}
										/>
									</div>
									<div className="space-y-1">
										<Label>Closing Costs ($)</Label>
										<NumericInput
											onChange={(value) => set("closingCosts", value)}
											placeholder="5,000"
											value={form.closingCosts}
										/>
									</div>
									<div className="space-y-1">
										<Label>Initial Rehab ($)</Label>
										<NumericInput
											onChange={(value) => set("rehabCosts", value)}
											placeholder="0"
											value={form.rehabCosts}
										/>
									</div>
									<div className="space-y-1">
										<AdvancedMortgageLabel
											estimated={
												form.remainingTermMonthsEstimated &&
												!!form.remainingTermMonths
											}
										>
											Remaining Term (Months)
										</AdvancedMortgageLabel>
										<Input
											onChange={(e) =>
												set("remainingTermMonths", e.target.value)
											}
											placeholder="300"
											type="number"
											value={form.remainingTermMonths}
										/>
									</div>
									<div className="space-y-1">
										<AdvancedMortgageLabel
											estimated={
												form.monthlyMortgagePaymentEstimated &&
												!!form.monthlyMortgagePayment
											}
										>
											Monthly Mortgage Payment ($)
										</AdvancedMortgageLabel>
										<NumericInput
											onChange={(value) => set("monthlyMortgagePayment", value)}
											placeholder="1,900"
											value={form.monthlyMortgagePayment}
										/>
									</div>
								</div>
							</AccordionContent>
						</AccordionItem>
					</Accordion>
				</>
			) : (
				<p className="text-muted-foreground text-sm">
					No mortgage? You can skip ahead to income and expenses.
				</p>
			)}
		</section>
	);
}

export function IncomeStep({
	form,
	set,
}: {
	form: RealEstateFormValues;
	set: SetForm;
}) {
	return (
		<section className="space-y-4">
			<p className={SUBHEADER_CLASSNAME}>Rental income</p>
			<div className="flex items-center gap-2">
				<Switch
					checked={form.isRented}
					id="is-rented"
					onCheckedChange={(v) => {
						set("isRented", v);
						if (!v) {
							set("monthlyRent", "");
							set("otherMonthlyIncome", "");
							set("vacancyRate", "");
						}
					}}
				/>
				<Label htmlFor="is-rented">This property is rented</Label>
			</div>
			{form.isRented ? (
				<div className="space-y-3">
					<div className="space-y-1">
						<Label>Monthly Rent ($)</Label>
						<NumericInput
							onChange={(value) => set("monthlyRent", value)}
							placeholder="2,000"
							value={form.monthlyRent}
						/>
					</div>
					<Accordion collapsible type="single">
						<AccordionItem value="income-advanced">
							<AccordionTrigger className="text-sm">
								Advanced income details
							</AccordionTrigger>
							<AccordionContent className="space-y-3 pt-2">
								<div className="grid gap-3 sm:grid-cols-2">
									<div className="space-y-1">
										<Label>Other Monthly Income ($)</Label>
										<NumericInput
											onChange={(value) => set("otherMonthlyIncome", value)}
											placeholder="0"
											value={form.otherMonthlyIncome}
										/>
									</div>
									<div className="space-y-1">
										<Label>Vacancy Rate (%)</Label>
										<Input
											onChange={(e) => set("vacancyRate", e.target.value)}
											placeholder="5"
											type="number"
											value={form.vacancyRate}
										/>
									</div>
								</div>
							</AccordionContent>
						</AccordionItem>
					</Accordion>
				</div>
			) : (
				<p className="text-muted-foreground text-sm">
					Primary residences and vacation homes can skip rental income.
				</p>
			)}
		</section>
	);
}

export function ExpensesStep({
	form,
	set,
}: {
	form: RealEstateFormValues;
	set: SetForm;
}) {
	return (
		<section className="space-y-4">
			<p className={SUBHEADER_CLASSNAME}>Monthly expenses</p>
			<div className="space-y-1">
				<Label>Total Monthly Expenses ($)</Label>
				<p className="text-muted-foreground text-xs">
					Quick estimate — overridden by itemized expenses below
				</p>
				<NumericInput
					onChange={(value) => set("totalMonthlyExpenses", value)}
					placeholder="1,500"
					value={form.totalMonthlyExpenses}
				/>
			</div>
			<Accordion collapsible type="single">
				<AccordionItem value="expenses-breakdown">
					<AccordionTrigger className="text-sm">
						Itemized expense breakdown
					</AccordionTrigger>
					<AccordionContent className="space-y-3 pt-2">
						<div className="grid gap-3 sm:grid-cols-2">
							<div className="space-y-1">
								<Label>Property Tax ($/mo)</Label>
								<NumericInput
									onChange={(value) => set("monthlyPropertyTax", value)}
									placeholder="400"
									value={form.monthlyPropertyTax}
								/>
							</div>
							<div className="space-y-1">
								<Label>Insurance ($/mo)</Label>
								<NumericInput
									onChange={(value) => set("monthlyInsurance", value)}
									placeholder="120"
									value={form.monthlyInsurance}
								/>
							</div>
							<div className="space-y-1">
								<Label>HOA ($/mo)</Label>
								<NumericInput
									onChange={(value) => set("monthlyHOA", value)}
									placeholder="0"
									value={form.monthlyHOA}
								/>
							</div>
							<div className="space-y-1">
								<Label>Utilities ($/mo)</Label>
								<NumericInput
									onChange={(value) => set("monthlyUtilities", value)}
									placeholder="0"
									value={form.monthlyUtilities}
								/>
							</div>
							<div className="space-y-1">
								<Label>Maintenance ($/mo)</Label>
								<NumericInput
									onChange={(value) => set("monthlyMaintenance", value)}
									placeholder="200"
									value={form.monthlyMaintenance}
								/>
							</div>
							<div className="space-y-1">
								<Label>Property Mgmt ($/mo)</Label>
								<NumericInput
									onChange={(value) => set("monthlyManagement", value)}
									placeholder="0"
									value={form.monthlyManagement}
								/>
							</div>
							<div className="space-y-1">
								<Label>Other Expenses ($/mo)</Label>
								<NumericInput
									onChange={(value) => set("monthlyOtherExpenses", value)}
									placeholder="0"
									value={form.monthlyOtherExpenses}
								/>
							</div>
						</div>
					</AccordionContent>
				</AccordionItem>
			</Accordion>
		</section>
	);
}

export function ForecastStep({
	form,
	set,
}: {
	form: RealEstateFormValues;
	set: SetForm;
}) {
	const preview = computeRealEstatePreview(form);

	return (
		<section className="space-y-4">
			<p className={SUBHEADER_CLASSNAME}>Forecast assumptions</p>
			<div className="space-y-1">
				<Label>Scenario</Label>
				<Select
					onValueChange={(v) =>
						set(
							"forecastScenario",
							v as RealEstateFormValues["forecastScenario"],
						)
					}
					value={form.forecastScenario}
				>
					<SelectTrigger>
						<SelectValue />
					</SelectTrigger>
					<SelectContent>
						<SelectItem value="MODERATE">
							Moderate (2% rent / 2% appreciation)
						</SelectItem>
						<SelectItem value="STANDARD">
							Standard (4% rent / 3% appreciation)
						</SelectItem>
						<SelectItem value="AGGRESSIVE">
							Aggressive (6% rent / 5% appreciation)
						</SelectItem>
					</SelectContent>
				</Select>
			</div>
			<Accordion collapsible type="single">
				<AccordionItem value="forecast-advanced">
					<AccordionTrigger className="text-sm">
						Advanced forecast assumptions
					</AccordionTrigger>
					<AccordionContent className="space-y-3 pt-2">
						<div className="grid gap-3 sm:grid-cols-2">
							<div className="space-y-1">
								<Label>Annual Appreciation Rate (%)</Label>
								<Input
									onChange={(e) => set("appreciationRate", e.target.value)}
									placeholder="3"
									type="number"
									value={form.appreciationRate}
								/>
							</div>
							<div className="space-y-1">
								<Label>Annual Expense Growth Rate (%)</Label>
								<Input
									onChange={(e) => set("expenseGrowthRate", e.target.value)}
									placeholder="2"
									type="number"
									value={form.expenseGrowthRate}
								/>
							</div>
						</div>
					</AccordionContent>
				</AccordionItem>
			</Accordion>
			<Card className="bg-muted/40">
				<CardContent className="pt-4 pb-3">
					<p className="mb-3 font-medium text-sm">Preview</p>
					<div className="grid grid-cols-[minmax(0,1fr)_auto] gap-x-3 gap-y-1.5 text-sm">
						<span className="text-muted-foreground">Current Equity</span>
						<span className="font-medium">
							{formatCurrency(preview.equity)}
						</span>
						<span className="text-muted-foreground">Monthly Cash Flow</span>
						<span
							className={
								preview.monthlyCashFlow >= 0
									? "font-medium text-green-600"
									: "font-medium text-red-500"
							}
						>
							{formatCurrency(preview.monthlyCashFlow)}
						</span>
						<span className="text-muted-foreground">5-Year ROI Preview</span>
						<span className="font-medium">
							{formatRealEstateRoiPercent(preview.roi5yr, preview.equity)}
						</span>
					</div>
				</CardContent>
			</Card>
		</section>
	);
}

export function ReviewStep({ form }: { form: RealEstateFormValues }) {
	const preview = computeRealEstatePreview(form);

	return (
		<section className="space-y-4">
			<p className={SUBHEADER_CLASSNAME}>Review and save</p>
			<div className="space-y-3 rounded-lg border p-4 text-sm">
				<div className="flex justify-between gap-3">
					<span className="text-muted-foreground">Property</span>
					<span className="font-medium">{form.name || "—"}</span>
				</div>
				<div className="flex justify-between gap-3">
					<span className="text-muted-foreground">Estimated value</span>
					<span className="font-medium">
						{form.currentEstimatedValue
							? formatCurrency(
									Number.parseFloat(
										form.currentEstimatedValue.replace(/,/g, ""),
									),
								)
							: "—"}
					</span>
				</div>
				<div className="flex justify-between gap-3">
					<span className="text-muted-foreground">Loan balance</span>
					<span className="font-medium">
						{form.hasMortgage
							? formatCurrency(
									Number.parseFloat(
										(form.currentLoanBalance || "0").replace(/,/g, ""),
									),
								)
							: formatCurrency(0)}
					</span>
				</div>
				<div className="flex justify-between gap-3">
					<span className="text-muted-foreground">Monthly rent</span>
					<span className="font-medium">
						{form.isRented && form.monthlyRent
							? formatCurrency(
									Number.parseFloat(form.monthlyRent.replace(/,/g, "")),
								)
							: "—"}
					</span>
				</div>
				<div className="flex justify-between gap-3">
					<span className="text-muted-foreground">Forecast scenario</span>
					<span className="font-medium">{form.forecastScenario}</span>
				</div>
			</div>
			<Card className="bg-muted/40">
				<CardContent className="pt-4 pb-3">
					<p className="mb-3 font-medium text-sm">Summary</p>
					<div className="grid grid-cols-[minmax(0,1fr)_auto] gap-x-3 gap-y-1.5 text-sm">
						<span className="text-muted-foreground">Equity</span>
						<span className="font-medium">
							{formatCurrency(preview.equity)}
						</span>
						<span className="text-muted-foreground">Monthly cash flow</span>
						<span
							className={
								preview.monthlyCashFlow >= 0
									? "font-medium text-green-600"
									: "font-medium text-red-500"
							}
						>
							{formatCurrency(preview.monthlyCashFlow)}
						</span>
						<span className="text-muted-foreground">5-year ROI</span>
						<span className="font-medium">
							{formatRealEstateRoiPercent(preview.roi5yr, preview.equity)}
						</span>
					</div>
				</CardContent>
			</Card>
		</section>
	);
}
