import type { RetirementPolicies } from "@moat/contracts";
import { emptyRetirementPolicies } from "@moat/contracts";
import { deriveAllocationPolicy } from "./derive-allocation-policy";
import { deriveContributionPolicy } from "./derive-contribution-policy";
import { deriveHealthcarePolicy } from "./derive-healthcare-policy";
import { deriveSpendingPolicy } from "./derive-spending-policy";
import { deriveTaxPolicy } from "./derive-tax-policy";
import type { DefaultSignals } from "./signals";

export { deriveAllocationPolicy } from "./derive-allocation-policy";
export { deriveContributionPolicy } from "./derive-contribution-policy";
export { deriveHealthcarePolicy } from "./derive-healthcare-policy";
export { deriveRecurringExpenseSuggestions } from "./derive-rule-suggestions";
export {
	deriveSpendingPhases,
	deriveSpendingPolicy,
} from "./derive-spending-policy";
export { deriveStateCode, deriveTaxPolicy } from "./derive-tax-policy";
export { policiesForDrawer } from "./drawer-policies";
export {
	expenseMonthRowsFromTransactions,
	modalStateCodeFromTransactions,
} from "./from-transactions";
export type { GrossedUpCompensation } from "./gross-up";
export { grossUpNetIncome } from "./gross-up";
export * from "./signals";

/**
 * The full set of pre-filled policies for a household, each field carrying
 * where its number came from.
 *
 * Derivation is not persistence. These are what the drawer shows before the
 * user has saved anything, and they are re-derived on every baseline build so
 * the baseline stays a live twin. A stored policy always wins — that is what
 * keeps `userEdited` from being overwritten by a later detection pass.
 */
export function deriveSmartDefaults(
	signals: DefaultSignals,
): RetirementPolicies {
	const base = emptyRetirementPolicies();
	return {
		...base,
		contribution: deriveContributionPolicy(signals),
		spending: deriveSpendingPolicy({
			retirementAge: signals.retirementAge,
			longevityAge: signals.longevityAge,
		}),
		healthcare: deriveHealthcarePolicy(),
		tax: deriveTaxPolicy({
			transactionStateCode: signals.transactionStateCode,
			profileLocation: signals.profileLocation,
			retirementAge: signals.retirementAge,
		}),
		allocation: deriveAllocationPolicy(signals.holdingMix),
	};
}
