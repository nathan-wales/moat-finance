import { getTaxYear } from "../../federal-rules";
import type { RetirementFilingStatus } from "../constants";
import { estimateAnnualTax } from "../taxes";

/** Employee share of Social Security and Medicare payroll tax. */
const PAYROLL_TAX_RATE = 0.0765;
const SOLVER_ITERATIONS = 48;

export type GrossedUpCompensation = {
	grossAnnualCompensation: number;
	/**
	 * Share of gross pay withheld. The engine uses this to price a pre-tax
	 * deferral: deferring a dollar costs `1 - wageTaxRate` of take-home.
	 */
	wageTaxRate: number;
};

/**
 * Recovers gross compensation from observed net deposits.
 *
 * Trailing deposits are what landed in the bank — after payroll tax, after
 * withholding, and after any deferral already being made. There is no salary
 * figure anywhere in the data, so "contribute 10% of salary" has nothing to
 * multiply until one is reconstructed. This is an assumption, and it is labeled
 * as one everywhere it surfaces.
 */
export function grossUpNetIncome(input: {
	netIncome: number;
	filingStatus: RetirementFilingStatus;
	stateTaxRate: number;
	taxYear?: number;
}): GrossedUpCompensation {
	if (input.netIncome <= 0) {
		return { grossAnnualCompensation: 0, wageTaxRate: 0 };
	}

	const taxYear = input.taxYear ?? getTaxYear();
	const netForGross = (gross: number): number => {
		const { totalTax } = estimateAnnualTax({
			ordinaryIncome: gross,
			capitalGains: 0,
			socialSecurityBenefit: 0,
			filingStatus: input.filingStatus,
			stateTaxRate: input.stateTaxRate,
			// A working-age taxpayer; the senior deduction must not distort the
			// gross-up of someone still drawing a paycheck.
			primaryAge: 45,
			spouseAge: null,
			taxYear,
			inflationRate: 0,
		});
		return gross - totalTax - gross * PAYROLL_TAX_RATE;
	};

	let low = input.netIncome;
	let high = input.netIncome * 3;
	for (let iteration = 0; iteration < SOLVER_ITERATIONS; iteration++) {
		const mid = (low + high) / 2;
		if (netForGross(mid) < input.netIncome) {
			low = mid;
		} else {
			high = mid;
		}
	}

	const grossAnnualCompensation = Math.round((low + high) / 2);
	return {
		grossAnnualCompensation,
		wageTaxRate:
			grossAnnualCompensation > 0
				? Math.max(0, 1 - input.netIncome / grossAnnualCompensation)
				: 0,
	};
}
