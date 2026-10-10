import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { TAXES_PRODUCT_ENABLED } from "@moat/contracts";
import { isTaxLlmExtractionEnabled } from "./tax-llm-config";

describe("tax LLM config", () => {
	it("stays disabled without controller and key", () => {
		assert.equal(
			isTaxLlmExtractionEnabled({
				TAX_LLM_EXTRACTION_ENABLED: "true",
			}),
			false,
		);
		assert.equal(
			isTaxLlmExtractionEnabled({
				TAX_LLM_EXTRACTION_ENABLED: "true",
				TAX_LLM_CONTROLLER_URL: "https://controller.example",
				TAX_LLM_ENCRYPTION_KEY_v1:
					"AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA=",
			}),
			TAXES_PRODUCT_ENABLED,
		);
	});
});
