import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { ProfileLiability } from "@moat/contracts";
import type { RetirementAccountSource } from "@moat/data-access";
import { assembleProjectedLiabilities } from "./assemble-liabilities";

function liability(
	overrides: Partial<ProfileLiability> & Pick<ProfileLiability, "id">,
): ProfileLiability {
	return {
		name: "Auto loan",
		type: "Loan",
		balance: 20_000,
		interestRate: 6,
		monthlyPayment: 400,
		includeInNetWorth: true,
		includeInForecast: true,
		...overrides,
	};
}

function debtAccount(
	overrides: Partial<RetirementAccountSource>,
): RetirementAccountSource {
	return {
		id: "plaid_loan-1",
		name: "Auto loan",
		origin: "plaid",
		kind: "auto",
		taxTreatment: "taxable",
		balance: 20_000,
		monthlyContribution: 0,
		annualReturnRate: 0,
		isCash: false,
		isDebt: true,
		...overrides,
	};
}

describe("assembleProjectedLiabilities", () => {
	const now = new Date("2026-08-01T00:00:00.000Z");

	it("amortizes profile loans and skips generated mortgages", () => {
		const assembled = assembleProjectedLiabilities({
			now,
			properties: [
				{
					id: "home-1",
					currentLoanBalance: 400_000,
					linkedPlaidAccountId: "mortgage-acct",
				},
			],
			profileLiabilities: [
				liability({
					id: "liability-auto",
					payoffDate: "2031-08-01",
				}),
				liability({
					id: "mortgage-home-1",
					name: "Home mortgage",
					type: "Mortgage",
					balance: 400_000,
				}),
			],
			debtAccounts: [
				debtAccount({
					id: "plaid_mortgage-acct",
					kind: "mortgage",
					balance: 400_000,
				}),
			],
		});

		assert.equal(assembled.length, 1);
		assert.equal(assembled[0]?.id, "liability-auto");
		assert.equal(assembled[0]?.remainingTermMonths, 60);
		assert.equal(assembled[0]?.annualInterestRate, 0.06);
	});

	it("drops a linked Plaid mortgage even without a generated profile row", () => {
		const assembled = assembleProjectedLiabilities({
			now,
			properties: [
				{
					id: "home-1",
					currentLoanBalance: 350_000,
					linkedPlaidAccountId: "mortgage-acct",
				},
			],
			profileLiabilities: [],
			debtAccounts: [
				debtAccount({
					id: "plaid_mortgage-acct",
					kind: "mortgage",
					balance: 350_000,
				}),
			],
		});
		assert.equal(assembled.length, 0);
	});

	it("drops an unlinked Plaid mortgage when the property already has a loan", () => {
		const assembled = assembleProjectedLiabilities({
			now,
			properties: [{ id: "home-1", currentLoanBalance: 350_000 }],
			profileLiabilities: [],
			debtAccounts: [
				debtAccount({
					id: "plaid_unlinked-mortgage",
					kind: "mortgage",
					balance: 350_000,
				}),
			],
		});
		assert.equal(assembled.length, 0);
	});

	it("does not double-count a Plaid loan that matches a profile liability", () => {
		const assembled = assembleProjectedLiabilities({
			now,
			properties: [],
			profileLiabilities: [liability({ id: "liability-auto" })],
			debtAccounts: [debtAccount({ id: "plaid_auto", balance: 20_000 })],
		});
		assert.equal(assembled.length, 1);
		assert.equal(assembled[0]?.id, "liability-auto");
	});

	it("does not double-count a Plaid account saved as a synced-debt liability after the balance diverges", () => {
		const assembled = assembleProjectedLiabilities({
			now,
			properties: [],
			profileLiabilities: [
				liability({
					id: "synced-debt-plaid-cmt933an10009svucf8l0rs6n",
					name: "Chase credit",
					type: "Credit Card",
					balance: 4200,
					interestRate: 22,
					monthlyPayment: 150,
				}),
			],
			debtAccounts: [
				debtAccount({
					id: "plaid-cmt933an10009svucf8l0rs6n",
					name: "Chase credit",
					kind: "credit",
					balance: 6100,
				}),
			],
		});
		assert.equal(assembled.length, 1);
		assert.equal(
			assembled[0]?.id,
			"synced-debt-plaid-cmt933an10009svucf8l0rs6n",
		);
	});

	it("prefers loan start date + term over payoffDate", () => {
		const assembled = assembleProjectedLiabilities({
			now,
			properties: [],
			profileLiabilities: [
				liability({
					id: "liability-mortgage",
					name: "Home Mortgage",
					type: "Mortgage",
					balance: 300_000,
					interestRate: 6.5,
					monthlyPayment: 2100,
					loanStartDate: "2023-05-15",
					loanTermYears: 30,
					payoffDate: "2030-01-01",
				}),
			],
			debtAccounts: [],
		});

		assert.equal(assembled.length, 1);
		// 30y from May 2023; from Aug 1 2026 ≈ 322 remaining months
		assert.equal(assembled[0]?.remainingTermMonths, 322);
	});
});
