import { randomUUID } from "node:crypto";
import type {
	CreateRealEstateInvestmentInput,
	RealEstateInvestment,
	RealEstateForecastScenario,
	RealEstatePropertyType,
	RealEstateRepository,
	RealEstateUsageType,
	UpdateRealEstateInvestmentInput,
} from "@moat/data-access";
import type { SqliteDbClient } from "../db-client";

type RealEstateRow = {
	id: string;
	userId: string;
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
};

function toRealEstate(row: RealEstateRow): RealEstateInvestment {
	return {
		id: row.id,
		userId: row.userId,
		name: row.name,
		propertyType: row.propertyType as RealEstatePropertyType,
		usageType: row.usageType as RealEstateUsageType,
		purchasePrice: row.purchasePrice,
		purchaseDate: row.purchaseDate,
		downPayment: row.downPayment,
		closingCosts: row.closingCosts,
		rehabCosts: row.rehabCosts,
		currentEstimatedValue: row.currentEstimatedValue,
		currentLoanBalance: row.currentLoanBalance,
		interestRate: row.interestRate,
		loanTermYears: row.loanTermYears,
		remainingTermMonths: row.remainingTermMonths,
		monthlyMortgagePayment: row.monthlyMortgagePayment,
		monthlyRent: row.monthlyRent,
		otherMonthlyIncome: row.otherMonthlyIncome,
		vacancyRate: row.vacancyRate,
		totalMonthlyExpenses: row.totalMonthlyExpenses,
		monthlyPropertyTax: row.monthlyPropertyTax,
		monthlyInsurance: row.monthlyInsurance,
		monthlyHOA: row.monthlyHOA,
		monthlyUtilities: row.monthlyUtilities,
		monthlyMaintenance: row.monthlyMaintenance,
		monthlyManagement: row.monthlyManagement,
		monthlyOtherExpenses: row.monthlyOtherExpenses,
		appreciationRate: row.appreciationRate,
		expenseGrowthRate: row.expenseGrowthRate,
		forecastScenario: row.forecastScenario as RealEstateForecastScenario,
		linkedPlaidAccountId: row.linkedPlaidAccountId,
		createdAt: row.createdAt,
		updatedAt: row.updatedAt,
	};
}

export class SqliteRealEstateRepository implements RealEstateRepository {
	constructor(private db: SqliteDbClient) {}

	async list(input: { userId: string }): Promise<RealEstateInvestment[]> {
		const rows = (await this.db.realEstateInvestment.findMany({
			where: { userId: input.userId },
			orderBy: { createdAt: "asc" },
		})) as RealEstateRow[];
		return rows.map(toRealEstate);
	}

	async create(
		input: { userId: string } & CreateRealEstateInvestmentInput,
	): Promise<RealEstateInvestment> {
		const { userId, ...data } = input;
		const row = (await this.db.realEstateInvestment.create({
			data: {
				id: randomUUID(),
				userId,
				name: data.name,
				propertyType: data.propertyType,
				usageType: data.usageType,
				currentEstimatedValue: data.currentEstimatedValue,
				currentLoanBalance: data.currentLoanBalance,
				purchasePrice: data.purchasePrice ?? null,
				purchaseDate: data.purchaseDate ?? null,
				downPayment: data.downPayment ?? null,
				closingCosts: data.closingCosts ?? null,
				rehabCosts: data.rehabCosts ?? null,
				interestRate: data.interestRate ?? null,
				loanTermYears: data.loanTermYears ?? null,
				remainingTermMonths: data.remainingTermMonths ?? null,
				monthlyMortgagePayment: data.monthlyMortgagePayment ?? null,
				monthlyRent: data.monthlyRent ?? null,
				otherMonthlyIncome: data.otherMonthlyIncome ?? null,
				vacancyRate: data.vacancyRate ?? null,
				totalMonthlyExpenses: data.totalMonthlyExpenses ?? null,
				monthlyPropertyTax: data.monthlyPropertyTax ?? null,
				monthlyInsurance: data.monthlyInsurance ?? null,
				monthlyHOA: data.monthlyHOA ?? null,
				monthlyUtilities: data.monthlyUtilities ?? null,
				monthlyMaintenance: data.monthlyMaintenance ?? null,
				monthlyManagement: data.monthlyManagement ?? null,
				monthlyOtherExpenses: data.monthlyOtherExpenses ?? null,
				appreciationRate: data.appreciationRate ?? null,
				expenseGrowthRate: data.expenseGrowthRate ?? null,
				forecastScenario: data.forecastScenario ?? "STANDARD",
				linkedPlaidAccountId: data.linkedPlaidAccountId ?? null,
				updatedAt: new Date(),
			},
		})) as RealEstateRow;
		return toRealEstate(row);
	}

	async update(input: {
		userId: string;
		id: string;
		data: UpdateRealEstateInvestmentInput;
	}): Promise<RealEstateInvestment> {
		const { userId, id, data } = input;
		const row = (await this.db.realEstateInvestment.update({
			where: { id, userId },
			data: {
				...(data.name !== undefined && { name: data.name }),
				...(data.propertyType !== undefined && {
					propertyType: data.propertyType,
				}),
				...(data.usageType !== undefined && { usageType: data.usageType }),
				...(data.currentEstimatedValue !== undefined && {
					currentEstimatedValue: data.currentEstimatedValue,
				}),
				...(data.currentLoanBalance !== undefined && {
					currentLoanBalance: data.currentLoanBalance,
				}),
				...(data.purchasePrice !== undefined && {
					purchasePrice: data.purchasePrice,
				}),
				...(data.purchaseDate !== undefined && {
					purchaseDate: data.purchaseDate,
				}),
				...(data.downPayment !== undefined && { downPayment: data.downPayment }),
				...(data.closingCosts !== undefined && {
					closingCosts: data.closingCosts,
				}),
				...(data.rehabCosts !== undefined && { rehabCosts: data.rehabCosts }),
				...(data.interestRate !== undefined && {
					interestRate: data.interestRate,
				}),
				...(data.loanTermYears !== undefined && {
					loanTermYears: data.loanTermYears,
				}),
				...(data.remainingTermMonths !== undefined && {
					remainingTermMonths: data.remainingTermMonths,
				}),
				...(data.monthlyMortgagePayment !== undefined && {
					monthlyMortgagePayment: data.monthlyMortgagePayment,
				}),
				...(data.monthlyRent !== undefined && { monthlyRent: data.monthlyRent }),
				...(data.otherMonthlyIncome !== undefined && {
					otherMonthlyIncome: data.otherMonthlyIncome,
				}),
				...(data.vacancyRate !== undefined && { vacancyRate: data.vacancyRate }),
				...(data.totalMonthlyExpenses !== undefined && {
					totalMonthlyExpenses: data.totalMonthlyExpenses,
				}),
				...(data.monthlyPropertyTax !== undefined && {
					monthlyPropertyTax: data.monthlyPropertyTax,
				}),
				...(data.monthlyInsurance !== undefined && {
					monthlyInsurance: data.monthlyInsurance,
				}),
				...(data.monthlyHOA !== undefined && { monthlyHOA: data.monthlyHOA }),
				...(data.monthlyUtilities !== undefined && {
					monthlyUtilities: data.monthlyUtilities,
				}),
				...(data.monthlyMaintenance !== undefined && {
					monthlyMaintenance: data.monthlyMaintenance,
				}),
				...(data.monthlyManagement !== undefined && {
					monthlyManagement: data.monthlyManagement,
				}),
				...(data.monthlyOtherExpenses !== undefined && {
					monthlyOtherExpenses: data.monthlyOtherExpenses,
				}),
				...(data.appreciationRate !== undefined && {
					appreciationRate: data.appreciationRate,
				}),
				...(data.expenseGrowthRate !== undefined && {
					expenseGrowthRate: data.expenseGrowthRate,
				}),
				...(data.forecastScenario !== undefined && {
					forecastScenario: data.forecastScenario,
				}),
				...(data.linkedPlaidAccountId !== undefined && {
					linkedPlaidAccountId: data.linkedPlaidAccountId,
				}),
				updatedAt: new Date(),
			},
		})) as RealEstateRow;
		return toRealEstate(row);
	}

	async delete(input: { userId: string; id: string }): Promise<void> {
		await this.db.realEstateInvestment.delete({
			where: { id: input.id, userId: input.userId },
		});
	}
}
