import { ZodError, z } from "zod";
import { createApiError } from "../api-context";
import { type AuthenticatedContext, withAuth } from "../handler-wrappers";
import {
	getDesktopBackupSummary,
	upsertDesktopBackup,
} from "../services/desktop-backup.service";

const ruleFieldEnum = z.enum([
	"MERCHANT",
	"DESCRIPTION",
	"AMOUNT",
	"CATEGORY",
	"DATE",
	"ACCOUNT",
	"NOTES",
]);

const ruleOperatorEnum = z.enum([
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
]);

const ruleActionTypeEnum = z.enum([
	"SET_CATEGORY",
	"SET_DESCRIPTION",
	"SET_TYPE",
	"ADD_HASHTAG",
]);

const scenarioTypeEnum = z.enum([
	"CONSERVATIVE",
	"STANDARD",
	"AGGRESSIVE",
	"CUSTOM",
]);

const upsertInput = z.object({
	categories: z
		.array(
			z.object({
				id: z.string().min(1),
				name: z.string().min(1).max(100),
				icon: z.string().nullable().optional(),
				sortOrder: z.number().int().optional(),
				isHidden: z.boolean().optional(),
			}),
		)
		.max(500)
		.optional(),
	hashtags: z
		.array(
			z.object({
				id: z.string().min(1),
				name: z.string().min(1),
				normalizedName: z.string().min(1),
			}),
		)
		.max(2000)
		.optional(),
	rules: z
		.array(
			z.object({
				id: z.string().min(1),
				name: z.string().min(1),
				isActive: z.boolean(),
				priority: z.number().int(),
				conditions: z.array(
					z.object({
						id: z.string().min(1),
						field: ruleFieldEnum,
						operator: ruleOperatorEnum,
						valueText: z.string().nullable().optional(),
						valueNumber: z.number().nullable().optional(),
						valueDate: z.string().nullable().optional(),
						secondValueText: z.string().nullable().optional(),
						secondValueNumber: z.number().nullable().optional(),
						secondValueDate: z.string().nullable().optional(),
						sortOrder: z.number().int(),
					}),
				),
				actions: z.array(
					z.object({
						id: z.string().min(1),
						type: ruleActionTypeEnum,
						valueText: z.string().nullable().optional(),
						hashtagId: z.string().nullable().optional(),
						hashtagName: z.string().nullable().optional(),
						sortOrder: z.number().int(),
					}),
				),
			}),
		)
		.max(500)
		.optional(),
	budgets: z
		.array(
			z.object({
				id: z.string().min(1),
				categoryId: z.string().min(1),
				monthlyGoal: z.number().min(0),
			}),
		)
		.max(500)
		.optional(),
	scenarios: z
		.array(
			z.object({
				id: z.string().min(1),
				name: z.string().min(1),
				type: scenarioTypeEnum,
				investmentReturn: z.number(),
				inflationRate: z.number(),
				salaryGrowth: z.number(),
				contributionChange: z.number(),
				expenseGrowth: z.number(),
				isActive: z.boolean(),
			}),
		)
		.max(100)
		.optional(),
	financialProfileData: z
		.object({
			profile: z.unknown(),
			accounts: z.unknown(),
			incomeSources: z.unknown(),
			assets: z.unknown(),
			liabilities: z.unknown(),
			investments: z.unknown(),
			insurancePolicies: z.unknown(),
			taxProfile: z.unknown(),
			forecastAssumptions: z.unknown(),
			planningNotes: z.unknown(),
		})
		.optional(),
	transactions: z
		.array(
			z.object({
				id: z.string().min(1),
				date: z.string().min(1),
				postedDate: z.string().nullable().optional(),
				amount: z.number(),
				merchantName: z.string().nullable().optional(),
				description: z.string().nullable().optional(),
				type: z.enum(["INCOME", "EXPENSE"]),
				pending: z.boolean().optional(),
				hidden: z.boolean().optional(),
				source: z.enum(["CSV", "MANUAL"]).optional(),
				account: z.string().nullable().optional(),
				categoryId: z.string().nullable().optional(),
				hashtagIds: z.array(z.string()).optional(),
			}),
		)
		.max(5000)
		.optional(),
});

function parseUpsertInput(body: unknown) {
	try {
		return upsertInput.parse(body);
	} catch (error) {
		if (error instanceof ZodError) {
			throw createApiError("Invalid backup payload", 400);
		}
		throw error;
	}
}

export const desktopBackup = {
	summary: withAuth(async (ctx: AuthenticatedContext) => {
		return getDesktopBackupSummary(ctx.db, ctx.userId);
	}),

	upsert: withAuth(async (ctx: AuthenticatedContext, body: unknown) => {
		const input = parseUpsertInput(body);
		return upsertDesktopBackup(ctx.db, ctx.userId, {
			...input,
			financialProfileData: input.financialProfileData
				? {
						profile: input.financialProfileData.profile as object,
						accounts: input.financialProfileData.accounts as object,
						incomeSources: input.financialProfileData.incomeSources as object,
						assets: input.financialProfileData.assets as object,
						liabilities: input.financialProfileData.liabilities as object,
						investments: input.financialProfileData.investments as object,
						insurancePolicies: input.financialProfileData
							.insurancePolicies as object,
						taxProfile: input.financialProfileData.taxProfile as object,
						forecastAssumptions: input.financialProfileData
							.forecastAssumptions as object,
						planningNotes: input.financialProfileData.planningNotes as object,
					}
				: undefined,
		});
	}),
};

export type DesktopBackupHandlers = typeof desktopBackup;
