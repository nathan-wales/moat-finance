import { z } from "zod";

const isoDateStringSchema = z
	.string()
	.refine((value) => !Number.isNaN(Date.parse(value)), {
		message: "Expected a valid ISO date string",
	});

const widgetSourceSchema = z.enum([
	"actual_user_data",
	"projection",
	"example",
	"mixed",
]);

export const moatWidgetBaseSchema = z.object({
	id: z.string().min(1),
	type: z.string(),
	widgetSchemaVersion: z.string().min(1),
	title: z.string().min(1),
	description: z.string().optional(),
	source: widgetSourceSchema,
	assumptions: z.array(z.string()).optional(),
	generatedAt: isoDateStringSchema,
	interactionLevel: z.enum(["display_only", "local_edit", "server_action"]),
});

const displayBaseSchema = moatWidgetBaseSchema.extend({
	interactionLevel: z.literal("display_only"),
});

export const insightCardWidgetSchema = displayBaseSchema.extend({
	type: z.literal("insight_card"),
	summary: z.string().min(1),
	items: z
		.array(
			z.object({
				label: z.string().min(1),
				value: z.string().min(1),
				tone: z.enum(["default", "positive", "negative", "warning"]).optional(),
			}),
		)
		.max(12)
		.optional(),
});

export const transactionTableWidgetSchema = displayBaseSchema.extend({
	type: z.literal("transaction_table"),
	rows: z
		.array(
			z.object({
				id: z.string().min(1),
				date: isoDateStringSchema,
				merchant: z.string().min(1),
				category: z.string().min(1),
				amount: z.number(),
			}),
		)
		.max(100),
});

const chartValueSchema = z.union([z.string(), z.number(), z.null()]);

function createGenericChartWidgetSchema<TType extends string>(type: TType) {
	return displayBaseSchema.extend({
		type: z.literal(type),
		data: z.array(z.record(chartValueSchema)).max(500),
		xKey: z.string().optional(),
		yKeys: z.array(z.string()).optional(),
	});
}

export const lineChartWidgetSchema =
	createGenericChartWidgetSchema("line_chart");
export const barChartWidgetSchema = createGenericChartWidgetSchema("bar_chart");
export const pieChartWidgetSchema = createGenericChartWidgetSchema("pie_chart");
export const areaChartWidgetSchema =
	createGenericChartWidgetSchema("area_chart");
export const stackedBarChartWidgetSchema =
	createGenericChartWidgetSchema("stacked_bar_chart");
export const projectionChartWidgetSchema =
	createGenericChartWidgetSchema("projection_chart");

export const netWorthChartWidgetSchema = displayBaseSchema.extend({
	type: z.literal("net_worth_chart"),
	data: z
		.array(
			z.object({
				month: z.string().min(1),
				actual: z.number().optional(),
				forecast: z.number().optional(),
			}),
		)
		.max(500),
});

export const cashFlowChartWidgetSchema = displayBaseSchema.extend({
	type: z.literal("cash_flow_chart"),
	data: z
		.array(
			z.object({
				month: z.string().min(1),
				income: z.number(),
				expenses: z.number(),
				net: z.number(),
			}),
		)
		.max(500),
});

export const spendingBreakdownChartWidgetSchema = displayBaseSchema.extend({
	type: z.literal("spending_breakdown_chart"),
	data: z
		.array(
			z.object({
				category: z.string().min(1),
				amount: z.number(),
			}),
		)
		.max(500),
});

export const scenarioComparisonWidgetSchema = displayBaseSchema.extend({
	type: z.literal("scenario_comparison"),
	scenarios: z
		.array(
			z.object({
				id: z.string().min(1),
				name: z.string().min(1),
				projectedNetWorth: z.number(),
				monthlyContribution: z.number().optional(),
				growthRate: z.number().optional(),
			}),
		)
		.max(25),
});

const widgetActionTypeSchema = z.enum([
	"create_rule",
	"save_budget_targets",
	"update_transaction",
	"create_scenario",
	"run_scenario",
	"apply_hashtags",
	"confirm_pending_action",
	"cancel_pending_action",
]);

const fieldOptionSchema = z.object({
	label: z.string().min(1),
	value: z.string().min(1),
});

export const moatWidgetFieldSchema = z.discriminatedUnion("type", [
	z.object({
		name: z.string().min(1),
		label: z.string().min(1),
		type: z.literal("text"),
		value: z.string().optional(),
		placeholder: z.string().optional(),
		required: z.boolean().optional(),
	}),
	z.object({
		name: z.string().min(1),
		label: z.string().min(1),
		type: z.literal("currency"),
		value: z.number().optional(),
		required: z.boolean().optional(),
	}),
	z.object({
		name: z.string().min(1),
		label: z.string().min(1),
		type: z.literal("number"),
		value: z.number().optional(),
		min: z.number().optional(),
		max: z.number().optional(),
		step: z.number().optional(),
		required: z.boolean().optional(),
	}),
	z.object({
		name: z.string().min(1),
		label: z.string().min(1),
		type: z.literal("select"),
		value: z.string().optional(),
		options: z.array(fieldOptionSchema).min(1).max(200),
		required: z.boolean().optional(),
	}),
	z.object({
		name: z.string().min(1),
		label: z.string().min(1),
		type: z.literal("multi_select"),
		value: z.array(z.string()).optional(),
		options: z.array(fieldOptionSchema).min(1).max(200),
		required: z.boolean().optional(),
	}),
	z.object({
		name: z.string().min(1),
		label: z.string().min(1),
		type: z.literal("date"),
		value: z.string().optional(),
		required: z.boolean().optional(),
	}),
]);

const interactiveBaseSchema = moatWidgetBaseSchema.extend({
	interactionLevel: z.enum(["local_edit", "server_action"]),
	fields: z.array(moatWidgetFieldSchema).max(100),
	actions: z
		.array(
			z.object({
				id: z.string().min(1),
				label: z.string().min(1),
				type: widgetActionTypeSchema,
				style: z.enum(["primary", "secondary", "destructive"]).optional(),
				requiresConfirmation: z.boolean().optional(),
			}),
		)
		.max(10),
});

export const budgetFormWidgetSchema = interactiveBaseSchema.extend({
	type: z.literal("budget_form"),
});
export const scenarioFormWidgetSchema = interactiveBaseSchema.extend({
	type: z.literal("scenario_form"),
});
export const transactionEditFormWidgetSchema = interactiveBaseSchema.extend({
	type: z.literal("transaction_edit_form"),
});
export const ruleBuilderFormWidgetSchema = interactiveBaseSchema.extend({
	type: z.literal("rule_builder_form"),
});

export const confirmationCardWidgetSchema = moatWidgetBaseSchema.extend({
	type: z.literal("confirmation_card"),
	interactionLevel: z.literal("server_action"),
	confirmationId: z.string().min(1),
	summary: z.string().min(1),
	details: z
		.array(
			z.object({
				label: z.string().min(1),
				value: z.string().min(1),
			}),
		)
		.max(25)
		.optional(),
	confirmAction: z.object({
		id: z.string().min(1),
		label: z.string().min(1),
		actionType: widgetActionTypeSchema,
	}),
	cancelAction: z.object({
		id: z.string().min(1),
		label: z.string().min(1),
	}),
});

export const moatWidgetSchema = z
	.discriminatedUnion("type", [
		insightCardWidgetSchema,
		transactionTableWidgetSchema,
		lineChartWidgetSchema,
		barChartWidgetSchema,
		pieChartWidgetSchema,
		areaChartWidgetSchema,
		stackedBarChartWidgetSchema,
		projectionChartWidgetSchema,
		netWorthChartWidgetSchema,
		cashFlowChartWidgetSchema,
		spendingBreakdownChartWidgetSchema,
		scenarioComparisonWidgetSchema,
		budgetFormWidgetSchema,
		scenarioFormWidgetSchema,
		transactionEditFormWidgetSchema,
		ruleBuilderFormWidgetSchema,
		confirmationCardWidgetSchema,
	])
	.superRefine((widget, ctx) => {
		if (
			widget.source !== "actual_user_data" &&
			(!widget.assumptions || widget.assumptions.length === 0)
		) {
			ctx.addIssue({
				code: z.ZodIssueCode.custom,
				path: ["assumptions"],
				message: "Projection, example, and mixed widgets require assumptions.",
			});
		}
	});

export type MoatWidgetInput = z.input<typeof moatWidgetSchema>;
