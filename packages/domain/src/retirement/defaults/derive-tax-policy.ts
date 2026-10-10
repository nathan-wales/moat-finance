import type { StateCodePolicyField, TaxPolicy } from "@moat/contracts";
import { RMD_START_AGE, STATE_INCOME_TAX_RATES } from "../constants";

const STATE_CODE_PATTERN = /\b([A-Z]{2})\b/g;

function isKnownStateCode(code: string): boolean {
	return code.toUpperCase() in STATE_INCOME_TAX_RATES;
}

/**
 * Pulls a state code out of the free-text profile location. "Salt Lake City,
 * UT" is the common shape; anything ambiguous returns null rather than a guess,
 * because a wrong state silently changes every year's tax line.
 */
export function stateCodeFromLocationText(
	location: string | null,
): string | null {
	if (!location) return null;
	const matches = location.toUpperCase().matchAll(STATE_CODE_PATTERN);
	for (const match of matches) {
		const candidate = match[1];
		if (candidate && isKnownStateCode(candidate)) return candidate;
	}
	return null;
}

/**
 * Resolves the household's state from two weak signals. Agreement between
 * transaction locations and the stated profile location is the only path to
 * `medium` confidence; a lone signal stays low and the UI always asks.
 */
export function deriveStateCode(input: {
	transactionStateCode: string | null;
	profileLocation: string | null;
}): StateCodePolicyField | null {
	const fromTransactions =
		input.transactionStateCode && isKnownStateCode(input.transactionStateCode)
			? input.transactionStateCode.toUpperCase()
			: null;
	const fromProfile = stateCodeFromLocationText(input.profileLocation);

	if (fromTransactions && fromProfile && fromTransactions === fromProfile) {
		return {
			value: fromTransactions,
			source: "detected",
			confidence: "medium",
			rationale: "Matches both your profile and where you spend.",
		};
	}
	if (fromProfile) {
		return {
			value: fromProfile,
			source: "profile",
			confidence: "low",
			rationale: "From the location on your profile.",
		};
	}
	if (fromTransactions) {
		return {
			value: fromTransactions,
			source: "detected",
			confidence: "low",
			rationale: "Where most of your transactions happen.",
		};
	}
	return null;
}

export function deriveTaxPolicy(input: {
	transactionStateCode: string | null;
	profileLocation: string | null;
	retirementAge?: number;
	rmdStartAge?: number;
}): TaxPolicy {
	const stateCode = deriveStateCode(input);
	const rmdStart = input.rmdStartAge ?? RMD_START_AGE;
	return {
		currentStateCode: stateCode,
		// Staying put is the honest default; a retirement-state guess would put
		// a tax change into a plan the user never asked for.
		retirementStateCode: stateCode,
		stateChangeAtAge: null,
		applyStateRetirementIncomeRules: stateCode !== null,
		rothConversion: {
			mode: "none",
			annualAmount: null,
			targetBracket: 0.22,
			fromAge: input.retirementAge ?? null,
			toAge: rmdStart - 1,
		},
	};
}
