import { Button, Skeleton } from "@moat/ui";
import { useQueryClient } from "@tanstack/react-query";
import { Pencil, Sparkles } from "lucide-react";
import type React from "react";
import { useApiClient } from "../../api-client-context";
import {
	invalidateForecastCascadeConsumers,
	overlappingPercentsFromAssumptions,
	writeAssumptionsOntoActiveScenario,
} from "../../forecast-rate-cascade";
import {
	currentDateString,
	DetailGrid,
	EditFieldsDialog,
	type FieldValues,
	formatPercent,
	numberValue,
	optionalNumberValue,
	SectionCard,
	stringValue,
} from "../components";
import { assumptionFields } from "../field-options";
import type { ForecastAssumptions } from "../types";
import { useEditFieldsPanel } from "../use-edit-fields-panel";
import type { FinancialProfileSectionProps } from "./types";

function forecastStyleValue(
	value: string,
): ForecastAssumptions["forecastStyle"] {
	if (value === "Conservative" || value === "Aggressive") return value;
	return "Balanced";
}

function valuesToAssumptions(
	values: FieldValues,
	fallback: ForecastAssumptions,
): ForecastAssumptions {
	return {
		...fallback,
		defaultCashYield: numberValue(values.defaultCashYield),
		expenseGrowthRate: numberValue(values.expenseGrowthRate),
		forecastStyle: forecastStyleValue(stringValue(values.forecastStyle)),
		incomeGrowthRate: numberValue(values.incomeGrowthRate),
		inflationRate: numberValue(values.inflationRate),
		investmentReturnRate: numberValue(values.investmentReturnRate),
		lastUpdated: currentDateString(),
		realEstateAppreciationRate: numberValue(values.realEstateAppreciationRate),
		retirementAge: optionalNumberValue(values.retirementAge),
	};
}

export function AssumptionsSection({
	data,
	isLoading = false,
	isSaving,
	onChange,
}: FinancialProfileSectionProps) {
	const api = useApiClient();
	const queryClient = useQueryClient();
	const forecastAssumptions = data.forecastAssumptions;
	const { cardClick, dialogProps, openEditor } = useEditFieldsPanel(isLoading);
	const value = (node: React.ReactNode) =>
		isLoading ? <Skeleton className="h-5 w-20" /> : node;

	async function handleSave(values: FieldValues) {
		const assumptions = valuesToAssumptions(values, forecastAssumptions);
		await onChange({
			...data,
			forecastAssumptions: assumptions,
		});
		await writeAssumptionsOntoActiveScenario(
			api,
			overlappingPercentsFromAssumptions(assumptions),
			undefined,
			overlappingPercentsFromAssumptions(forecastAssumptions),
		);
		await invalidateForecastCascadeConsumers(queryClient);
	}

	return (
		<SectionCard
			action={
				<EditFieldsDialog
					{...dialogProps}
					fields={assumptionFields}
					initialValues={forecastAssumptions}
					isSaving={isSaving}
					onSave={(values) => {
						void handleSave(values);
					}}
					title="Edit Assumptions"
					trigger={
						<Button disabled={isLoading} onClick={() => openEditor()} size="sm">
							<Pencil className="h-4 w-4" />
							Edit Assumptions
						</Button>
					}
				/>
			}
			description="Global forecast behavior that affects projections throughout Moat."
			icon={Sparkles}
			id="assumptions"
			title="Assumptions"
		>
			<div className="mb-4 flex items-start gap-3 rounded-lg border bg-muted/30 p-3 text-muted-foreground text-sm">
				<Sparkles className="mt-0.5 h-4 w-4 text-primary" />
				These rates are shared with your active forecast scenario and the
				retirement planner. Changing them here updates all three.
			</div>
			<DetailGrid
				items={[
					{
						helpText:
							"The annual inflation assumption used to grow future costs.",
						label: "Inflation rate",
						onClick: cardClick("inflationRate"),
						value: value(formatPercent(forecastAssumptions.inflationRate)),
					},
					{
						helpText:
							"The annual default growth assumption for income forecasts.",
						label: "Income growth rate",
						onClick: cardClick("incomeGrowthRate"),
						value: value(formatPercent(forecastAssumptions.incomeGrowthRate)),
					},
					{
						helpText:
							"The annual default growth assumption for recurring expenses.",
						label: "Expense growth rate",
						onClick: cardClick("expenseGrowthRate"),
						value: value(formatPercent(forecastAssumptions.expenseGrowthRate)),
					},
					{
						helpText:
							"The default annual return assumption for investments when no account-specific rate is set.",
						label: "Investment return rate",
						onClick: cardClick("investmentReturnRate"),
						value: value(
							formatPercent(forecastAssumptions.investmentReturnRate),
						),
					},
					{
						helpText:
							"The default annual appreciation assumption for real estate values.",
						label: "Real estate appreciation",
						onClick: cardClick("realEstateAppreciationRate"),
						value: value(
							formatPercent(forecastAssumptions.realEstateAppreciationRate),
						),
					},
					{
						helpText:
							"The assumed annual yield for cash-like balances when an account-specific rate is unavailable.",
						label: "Default cash yield",
						onClick: cardClick("defaultCashYield"),
						value: value(formatPercent(forecastAssumptions.defaultCashYield)),
					},
					{
						helpText:
							"The age at which retirement-focused forecasts should assume work income changes or stops.",
						label: "Retirement age",
						onClick: cardClick("retirementAge"),
						value: value(forecastAssumptions.retirementAge ?? "Not set"),
					},
					{
						helpText: assumptionFields.find(
							(field) => field.name === "forecastStyle",
						)?.helpText,
						label: "Forecast style",
						onClick: cardClick("forecastStyle"),
						value: value(forecastAssumptions.forecastStyle),
					},
				]}
			/>
			{isLoading ? (
				<Skeleton className="mt-4 h-4 w-36" />
			) : (
				<div className="mt-4 text-muted-foreground text-xs">
					Last updated {forecastAssumptions.lastUpdated}
				</div>
			)}
		</SectionCard>
	);
}
