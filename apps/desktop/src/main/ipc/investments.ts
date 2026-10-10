import {
	CreateInvestmentInputSchema,
	DeleteInvestmentInputSchema,
	INVESTMENT_CHANNELS,
	IpcInvestmentSchema,
	UpdateInvestmentInputSchema,
} from "@moat/contracts";
import { stripManualInvestmentFromProfile } from "@moat/domain";
import { ipcMain } from "electron";
import { getUnlockedDesktopDb } from "./vault-guard";

function getInvestmentRepository() {
	const { appCtx } = getUnlockedDesktopDb();
	const investmentRepository = appCtx.repositories.investments;
	if (!investmentRepository) {
		throw new Error("Investment repository is not available");
	}
	return { userId: appCtx.userId, investmentRepository, appCtx };
}

function mapPlaidSubtypeToInvestmentType(subtype: string | null): string {
	if (!subtype) return "STOCKS";
	const sub = subtype.toLowerCase();
	if (sub.includes("401")) return "FOUR01K";
	if (sub.includes("roth")) return "ROTH_IRA";
	if (sub.includes("ira") && !sub.includes("roth")) return "ROTH_IRA";
	if (sub.includes("brokerage")) return "STOCKS";
	if (sub.includes("hsa")) return "HSA";
	return "STOCKS";
}

function barePlaidAccountId(id: string): string {
	return id.replace(/^plaid[-_]/, "");
}

function isPlaidInvestmentId(id: string): boolean {
	return id.startsWith("plaid_") || id.startsWith("plaid-");
}

function serializeInvestment(inv: {
	id: string;
	type: string;
	name: string;
	startingBalance: number;
	monthlyContribution: number;
	annualReturnRate: number;
	notes?: string | null;
	autoUpdateBalance?: boolean;
	lastBalanceAccruedAt?: Date | null;
	nextBalanceAccrualDueAt?: Date | null;
	createdAt: Date;
	updatedAt: Date;
}) {
	return IpcInvestmentSchema.parse({
		...inv,
		notes: inv.notes ?? null,
		autoUpdateBalance: inv.autoUpdateBalance ?? true,
		lastBalanceAccruedAt: inv.lastBalanceAccruedAt?.toISOString() ?? null,
		nextBalanceAccrualDueAt: inv.nextBalanceAccrualDueAt?.toISOString() ?? null,
		createdAt: inv.createdAt.toISOString(),
		updatedAt: inv.updatedAt.toISOString(),
	});
}

export function registerInvestmentHandlers(): void {
	// ─── list ─────────────────────────────────────────────────────────────────

	ipcMain.handle(INVESTMENT_CHANNELS.list, async () => {
		try {
			const { userId, investmentRepository } = getInvestmentRepository();
			const investments = await investmentRepository.list({
				userId,
			});
			return investments.map(serializeInvestment);
		} catch (err) {
			console.error("[investments:list] error", err);
			throw err;
		}
	});

	// ─── create ───────────────────────────────────────────────────────────────

	ipcMain.handle(
		INVESTMENT_CHANNELS.create,
		async (_event, rawInput: unknown) => {
			try {
				const input = CreateInvestmentInputSchema.parse(rawInput);
				const { userId, investmentRepository } = getInvestmentRepository();
				const investment = await investmentRepository.create({
					userId,
					...input,
				});
				return serializeInvestment(investment);
			} catch (err) {
				console.error("[investments:create] error", err);
				throw err;
			}
		},
	);

	// ─── update ───────────────────────────────────────────────────────────────

	ipcMain.handle(
		INVESTMENT_CHANNELS.update,
		async (_event, rawInput: unknown) => {
			try {
				const { id, ...data } = UpdateInvestmentInputSchema.parse(rawInput);
				const { userId, investmentRepository, appCtx } =
					getInvestmentRepository();

				if (isPlaidInvestmentId(id)) {
					const plaidAccounts = appCtx.repositories.plaidAccounts;
					if (!plaidAccounts) {
						throw new Error("Plaid account repository is not available");
					}
					const accountId = barePlaidAccountId(id);
					const updated = await plaidAccounts.updateForecastInputs({
						userId,
						accountId,
						data: {
							...(data.name !== undefined && { name: data.name }),
							...(data.monthlyContribution !== undefined && {
								monthlyContribution: data.monthlyContribution,
							}),
							...(data.annualReturnRate !== undefined && {
								annualReturnRate: data.annualReturnRate,
							}),
							...(data.notes !== undefined && { notes: data.notes }),
						},
					});
					const now = new Date();
					return serializeInvestment({
						id: `plaid_${updated.id}`,
						type: mapPlaidSubtypeToInvestmentType(updated.subtype),
						name: updated.name,
						startingBalance: updated.currentBalance ?? 0,
						monthlyContribution: updated.monthlyContribution,
						annualReturnRate: updated.annualReturnRate,
						notes: updated.notes,
						autoUpdateBalance: false,
						lastBalanceAccruedAt: null,
						nextBalanceAccrualDueAt: null,
						createdAt: now,
						updatedAt: now,
					});
				}

				const investment = await investmentRepository.update({
					userId,
					id,
					data,
				});
				return serializeInvestment(investment);
			} catch (err) {
				console.error("[investments:update] error", err);
				throw err;
			}
		},
	);

	// ─── delete ───────────────────────────────────────────────────────────────

	ipcMain.handle(
		INVESTMENT_CHANNELS.delete,
		async (_event, rawInput: unknown) => {
			try {
				const { id } = DeleteInvestmentInputSchema.parse(rawInput);
				const { userId, investmentRepository, appCtx } =
					getInvestmentRepository();

				if (isPlaidInvestmentId(id)) {
					const plaidAccounts = appCtx.repositories.plaidAccounts;
					if (!plaidAccounts) {
						throw new Error("Plaid account repository is not available");
					}
					await plaidAccounts.setHidden({
						userId,
						plaidAccountId: barePlaidAccountId(id),
						isHidden: true,
					});
					return { success: true };
				}

				await investmentRepository.delete({
					userId,
					id,
				});

				const profileRepo = appCtx.repositories.financialProfileData;
				if (profileRepo) {
					const stored = await profileRepo.get({ userId });
					if (stored) {
						const next = stripManualInvestmentFromProfile(stored, id);
						await profileRepo.upsert({ userId, data: next });
					}
				}

				return { success: true };
			} catch (err) {
				console.error("[investments:delete] error", err);
				throw err;
			}
		},
	);
}
