import {
	CreateRealEstateInputSchema,
	DeleteRealEstateInputSchema,
	IpcRealEstateInvestmentSchema,
	REAL_ESTATE_CHANNELS,
	UpdateRealEstateInputSchema,
} from "@moat/contracts";
import { ipcMain } from "electron";
import { getUnlockedDesktopDb } from "./vault-guard";

function getRealEstateRepository() {
	const { appCtx } = getUnlockedDesktopDb();
	const realEstateRepository = appCtx.repositories.realEstate;
	if (!realEstateRepository) {
		throw new Error("Real estate repository is not available");
	}
	return { userId: appCtx.userId, realEstateRepository };
}

function serializeRealEstate(inv: {
	id: string;
	name: string;
	propertyType: string;
	usageType: string;
	purchasePrice: number | null;
	purchaseDate: Date | null;
	downPayment: number | null;
	closingCosts: number | null;
	rehabCosts: number | null;
	currentEstimatedValue: number;
	currentLoanBalance: number;
	interestRate: number | null;
	loanTermYears: number | null;
	remainingTermMonths: number | null;
	monthlyMortgagePayment: number | null;
	monthlyRent: number | null;
	otherMonthlyIncome: number | null;
	vacancyRate: number | null;
	totalMonthlyExpenses: number | null;
	monthlyPropertyTax: number | null;
	monthlyInsurance: number | null;
	monthlyHOA: number | null;
	monthlyUtilities: number | null;
	monthlyMaintenance: number | null;
	monthlyManagement: number | null;
	monthlyOtherExpenses: number | null;
	appreciationRate: number | null;
	expenseGrowthRate: number | null;
	forecastScenario: string;
	linkedPlaidAccountId: string | null;
	createdAt: Date;
	updatedAt: Date;
}) {
	return IpcRealEstateInvestmentSchema.parse({
		...inv,
		purchaseDate: inv.purchaseDate ? inv.purchaseDate.toISOString() : null,
		createdAt: inv.createdAt.toISOString(),
		updatedAt: inv.updatedAt.toISOString(),
	});
}

function toOptionalDate(
	value: string | null | undefined,
): Date | null | undefined {
	if (value === undefined) return undefined;
	if (value === null) return null;
	return new Date(value);
}

export function registerRealEstateHandlers(): void {
	// ─── list ─────────────────────────────────────────────────────────────────

	ipcMain.handle(REAL_ESTATE_CHANNELS.list, async () => {
		try {
			const { userId, realEstateRepository } = getRealEstateRepository();
			const items = await realEstateRepository.list({
				userId,
			});
			return items.map(serializeRealEstate);
		} catch (err) {
			console.error("[realEstate:list] error", err);
			throw err;
		}
	});

	// ─── create ───────────────────────────────────────────────────────────────

	ipcMain.handle(
		REAL_ESTATE_CHANNELS.create,
		async (_event, rawInput: unknown) => {
			try {
				const input = CreateRealEstateInputSchema.parse(rawInput);
				const { userId, realEstateRepository } = getRealEstateRepository();
				const item = await realEstateRepository.create({
					userId,
					...input,
					purchaseDate: toOptionalDate(input.purchaseDate),
				});
				return serializeRealEstate(item);
			} catch (err) {
				console.error("[realEstate:create] error", err);
				throw err;
			}
		},
	);

	// ─── update ───────────────────────────────────────────────────────────────

	ipcMain.handle(
		REAL_ESTATE_CHANNELS.update,
		async (_event, rawInput: unknown) => {
			try {
				const { id, ...data } = UpdateRealEstateInputSchema.parse(rawInput);
				const { userId, realEstateRepository } = getRealEstateRepository();
				const item = await realEstateRepository.update({
					userId,
					id,
					data: {
						...data,
						purchaseDate: toOptionalDate(data.purchaseDate),
					},
				});
				return serializeRealEstate(item);
			} catch (err) {
				console.error("[realEstate:update] error", err);
				throw err;
			}
		},
	);

	// ─── delete ───────────────────────────────────────────────────────────────

	ipcMain.handle(
		REAL_ESTATE_CHANNELS.delete,
		async (_event, rawInput: unknown) => {
			try {
				const { id } = DeleteRealEstateInputSchema.parse(rawInput);
				const { userId, realEstateRepository } = getRealEstateRepository();
				await realEstateRepository.delete({
					userId,
					id,
				});
				return { success: true };
			} catch (err) {
				console.error("[realEstate:delete] error", err);
				throw err;
			}
		},
	);
}
