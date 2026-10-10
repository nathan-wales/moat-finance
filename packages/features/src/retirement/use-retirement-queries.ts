import type {
	RetirementLeverInput,
	SolveRetirementGoalInput,
	UpdateRetirementPlanInput,
	UpdateRetirementSpendingPlanInput,
	UpsertRetirementStandingRuleInput,
} from "@moat/contracts";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import { useApiClient } from "../api-client-context";

export const retirementKeys = {
	overview: ["retirement", "overview"] as const,
	projection: (scenarioId: string | null, levers: RetirementLeverInput[]) =>
		["retirement", "projection", scenarioId, levers] as const,
	monteCarlo: (
		scenarioId: string | null,
		levers: RetirementLeverInput[],
		includeCone: boolean,
		includeSafeSpending: boolean,
	) =>
		[
			"retirement",
			"monteCarlo",
			scenarioId,
			levers,
			includeCone,
			includeSafeSpending,
		] as const,
	stress: (scenarioId: string | null, levers: RetirementLeverInput[]) =>
		["retirement", "stress", scenarioId, levers] as const,
	opportunities: (scenarioId?: string, limit?: number) =>
		[
			"retirement",
			"opportunities",
			scenarioId ?? "draft",
			limit ?? "default",
		] as const,
	spending: ["retirement", "spending"] as const,
	plan: ["retirement", "plan"] as const,
	scenarios: ["retirement", "scenarios"] as const,
	goal: (objective: SolveRetirementGoalInput["objective"]) =>
		["retirement", "goal", objective] as const,
};

function useDebouncedValue<T>(value: T, delayMs: number): T {
	const [debounced, setDebounced] = useState(value);
	useEffect(() => {
		const timer = setTimeout(() => setDebounced(value), delayMs);
		return () => clearTimeout(timer);
	}, [value, delayMs]);
	return debounced;
}

function useDebouncedLevers(levers: RetirementLeverInput[]) {
	const serialized = JSON.stringify(levers);
	const debounced = useDebouncedValue(serialized, 200);
	return useMemo(
		() => JSON.parse(debounced) as RetirementLeverInput[],
		[debounced],
	);
}

export function useRetirementOverview() {
	const api = useApiClient();
	return useQuery({
		queryKey: retirementKeys.overview,
		queryFn: () => api.getRetirementPlanOverview(),
	});
}

export function useRetirementProjection(
	levers: RetirementLeverInput[],
	scenarioId: string | null,
	enabled = true,
) {
	const api = useApiClient();
	const debouncedLevers = useDebouncedLevers(levers);
	return useQuery({
		queryKey: retirementKeys.projection(scenarioId, debouncedLevers),
		queryFn: () =>
			api.projectRetirementScenario({
				levers: debouncedLevers,
				scenarioId: scenarioId ?? undefined,
				includeBaseline: true,
			}),
		enabled,
		placeholderData: (previous) => previous,
	});
}

export function useRetirementMonteCarlo(
	levers: RetirementLeverInput[],
	scenarioId: string | null,
	options: {
		includeCone?: boolean;
		includeSafeSpending?: boolean;
		enabled?: boolean;
	} = {},
) {
	const api = useApiClient();
	const debouncedLevers = useDebouncedLevers(levers);
	const includeCone = options.includeCone === true;
	const includeSafeSpending = options.includeSafeSpending === true;
	const enabled = options.enabled ?? true;
	return useQuery({
		queryKey: retirementKeys.monteCarlo(
			scenarioId,
			debouncedLevers,
			includeCone,
			includeSafeSpending,
		),
		queryFn: () =>
			api.runRetirementMonteCarlo({
				levers: debouncedLevers,
				scenarioId: scenarioId ?? undefined,
				includeCone,
				includeSafeSpending,
			}),
		enabled,
		placeholderData: (previous) => previous,
	});
}

export function useRetirementStressTests(
	levers: RetirementLeverInput[],
	scenarioId: string | null,
	enabled = true,
) {
	const api = useApiClient();
	const debouncedLevers = useDebouncedLevers(levers);
	return useQuery({
		queryKey: retirementKeys.stress(scenarioId, debouncedLevers),
		queryFn: () =>
			api.runRetirementStressTests({
				levers: debouncedLevers,
				scenarioId: scenarioId ?? undefined,
			}),
		enabled,
	});
}

export function useRetirementComparison(scenarioIds: string[], enabled = true) {
	const api = useApiClient();
	return useQuery({
		queryKey: ["retirement", "compare", ...scenarioIds] as const,
		queryFn: () =>
			api.compareRetirementScenarios({
				scenarioIds,
				includeBaseline: true,
			}),
		enabled: enabled && scenarioIds.length > 0,
	});
}

/** Suggested takes ranks 1–6; the accordion is overflow. */
export const WHAT_IF_OPPORTUNITY_LIMIT = 12;

export function useRetirementOpportunities(
	scenarioId?: string,
	options: { limit?: number; enabled?: boolean } = {},
) {
	const api = useApiClient();
	const limit = options.limit ?? WHAT_IF_OPPORTUNITY_LIMIT;
	return useQuery({
		queryKey: retirementKeys.opportunities(scenarioId, limit),
		queryFn: () => api.getRetirementOpportunities({ scenarioId, limit }),
		enabled: options.enabled ?? true,
	});
}

export function useRetirementSpendingPlan() {
	const api = useApiClient();
	return useQuery({
		queryKey: retirementKeys.spending,
		queryFn: () => api.getRetirementSpendingPlan(),
	});
}

export function useRetirementScenarios() {
	const api = useApiClient();
	return useQuery({
		queryKey: retirementKeys.scenarios,
		queryFn: () => api.listRetirementScenarios(),
	});
}

export function useRetirementMutations() {
	const api = useApiClient();
	const queryClient = useQueryClient();
	const invalidate = () => {
		void queryClient.invalidateQueries({ queryKey: ["retirement"] });
	};

	const updatePlan = useMutation({
		mutationFn: (input: UpdateRetirementPlanInput) =>
			api.updateRetirementPlan(input),
		onSuccess: invalidate,
	});
	const updateSpending = useMutation({
		mutationFn: (input: UpdateRetirementSpendingPlanInput) =>
			api.updateRetirementSpendingPlan(input),
		onSuccess: invalidate,
	});
	const createScenario = useMutation({
		mutationFn: api.createRetirementScenario.bind(api),
		onSuccess: invalidate,
	});
	const updateScenario = useMutation({
		mutationFn: api.updateRetirementScenario.bind(api),
		onSuccess: invalidate,
	});
	const duplicateScenario = useMutation({
		mutationFn: api.duplicateRetirementScenario.bind(api),
		onSuccess: invalidate,
	});
	const deleteScenario = useMutation({
		mutationFn: (id: string) => api.deleteRetirementScenario({ id }),
		onSuccess: invalidate,
	});
	const upsertStandingRule = useMutation({
		mutationFn: (input: UpsertRetirementStandingRuleInput) =>
			api.upsertRetirementStandingRule(input),
		onSuccess: invalidate,
	});
	const deleteStandingRule = useMutation({
		mutationFn: (id: string) => api.deleteRetirementStandingRule({ id }),
		onSuccess: invalidate,
	});
	const solveGoal = useMutation({
		mutationFn: (input: SolveRetirementGoalInput) =>
			api.solveRetirementGoal(input),
	});

	return {
		updatePlan,
		updateSpending,
		createScenario,
		updateScenario,
		duplicateScenario,
		deleteScenario,
		upsertStandingRule,
		deleteStandingRule,
		solveGoal,
	};
}
