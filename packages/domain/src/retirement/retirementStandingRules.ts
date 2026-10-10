import type {
	DeleteRetirementStandingRuleInput,
	RetirementStandingRule,
	UpsertRetirementStandingRuleInput,
} from "@moat/contracts";
import type { RetirementStandingRuleRecord } from "@moat/data-access";
import type { AppContext } from "../context";

function requireRepo(ctx: AppContext) {
	const repo = ctx.repositories.retirement;
	if (!repo) throw new Error("Retirement repository is not configured");
	return repo;
}

export function toStandingRule(
	record: RetirementStandingRuleRecord,
): RetirementStandingRule {
	return {
		id: record.id,
		label: record.label,
		enabled: record.enabled,
		sortOrder: record.sortOrder,
		source: record.source,
		rule: record.rule,
	};
}

export async function listRetirementStandingRules(
	ctx: AppContext,
): Promise<RetirementStandingRule[]> {
	const records = await requireRepo(ctx).listStandingRules({
		userId: ctx.userId,
	});
	return records.map(toStandingRule);
}

export async function upsertRetirementStandingRule(
	ctx: AppContext,
	input: UpsertRetirementStandingRuleInput,
): Promise<RetirementStandingRule> {
	const record = await requireRepo(ctx).upsertStandingRule({
		userId: ctx.userId,
		id: input.id,
		label: input.label,
		enabled: input.enabled,
		sortOrder: input.sortOrder,
		source: input.source ?? "userEdited",
		rule: input.rule,
	});
	return toStandingRule(record);
}

export async function deleteRetirementStandingRule(
	ctx: AppContext,
	input: DeleteRetirementStandingRuleInput,
): Promise<void> {
	await requireRepo(ctx).deleteStandingRule({
		userId: ctx.userId,
		id: input.id,
	});
}
