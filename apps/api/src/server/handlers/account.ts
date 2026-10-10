import { z } from "zod";
import { logger } from "~/lib/logger";
import { type AuthenticatedContext, withAuth } from "../handler-wrappers";
import { revokeAllUserTokens } from "../lib/token-manager";
import { disconnectItem } from "../plaid/service";

const deleteAccountInput = z.object({
	email: z.string().email("Valid email is required"),
	confirmation: z.literal(true, {
		errorMap: () => ({ message: "You must confirm account deletion" }),
	}),
});

const updateProfileInput = z.object({
	name: z.string().min(1, "Name is required").max(100, "Name is too long"),
});

export const account = {
	/**
	 * Update user profile name
	 * POST /api/v1/account/updateProfile
	 */
	updateProfile: withAuth(async (ctx: AuthenticatedContext, body: unknown) => {
		const userId = ctx.actorUserId;

		const input = updateProfileInput.parse(body);

		const updated = await ctx.db.user.update({
			where: { id: userId },
			data: { name: input.name },
			select: { id: true, name: true },
		});

		logger.info("User profile updated", {
			feature: "account",
			operation: "updateProfile",
			userId,
		});

		return { name: updated.name };
	}),
	/**
	 * Permanently delete user account and all associated data
	 * POST /api/v1/account/deleteAccount
	 *
	 * Requires email verification for security.
	 * Immediately deletes the user and all data (cascades via Prisma).
	 * Revokes Plaid access tokens before deletion.
	 */
	deleteAccount: withAuth(async (ctx: AuthenticatedContext, body: unknown) => {
		const userId = ctx.actorUserId;

		const input = deleteAccountInput.parse(body);

		// Get user
		const user = await ctx.db.user.findUnique({
			where: { id: userId },
			select: {
				id: true,
				email: true,
			},
		});

		if (!user) throw new Error("User not found");

		// Verify email matches the user's email
		if (input.email.toLowerCase() !== user.email?.toLowerCase()) {
			throw new Error("Email does not match your account");
		}

		// 1. Revoke all sessions and tokens first
		await revokeAllUserTokens(userId);
		await ctx.db.session.deleteMany({
			where: { userId },
		});

		// 2. Disconnect all Plaid items (revoke access tokens)
		const plaidItems = await ctx.db.plaidItem.findMany({
			where: { userId },
			select: { id: true },
		});

		for (const item of plaidItems) {
			try {
				await disconnectItem(item.id, userId);
			} catch (error) {
				// Log but continue - don't block deletion if Plaid revocation fails
				logger.logError(
					"Failed to disconnect Plaid item during deletion",
					error,
					{
						feature: "account",
						operation: "deleteAccount",
						userId,
						itemId: item.id,
					},
				);
			}
		}

		// 3. Delete user (cascades to all related data via onDelete: Cascade)
		await ctx.db.user.delete({
			where: { id: userId },
		});

		logger.info("User account permanently deleted", {
			feature: "account",
			operation: "deleteAccount",
			userId,
		});

		return {
			success: true,
			message:
				"Your account and all associated data have been permanently deleted.",
		};
	}),

	/**
	 * Export all user data in JSON format (GDPR data portability)
	 * GET /api/v1/account/exportData
	 *
	 * Returns all user data including:
	 * - Profile information
	 * - Transactions
	 * - Categories
	 * - Rules
	 * - Investments
	 * - Settings
	 */
	exportData: withAuth(async (ctx: AuthenticatedContext) => {
		const userId = ctx.actorUserId;

		// Fetch all user data in parallel
		const [
			user,
			transactions,
			categories,
			hashtags,
			rules,
			investments,
			realEstateInvestments,
			forecastScenarios,
			plaidItems,
			plaidAccounts,
			settings,
		] = await Promise.all([
			ctx.db.user.findUnique({
				where: { id: userId },
				select: {
					id: true,
					name: true,
					email: true,
					emailVerified: true,
					image: true,
					username: true,
					twoFactorEnabled: true,
					// Exclude sensitive fields: password, twoFactorSecret, twoFactorBackupCodes
				},
			}),
			ctx.db.transaction.findMany({
				where: { userId },
				select: {
					id: true,
					date: true,
					postedDate: true,
					authorizedDate: true,
					amount: true,
					isoCurrencyCode: true,
					type: true,
					category: true,
					description: true,
					originalDescription: true,
					merchantName: true,
					account: true,
					paymentChannel: true,
					source: true,
					pending: true,
					createdAt: true,
					updatedAt: true,
				},
				orderBy: { date: "desc" },
			}),
			ctx.db.category.findMany({
				where: { userId },
				select: {
					id: true,
					name: true,
					isDefault: true,
					sortOrder: true,
				},
			}),
			ctx.db.hashtag.findMany({
				where: { userId },
				select: {
					id: true,
					name: true,
					normalizedName: true,
					createdAt: true,
				},
			}),
			ctx.db.transactionRule.findMany({
				where: { userId },
				include: {
					conditions: true,
					actions: true,
				},
			}),
			ctx.db.investment.findMany({
				where: { userId },
				select: {
					id: true,
					type: true,
					name: true,
					startingBalance: true,
					monthlyContribution: true,
					annualReturnRate: true,
					createdAt: true,
					updatedAt: true,
				},
			}),
			ctx.db.realEstateInvestment.findMany({
				where: { userId },
			}),
			ctx.db.forecastScenario.findMany({
				where: { userId },
			}),
			ctx.db.plaidItem.findMany({
				where: { userId },
				select: {
					id: true,
					institutionId: true,
					institutionName: true,
					lastSyncAt: true,
					createdAt: true,
					// Exclude sensitive: accessTokenEncrypted
				},
			}),
			ctx.db.plaidAccount.findMany({
				where: { userId },
				select: {
					id: true,
					name: true,
					officialName: true,
					mask: true,
					type: true,
					subtype: true,
					currentBalance: true,
					availableBalance: true,
					currency: true,
					monthlyContribution: true,
					annualReturnRate: true,
					isActive: true,
				},
			}),
			ctx.db.userSettings.findUnique({
				where: { userId },
			}),
		]);

		if (!user) throw new Error("User not found");

		const exportData = {
			exportedAt: new Date().toISOString(),
			exportVersion: "1.0",
			user: {
				profile: user,
				settings,
			},
			financialData: {
				transactions: transactions.map((t) => ({
					...t,
					amount: Number(t.amount), // Convert Decimal to number for JSON
				})),
				categories,
				hashtags,
			},
			automation: {
				rules: rules.map((rule) => ({
					id: rule.id,
					name: rule.name,
					isActive: rule.isActive,
					priority: rule.priority,
					conditions: rule.conditions,
					actions: rule.actions,
					createdAt: rule.createdAt,
					updatedAt: rule.updatedAt,
				})),
			},
			investments: {
				portfolios: investments,
				realEstate: realEstateInvestments,
				scenarios: forecastScenarios,
			},
			connectedAccounts: {
				plaidItems,
				plaidAccounts,
			},
		};

		return exportData;
	}),
};
