import { addMonths } from "date-fns";

export type MortgageDeriveInput = {
	purchasePrice?: number | null;
	purchaseDate?: Date | string | null;
	loanTermYears?: number | null;
	/** Annual rate as a decimal, e.g. 0.065 for 6.5%. */
	annualInterestRate?: number | null;
	currentLoanBalance: number;
	now?: Date;
};

export type DerivedMortgageDetails = {
	remainingTermMonths: number | null;
	monthlyMortgagePayment: number | null;
	downPayment: number | null;
};

function toValidDate(
	value: Date | string | null | undefined,
): Date | undefined {
	if (!value) return undefined;
	if (value instanceof Date) {
		return Number.isNaN(value.getTime()) ? undefined : value;
	}
	const isoDate = /^(\d{4})-(\d{2})-(\d{2})/.exec(value);
	if (isoDate) {
		const year = Number(isoDate[1]);
		const month = Number(isoDate[2]);
		const day = Number(isoDate[3]);
		const date = new Date(year, month - 1, day);
		return Number.isNaN(date.getTime()) ? undefined : date;
	}
	const date = new Date(value);
	return Number.isNaN(date.getTime()) ? undefined : date;
}

export function monthsElapsedBetween(startDate: Date, endDate: Date): number {
	let elapsedMonths =
		(endDate.getFullYear() - startDate.getFullYear()) * 12 +
		(endDate.getMonth() - startDate.getMonth());

	if (endDate.getDate() < startDate.getDate()) {
		elapsedMonths -= 1;
	}

	return Math.max(0, elapsedMonths);
}

export function calcMonthlyPayment(
	principal: number,
	annualRate: number,
	termMonths: number,
): number {
	if (termMonths <= 0 || principal <= 0) return 0;
	const factor = annuityPresentValueFactor(annualRate, termMonths);
	return factor > 0 ? principal / factor : 0;
}

function annuityPresentValueFactor(
	annualRate: number,
	termMonths: number,
): number {
	if (termMonths <= 0) return 0;
	if (annualRate === 0) return termMonths;
	const monthlyRate = annualRate / 12;
	return (1 - (1 + monthlyRate) ** -termMonths) / monthlyRate;
}

export function roundMortgageDollars(value: number): number {
	return Math.round(value);
}

export function deriveMortgageAdvancedDetails(
	input: MortgageDeriveInput,
): DerivedMortgageDetails {
	const now = input.now ?? new Date();
	const termYears = input.loanTermYears;
	const originalTermMonths =
		termYears != null && termYears > 0 ? Math.round(termYears * 12) : null;

	const purchaseDate = toValidDate(input.purchaseDate);
	let remainingTermMonths: number | null = null;
	if (originalTermMonths != null && purchaseDate) {
		const firstPaymentDate = addMonths(purchaseDate, 1);
		remainingTermMonths = Math.max(
			0,
			originalTermMonths - monthsElapsedBetween(firstPaymentDate, now),
		);
	}

	const rate = input.annualInterestRate;
	const balance = input.currentLoanBalance;
	let monthlyMortgagePayment: number | null = null;
	let downPayment: number | null = null;

	if (remainingTermMonths === 0) {
		monthlyMortgagePayment = 0;
	} else if (
		remainingTermMonths != null &&
		remainingTermMonths > 0 &&
		originalTermMonths != null &&
		originalTermMonths > 0 &&
		balance > 0 &&
		rate != null &&
		rate >= 0
	) {
		const fullTermFactor = annuityPresentValueFactor(rate, originalTermMonths);
		const remainingFactor = annuityPresentValueFactor(
			rate,
			remainingTermMonths,
		);
		if (fullTermFactor > 0 && remainingFactor > 0) {
			const originalLoanAmount = balance * (fullTermFactor / remainingFactor);
			monthlyMortgagePayment = originalLoanAmount / fullTermFactor;
			const purchasePrice = input.purchasePrice;
			if (purchasePrice != null && purchasePrice > 0) {
				downPayment = Math.max(0, purchasePrice - originalLoanAmount);
			}
		}
	}

	return {
		downPayment,
		monthlyMortgagePayment,
		remainingTermMonths,
	};
}

export function applyDerivedMortgageDetailsIfEmpty(
	stored: {
		remainingTermMonths?: number | null;
		monthlyMortgagePayment?: number | null;
		downPayment?: number | null;
	},
	derived: DerivedMortgageDetails,
): DerivedMortgageDetails {
	return {
		downPayment:
			stored.downPayment == null ? derived.downPayment : stored.downPayment,
		monthlyMortgagePayment:
			stored.monthlyMortgagePayment == null
				? derived.monthlyMortgagePayment
				: stored.monthlyMortgagePayment,
		remainingTermMonths:
			stored.remainingTermMonths == null
				? derived.remainingTermMonths
				: stored.remainingTermMonths,
	};
}
