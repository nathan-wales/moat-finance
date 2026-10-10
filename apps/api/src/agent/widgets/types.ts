import type { MoatWidgetActionType } from "./actions";

export type MoatWidgetType =
	| "insight_card"
	| "transaction_table"
	| "line_chart"
	| "bar_chart"
	| "pie_chart"
	| "area_chart"
	| "stacked_bar_chart"
	| "projection_chart"
	| "net_worth_chart"
	| "cash_flow_chart"
	| "spending_breakdown_chart"
	| "scenario_comparison"
	| "budget_form"
	| "scenario_form"
	| "transaction_edit_form"
	| "rule_builder_form"
	| "confirmation_card";

export type MoatWidgetSource =
	| "actual_user_data"
	| "projection"
	| "example"
	| "mixed";

export type MoatWidgetInteractionLevel =
	| "display_only"
	| "local_edit"
	| "server_action";

export type MoatWidgetBase = {
	id: string;
	type: MoatWidgetType;
	widgetSchemaVersion: string;
	title: string;
	description?: string;
	source: MoatWidgetSource;
	assumptions?: string[];
	generatedAt: string;
	interactionLevel: MoatWidgetInteractionLevel;
};

export type InsightCardWidget = MoatWidgetBase & {
	type: "insight_card";
	summary: string;
	items?: Array<{
		label: string;
		value: string;
		tone?: "default" | "positive" | "negative" | "warning";
	}>;
};

export type TransactionTableWidget = MoatWidgetBase & {
	type: "transaction_table";
	rows: Array<{
		id: string;
		date: string;
		merchant: string;
		category: string;
		amount: number;
	}>;
};

export type GenericChartWidget = MoatWidgetBase & {
	type:
		| "line_chart"
		| "bar_chart"
		| "pie_chart"
		| "area_chart"
		| "stacked_bar_chart"
		| "projection_chart";
	data: Array<Record<string, string | number | null>>;
	xKey?: string;
	yKeys?: string[];
};

export type NetWorthChartWidget = MoatWidgetBase & {
	type: "net_worth_chart";
	data: Array<{
		month: string;
		actual?: number;
		forecast?: number;
	}>;
};

export type CashFlowChartWidget = MoatWidgetBase & {
	type: "cash_flow_chart";
	data: Array<{
		month: string;
		income: number;
		expenses: number;
		net: number;
	}>;
};

export type SpendingBreakdownChartWidget = MoatWidgetBase & {
	type: "spending_breakdown_chart";
	data: Array<{
		category: string;
		amount: number;
	}>;
};

export type ScenarioComparisonWidget = MoatWidgetBase & {
	type: "scenario_comparison";
	scenarios: Array<{
		id: string;
		name: string;
		projectedNetWorth: number;
		monthlyContribution?: number;
		growthRate?: number;
	}>;
};

export type MoatWidgetField =
	| {
			name: string;
			label: string;
			type: "text";
			value?: string;
			placeholder?: string;
			required?: boolean;
	  }
	| {
			name: string;
			label: string;
			type: "currency";
			value?: number;
			required?: boolean;
	  }
	| {
			name: string;
			label: string;
			type: "number";
			value?: number;
			min?: number;
			max?: number;
			step?: number;
			required?: boolean;
	  }
	| {
			name: string;
			label: string;
			type: "select";
			value?: string;
			options: Array<{ label: string; value: string }>;
			required?: boolean;
	  }
	| {
			name: string;
			label: string;
			type: "multi_select";
			value?: string[];
			options: Array<{ label: string; value: string }>;
			required?: boolean;
	  }
	| {
			name: string;
			label: string;
			type: "date";
			value?: string;
			required?: boolean;
	  };

export type MoatInteractiveWidget = MoatWidgetBase & {
	type:
		| "budget_form"
		| "scenario_form"
		| "transaction_edit_form"
		| "rule_builder_form";
	interactionLevel: "local_edit" | "server_action";
	fields: MoatWidgetField[];
	actions: Array<{
		id: string;
		label: string;
		type: MoatWidgetActionType;
		style?: "primary" | "secondary" | "destructive";
		requiresConfirmation?: boolean;
	}>;
};

export type ConfirmationCardWidget = MoatWidgetBase & {
	type: "confirmation_card";
	interactionLevel: "server_action";
	confirmationId: string;
	summary: string;
	details?: Array<{
		label: string;
		value: string;
	}>;
	confirmAction: {
		id: string;
		label: string;
		actionType: MoatWidgetActionType;
	};
	cancelAction: {
		id: string;
		label: string;
	};
};

export type MoatWidget =
	| InsightCardWidget
	| TransactionTableWidget
	| GenericChartWidget
	| NetWorthChartWidget
	| CashFlowChartWidget
	| SpendingBreakdownChartWidget
	| ScenarioComparisonWidget
	| MoatInteractiveWidget
	| ConfirmationCardWidget;
