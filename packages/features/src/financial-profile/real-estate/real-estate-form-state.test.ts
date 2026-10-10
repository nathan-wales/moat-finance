import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
	applyRealEstateFormChange,
	DEFAULT_RE_FORM,
	mortgageAdvancedFieldsPatch,
	type RealEstateFormValues,
} from "./real-estate-form-state";

const NOW = new Date(2026, 8, 4);

function drivers(
	overrides: Partial<RealEstateFormValues> = {},
): RealEstateFormValues {
	return {
		...DEFAULT_RE_FORM,
		currentLoanBalance: "300000",
		interestRate: "6.5",
		loanTermYears: "30",
		purchaseDate: "2099-01-01",
		purchasePrice: "380000",
		...overrides,
	};
}

describe("mortgageAdvancedFieldsPatch", () => {
	it("fills empty remaining months, payment, and down payment once all drivers are set", () => {
		const patch = mortgageAdvancedFieldsPatch(drivers(), NOW);
		assert.equal(patch.remainingTermMonths, "360");
		assert.equal(patch.monthlyMortgagePayment, "1896");
		assert.equal(patch.downPayment, "80000");
		assert.equal(patch.remainingTermMonthsEstimated, true);
		assert.equal(patch.monthlyMortgagePaymentEstimated, true);
		assert.equal(patch.downPaymentEstimated, true);
	});

	it("does not fill advanced fields until every required driver is present", () => {
		const patch = mortgageAdvancedFieldsPatch(
			drivers({ currentLoanBalance: "" }),
			NOW,
		);
		assert.deepEqual(patch, {});
	});

	it("leaves typed advanced fields alone", () => {
		const patch = mortgageAdvancedFieldsPatch(
			drivers({
				downPayment: "75000",
				monthlyMortgagePayment: "2100",
				remainingTermMonths: "300",
			}),
			NOW,
		);
		assert.deepEqual(patch, {});
	});

	it("keeps updating fields that were auto-filled", () => {
		const patch = mortgageAdvancedFieldsPatch(
			drivers({
				currentLoanBalance: "501000",
				downPayment: "569995",
				downPaymentEstimated: true,
				monthlyMortgagePayment: "0",
				monthlyMortgagePaymentEstimated: true,
				purchaseDate: "2024-05-20",
				purchasePrice: "570000",
				remainingTermMonths: "9",
				remainingTermMonthsEstimated: true,
			}),
			NOW,
		);
		assert.equal(patch.remainingTermMonths, "334");
		assert.ok(Number(patch.monthlyMortgagePayment) > 3000);
		assert.ok(Number(patch.downPayment) > 50_000);
		assert.ok(Number(patch.downPayment) < 80_000);
	});
});

describe("applyRealEstateFormChange", () => {
	it("recalculates estimates as the current balance is typed in", () => {
		let form = applyRealEstateFormChange(
			drivers({
				currentLoanBalance: "",
				purchaseDate: "2024-05-20",
				purchasePrice: "570000",
			}),
			"currentLoanBalance",
			"5",
			NOW,
		);
		assert.equal(form.remainingTermMonthsEstimated, true);
		assert.equal(form.downPaymentEstimated, true);
		assert.ok(Number(form.downPayment.replace(/,/g, "")) > 500_000);

		form = applyRealEstateFormChange(form, "currentLoanBalance", "501000", NOW);
		assert.equal(form.remainingTermMonths, "334");
		assert.ok(Number(form.monthlyMortgagePayment) > 3000);
		assert.ok(Number(form.downPayment) > 50_000);
		assert.ok(Number(form.downPayment) < 80_000);
	});

	it("updates remaining months after a partial loan-term keystroke", () => {
		let form = applyRealEstateFormChange(
			drivers({
				loanTermYears: "",
				purchaseDate: "2024-05-20",
				purchasePrice: "570000",
				currentLoanBalance: "501000",
			}),
			"loanTermYears",
			"3",
			NOW,
		);
		assert.equal(form.remainingTermMonths, "10");

		form = applyRealEstateFormChange(form, "loanTermYears", "30", NOW);
		assert.equal(form.remainingTermMonths, "334");
	});

	it("does not overwrite an advanced field after the user edits it", () => {
		const estimated = applyRealEstateFormChange(
			drivers({ remainingTermMonths: "" }),
			"purchasePrice",
			"380000",
			NOW,
		);
		assert.equal(estimated.remainingTermMonthsEstimated, true);

		const edited = applyRealEstateFormChange(
			estimated,
			"remainingTermMonths",
			"300",
			NOW,
		);
		assert.equal(edited.remainingTermMonths, "300");
		assert.equal(edited.remainingTermMonthsEstimated, false);

		const afterDriverChange = applyRealEstateFormChange(
			edited,
			"interestRate",
			"6.25",
			NOW,
		);
		assert.equal(afterDriverChange.remainingTermMonths, "300");
		assert.equal(afterDriverChange.remainingTermMonthsEstimated, false);
	});
});
