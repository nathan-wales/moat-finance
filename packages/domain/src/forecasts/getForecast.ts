import type { ForecastScenario } from "@moat/data-access";
import type { AppContext } from "../context";

export type GetForecastInput = {
	/** Optional: only return the active scenario */
	activeOnly?: boolean;
};

/**
 * Returns forecast scenarios for the user.
 */
export async function getForecast(
	ctx: AppContext,
	input: GetForecastInput = {},
): Promise<ForecastScenario[]> {
	const scenarios = await ctx.repositories.forecasts.listScenarios({
		userId: ctx.userId,
	});

	if (input.activeOnly) {
		return scenarios.filter((s) => s.isActive);
	}

	return scenarios;
}
