import { TAXES_PRODUCT_ENABLED } from "@moat/contracts";
import { Button, Skeleton } from "@moat/ui";
import { FileText, Pencil, ReceiptText } from "lucide-react";
import type React from "react";
import { useMoatNavigation } from "../../navigation-context";
import {
	booleanValue,
	ClickableCard,
	currentDateString,
	EditFieldsDialog,
	type FieldValues,
	formatCurrency,
	numberValue,
	SectionCard,
	StatusBadge,
	stringValue,
} from "../components";
import { taxFields } from "../field-options";
import { withTaxFieldRecommendations } from "../tax-field-recommendations";
import type { TaxProfile } from "../types";
import { useEditFieldsPanel } from "../use-edit-fields-panel";
import type { FinancialProfileSectionProps } from "./types";

function filingStatusValue(value: string): TaxProfile["filingStatus"] {
	if (
		value === "Married filing jointly" ||
		value === "Married filing separately" ||
		value === "Head of household"
	) {
		return value;
	}
	return "Single";
}

function deductionStrategyValue(
	value: string,
): TaxProfile["deductionStrategy"] {
	return value === "Itemized" ? "Itemized" : "Standard";
}

function valuesToTaxProfile(
	values: FieldValues,
	fallback: TaxProfile,
): TaxProfile {
	return {
		...fallback,
		filingStatus: filingStatusValue(stringValue(values.filingStatus)),
		taxYear: numberValue(values.taxYear),
		estimatedFederalTaxBracket: stringValue(values.estimatedFederalTaxBracket),
		estimatedStateTaxRate: stringValue(values.estimatedStateTaxRate),
		totalAnnualIncome: numberValue(values.totalAnnualIncome),
		taxableIncomeEstimate: numberValue(values.taxableIncomeEstimate),
		deductionStrategy: deductionStrategyValue(
			stringValue(values.deductionStrategy),
		),
		selfEmployedIncome: booleanValue(values.selfEmployedIncome),
		rentalIncome: booleanValue(values.rentalIncome),
		lastUpdated: currentDateString(),
	};
}

function formatTaxYear(taxYear: number) {
	return String(Math.trunc(taxYear));
}

export function TaxesSection({
	data,
	onChange,
	isSaving,
	isLoading = false,
}: FinancialProfileSectionProps) {
	const taxProfile = data.taxProfile;
	const nav = useMoatNavigation();
	const { openEditor, cardClick, dialogProps } = useEditFieldsPanel(isLoading);
	const value = (node: React.ReactNode, className = "h-4 w-24") =>
		isLoading ? <Skeleton className={className} /> : node;
	const taxSectionDescription = TAXES_PRODUCT_ENABLED
		? "Planning assumptions for forecasts and retirement. Filing status, self-employment, and rental flags also seed the Taxes workspace."
		: "Planning assumptions for forecasts and retirement.";
	const openTaxesButton = TAXES_PRODUCT_ENABLED ? (
		<Button
			disabled={isLoading}
			onClick={() =>
				nav.push(`/taxes?year=${formatTaxYear(taxProfile.taxYear)}`)
			}
			size="sm"
			variant="outline"
		>
			Open Taxes
		</Button>
	) : null;

	return (
		<SectionCard
			action={
				<div className="flex items-center gap-2">
					{openTaxesButton}
					<EditFieldsDialog
						{...dialogProps}
						fields={withTaxFieldRecommendations(
							taxFields,
							data.taxProfileRecommendations,
						)}
						initialValues={taxProfile}
						isSaving={isSaving}
						onSave={(values) =>
							onChange({
								...data,
								taxProfile: valuesToTaxProfile(values, taxProfile),
							})
						}
						title="Edit Taxes"
						trigger={
							<Button
								disabled={isLoading}
								onClick={() => openEditor()}
								size="sm"
							>
								<Pencil className="h-4 w-4" />
								Edit Taxes
							</Button>
						}
					/>
				</div>
			}
			description={taxSectionDescription}
			icon={ReceiptText}
			id="taxes"
			title="Taxes"
		>
			<div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
				<ClickableCard
					className="p-4"
					label="Filing"
					onClick={cardClick("filingStatus")}
				>
					<div className="flex items-center gap-2 font-medium text-sm">
						<FileText className="h-4 w-4 text-primary" /> Filing
					</div>
					<div className="mt-3 space-y-2 text-sm">
						<div>{value(taxProfile.filingStatus)}</div>
						<div className="text-muted-foreground">
							{isLoading
								? value(null, "h-4 w-20")
								: `Tax year ${formatTaxYear(taxProfile.taxYear)}`}
						</div>
						<div className="text-muted-foreground">
							{isLoading
								? value(null, "h-4 w-28")
								: `${taxProfile.deductionStrategy} deduction`}
						</div>
					</div>
				</ClickableCard>
				<ClickableCard
					className="p-4"
					label="Income"
					onClick={cardClick("totalAnnualIncome")}
				>
					<div className="font-medium text-sm">Income</div>
					<div className="mt-3 space-y-2 text-sm">
						<div>
							{isLoading
								? value(null, "h-4 w-28")
								: `Total ${formatCurrency(taxProfile.totalAnnualIncome)}`}
						</div>
						<div className="text-muted-foreground">
							{isLoading
								? value(null, "h-4 w-28")
								: `Taxable ${formatCurrency(taxProfile.taxableIncomeEstimate)}`}
						</div>
					</div>
				</ClickableCard>
				<ClickableCard
					className="p-4"
					label="Rates"
					onClick={cardClick("estimatedFederalTaxBracket")}
				>
					<div className="font-medium text-sm">Rates</div>
					<div className="mt-3 space-y-2 text-sm">
						<div>
							{isLoading
								? value(null, "h-4 w-20")
								: `Federal ${taxProfile.estimatedFederalTaxBracket}`}
						</div>
						<div className="text-muted-foreground">
							{isLoading
								? value(null, "h-4 w-20")
								: `State ${taxProfile.estimatedStateTaxRate}`}
						</div>
					</div>
				</ClickableCard>
				<ClickableCard
					className="p-4"
					label="Other"
					onClick={cardClick("selfEmployedIncome")}
				>
					<div className="font-medium text-sm">Other</div>
					<div className="mt-3 flex flex-wrap gap-2">
						{isLoading ? (
							<>
								<Skeleton className="h-5 w-28" />
								<Skeleton className="h-5 w-24" />
							</>
						) : (
							<>
								<StatusBadge
									active={taxProfile.selfEmployedIncome}
									activeLabel="Self-employed"
									inactiveLabel="No self-employment"
								/>
								<StatusBadge
									active={taxProfile.rentalIncome}
									activeLabel="Rental income"
									inactiveLabel="No rental income"
								/>
							</>
						)}
					</div>
				</ClickableCard>
			</div>
			{isLoading ? (
				<Skeleton className="mt-4 h-4 w-36" />
			) : (
				<div className="mt-4 text-muted-foreground text-xs">
					Last updated {taxProfile.lastUpdated}
				</div>
			)}
		</SectionCard>
	);
}
