import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { compareExtractionAccuracy } from "./accuracy";

describe("compareExtractionAccuracy", () => {
	it("reports exact, incorrect, missing, and hallucinated fields", () => {
		const report = compareExtractionAccuracy({
			expected: { wages: 100, federalWithholding: 20, employeeName: "Alex" },
			actual: { wages: 100, federalWithholding: 21, employerName: "Co" },
		});
		assert.equal(report.exact, 1);
		assert.equal(report.incorrect, 1);
		assert.equal(report.missing, 1);
		assert.equal(report.hallucinated, 1);
	});
});
