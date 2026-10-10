import type { z } from "zod";
import {
	areaChartWidgetSchema,
	barChartWidgetSchema,
	budgetFormWidgetSchema,
	cashFlowChartWidgetSchema,
	confirmationCardWidgetSchema,
	insightCardWidgetSchema,
	lineChartWidgetSchema,
	netWorthChartWidgetSchema,
	pieChartWidgetSchema,
	projectionChartWidgetSchema,
	ruleBuilderFormWidgetSchema,
	scenarioComparisonWidgetSchema,
	scenarioFormWidgetSchema,
	spendingBreakdownChartWidgetSchema,
	stackedBarChartWidgetSchema,
	transactionEditFormWidgetSchema,
	transactionTableWidgetSchema,
} from "./schemas";
import type { MoatWidgetType } from "./types";

type WidgetRegistryEntry = {
	schema: z.ZodType<unknown>;
	clientComponent: string;
	interactive: boolean;
};

export const moatWidgetRegistry = {
	insight_card: {
		schema: insightCardWidgetSchema,
		clientComponent: "InsightCardWidget",
		interactive: false,
	},
	transaction_table: {
		schema: transactionTableWidgetSchema,
		clientComponent: "TransactionTableWidget",
		interactive: false,
	},
	line_chart: {
		schema: lineChartWidgetSchema,
		clientComponent: "LineChartWidget",
		interactive: false,
	},
	bar_chart: {
		schema: barChartWidgetSchema,
		clientComponent: "BarChartWidget",
		interactive: false,
	},
	pie_chart: {
		schema: pieChartWidgetSchema,
		clientComponent: "PieChartWidget",
		interactive: false,
	},
	area_chart: {
		schema: areaChartWidgetSchema,
		clientComponent: "AreaChartWidget",
		interactive: false,
	},
	stacked_bar_chart: {
		schema: stackedBarChartWidgetSchema,
		clientComponent: "StackedBarChartWidget",
		interactive: false,
	},
	projection_chart: {
		schema: projectionChartWidgetSchema,
		clientComponent: "ProjectionChartWidget",
		interactive: false,
	},
	net_worth_chart: {
		schema: netWorthChartWidgetSchema,
		clientComponent: "NetWorthChartWidget",
		interactive: false,
	},
	cash_flow_chart: {
		schema: cashFlowChartWidgetSchema,
		clientComponent: "CashFlowChartWidget",
		interactive: false,
	},
	spending_breakdown_chart: {
		schema: spendingBreakdownChartWidgetSchema,
		clientComponent: "SpendingBreakdownChartWidget",
		interactive: false,
	},
	scenario_comparison: {
		schema: scenarioComparisonWidgetSchema,
		clientComponent: "ScenarioComparisonWidget",
		interactive: false,
	},
	budget_form: {
		schema: budgetFormWidgetSchema,
		clientComponent: "BudgetFormWidget",
		interactive: true,
	},
	scenario_form: {
		schema: scenarioFormWidgetSchema,
		clientComponent: "ScenarioFormWidget",
		interactive: true,
	},
	transaction_edit_form: {
		schema: transactionEditFormWidgetSchema,
		clientComponent: "TransactionEditFormWidget",
		interactive: true,
	},
	rule_builder_form: {
		schema: ruleBuilderFormWidgetSchema,
		clientComponent: "RuleBuilderFormWidget",
		interactive: true,
	},
	confirmation_card: {
		schema: confirmationCardWidgetSchema,
		clientComponent: "ConfirmationCardWidget",
		interactive: true,
	},
} satisfies Record<MoatWidgetType, WidgetRegistryEntry>;

export function isRegisteredWidgetType(type: string): type is MoatWidgetType {
	return type in moatWidgetRegistry;
}
