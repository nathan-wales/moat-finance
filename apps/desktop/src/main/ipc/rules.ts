import {
	ApplyRuleHistoricalInputSchema,
	CreateRuleInputSchema,
	DeleteRuleInputSchema,
	LinkRuleToTransactionInputSchema,
	PreviewRuleConditionsInputSchema,
	RULES_CHANNELS,
	ToggleRuleInputSchema,
	UpdateRuleInputSchema,
} from "@moat/contracts";
import { ipcMain } from "electron";
import { remoteLogger } from "../lib/remote-logger";
import {
	applyRuleToMatches,
	linkRuleToTransaction,
	previewConditions,
	previewRuleMatches,
	toPreviewTransactions,
} from "../services/rules-apply";
import { getUnlockedDesktopDb } from "./vault-guard";

export function registerRuleHandlers(): void {
	ipcMain.handle(RULES_CHANNELS.list, async (_event) => {
		const { appCtx } = getUnlockedDesktopDb();
		return appCtx.repositories.rules.listAll({ userId: appCtx.userId });
	});

	ipcMain.handle(RULES_CHANNELS.create, async (_event, raw: unknown) => {
		const { appCtx } = getUnlockedDesktopDb();
		const input = CreateRuleInputSchema.parse(raw);
		const rule = await appCtx.repositories.rules.create({
			userId: appCtx.userId,
			...input,
		});
		remoteLogger.info("Desktop rule created", {
			event: "desktop.rule.created",
			feature: "rules",
			operation: "create",
			metadata: {
				conditionCount: input.conditions?.length ?? 0,
				actionCount: input.actions?.length ?? 0,
			},
		});
		return rule;
	});

	ipcMain.handle(RULES_CHANNELS.update, async (_event, raw: unknown) => {
		const { appCtx } = getUnlockedDesktopDb();
		const input = UpdateRuleInputSchema.parse(raw);
		const { ruleId, ...data } = input;
		const rule = await appCtx.repositories.rules.update({
			userId: appCtx.userId,
			ruleId,
			...data,
		});
		remoteLogger.info("Desktop rule updated", {
			event: "desktop.rule.updated",
			feature: "rules",
			operation: "update",
			metadata: {
				hasConditions: data.conditions !== undefined,
				hasActions: data.actions !== undefined,
			},
		});
		return rule;
	});

	ipcMain.handle(RULES_CHANNELS.delete, async (_event, raw: unknown) => {
		const { appCtx } = getUnlockedDesktopDb();
		const { ruleId } = DeleteRuleInputSchema.parse(raw);
		await appCtx.repositories.rules.delete({
			userId: appCtx.userId,
			ruleId,
		});
		remoteLogger.info("Desktop rule deleted", {
			event: "desktop.rule.deleted",
			feature: "rules",
			operation: "delete",
		});
		return { success: true };
	});

	ipcMain.handle(RULES_CHANNELS.toggleActive, async (_event, raw: unknown) => {
		const { appCtx } = getUnlockedDesktopDb();
		const input = ToggleRuleInputSchema.parse(raw);
		await appCtx.repositories.rules.toggleActive({
			userId: appCtx.userId,
			ruleId: input.ruleId,
			isActive: input.isActive,
		});
		return { success: true };
	});

	ipcMain.handle(
		RULES_CHANNELS.previewConditions,
		async (_event, raw: unknown) => {
			const { appCtx } = getUnlockedDesktopDb();
			const input = PreviewRuleConditionsInputSchema.parse(raw);
			const mapCondition = (
				condition: (typeof input.conditions)[number],
				index: number,
			) => ({
				id: condition.id ?? `preview-${index}`,
				field: condition.field,
				operator: condition.operator,
				valueText: condition.valueText ?? null,
				valueNumber: condition.valueNumber ?? null,
				valueDate: condition.valueDate ? new Date(condition.valueDate) : null,
				secondValueNumber: condition.secondValueNumber ?? null,
				secondValueDate: condition.secondValueDate
					? new Date(condition.secondValueDate)
					: null,
				sortOrder: condition.sortOrder ?? index,
			});
			const conditions = input.conditions.map(mapCondition);
			const conditionGroups = input.conditionGroups?.map((group, gi) => ({
				id: group.id ?? `preview-group-${gi}`,
				match: group.match ?? ("ALL" as const),
				sortOrder: group.sortOrder ?? gi,
				conditions: group.conditions.map(mapCondition),
			}));
			const { matched } = await previewConditions(appCtx, {
				match: input.match,
				conditions,
				conditionGroups,
				appliedRuleId: input.appliedRuleId,
			});
			return toPreviewTransactions(matched, input.limit);
		},
	);

	ipcMain.handle(
		RULES_CHANNELS.applyHistorical,
		async (_event, raw: unknown) => {
			const { appCtx } = getUnlockedDesktopDb();
			const input = ApplyRuleHistoricalInputSchema.parse(raw);
			const rule = await appCtx.repositories.rules.findById({
				userId: appCtx.userId,
				ruleId: input.ruleId,
			});
			if (!rule) throw new Error("Rule not found");
			const { matched } = await previewRuleMatches(appCtx, rule);
			return applyRuleToMatches(appCtx, rule, matched);
		},
	);

	ipcMain.handle(
		RULES_CHANNELS.linkToTransaction,
		async (_event, raw: unknown) => {
			const { appCtx } = getUnlockedDesktopDb();
			const input = LinkRuleToTransactionInputSchema.parse(raw);
			await linkRuleToTransaction(appCtx, input);
			return { success: true };
		},
	);
}
