import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { IdentifierValidationError } from "./restore";
import { tokenizeSsnsAndEins } from "./tokenize";
import { SchemaValidationError, validateAndRestoreW2 } from "./validate";

describe("validateAndRestoreW2", () => {
	it("restores sentinel tokens and accepts valid schema", () => {
		const { tokenMap } = tokenizeSsnsAndEins(
			"Employee's social security number 123-45-6789 Employer identification number 87-1234567",
		);
		const restored = validateAndRestoreW2({
			tokenMap,
			raw: {
				employerName: "Northwind Paper Co",
				employerEin: "<EIN_1>",
				employeeName: "Alex Rivera",
				employeeSsn: "<SSN_1>",
				wages: 81234.56,
				federalWithholding: 14200,
				box12: [{ code: "DD", amount: 3400 }],
				box14: [{ label: "Union dues", amount: 350 }],
				retirementPlan: true,
				dependentCareBenefits: null,
			},
		});
		assert.equal(restored.wages, 81234.56);
		assert.equal(restored.federalWithholding, 14200);
		assert.equal(restored.employerName, "Northwind Paper Co");
		assert.equal(restored.employeeName, "Alex Rivera");
		assert.equal(restored.employeeSsn, "123-45-6789");
		assert.equal(restored.employerEin, "87-1234567");
		assert.equal(restored.dependentCareBenefits, undefined);
		assert.equal(restored.box12?.[0]?.code, "DD");
	});

	it("rejects raw SSNs and EINs returned by the model", () => {
		const { tokenMap } = tokenizeSsnsAndEins(
			"Employee's social security number 123-45-6789 Employer identification number 87-1234567",
		);
		assert.throws(
			() =>
				validateAndRestoreW2({
					tokenMap,
					raw: {
						employeeSsn: "123-45-6789",
						wages: 1,
					},
				}),
			IdentifierValidationError,
		);
		assert.throws(
			() =>
				validateAndRestoreW2({
					tokenMap,
					raw: {
						employerEin: "87-1234567",
						wages: 1,
					},
				}),
			IdentifierValidationError,
		);
	});

	it("rejects unknown sentinel tokens", () => {
		const { tokenMap } = tokenizeSsnsAndEins(
			"Employee's social security number 123-45-6789",
		);
		assert.throws(
			() =>
				validateAndRestoreW2({
					tokenMap,
					raw: {
						employeeSsn: "<SSN_99>",
						wages: 1,
					},
				}),
			IdentifierValidationError,
		);
	});

	it("rejects structurally invalid responses", () => {
		assert.throws(
			() =>
				validateAndRestoreW2({
					tokenMap: {},
					raw: { wages: "not-a-number" },
				}),
			SchemaValidationError,
		);
	});
});
