import { z } from "zod";

export const RULES_CHANNELS = {
	list: "rules:list",
	create: "rules:create",
	update: "rules:update",
	delete: "rules:delete",
	toggleActive: "rules:toggleActive",
	previewConditions: "rules:previewConditions",
	applyHistorical: "rules:applyHistorical",
	linkToTransaction: "rules:linkToTransaction",
} as const;

export const RuleMatchSchema = z.enum(["ALL", "ANY"]);

export const RuleConditionSchema = z.object({
	id: z.string().optional(),
	field: z.enum([
		"MERCHANT",
		"DESCRIPTION",
		"AMOUNT",
		"CATEGORY",
		"DATE",
		"ACCOUNT",
		"NOTES",
	]),
	operator: z.enum([
		"CONTAINS",
		"NOT_CONTAINS",
		"STARTS_WITH",
		"ENDS_WITH",
		"EQUALS",
		"NOT_EQUALS",
		"GREATER_THAN",
		"GREATER_THAN_OR_EQUAL",
		"LESS_THAN",
		"LESS_THAN_OR_EQUAL",
		"IS_EMPTY",
		"IS_NOT_EMPTY",
		"BEFORE",
		"AFTER",
		"ON",
		"BETWEEN",
	]),
	valueText: z.string().nullable().default(null),
	valueNumber: z.number().nullable().default(null),
	valueDate: z.coerce.date().nullable().default(null),
	secondValueNumber: z.number().nullable().default(null),
	secondValueDate: z.coerce.date().nullable().default(null),
	sortOrder: z.number().default(0),
	groupId: z.string().optional(),
});

export const RuleConditionGroupSchema = z.object({
	id: z.string().optional(),
	match: RuleMatchSchema.default("ALL"),
	sortOrder: z.number().default(0),
	conditions: z.array(RuleConditionSchema).min(1),
});

export const RuleActionSchema = z.object({
	id: z.string().optional(),
	type: z.enum(["SET_CATEGORY", "SET_DESCRIPTION", "SET_TYPE", "ADD_HASHTAG"]),
	valueText: z.string().nullable().default(null),
	hashtagId: z.string().nullable().default(null),
	hashtagName: z.string().nullable().default(null),
	sortOrder: z.number().default(0),
});

export const ActiveRuleSchema = z.object({
	id: z.string(),
	name: z.string(),
	isActive: z.boolean(),
	priority: z.number(),
	match: RuleMatchSchema.default("ALL"),
	conditions: z.array(RuleConditionSchema),
	conditionGroups: z.array(RuleConditionGroupSchema).default([]),
	actions: z.array(RuleActionSchema),
});

export const CreateRuleInputSchema = z.object({
	name: z.string().min(1),
	match: RuleMatchSchema.optional(),
	conditions: z.array(RuleConditionSchema).min(1),
	conditionGroups: z.array(RuleConditionGroupSchema).optional(),
	actions: z.array(RuleActionSchema).min(1),
});

export const UpdateRuleInputSchema = z.object({
	ruleId: z.string(),
	name: z.string().optional(),
	match: RuleMatchSchema.optional(),
	conditions: z.array(RuleConditionSchema).optional(),
	conditionGroups: z.array(RuleConditionGroupSchema).optional(),
	actions: z.array(RuleActionSchema).optional(),
});

export const ToggleRuleInputSchema = z.object({
	ruleId: z.string(),
	isActive: z.boolean(),
});

export const DeleteRuleInputSchema = z.object({
	ruleId: z.string(),
});

export const PreviewRuleConditionsInputSchema = z.object({
	match: RuleMatchSchema.optional(),
	conditions: z.array(RuleConditionSchema),
	conditionGroups: z.array(RuleConditionGroupSchema).optional(),
	appliedRuleId: z.string().optional(),
	limit: z.number().int().min(1).max(100).optional(),
});

export const ApplyRuleHistoricalInputSchema = z.object({
	ruleId: z.string(),
});

export const LinkRuleToTransactionInputSchema = z.object({
	ruleId: z.string(),
	transactionId: z.string(),
});

export type IpcRuleCondition = z.infer<typeof RuleConditionSchema>;
export type IpcRuleConditionGroup = z.infer<typeof RuleConditionGroupSchema>;
export type IpcRuleAction = z.infer<typeof RuleActionSchema>;
export type IpcActiveRule = z.infer<typeof ActiveRuleSchema>;
export type IpcCreateRuleInput = z.infer<typeof CreateRuleInputSchema>;
export type IpcUpdateRuleInput = z.infer<typeof UpdateRuleInputSchema>;
export type IpcPreviewRuleConditionsInput = z.infer<
	typeof PreviewRuleConditionsInputSchema
>;
export type IpcApplyRuleHistoricalInput = z.infer<
	typeof ApplyRuleHistoricalInputSchema
>;
export type IpcLinkRuleToTransactionInput = z.infer<
	typeof LinkRuleToTransactionInputSchema
>;
