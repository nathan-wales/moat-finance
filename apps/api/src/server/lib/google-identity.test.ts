import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
	doclingRuntimeAudience,
	doclingRuntimeServiceAccounts,
	readBearerToken,
} from "./google-identity";

describe("google identity helpers", () => {
	it("reads a bearer token", () => {
		assert.equal(readBearerToken("Bearer abc"), "abc");
		assert.equal(readBearerToken("Basic abc"), null);
		assert.equal(readBearerToken(undefined), null);
	});

	it("splits allowed runtime service accounts", () => {
		process.env.DOCLING_RUNTIME_SERVICE_ACCOUNT =
			"moat-docling-runtime@moat-finance.iam.gserviceaccount.com";
		assert.deepEqual(doclingRuntimeServiceAccounts(), [
			"moat-docling-runtime@moat-finance.iam.gserviceaccount.com",
		]);
		delete process.env.DOCLING_RUNTIME_SERVICE_ACCOUNT;
	});

	it("prefers an explicit parse audience", () => {
		process.env.DOCLING_PARSE_AUDIENCE = "https://api.moatfinance.ai/";
		assert.equal(doclingRuntimeAudience(), "https://api.moatfinance.ai");
		delete process.env.DOCLING_PARSE_AUDIENCE;
	});
});
