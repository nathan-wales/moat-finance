import type {
	CreateScenarioInput,
	ForecastScenario,
	UpdateScenarioInput,
} from "@moat/contracts";
import { Button } from "@moat/ui";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus } from "lucide-react";
import { useMemo, useState } from "react";
import { useApiClient } from "../api-client-context";
import {
	invalidateForecastCascadeConsumers,
	overlappingDecimalsFromScenario,
	writeScenarioRatesOntoAssumptions,
} from "../forecast-rate-cascade";
import {
	DEFAULT_SCENARIO_SKELETONS,
	ScenarioCard,
	ScenarioCardSkeleton,
} from "./scenario-card";
import { ScenarioFormDialog } from "./scenario-form-dialog";

interface ScenariosPageProps {
	onNotify?: (message: string, type?: "success" | "error") => void;
}

function findFallbackScenario(
	scenarios: ForecastScenario[],
	deletedId: string,
): ForecastScenario | null {
	const remaining = scenarios.filter((scenario) => scenario.id !== deletedId);
	return (
		remaining.find((scenario) => scenario.type === "STANDARD") ??
		remaining[0] ??
		null
	);
}

export function ScenariosPage({ onNotify }: ScenariosPageProps) {
	const api = useApiClient();
	const queryClient = useQueryClient();
	const [dialogOpen, setDialogOpen] = useState(false);
	const [editingScenario, setEditingScenario] =
		useState<ForecastScenario | null>(null);
	const queryKey = useMemo(() => ["scenarios"], []);

	const scenariosQuery = useQuery({
		queryKey,
		queryFn: async () => {
			const scenarios = await api.listScenarios();
			if (scenarios.length === 0) {
				await api.seedDefaultScenarios();
				return api.listScenarios();
			}
			return scenarios;
		},
	});

	const invalidateForecastConsumers = () =>
		invalidateForecastCascadeConsumers(queryClient);

	const createMutation = useMutation({
		mutationFn: (input: CreateScenarioInput) => api.createScenario(input),
		onSuccess: () => {
			closeDialog();
			onNotify?.("Scenario created");
			return invalidateForecastConsumers();
		},
		onError: () => onNotify?.("Could not create scenario", "error"),
	});
	const updateMutation = useMutation({
		mutationFn: async (input: UpdateScenarioInput) => {
			const updated = await api.updateScenario(input);
			if (editingScenario?.isActive) {
				await writeScenarioRatesOntoAssumptions(
					api,
					overlappingDecimalsFromScenario({
						expenseGrowth: input.expenseGrowth ?? editingScenario.expenseGrowth,
						inflationRate: input.inflationRate ?? editingScenario.inflationRate,
						investmentReturn:
							input.investmentReturn ?? editingScenario.investmentReturn,
						salaryGrowth: input.salaryGrowth ?? editingScenario.salaryGrowth,
					}),
				);
			}
			return updated;
		},
		onSuccess: () => {
			closeDialog();
			onNotify?.("Scenario updated");
			return invalidateForecastConsumers();
		},
		onError: () => onNotify?.("Could not update scenario", "error"),
	});
	const activeMutation = useMutation({
		mutationFn: async (scenario: ForecastScenario) => {
			await api.setActiveScenario(scenario.id);
			await writeScenarioRatesOntoAssumptions(
				api,
				overlappingDecimalsFromScenario(scenario),
			);
		},
		onSuccess: () => {
			onNotify?.("Active scenario updated");
			return invalidateForecastConsumers();
		},
		onError: () => onNotify?.("Could not update active scenario", "error"),
	});
	const deleteMutation = useMutation({
		mutationFn: async (scenario: ForecastScenario) => {
			if (scenario.isActive) {
				const fallback = findFallbackScenario(
					scenariosQuery.data ?? [],
					scenario.id,
				);
				if (fallback) {
					await api.setActiveScenario(fallback.id);
					await writeScenarioRatesOntoAssumptions(
						api,
						overlappingDecimalsFromScenario(fallback),
					);
				}
			}
			await api.deleteScenario(scenario.id);
		},
		onSuccess: () => {
			onNotify?.("Scenario deleted");
			return invalidateForecastConsumers();
		},
		onError: () => onNotify?.("Could not delete scenario", "error"),
	});

	function openCreateDialog() {
		setEditingScenario(null);
		setDialogOpen(true);
	}

	function openEditDialog(scenario: ForecastScenario) {
		setEditingScenario(scenario);
		setDialogOpen(true);
	}

	function closeDialog() {
		setDialogOpen(false);
		setEditingScenario(null);
	}

	function handleFormSubmit(input: CreateScenarioInput) {
		if (!input.name) {
			onNotify?.("Please enter a scenario name", "error");
			return;
		}

		if (editingScenario) {
			updateMutation.mutate({
				contributionChange: input.contributionChange,
				expenseGrowth: input.expenseGrowth,
				id: editingScenario.id,
				inflationRate: input.inflationRate,
				investmentReturn: input.investmentReturn,
				name: input.name,
				salaryGrowth: input.salaryGrowth,
			});
			return;
		}

		createMutation.mutate(input);
	}

	const isLoading = scenariosQuery.isLoading;
	const scenarios = scenariosQuery.data ?? [];
	const scenarioCards = isLoading
		? DEFAULT_SCENARIO_SKELETONS.map((scenario) => (
				<ScenarioCardSkeleton
					description={scenario.description}
					key={scenario.id}
					name={scenario.name}
				/>
			))
		: scenarios.map((scenario) => (
				<ScenarioCard
					key={scenario.id}
					onDelete={() => deleteMutation.mutate(scenario)}
					onEdit={() => openEditDialog(scenario)}
					onSetActive={() => activeMutation.mutate(scenario)}
					scenario={scenario}
				/>
			));

	return (
		<div className="mx-auto w-full max-w-5xl space-y-6 pb-24">
			<div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
				<div>
					<h1 className="font-bold text-2xl tracking-tight">Scenarios</h1>
					<p className="text-muted-foreground">
						The active scenario's rates apply everywhere: net worth forecasts,
						Financial Profile, and the retirement planner. Change them here or
						in Edit plan — they stay in sync.
					</p>
				</div>
				<Button disabled={isLoading} onClick={openCreateDialog}>
					<Plus className="h-4 w-4" />
					Scenario
				</Button>
			</div>

			<div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
				{scenarioCards}
			</div>

			<ScenarioFormDialog
				isPending={createMutation.isPending || updateMutation.isPending}
				onOpenChange={setDialogOpen}
				onSubmit={handleFormSubmit}
				open={dialogOpen}
				scenario={editingScenario}
			/>
		</div>
	);
}
