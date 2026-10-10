import { z } from "zod";

export const watchSourceKinds = [
	"transactions",
	"budgets",
	"balances",
	"recurring",
	"accounts_sync",
	"scheduled_summary",
] as const;

export const watchSourceKindSchema = z.enum(watchSourceKinds);
export type WatchSourceKind = z.infer<typeof watchSourceKindSchema>;

export const watchSourceSchema = z.object({
	kind: watchSourceKindSchema,
});
export type WatchSource = z.infer<typeof watchSourceSchema>;

const stringOrStringArraySchema = z.union([
	z.string().min(1).max(200),
	z.array(z.string().min(1).max(200)).min(1).max(40),
]);

const numberCompareFields = {
	value: z.number().finite().optional(),
	min: z.number().finite().optional(),
	max: z.number().finite().optional(),
} as const;

export const watchClauseSchema = z.discriminatedUnion("field", [
	z.object({
		field: z.literal("merchant"),
		op: z.enum([
			"contains",
			"contains_any",
			"contains_all",
			"eq",
			"starts_with",
		]),
		value: stringOrStringArraySchema,
		caseSensitive: z.boolean().optional(),
	}),
	z.object({
		field: z.literal("description"),
		op: z.enum([
			"contains",
			"contains_any",
			"contains_all",
			"eq",
			"starts_with",
		]),
		value: stringOrStringArraySchema,
		caseSensitive: z.boolean().optional(),
	}),
	z.object({
		field: z.literal("category"),
		op: z.enum(["eq", "in", "not_in", "neq"]),
		value: stringOrStringArraySchema,
	}),
	z.object({
		field: z.literal("categoryId"),
		op: z.enum(["eq", "in"]),
		value: stringOrStringArraySchema,
	}),
	z.object({
		field: z.literal("hashtag"),
		op: z.enum(["eq", "in"]),
		value: stringOrStringArraySchema,
	}),
	z.object({
		field: z.literal("accountId"),
		op: z.enum(["in", "not_in"]),
		value: z.array(z.string().min(1)).min(1).max(50),
	}),
	z.object({
		field: z.literal("amountAbs"),
		op: z.enum(["eq", "neq", "gt", "gte", "lt", "lte", "between"]),
		...numberCompareFields,
	}),
	z.object({
		field: z.literal("amountSigned"),
		op: z.enum(["eq", "neq", "gt", "gte", "lt", "lte", "between"]),
		...numberCompareFields,
	}),
	z.object({
		field: z.literal("direction"),
		op: z.literal("eq"),
		value: z.enum(["inflow", "outflow", "transfer"]),
	}),
	z.object({
		field: z.literal("isRecurring"),
		op: z.literal("eq"),
		value: z.boolean(),
	}),
	z.object({
		field: z.literal("recurringLabel"),
		op: z.enum(["contains", "eq"]),
		value: z.string().min(1).max(120),
	}),
	z.object({
		field: z.literal("connectionId"),
		op: z.literal("in"),
		value: z.array(z.string().min(1)).min(1).max(50),
	}),
]);

export type WatchClause = z.infer<typeof watchClauseSchema>;

export const watchFilterSchema = z.object({
	all: z.array(watchClauseSchema).max(40).optional(),
	any: z.array(watchClauseSchema).max(40).optional(),
	none: z.array(watchClauseSchema).max(40).optional(),
});
export type WatchFilter = z.infer<typeof watchFilterSchema>;

export const watchWindowKinds = [
	"same_day",
	"rolling_days",
	"calendar_month",
	"month_to_date",
	"day_of_month_range",
	"previous_calendar_week",
	"last_seven_days",
	"previous_month",
	"custom_period_days",
] as const;

export const watchWindowKindSchema = z.enum(watchWindowKinds);
export type WatchWindowKind = z.infer<typeof watchWindowKindSchema>;

export const watchWindowSchema = z
	.object({
		kind: watchWindowKindSchema,
		startDay: z.number().int().min(1).max(31).optional(),
		endDay: z.number().int().min(1).max(31).optional(),
		days: z.number().int().min(1).max(90).optional(),
		timezone: z.string().min(1).max(80).optional(),
	})
	.superRefine((window, ctx) => {
		if (window.kind === "day_of_month_range") {
			if (window.startDay === undefined || window.endDay === undefined) {
				ctx.addIssue({
					code: z.ZodIssueCode.custom,
					message: "day_of_month_range requires startDay and endDay",
				});
			} else if (window.startDay > window.endDay) {
				ctx.addIssue({
					code: z.ZodIssueCode.custom,
					message: "day_of_month_range requires startDay <= endDay",
				});
			}
		}
		if (
			(window.kind === "rolling_days" ||
				window.kind === "custom_period_days") &&
			window.days === undefined
		) {
			ctx.addIssue({
				code: z.ZodIssueCode.custom,
				message: `${window.kind} requires days`,
			});
		}
	});
export type WatchWindow = z.infer<typeof watchWindowSchema>;

export const watchMeasureMetrics = [
	"count",
	"sum_amount_abs",
	"sum_amount_signed",
	"avg_amount_abs",
	"max_amount_abs",
	"distinct_merchants",
	"budget_spent_percent",
	"budget_remaining_amount",
	"balance",
	"exists",
	"missing",
] as const;

export const watchMeasureMetricSchema = z.enum(watchMeasureMetrics);
export type WatchMeasureMetric = z.infer<typeof watchMeasureMetricSchema>;

export const watchMeasureSchema = z.object({
	metric: watchMeasureMetricSchema,
});
export type WatchMeasure = z.infer<typeof watchMeasureSchema>;

export const watchPredicateOps = [
	"eq",
	"neq",
	"gte",
	"lte",
	"gt",
	"lt",
	"between",
	"crossed_above",
	"crossed_below",
	"always",
] as const;

export const watchPredicateOpSchema = z.enum(watchPredicateOps);
export type WatchPredicateOp = z.infer<typeof watchPredicateOpSchema>;

export const watchPredicateSchema = z.object({
	op: watchPredicateOpSchema,
	value: z.number().finite().optional(),
	min: z.number().finite().optional(),
	max: z.number().finite().optional(),
	expected: z.number().finite().optional(),
});
export type WatchPredicate = z.infer<typeof watchPredicateSchema>;

export const watchReportModes = [
	"on_match",
	"on_change",
	"status_report",
	"expected_vs_actual",
] as const;

export const watchReportModeSchema = z.enum(watchReportModes);
export type WatchReportMode = z.infer<typeof watchReportModeSchema>;

export const watchReportSchema = z.object({
	mode: watchReportModeSchema,
});
export type WatchReport = z.infer<typeof watchReportSchema>;

function refineAmountClause(
	clause: WatchClause,
	ctx: z.RefinementCtx,
	pathPrefix: Array<string | number>,
) {
	if (clause.field !== "amountAbs" && clause.field !== "amountSigned") return;
	if (clause.op === "between") {
		if (clause.min === undefined || clause.max === undefined) {
			ctx.addIssue({
				code: z.ZodIssueCode.custom,
				message: `${clause.field} between requires min and max`,
				path: pathPrefix,
			});
		} else if (clause.min > clause.max) {
			ctx.addIssue({
				code: z.ZodIssueCode.custom,
				message: `${clause.field} between requires min <= max`,
				path: pathPrefix,
			});
		}
		return;
	}
	if (clause.value === undefined) {
		ctx.addIssue({
			code: z.ZodIssueCode.custom,
			message: `${clause.field} ${clause.op} requires value`,
			path: pathPrefix,
		});
	}
}

export const watchQuerySchema = z
	.object({
		source: watchSourceSchema,
		filter: watchFilterSchema.optional(),
		window: watchWindowSchema,
		measure: watchMeasureSchema,
		predicate: watchPredicateSchema,
		report: watchReportSchema,
	})
	.superRefine((query, ctx) => {
		const groups: Array<keyof NonNullable<WatchFilter>> = [
			"all",
			"any",
			"none",
		];
		for (const group of groups) {
			const clauses = query.filter?.[group] ?? [];
			for (const [index, clause] of clauses.entries()) {
				refineAmountClause(clause, ctx, ["filter", group, index]);
			}
		}
		if (query.predicate.op === "between") {
			if (
				query.predicate.min === undefined ||
				query.predicate.max === undefined
			) {
				ctx.addIssue({
					code: z.ZodIssueCode.custom,
					message: "predicate between requires min and max",
					path: ["predicate"],
				});
			}
		} else if (
			query.predicate.op !== "always" &&
			query.predicate.value === undefined
		) {
			ctx.addIssue({
				code: z.ZodIssueCode.custom,
				message: `predicate ${query.predicate.op} requires value`,
				path: ["predicate", "value"],
			});
		}
	});
export type WatchQuery = z.infer<typeof watchQuerySchema>;
