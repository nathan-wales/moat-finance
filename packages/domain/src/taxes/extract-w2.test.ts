import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { extractFactsFromParsed } from "./extract-facts";
import { extractW2Fields } from "./extract-w2";
import type { ParsedTaxDocument } from "./parser";

function parsed(
	text: string,
	tables: ParsedTaxDocument["tables"] = [],
): ParsedTaxDocument {
	return {
		text,
		pages: [{ page: 1, text }],
		tables,
		keyValues: [],
		formClassification: null,
		extractedFields: {},
		confidence: 0.55,
		sourceLocations: [],
	};
}

const COLUMN_W2 = `a Employee's social security number
Form W-2 Wage and Tax Statement
c Employer's name, address, and ZIP code
School AI, Inc.
1 Wages, tips, other compensation
3 Social security wages
5 Medicare wages and tips
11111.11
33333.33
55555.55
2 Federal income tax withheld
4 Social security tax withheld
6 Medicare tax withheld
22222.22
44444.44
66666.66
16 State wages, tips, etc.
17 State income tax
77777.77
88888.88`;

const ROW_W2 = `a Employee's social security number 1 Wages, tips, other compensation 2 Federal income tax withheld
11111.11 22222.22
b Employer identification number 3 Social security wages 4 Social security tax withheld
33333.33 44444.44
c Employer's name, address, and ZIP code 5 Medicare wages and tips 6 Medicare tax withheld
School AI, Inc. 55555.55 66666.66
15 State 16 State wages, tips, etc. 17 State income tax
UT 77777.77 88888.88`;

describe("extractW2Fields", () => {
	it("zips left-column then right-column W-2 reading order", () => {
		const fields = extractW2Fields(parsed(COLUMN_W2));
		assert.equal(fields.employerName, "School AI, Inc.");
		assert.equal(fields.wages, 11111.11);
		assert.equal(fields.federalWithholding, 22222.22);
		assert.equal(fields.socialSecurityWages, 33333.33);
		assert.equal(fields.socialSecurityTax, 44444.44);
		assert.equal(fields.medicareWages, 55555.55);
		assert.equal(fields.medicareTax, 66666.66);
		assert.equal(fields.stateWages, 77777.77);
		assert.equal(fields.stateTax, 88888.88);
	});

	it("zips row-wise W-2 labels with amounts on the next line", () => {
		const fields = extractW2Fields(parsed(ROW_W2));
		assert.equal(fields.employerName, "School AI, Inc.");
		assert.equal(fields.wages, 11111.11);
		assert.equal(fields.federalWithholding, 22222.22);
		assert.equal(fields.socialSecurityWages, 33333.33);
		assert.equal(fields.medicareTax, 66666.66);
		assert.equal(fields.stateWages, 77777.77);
		assert.equal(fields.stateTax, 88888.88);
	});

	it("reads W-2 boxes from a table grid", () => {
		const fields = extractW2Fields(
			parsed("Form W-2 Wage and Tax Statement", [
				{
					headers: [
						"1 Wages, tips, other compensation",
						"2 Federal income tax withheld",
					],
					rows: [["11111.11", "22222.22"]],
				},
			]),
		);
		assert.equal(fields.wages, 11111.11);
		assert.equal(fields.federalWithholding, 22222.22);
	});

	it("does not use form chrome as the employer", () => {
		const fields = extractW2Fields(
			parsed(
				"a Employee's social security number\nForm W-2 Wage and Tax Statement\nc Employer's name, address, and ZIP code\nSchool AI, Inc.",
			),
		);
		assert.equal(fields.employerName, "School AI, Inc.");
	});
});

describe("extractFactsFromParsed W-2 grid", () => {
	it("extracts boxes 1-6 and 16-17 from column-wise pdfium text", () => {
		const extracted = extractFactsFromParsed({
			taxYear: 2026,
			documentId: "doc-w2-grid",
			filename: "w2.pdf",
			parsed: parsed(COLUMN_W2),
		});
		assert.equal(extracted.formType, "W-2");
		assert.equal(extracted.issuer, "School AI, Inc.");
		assert.equal(
			extracted.facts.find((item) => item.type === "w2.wages")?.value,
			11111.11,
		);
		assert.equal(
			extracted.facts.find((item) => item.type === "w2.federal_withholding")
				?.value,
			22222.22,
		);
		assert.equal(
			extracted.facts.find((item) => item.type === "w2.medicare_tax")?.value,
			66666.66,
		);
		assert.equal(
			extracted.facts.find((item) => item.type === "w2.state_tax")?.value,
			88888.88,
		);
		assert.equal(extracted.facts.length, 8);
	});

	it("prefers Qwen structured fields over heuristic box matching", () => {
		const extracted = extractFactsFromParsed({
			taxYear: 2026,
			documentId: "doc-w2-qwen",
			filename: "w2.pdf",
			parsed: {
				...parsed(COLUMN_W2),
				parserName: "docling+qwen",
				extractedFields: {
					employerName: "School AI, Inc.",
					medicareTax: 987.65,
					wages: 50000,
				},
			},
		});
		assert.equal(extracted.extractionMethod, "llm");
		assert.equal(
			extracted.facts.find((item) => item.type === "w2.medicare_tax")?.value,
			987.65,
		);
		assert.equal(
			extracted.facts.find((item) => item.type === "w2.wages")?.value,
			50000,
		);
	});
});
