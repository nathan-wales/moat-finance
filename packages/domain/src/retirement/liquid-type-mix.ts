// Maps live accounts onto the named series the projected-net-worth chart
// stacks. The engine still compounds by tax treatment; this mix only splits
// those buckets for display (and HSA vs Roth, which share tax-free).

import {
	DEFAULT_LIQUID_TYPE_MIX,
	type RetirementLiquidTypeMix,
} from "@moat/contracts";
import type { RetirementAccountSource } from "@moat/data-access";

export type RetirementLiquidType =
	| "stocks"
	| "rothIra"
	| "four01k"
	| "hsa"
	| "other";

export function retirementLiquidTypeForAccount(
	account: Pick<
		RetirementAccountSource,
		"kind" | "taxTreatment" | "isCash" | "isDebt"
	>,
): RetirementLiquidType | null {
	if (account.isDebt) return null;
	if (account.isCash) return "other";

	const kind = account.kind.toUpperCase();
	if (kind.includes("HSA")) return "hsa";
	if (kind.includes("ROTH")) return "rothIra";
	if (
		kind.includes("401") ||
		kind.includes("403") ||
		kind.includes("457") ||
		kind === "FOUR01K" ||
		kind.includes("TSP") ||
		kind.includes("THRIFT")
	) {
		return "four01k";
	}
	if (
		kind === "OTHER" ||
		kind.includes("PENSION") ||
		kind.includes("ANNUITY")
	) {
		return "other";
	}
	if (kind.includes("REAL") && kind.includes("ESTATE")) return "other";
	if (account.taxTreatment === "taxFree") return "rothIra";
	if (account.taxTreatment === "taxDeferred") return "four01k";
	return "stocks";
}

function share(part: number, total: number, emptyDefault: number): number {
	if (total <= 0) return emptyDefault;
	return part / total;
}

export function liquidTypeMixFromAccounts(
	accounts: RetirementAccountSource[],
): RetirementLiquidTypeMix {
	let taxableStocks = 0;
	let taxableTotal = 0;
	let deferred401k = 0;
	let deferredTotal = 0;
	let taxFreeRoth = 0;
	let taxFreeHsa = 0;
	let taxFreeTotal = 0;

	for (const account of accounts) {
		if (account.isDebt || account.isCash) continue;
		const balance = Math.max(0, account.balance);
		if (balance <= 0) continue;
		const type = retirementLiquidTypeForAccount(account);
		if (type === null) continue;

		if (account.taxTreatment === "taxable") {
			taxableTotal += balance;
			if (type === "stocks") taxableStocks += balance;
		} else if (account.taxTreatment === "taxDeferred") {
			deferredTotal += balance;
			if (type === "four01k") deferred401k += balance;
		} else {
			taxFreeTotal += balance;
			if (type === "rothIra") taxFreeRoth += balance;
			if (type === "hsa") taxFreeHsa += balance;
		}
	}

	if (taxableTotal <= 0 && deferredTotal <= 0 && taxFreeTotal <= 0) {
		return { ...DEFAULT_LIQUID_TYPE_MIX };
	}

	return {
		stocksOfTaxable: share(
			taxableStocks,
			taxableTotal,
			DEFAULT_LIQUID_TYPE_MIX.stocksOfTaxable,
		),
		four01kOfDeferred: share(
			deferred401k,
			deferredTotal,
			DEFAULT_LIQUID_TYPE_MIX.four01kOfDeferred,
		),
		rothOfTaxFree: share(
			taxFreeRoth,
			taxFreeTotal,
			DEFAULT_LIQUID_TYPE_MIX.rothOfTaxFree,
		),
		hsaOfTaxFree: share(
			taxFreeHsa,
			taxFreeTotal,
			DEFAULT_LIQUID_TYPE_MIX.hsaOfTaxFree,
		),
	};
}
