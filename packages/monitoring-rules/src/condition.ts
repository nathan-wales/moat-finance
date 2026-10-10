import { z } from "zod";

/**
 * Legacy decorative condition kinds kept for stored rules / UI labels.
 * Evaluation ignores these — prefer `watchQuery` for counts, windows, and
 * expected-vs-actual reports (see packages/monitoring-rules watch-query).
 */
export const conditionKindSchema = z.enum([
	"appears",
	"does_not_appear_by_date",
	"exceeds_amount",
	"falls_below_amount",
	"changes_by_percent",
	"happens_more_than",
	"is_unusual",
	"is_forecast",
	"remains_unresolved",
]);

export type ConditionKind = z.infer<typeof conditionKindSchema>;

export const notificationConditionSchema = z.object({
	kind: conditionKindSchema,
	amount: z.number().finite().optional(),
	percent: z.number().finite().optional(),
	count: z.number().int().positive().optional(),
	dayOfMonth: z.number().int().min(1).max(31).optional(),
	unresolvedHours: z.number().positive().optional(),
	comparisonBaseline: z
		.enum(["recent_average", "previous_period", "budget"])
		.optional(),
});

export type NotificationCondition = z.infer<typeof notificationConditionSchema>;
