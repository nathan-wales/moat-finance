import crypto from "node:crypto";
import { z } from "zod";
import { db } from "~/server/db";

import { AgentError } from "../errors";
import { TimelineStore } from "../timeline/timeline-store";
import type { MoatToolDefinition } from "../tools/types";
import { moatWidgetSchema } from "./schemas";
import type { MoatWidget } from "./types";

// OpenAI requires top-level type:"object" for function parameters.
// The full widget schema is a discriminated union, which cannot be used as the
// function-parameter root. This object lists every widget-specific property the
// model may need, then execute() validates against the real widget union.
const chartValueSchema = z.union([z.string(), z.number(), z.null()]);

const widgetItemSchema = z.object({
	label: z.string().min(1),
	value: z.string().min(1),
	tone: z.enum(["default", "positive", "negative", "warning"]).optional(),
});

const transactionRowSchema = z.object({
	id: z.string().min(1),
	date: z.string().min(1),
	merchant: z.string().min(1),
	category: z.string().min(1),
	amount: z.number(),
});

const fieldOptionSchema = z.object({
	label: z.string().min(1),
	value: z.string().min(1),
});

const widgetFieldSchema = z
	.object({
		name: z.string().min(1),
		label: z.string().min(1),
		type: z.enum([
			"text",
			"currency",
			"number",
			"select",
			"multi_select",
			"date",
		]),
		value: z.union([z.string(), z.number(), z.array(z.string())]).optional(),
		placeholder: z.string().optional(),
		min: z.number().optional(),
		max: z.number().optional(),
		step: z.number().optional(),
		options: z.array(fieldOptionSchema).optional(),
		required: z.boolean().optional(),
	})
	.passthrough();

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

const widgetActionSchema = z.object({
	id: z.string().min(1),
	label: z.string().min(1),
	type: widgetActionTypeSchema,
	style: z.enum(["primary", "secondary", "destructive"]).optional(),
	requiresConfirmation: z.boolean().optional(),
});

export const renderWidgetInputSchema = z
	.object({
		id: z.string().min(1).optional(),
		type: z
			.enum([
				"insight_card",
				"transaction_table",
				"line_chart",
				"bar_chart",
				"pie_chart",
				"area_chart",
				"stacked_bar_chart",
				"projection_chart",
				"net_worth_chart",
				"cash_flow_chart",
				"spending_breakdown_chart",
				"scenario_comparison",
				"budget_form",
				"scenario_form",
				"transaction_edit_form",
				"rule_builder_form",
				"confirmation_card",
			])
			.describe("Widget type to render."),
		widgetSchemaVersion: z.string().optional(),
		title: z.string().min(1),
		description: z.string().optional(),
		source: z
			.enum(["actual_user_data", "projection", "example", "mixed"])
			.describe(
				"Use actual_user_data only when the data came from a data-fetching tool or user-provided values.",
			),
		assumptions: z.array(z.string()).optional(),
		generatedAt: z.string().optional(),
		interactionLevel: z.enum(["display_only", "local_edit", "server_action"]),

		// Display widget fields
		summary: z.string().min(1).optional(),
		items: z.array(widgetItemSchema).max(12).optional(),
		rows: z.array(transactionRowSchema).max(100).optional(),
		data: z
			.array(z.record(chartValueSchema))
			.max(500)
			.optional()
			.describe(
				"Chart data. net_worth_chart rows need {month, actual?, forecast?}; cash_flow_chart rows need {month, income, expenses, net}; spending_breakdown_chart rows need {category, amount}.",
			),
		xKey: z.string().optional(),
		yKeys: z.array(z.string()).optional(),
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
			.max(25)
			.optional(),

		// Interactive widget fields
		fields: z.array(widgetFieldSchema).max(100).optional(),
		actions: z.array(widgetActionSchema).max(10).optional(),
		confirmationId: z.string().min(1).optional(),
		details: z
			.array(
				z.object({
					label: z.string().min(1),
					value: z.string().min(1),
				}),
			)
			.max(25)
			.optional(),
		confirmAction: z
			.object({
				id: z.string().min(1),
				label: z.string().min(1),
				actionType: widgetActionTypeSchema,
			})
			.optional(),
		cancelAction: z
			.object({
				id: z.string().min(1),
				label: z.string().min(1),
			})
			.optional(),
	})
	.passthrough();

export type RenderWidgetInput = z.infer<typeof renderWidgetInputSchema>;

export type RenderWidgetOutput = {
	widgetId: string;
	widgetType: MoatWidget["type"];
	summary: string;
};

export const renderWidgetTool: MoatToolDefinition<
	RenderWidgetInput,
	RenderWidgetOutput
> = {
	name: "render_widget",
	displayName: "Render widget",
	description: [
		"Render a supported Moat widget in the chat timeline. Use this when structured UI is better than plain text.",
		"Pass all widget fields directly as top-level arguments. The server fills id, widgetSchemaVersion, and generatedAt automatically.",
		"For actual_user_data widgets, first call the relevant data-fetching tool, then pass that output into this tool. Do not call this tool with actual_user_data and no data/rows/scenarios.",
		"Supported widget types and their required extra fields:",
		"  insight_card: summary (string), items? [{label,value,tone?}]",
		"  transaction_table: rows [{id,date,merchant,category,amount}]",
		"  line_chart | bar_chart | pie_chart | area_chart | stacked_bar_chart | projection_chart: data [{...}], xKey?, yKeys?",
		"  net_worth_chart: data [{month,actual?,forecast?}]",
		"  cash_flow_chart: data [{month,income,expenses,net}]",
		"  spending_breakdown_chart: data [{category,amount}]",
		"  scenario_comparison: scenarios [{id,name,projectedNetWorth,monthlyContribution?,growthRate?}]",
		"Required base fields for all widgets: type, title, source ('actual_user_data' | 'projection' | 'example' | 'mixed'), interactionLevel ('display_only' | 'local_edit' | 'server_action').",
		"Use source='actual_user_data' only for real user data. For projections/examples/mixed, include an assumptions array.",
		"Limits: transaction_table.rows max 100, chart data max 500 points.",
	].join("\n"),
	enabled: true,
	capabilities: [],
	safetyClass: "read_only_app_data",
	requiresConfirmation: false,
	inputSchema: renderWidgetInputSchema,
	execute: async (input, context) => {
		const { id, widgetSchemaVersion, generatedAt, ...rest } = input;
		const widgetData = {
			widgetSchemaVersion: widgetSchemaVersion ?? "1",
			generatedAt: generatedAt ?? new Date().toISOString(),
			...rest,
			id: id ?? `wid_${crypto.randomUUID()}`,
		};

		const parsed = moatWidgetSchema.safeParse(widgetData);
		if (!parsed.success) {
			const issues = parsed.error.errors
				.map((e) => `${e.path.join(".") || "root"}: ${e.message}`)
				.join("; ");
			throw new AgentError(
				"VALIDATION_ERROR",
				`Widget validation failed — ${issues}`,
			);
		}
		const parsedWidget = parsed.data;

		const timelineStore = new TimelineStore(db);
		await timelineStore.createWidgetBlock({
			conversationId: context.conversationId,
			widget: parsedWidget,
			runId: context.runId,
			stepId: context.stepId,
		});

		await context.emit?.({
			type: "widget_started",
			runId: context.runId,
			stepId: context.stepId,
			widgetId: parsedWidget.id,
			widgetType: parsedWidget.type,
		});

		await context.emit?.({
			type: "widget_done",
			runId: context.runId,
			stepId: context.stepId,
			widget: parsedWidget,
		});

		return {
			widgetId: parsedWidget.id,
			widgetType: parsedWidget.type,
			summary: `Rendered ${parsedWidget.type}.`,
		};
	},
};
