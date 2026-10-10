// What the shell has managed to observe about a household, reduced to the
// smallest shape the pure `derive*` functions need. Nothing in this directory
// performs I/O; `build-baseline.ts` assembles this and hands it over.

import type { PolicyFieldConfidence, PolicyFieldSource } from "@moat/contracts";
import type { RetirementFilingStatus } from "../constants";

export type DetectedRetirementAccountKind =
	| "employerPlan"
	| "traditionalIra"
	| "rothIra"
	| "hsa"
	| "brokerage";

export type DetectedAccountSignal = {
	kind: DetectedRetirementAccountKind;
	balance: number;
	/** Annual contribution implied by a user-entered monthly figure. */
	annualContribution: number | null;
	institutionLabel: string | null;
};

export type DetectedHoldingMix = {
	equityValue: number;
	fixedIncomeValue: number;
	cashValue: number;
	unclassifiedValue: number;
};

export type DetectedRecurringExpenseSignal = {
	key: string;
	label: string;
	monthlyAmount: number;
	/** How many months of the trailing window contained a charge. */
	observedMonths: number;
};

export type DefaultSignals = {
	currentAge: number;
	retirementAge: number;
	longevityAge: number;
	filingStatus: RetirementFilingStatus;
	hasSpouse: boolean;
	/** Trailing net employment deposits, per person. Never gross. */
	netEmploymentIncome: number;
	netSpouseEmploymentIncome: number;
	stateTaxRate: number;
	accounts: DetectedAccountSignal[];
	holdingMix: DetectedHoldingMix | null;
	hsaEligible: boolean | null;
	healthCoverageAdults: number;
	/** Two-letter code inferred from transaction locations, when consistent. */
	transactionStateCode: string | null;
	/** Free-text profile location, e.g. "Salt Lake City, UT". */
	profileLocation: string | null;
	recurringExpenses: DetectedRecurringExpenseSignal[];
	monthlyHealthcareSpend: number;
};

export type DerivedPolicyField<Value> = {
	value: Value;
	source: PolicyFieldSource;
	confidence: PolicyFieldConfidence;
	rationale: string;
};

export function derivedField<Value>(
	value: Value,
	source: PolicyFieldSource,
	confidence: PolicyFieldConfidence,
	rationale: string,
): DerivedPolicyField<Value> {
	return { value, source, confidence, rationale };
}
