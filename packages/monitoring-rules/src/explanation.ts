import { z } from "zod";
import { notificationSignalTypeSchema } from "./signal";

export const explanationFactSchema = z.object({
	label: z.string().min(1).max(200),
	value: z.string().min(1).max(500),
});

export const notificationExplanationSchema = z.object({
	signalType: notificationSignalTypeSchema,
	summary: z.string().min(1).max(500),
	facts: z.array(explanationFactSchema).max(40).default([]),
	checkedAccountIds: z.array(z.string()).max(50).default([]),
	matchedTransactionIds: z.array(z.string()).max(50).default([]),
	absentExpectedLabel: z.string().max(200).optional(),
	threshold: z
		.object({
			kind: z.string(),
			value: z.number().finite(),
			actual: z.number().finite().optional(),
		})
		.optional(),
	window: z
		.object({
			startIso: z.string(),
			endIso: z.string(),
			label: z.string().optional(),
		})
		.optional(),
	confidence: z.number().min(0).max(1).optional(),
});

export type NotificationExplanation = z.infer<
	typeof notificationExplanationSchema
>;
