import type {
	RetirementComparison,
	RetirementComparisonColumn,
	RetirementScenarioLever,
} from "@moat/contracts";
import { RETIREMENT_SCENARIO_COLORS } from "@moat/contracts";
import type { RetirementBaseline } from "./build-baseline";
import { buildRetirementProjection } from "./build-projection";
import type { RetirementComputeOptions } from "./compute-options";
import { runMonteCarloAsync, seedFromKey } from "./monte-carlo";

export type PreparedRetirementComparison = {
	userId: string;
	trials: number;
	includeBaseline: boolean;
	baseline: RetirementBaseline;
	scenarios: Array<{
		id: string;
		name: string;
		color: string | null;
		levers: RetirementScenarioLever[];
	}>;
};

export async function computeRetirementComparison(
	prepared: PreparedRetirementComparison,
	options: RetirementComputeOptions = {},
): Promise<RetirementComparison> {
	const columns: RetirementComparisonColumn[] = [];

	const toColumn = async (args: {
		scenarioId: string | null;
		name: string;
		color: string | null;
		levers: Parameters<typeof buildRetirementProjection>[0]["levers"];
	}): Promise<RetirementComparisonColumn> => {
		const built = buildRetirementProjection({
			baseline: prepared.baseline,
			levers: args.levers,
			scenarioId: args.scenarioId,
			scenarioName: args.name,
		});
		const outcome = await runMonteCarloAsync(built.inputs, {
			trials: prepared.trials,
			seed: seedFromKey(
				`${prepared.userId}:${args.scenarioId ?? "baseline"}:${built.projection.projectionKey}`,
			),
			includeCone: false,
			...options,
		});
		return {
			scenarioId: args.scenarioId,
			name: args.name,
			color: args.color,
			summary: {
				...built.projection.summary,
				confidence: outcome.confidence,
			},
			confidence: outcome.confidence,
			worstDecileLegacy: outcome.worstDecileLegacy,
			runsOut: !built.result.fundedThroughLongevity,
			series: built.projection.years.map((year) => ({
				age: year.age,
				year: year.year,
				netWorth: year.netWorth,
			})),
		};
	};

	if (prepared.includeBaseline) {
		columns.push(
			await toColumn({
				scenarioId: null,
				name: "Baseline",
				color: null,
				levers: [],
			}),
		);
	}

	for (const [index, scenario] of prepared.scenarios.entries()) {
		columns.push(
			await toColumn({
				scenarioId: scenario.id,
				name: scenario.name,
				color:
					scenario.color ??
					RETIREMENT_SCENARIO_COLORS[
						index % RETIREMENT_SCENARIO_COLORS.length
					] ??
					null,
				levers: scenario.levers,
			}),
		);
	}

	return { columns };
}
