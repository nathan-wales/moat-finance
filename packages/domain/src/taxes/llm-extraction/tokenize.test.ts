import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { tokenizeSsnsAndEins } from "./tokenize";

describe("tokenizeSsnsAndEins", () => {
	it("replaces labeled identifiers with sentinels", () => {
		const text = `Employee's social security number
123-45-6789

Employer identification number
87-1234567`;
		const result = tokenizeSsnsAndEins(text);
		assert.match(result.redactedText, /<SSN_1>/);
		assert.match(result.redactedText, /<EIN_1>/);
		assert.equal(result.redactedText.includes("123-45-6789"), false);
		assert.equal(result.redactedText.includes("87-1234567"), false);
		assert.equal(result.tokenMap["<SSN_1>"], "123-45-6789");
		assert.equal(result.tokenMap["<EIN_1>"], "87-1234567");
	});

	it("tolerates OCR spaces, unicode dashes, and line breaks", () => {
		const text = `Employee SSN
123 45 6789
EIN
12\u20131234567`;
		const result = tokenizeSsnsAndEins(text);
		assert.equal(result.tokenMap["<SSN_1>"], "123 45 6789");
		assert.equal(result.tokenMap["<EIN_1>"]?.includes("1234567"), true);
		assert.equal(result.redactedText.includes("123 45 6789"), false);
	});

	it("supports multiple SSNs and EINs", () => {
		const text = `Employee's social security number 111-11-1111
Spouse SSN 222-22-2222
Employer identification number 11-1111111
Federal employer identification number 22-2222222`;
		const result = tokenizeSsnsAndEins(text);
		assert.equal(result.tokenMap["<SSN_1>"], "111-11-1111");
		assert.equal(result.tokenMap["<SSN_2>"], "222-22-2222");
		assert.equal(result.tokenMap["<EIN_1>"], "11-1111111");
		assert.equal(result.tokenMap["<EIN_2>"], "22-2222222");
	});

	it("does not classify unrelated 9-digit numbers without context", () => {
		const text = "Control number 123456789 wages 1000.00";
		const result = tokenizeSsnsAndEins(text);
		assert.equal(result.redactedText.includes("123456789"), true);
		assert.deepEqual(result.tokenMap, {});
	});

	it("classifies unformatted 9-digit values using nearby labels", () => {
		const text = `social security number
123456789
employer identification number
871234567`;
		const result = tokenizeSsnsAndEins(text);
		assert.equal(result.tokenMap["<SSN_1>"], "123456789");
		assert.equal(result.tokenMap["<EIN_1>"], "871234567");
	});
});
