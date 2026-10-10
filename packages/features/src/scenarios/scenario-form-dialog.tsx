import type {
	CreateScenarioInput,
	ForecastScenario,
	ScenarioType,
} from "@moat/contracts";
import {
	Button,
	Dialog,
	DialogContent,
	DialogDescription,
	DialogHeader,
	DialogTitle,
	Input,
	Label,
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@moat/ui";
import { useEffect, useState } from "react";
import { PercentInput } from "./percent-input";
import {
	DEFAULT_SCENARIO_FORM,
	formatPercent,
	parsePercent,
	SCENARIO_TYPE_LABELS,
	type ScenarioPercentField,
} from "./scenario-utils";

interface ScenarioFormDialogProps {
	open: boolean;
	scenario: ForecastScenario | null;
	isPending: boolean;
	onOpenChange: (open: boolean) => void;
	onSubmit: (input: CreateScenarioInput) => void;
}

function scenarioToForm(
	scenario: ForecastScenario | null,
): CreateScenarioInput {
	if (!scenario) return DEFAULT_SCENARIO_FORM;
	return {
		contributionChange: scenario.contributionChange,
		expenseGrowth: scenario.expenseGrowth,
		inflationRate: scenario.inflationRate,
		investmentReturn: scenario.investmentReturn,
		name: scenario.name,
		salaryGrowth: scenario.salaryGrowth,
		type: SCENARIO_TYPE_LABELS[scenario.type as ScenarioType]
			? (scenario.type as ScenarioType)
			: "CUSTOM",
	};
}

export function ScenarioFormDialog({
	isPending,
	onOpenChange,
	onSubmit,
	open,
	scenario,
}: ScenarioFormDialogProps) {
	const [form, setForm] = useState<CreateScenarioInput>(DEFAULT_SCENARIO_FORM);
	const isEditing = scenario !== null;

	useEffect(() => {
		if (open) setForm(scenarioToForm(scenario));
	}, [open, scenario]);

	function updatePercentField(field: ScenarioPercentField, value: string) {
		setForm((current) => ({ ...current, [field]: parsePercent(value) }));
	}

	function handleSubmit() {
		onSubmit({ ...form, name: form.name.trim() });
	}

	return (
		<Dialog onOpenChange={onOpenChange} open={open}>
			<DialogContent>
				<DialogHeader>
					<DialogTitle>
						{isEditing ? "Edit Scenario" : "Create Scenario"}
					</DialogTitle>
					<DialogDescription>
						These rates apply to forecasts, Financial Profile, and the
						retirement planner while this scenario is active.
					</DialogDescription>
				</DialogHeader>
				<div className="space-y-4">
					<div className="space-y-2">
						<Label htmlFor="scenario-name">Name</Label>
						<Input
							id="scenario-name"
							onChange={(event) =>
								setForm((current) => ({ ...current, name: event.target.value }))
							}
							value={form.name}
						/>
					</div>
					<div className="space-y-2">
						<Label htmlFor="scenario-type">Type</Label>
						<Select
							disabled={isEditing}
							onValueChange={(value) =>
								setForm((current) => ({
									...current,
									type: value as ScenarioType,
								}))
							}
							value={form.type}
						>
							<SelectTrigger id="scenario-type">
								<SelectValue />
							</SelectTrigger>
							<SelectContent>
								{Object.entries(SCENARIO_TYPE_LABELS).map(([value, label]) => (
									<SelectItem key={value} value={value}>
										{label}
									</SelectItem>
								))}
							</SelectContent>
						</Select>
					</div>
					<div className="grid gap-3 sm:grid-cols-2">
						<PercentInput
							label="Investment Return"
							onChange={(value) =>
								updatePercentField("investmentReturn", value)
							}
							value={formatPercent(form.investmentReturn)}
						/>
						<PercentInput
							label="Inflation Rate"
							onChange={(value) => updatePercentField("inflationRate", value)}
							value={formatPercent(form.inflationRate)}
						/>
						<PercentInput
							label="Salary Growth"
							onChange={(value) => updatePercentField("salaryGrowth", value)}
							value={formatPercent(form.salaryGrowth)}
						/>
						<PercentInput
							label="Contribution Change"
							onChange={(value) =>
								updatePercentField("contributionChange", value)
							}
							value={formatPercent(form.contributionChange)}
						/>
						<PercentInput
							label="Expense Growth"
							onChange={(value) => updatePercentField("expenseGrowth", value)}
							value={formatPercent(form.expenseGrowth)}
						/>
					</div>
					<div className="flex justify-end gap-2 pt-2">
						<Button onClick={() => onOpenChange(false)} variant="outline">
							Cancel
						</Button>
						<Button
							disabled={isPending}
							onClick={handleSubmit}
							shortcut="mod+enter"
						>
							{isEditing ? "Save" : "Create"}
						</Button>
					</div>
				</div>
			</DialogContent>
		</Dialog>
	);
}
