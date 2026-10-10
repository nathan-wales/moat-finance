import { z } from "zod";
import { logger } from "~/lib/logger";
import { calculateRealEstateProjection } from "~/lib/real-estate-forecasting";
import { assertOwnedPlaidAccountId } from "~/server/lib/ownership";
import { takeSnapshot } from "~/server/services/balance-snapshot.service";
import {
	mergeProperties,
	resolveProperty,
} from "~/server/services/demo/demo-merge.service";
import {
	deleteOverlayProperty,
	getPropertiesOverlay,
	upsertOverlayProperty,
} from "~/server/services/demo/demo-overlay.service";
import { type DemoOrAuthContext, withDemoOrAuth } from "../handler-wrappers";

const PropertyTypeEnum = z.enum([
	"SINGLE_FAMILY",
	"MULTI_FAMILY",
	"CONDO",
	"COMMERCIAL",
	"LAND",
	"OTHER",
]);

const UsageTypeEnum = z.enum([
	"PRIMARY_RESIDENCE",
	"RENTAL",
	"VACATION_HOME",
	"MIXED_USE",
]);

const ForecastScenarioEnum = z.enum(["MODERATE", "STANDARD", "AGGRESSIVE"]);

const nullableNumber = () => z.number().min(0).nullable().optional();
const nullablePercent = () => z.number().min(0).max(1).nullable().optional();
const nullableInt = () => z.number().int().min(0).nullable().optional();
const nullableLoanTermYears = () =>
	z.number().int().min(1).nullable().optional();

const realEstateInput = z.object({
	name: z.string().min(1),
	propertyType: PropertyTypeEnum,
	usageType: UsageTypeEnum,
	currentEstimatedValue: z.number().min(0),
	currentLoanBalance: z.number().min(0),
	purchasePrice: nullableNumber(),
	purchaseDate: z.coerce.date().nullable().optional(),
	downPayment: nullableNumber(),
	closingCosts: nullableNumber(),
	rehabCosts: nullableNumber(),
	interestRate: nullablePercent(),
	loanTermYears: nullableLoanTermYears(),
	remainingTermMonths: nullableInt(),
	monthlyMortgagePayment: nullableNumber(),
	monthlyRent: nullableNumber(),
	otherMonthlyIncome: nullableNumber(),
	vacancyRate: nullablePercent(),
	totalMonthlyExpenses: nullableNumber(),
	monthlyPropertyTax: nullableNumber(),
	monthlyInsurance: nullableNumber(),
	monthlyHOA: nullableNumber(),
	monthlyUtilities: nullableNumber(),
	monthlyMaintenance: nullableNumber(),
	monthlyManagement: nullableNumber(),
	monthlyOtherExpenses: nullableNumber(),
	appreciationRate: nullablePercent(),
	expenseGrowthRate: nullablePercent(),
	forecastScenario: ForecastScenarioEnum.optional(),
	linkedPlaidAccountId: z.string().nullable().optional(),
});

const updateRealEstateInput = z
	.object({ id: z.string() })
	.merge(realEstateInput.partial());

const deleteRealEstateInput = z.object({ id: z.string() });

const getProjectionInput = z.object({
	id: z.string(),
	scenario: ForecastScenarioEnum.optional(),
	years: z.number().int().min(1).max(40).optional(),
});

export const realEstate = {
	list: withDemoOrAuth(async (ctx: DemoOrAuthContext) => {
		if (ctx.isDemoMode) {
			// In demo mode, fetch the DEMO user's properties, not the real user's
			const demoUserId = ctx.userId;

			const seeded = await ctx.db.realEstateInvestment.findMany({
				where: { userId: demoUserId },
				orderBy: { createdAt: "asc" },
			});

			if (!ctx.demoOverlaySessionKey) {
				return seeded;
			}

			const overlay = await getPropertiesOverlay(ctx.demoOverlaySessionKey);
			const merged = mergeProperties(seeded, overlay);

			return merged;
		}

		// Personal mode - use the authenticated user's ID
		const userId = ctx.userId;

		return ctx.db.realEstateInvestment.findMany({
			where: { userId },
			orderBy: { createdAt: "asc" },
		});
	}),

	create: withDemoOrAuth(async (ctx: DemoOrAuthContext, body: unknown) => {
		const input = realEstateInput.parse(body);

		if (ctx.isDemoMode) {
			if (!ctx.demoOverlaySessionKey) throw new Error("No demo session key");
			const demoUserId = ctx.userId;
			const now = new Date();
			const overlayProperty = {
				id: crypto.randomUUID(),
				userId: demoUserId,
				...input,
				purchaseDate: input.purchaseDate ?? null,
				purchasePrice: input.purchasePrice ?? null,
				downPayment: input.downPayment ?? null,
				closingCosts: input.closingCosts ?? null,
				rehabCosts: input.rehabCosts ?? null,
				interestRate: input.interestRate ?? null,
				loanTermYears: input.loanTermYears ?? null,
				remainingTermMonths: input.remainingTermMonths ?? null,
				monthlyMortgagePayment: input.monthlyMortgagePayment ?? null,
				monthlyRent: input.monthlyRent ?? null,
				otherMonthlyIncome: input.otherMonthlyIncome ?? null,
				vacancyRate: input.vacancyRate ?? null,
				totalMonthlyExpenses: input.totalMonthlyExpenses ?? null,
				monthlyPropertyTax: input.monthlyPropertyTax ?? null,
				monthlyInsurance: input.monthlyInsurance ?? null,
				monthlyHOA: input.monthlyHOA ?? null,
				monthlyUtilities: input.monthlyUtilities ?? null,
				monthlyMaintenance: input.monthlyMaintenance ?? null,
				monthlyManagement: input.monthlyManagement ?? null,
				monthlyOtherExpenses: input.monthlyOtherExpenses ?? null,
				appreciationRate: input.appreciationRate ?? null,
				expenseGrowthRate: input.expenseGrowthRate ?? null,
				forecastScenario: input.forecastScenario ?? "STANDARD",
				linkedPlaidAccountId: input.linkedPlaidAccountId ?? null,
				createdAt: now,
				updatedAt: now,
				_isOverlay: true as const,
			};
			return upsertOverlayProperty(ctx.demoOverlaySessionKey, overlayProperty);
		}

		const userId = ctx.userId;
		await assertOwnedPlaidAccountId(ctx.db, userId, input.linkedPlaidAccountId);
		const property = await ctx.db.realEstateInvestment.create({
			data: { ...input, userId },
		});
		await takeSnapshot(userId, ctx.db).catch((err) =>
			logger.logError("Snapshot failed after real estate create", err, {
				feature: "realEstate",
				operation: "create",
				userId,
			}),
		);
		return property;
	}),

	update: withDemoOrAuth(async (ctx: DemoOrAuthContext, body: unknown) => {
		const input = updateRealEstateInput.parse(body);

		if (ctx.isDemoMode) {
			if (!ctx.demoOverlaySessionKey) throw new Error("No demo session key");
			const demoUserId = ctx.userId;
			const seeded = await ctx.db.realEstateInvestment.findMany({
				where: { userId: demoUserId },
			});
			const overlay = await getPropertiesOverlay(ctx.demoOverlaySessionKey);
			const merged = mergeProperties(seeded, overlay);
			const existing = merged.find((p) => p.id === input.id);
			if (!existing) throw new Error("Property not found");
			const { id, ...data } = input;
			const updated = { ...existing, ...data, updatedAt: new Date() };
			return upsertOverlayProperty(ctx.demoOverlaySessionKey, updated);
		}

		const userId = ctx.userId;
		const { id, ...data } = input;
		if (data.linkedPlaidAccountId !== undefined) {
			await assertOwnedPlaidAccountId(
				ctx.db,
				userId,
				data.linkedPlaidAccountId,
			);
		}
		const existing = await ctx.db.realEstateInvestment.findFirst({
			where: { id, userId },
		});
		if (!existing) throw new Error("Property not found");
		const property = await ctx.db.realEstateInvestment.update({
			where: { id },
			data,
		});
		await takeSnapshot(userId, ctx.db).catch((err) =>
			logger.logError("Snapshot failed after real estate update", err, {
				feature: "realEstate",
				operation: "update",
				userId,
			}),
		);
		return property;
	}),

	delete: withDemoOrAuth(async (ctx: DemoOrAuthContext, body: unknown) => {
		const input = deleteRealEstateInput.parse(body);

		if (ctx.isDemoMode) {
			if (!ctx.demoOverlaySessionKey) throw new Error("No demo session key");
			await deleteOverlayProperty(ctx.demoOverlaySessionKey, input.id);
			return { id: input.id };
		}

		const userId = ctx.userId;
		const deleted = await ctx.db.realEstateInvestment.delete({
			where: { id: input.id, userId },
		});
		await takeSnapshot(userId, ctx.db).catch((err) =>
			logger.logError("Snapshot failed after real estate delete", err, {
				feature: "realEstate",
				operation: "delete",
				userId,
			}),
		);
		return deleted;
	}),

	getProjection: withDemoOrAuth(
		async (ctx: DemoOrAuthContext, body: unknown) => {
			const input = getProjectionInput.parse(body);

			let property: Awaited<
				ReturnType<typeof ctx.db.realEstateInvestment.findUniqueOrThrow>
			>;

			if (ctx.isDemoMode) {
				const demoUserId = ctx.userId;
				const seeded = await ctx.db.realEstateInvestment.findMany({
					where: { userId: demoUserId },
				});
				const overlayItems = ctx.demoOverlaySessionKey
					? (await getPropertiesOverlay(ctx.demoOverlaySessionKey)).items
					: [];
				const found = resolveProperty(input.id, seeded, overlayItems);
				if (!found) throw new Error("Property not found");
				property = found;
			} else {
				const userId = ctx.userId;
				property = await ctx.db.realEstateInvestment.findUniqueOrThrow({
					where: { id: input.id, userId },
				});
			}

			const scenario = input.scenario ?? property.forecastScenario;
			const points = calculateRealEstateProjection(
				{
					currentEstimatedValue: property.currentEstimatedValue,
					currentLoanBalance: property.currentLoanBalance,
					purchaseDate: property.purchaseDate ?? undefined,
					monthlyRent: property.monthlyRent ?? undefined,
					otherMonthlyIncome: property.otherMonthlyIncome ?? undefined,
					vacancyRate: property.vacancyRate ?? undefined,
					totalMonthlyExpenses: property.totalMonthlyExpenses ?? undefined,
					monthlyPropertyTax: property.monthlyPropertyTax ?? undefined,
					monthlyInsurance: property.monthlyInsurance ?? undefined,
					monthlyHOA: property.monthlyHOA ?? undefined,
					monthlyUtilities: property.monthlyUtilities ?? undefined,
					monthlyMaintenance: property.monthlyMaintenance ?? undefined,
					monthlyManagement: property.monthlyManagement ?? undefined,
					monthlyOtherExpenses: property.monthlyOtherExpenses ?? undefined,
					interestRate: property.interestRate ?? undefined,
					loanTermYears: property.loanTermYears ?? undefined,
					remainingTermMonths: property.remainingTermMonths ?? undefined,
					monthlyMortgagePayment: property.monthlyMortgagePayment ?? undefined,
					appreciationRate: property.appreciationRate ?? undefined,
					expenseGrowthRate: property.expenseGrowthRate ?? undefined,
					forecastScenario: scenario,
				},
				scenario,
				input.years ?? 5,
			);

			const projections = points.map((p) => ({
				year: p.year,
				propertyValue: p.projectedPropertyValue,
				loanBalance: p.projectedLoanBalance,
				equity: p.projectedEquity,
				cashFlow: p.annualCashFlow,
				totalReturn: p.roiPercent ?? undefined,
				principalPaidDownThisYear: p.principalPaidDownThisYear,
				cumulativePrincipalPaidDown: p.cumulativePrincipalPaidDown,
				appreciationThisYear: p.appreciationThisYear,
				cumulativeAppreciation: p.cumulativeAppreciation,
				equityIncreaseThisYear: p.equityIncreaseThisYear,
				cumulativeCashFlow: p.cumulativeCashFlow,
				cumulativeNetGain: p.cumulativeNetGain,
				cumulativeROI: p.cumulativeROI ?? undefined,
			}));

			const lastPoint = points[points.length - 1];
			const summary = {
				totalAppreciation: lastPoint ? lastPoint.cumulativeAppreciation : 0,
				totalRent: lastPoint ? lastPoint.cumulativeCashFlow : 0,
				totalExpenses: 0,
				finalEquity: lastPoint ? lastPoint.projectedEquity : 0,
			};

			return {
				projections,
				summary,
			};
		},
	),
};
