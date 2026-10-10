import type { ProfileLiability } from "@moat/contracts";
import type { RetirementAccountSource } from "@moat/data-access";
import { differenceInCalendarMonths } from "date-fns";
import { mortgageLiabilityId } from "../financial-profile/merge-real-estate-into-profile";
import { resolveRemainingTermMonths } from "../liabilities/amortize-due";
import type { ProjectedLiability } from "./types";

export type LiabilityPropertySource = {
	id: string;
	currentLoanBalance: number;
	linkedPlaidAccountId?: string | null;
};

function parseAnnualRate(value: number): number {
	if (!Number.isFinite(value) || value === 0) return 0;
	return value > 1 ? value / 100 : value;
}

function isHousingDebtKind(kind: string): boolean {
	const value = kind.toLowerCase();
	return value.includes("mortgage") || value.includes("home equity");
}

function isGeneratedMortgageId(
	liabilityId: string,
	properties: LiabilityPropertySource[],
): boolean {
	return properties.some(
		(property) => mortgageLiabilityId(property.id) === liabilityId,
	);
}

function plaidAccountMatchesId(accountId: string, plaidId: string): boolean {
	return (
		accountId === plaidId ||
		accountId === `plaid_${plaidId}` ||
		accountId === `plaid-${plaidId}`
	);
}

function isLinkedHousingAccount(
	account: RetirementAccountSource,
	properties: LiabilityPropertySource[],
): boolean {
	return properties.some((property) => {
		if (!property.linkedPlaidAccountId) return false;
		return plaidAccountMatchesId(account.id, property.linkedPlaidAccountId);
	});
}

function isUnlinkedMortgageCoveredByProperty(
	account: RetirementAccountSource,
	properties: LiabilityPropertySource[],
): boolean {
	if (!isHousingDebtKind(account.kind)) return false;
	return properties.some((property) => property.currentLoanBalance > 0);
}

function balancesMatch(left: number, right: number): boolean {
	const delta = Math.abs(left - right);
	if (delta < 1) return true;
	const scale = Math.max(Math.abs(left), Math.abs(right));
	return scale > 0 && delta / scale < 0.02;
}

export function toProjectedLiabilityFromProfile(
	liability: ProfileLiability,
	now: Date,
): ProjectedLiability | null {
	const balance = Math.abs(liability.balance);
	if (balance <= 0) return null;

	const annualInterestRate = parseAnnualRate(liability.interestRate);
	const monthlyPayment = Math.max(0, liability.monthlyPayment);
	const remainingTermMonths = resolveRemainingTermMonths(liability, now);

	if (
		liability.payoffDate !== undefined &&
		liability.loanStartDate == null &&
		liability.loanTermYears == null
	) {
		const end = new Date(liability.payoffDate);
		if (!Number.isNaN(end.getTime())) {
			const monthsUntil = differenceInCalendarMonths(end, now);
			if (monthsUntil < -1) return null;
		}
	}

	return {
		id: liability.id,
		name: liability.name,
		balance,
		annualInterestRate,
		monthlyPayment,
		remainingTermMonths,
	};
}

export function toProjectedLiabilityFromAccount(
	account: RetirementAccountSource,
): ProjectedLiability | null {
	const balance = Math.abs(account.balance);
	if (balance <= 0) return null;
	return {
		id: account.id,
		name: account.name,
		balance,
		annualInterestRate: 0,
		monthlyPayment: 0,
		remainingTermMonths: 0,
	};
}

export function assembleProjectedLiabilities(input: {
	profileLiabilities: ProfileLiability[];
	debtAccounts: RetirementAccountSource[];
	properties: LiabilityPropertySource[];
	now: Date;
}): ProjectedLiability[] {
	const fromProfile: ProjectedLiability[] = [];
	for (const liability of input.profileLiabilities) {
		if (liability.includeInForecast === false) continue;
		if (isGeneratedMortgageId(liability.id, input.properties)) continue;
		const projected = toProjectedLiabilityFromProfile(liability, input.now);
		if (projected === null) continue;
		fromProfile.push(projected);
	}

	const fromAccounts: ProjectedLiability[] = [];
	for (const account of input.debtAccounts) {
		if (!account.isDebt) continue;
		if (isLinkedHousingAccount(account, input.properties)) continue;
		if (isUnlinkedMortgageCoveredByProperty(account, input.properties)) {
			continue;
		}
		const projected = toProjectedLiabilityFromAccount(account);
		if (projected === null) continue;
		const alreadyModeled = fromProfile.some(
			(liability) =>
				liability.id === account.id ||
				liability.id === `synced-debt-${account.id}` ||
				balancesMatch(liability.balance, projected.balance),
		);
		if (alreadyModeled) continue;
		fromAccounts.push(projected);
	}

	return [...fromProfile, ...fromAccounts];
}

export function liabilityBalancesTotal(
	liabilities: ProjectedLiability[],
): number {
	return liabilities.reduce((sum, liability) => sum + liability.balance, 0);
}
