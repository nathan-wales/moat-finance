export type AmortizeMonthInput = {
	balance: number;
	annualInterestRate: number;
	monthlyPayment: number;
	remainingTermMonths: number;
};

export type AmortizeMonthResult = {
	balance: number;
	remainingTermMonths: number;
};

/**
 * One month of scheduled paydown. Term is a hard stop: the last remaining
 * month zeros the balance so a 5-year auto loan does not linger to longevity.
 * Missing payment with a known term falls back to equal principal. Missing
 * both payment and term leaves the balance unchanged.
 */
export function amortizeMonth(input: AmortizeMonthInput): AmortizeMonthResult {
	const balance = Math.max(0, input.balance);
	if (balance <= 0) {
		return { balance: 0, remainingTermMonths: 0 };
	}

	const remainingTermMonths = Math.max(0, input.remainingTermMonths);
	if (remainingTermMonths === 1) {
		return { balance: 0, remainingTermMonths: 0 };
	}

	const monthlyPayment = Math.max(0, input.monthlyPayment);
	if (monthlyPayment <= 0) {
		if (remainingTermMonths <= 0) {
			return { balance, remainingTermMonths: 0 };
		}
		const principal = balance / remainingTermMonths;
		return {
			balance: Math.max(0, balance - principal),
			remainingTermMonths: remainingTermMonths - 1,
		};
	}

	const interest = balance * (Math.max(0, input.annualInterestRate) / 12);
	const principal = monthlyPayment - interest;
	if (principal <= 0) {
		return { balance, remainingTermMonths };
	}

	return {
		balance: Math.max(0, balance - principal),
		remainingTermMonths: remainingTermMonths > 0 ? remainingTermMonths - 1 : 0,
	};
}

export type AmortizeYearResult = {
	balance: number;
	remainingTermMonths: number;
	/**
	 * Months the loan was still open during the year, so the ledger charges
	 * `monthlyPayment * monthsPaid` instead of a full year in the payoff year.
	 */
	monthsPaid: number;
};

/** Twelve months of scheduled paydown, or fewer if the loan retires first. */
export function amortizeYear(input: AmortizeMonthInput): AmortizeYearResult {
	let balance = Math.max(0, input.balance);
	let remainingTermMonths = Math.max(0, input.remainingTermMonths);
	let monthsPaid = 0;

	for (let month = 0; month < 12; month++) {
		if (balance <= 0) break;
		const stepped = amortizeMonth({
			balance,
			annualInterestRate: input.annualInterestRate,
			monthlyPayment: input.monthlyPayment,
			remainingTermMonths,
		});
		monthsPaid += 1;
		balance = stepped.balance;
		remainingTermMonths = stepped.remainingTermMonths;
	}

	return { balance, remainingTermMonths, monthsPaid };
}

export function remainingTermMonthsFromPayment(
	balance: number,
	monthlyPayment: number,
	annualRate: number,
): number {
	if (balance <= 0 || monthlyPayment <= 0) return 0;
	const rate = annualRate / 12;
	if (rate <= 0) return Math.max(1, Math.ceil(balance / monthlyPayment));
	const interestOnly = balance * rate;
	if (monthlyPayment <= interestOnly) return 0;
	const months =
		-Math.log(1 - (rate * balance) / monthlyPayment) / Math.log(1 + rate);
	return Math.min(480, Math.max(1, Math.ceil(months)));
}
