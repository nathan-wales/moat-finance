import type {
	CreateForecastScenarioInput,
	ForecastScenario,
	UpdateForecastScenarioInput,
} from "../types";

export interface ForecastRepository {
	listScenarios(input: { userId: string }): Promise<ForecastScenario[]>;
	seedDefaultScenarios(input: { userId: string }): Promise<{ seeded: boolean }>;
	createScenario(
		input: { userId: string } & CreateForecastScenarioInput,
	): Promise<ForecastScenario>;
	updateScenario(input: {
		userId: string;
		id: string;
		data: UpdateForecastScenarioInput;
	}): Promise<ForecastScenario>;
	deleteScenario(input: { userId: string; id: string }): Promise<void>;
	setActiveScenario(input: {
		userId: string;
		id: string | null;
	}): Promise<void>;
}
