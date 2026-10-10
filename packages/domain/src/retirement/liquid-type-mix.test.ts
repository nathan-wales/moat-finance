import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { DEFAULT_LIQUID_TYPE_MIX } from "@moat/contracts";
import type { RetirementAccountSource } from "@moat/data-access";
import {
	liquidTypeMixFromAccounts,
	retirementLiquidTypeForAccount,
} from "./liquid-type-mix";

function account(
	overrides: Partial<RetirementAccountSource> &
		Pick<RetirementAccountSource, "kind" | "taxTreatment">,
): RetirementAccountSource {
	return {
		id: overrides.id ?? "acct",
		name: overrides.name ?? "Account",
		origin: overrides.origin ?? "manual",
		kind: overrides.kind,
		taxTreatment: overrides.taxTreatment,
		balance: overrides.balance ?? 10_000,
		monthlyContribution: overrides.monthlyContribution ?? 0,
		annualReturnRate: overrides.annualReturnRate ?? 0.07,
		isCash: overrides.isCash ?? false,
		isDebt: overrides.isDebt ?? false,
	};
}

describe("retirementLiquidTypeForAccount", () => {
	it("maps HSA, 401(k), Roth, brokerage, and cash", () => {
		assert.equal(
			retirementLiquidTypeForAccount(
				account({ kind: "HSA", taxTreatment: "taxFree" }),
			),
			"hsa",
		);
		assert.equal(
			retirementLiquidTypeForAccount(
				account({ kind: "FOUR01K", taxTreatment: "taxDeferred" }),
			),
			"four01k",
		);
		assert.equal(
			retirementLiquidTypeForAccount(
				account({ kind: "403b", taxTreatment: "taxDeferred" }),
			),
			"four01k",
		);
		assert.equal(
			retirementLiquidTypeForAccount(
				account({ kind: "ROTH_IRA", taxTreatment: "taxFree" }),
			),
			"rothIra",
		);
		assert.equal(
			retirementLiquidTypeForAccount(
				account({ kind: "brokerage", taxTreatment: "taxable" }),
			),
			"stocks",
		);
		assert.equal(
			retirementLiquidTypeForAccount(
				account({ kind: "checking", taxTreatment: "taxable", isCash: true }),
			),
			"other",
		);
		assert.equal(
			retirementLiquidTypeForAccount(
				account({ kind: "credit", taxTreatment: "taxable", isDebt: true }),
			),
			null,
		);
	});

	it("treats roth 401k as Roth and traditional IRA as 401(k)", () => {
		assert.equal(
			retirementLiquidTypeForAccount(
				account({ kind: "roth 401k", taxTreatment: "taxFree" }),
			),
			"rothIra",
		);
		assert.equal(
			retirementLiquidTypeForAccount(
				account({ kind: "ira", taxTreatment: "taxDeferred" }),
			),
			"four01k",
		);
	});
});

describe("liquidTypeMixFromAccounts", () => {
	it("returns the default mix when there are no investable balances", () => {
		assert.deepEqual(liquidTypeMixFromAccounts([]), DEFAULT_LIQUID_TYPE_MIX);
		assert.deepEqual(
			liquidTypeMixFromAccounts([
				account({
					kind: "checking",
					taxTreatment: "taxable",
					isCash: true,
					balance: 8_000,
				}),
			]),
			DEFAULT_LIQUID_TYPE_MIX,
		);
	});

	it("splits tax-free between Roth and HSA and taxable toward stocks", () => {
		const mix = liquidTypeMixFromAccounts([
			account({
				kind: "STOCKS",
				taxTreatment: "taxable",
				balance: 80_000,
			}),
			account({
				kind: "OTHER",
				taxTreatment: "taxable",
				balance: 20_000,
			}),
			account({
				kind: "FOUR01K",
				taxTreatment: "taxDeferred",
				balance: 200_000,
			}),
			account({
				kind: "ROTH_IRA",
				taxTreatment: "taxFree",
				balance: 30_000,
			}),
			account({
				kind: "HSA",
				taxTreatment: "taxFree",
				balance: 10_000,
			}),
		]);
		assert.equal(mix.stocksOfTaxable, 0.8);
		assert.equal(mix.four01kOfDeferred, 1);
		assert.equal(mix.rothOfTaxFree, 0.75);
		assert.equal(mix.hsaOfTaxFree, 0.25);
	});
});
