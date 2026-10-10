import assert from "node:assert/strict";
import { afterEach, beforeEach, describe, it } from "node:test";
import { TAXES_PRODUCT_ENABLED } from "@moat/contracts";
import {
	resetProductionConfigValidationForTests,
	validateProductionConfig,
} from "./env-validation";

const ORIGINAL_ENV = {
	AUTH_GOOGLE_ID: process.env.AUTH_GOOGLE_ID,
	AUTH_GOOGLE_ID_IOS: process.env.AUTH_GOOGLE_ID_IOS,
	AUTH_SECRET: process.env.AUTH_SECRET,
	CRON_SECRET: process.env.CRON_SECRET,
	ENCRYPTION_KEY: process.env.ENCRYPTION_KEY,
	GITHUB_FEEDBACK_ENABLED: process.env.GITHUB_FEEDBACK_ENABLED,
	GITHUB_FEEDBACK_OWNER: process.env.GITHUB_FEEDBACK_OWNER,
	GITHUB_FEEDBACK_REPO: process.env.GITHUB_FEEDBACK_REPO,
	GITHUB_FEEDBACK_TOKEN: process.env.GITHUB_FEEDBACK_TOKEN,
	MCP_TOKEN_PEPPER: process.env.MCP_TOKEN_PEPPER,
	NODE_ENV: process.env.NODE_ENV,
	TAX_R2_ACCESS_KEY_ID: process.env.TAX_R2_ACCESS_KEY_ID,
	TAX_R2_ACCOUNT_ID: process.env.TAX_R2_ACCOUNT_ID,
	TAX_R2_BUCKET: process.env.TAX_R2_BUCKET,
	TAX_R2_SECRET_ACCESS_KEY: process.env.TAX_R2_SECRET_ACCESS_KEY,
	DOCLING_PARSER_URL: process.env.DOCLING_PARSER_URL,
	DOCLING_RUNTIME_SERVICE_ACCOUNT: process.env.DOCLING_RUNTIME_SERVICE_ACCOUNT,
	DOCLING_PARSE_AUDIENCE: process.env.DOCLING_PARSE_AUDIENCE,
};

function restoreEnv() {
	for (const [key, value] of Object.entries(ORIGINAL_ENV)) {
		if (value === undefined) {
			delete process.env[key];
		} else {
			process.env[key] = value;
		}
	}
}

function setNodeEnv(value: string) {
	Object.assign(process.env, { NODE_ENV: value });
}

function setBaseProductionEnv() {
	setNodeEnv("production");
	process.env.AUTH_SECRET = "test-auth-secret";
	process.env.CRON_SECRET = "test-cron-secret";
	process.env.ENCRYPTION_KEY =
		"0000000000000000000000000000000000000000000000000000000000000000";
	process.env.MCP_TOKEN_PEPPER = "a".repeat(32);
	process.env.TAX_R2_ACCOUNT_ID = "test-account-id";
	process.env.TAX_R2_ACCESS_KEY_ID = "test-access-key";
	process.env.TAX_R2_SECRET_ACCESS_KEY = "test-secret-key";
	process.env.TAX_R2_BUCKET = "moat-tax-files";
}

beforeEach(() => {
	setNodeEnv("test");
	resetProductionConfigValidationForTests();
	setBaseProductionEnv();
});

afterEach(() => {
	setNodeEnv("test");
	resetProductionConfigValidationForTests();
	restoreEnv();
});

describe("production environment validation", () => {
	it("requires MCP_TOKEN_PEPPER in production", () => {
		delete process.env.MCP_TOKEN_PEPPER;

		assert.throws(
			() => validateProductionConfig(),
			/MCP_TOKEN_PEPPER.*MCP personal access token hashing pepper/s,
		);
	});

	it("rejects a short MCP_TOKEN_PEPPER in production", () => {
		process.env.MCP_TOKEN_PEPPER = "too-short";

		assert.throws(
			() => validateProductionConfig(),
			/MCP_TOKEN_PEPPER.*at least 32 characters/s,
		);
	});

	it("accepts the required production security secrets", () => {
		assert.doesNotThrow(() => validateProductionConfig());
	});

	it("requires the iOS Google client ID when Google auth is enabled", () => {
		process.env.AUTH_GOOGLE_ID = "web-client.apps.googleusercontent.com";
		delete process.env.AUTH_GOOGLE_ID_IOS;

		assert.throws(
			() => validateProductionConfig(),
			/AUTH_GOOGLE_ID_IOS.*iOS Google OAuth client ID/s,
		);
	});

	it("accepts the iOS Google client ID when Google auth is enabled", () => {
		process.env.AUTH_GOOGLE_ID = "web-client.apps.googleusercontent.com";
		process.env.AUTH_GOOGLE_ID_IOS = "ios-client.apps.googleusercontent.com";

		assert.doesNotThrow(() => validateProductionConfig());
	});

	it("requires GitHub feedback secrets when GitHub sync is enabled", () => {
		process.env.GITHUB_FEEDBACK_ENABLED = "true";
		delete process.env.GITHUB_FEEDBACK_TOKEN;
		delete process.env.GITHUB_FEEDBACK_OWNER;
		delete process.env.GITHUB_FEEDBACK_REPO;

		assert.throws(
			() => validateProductionConfig(),
			/GITHUB_FEEDBACK_TOKEN.*feedback issue creation/s,
		);
	});

	it("accepts GitHub feedback secrets when GitHub sync is enabled", () => {
		process.env.GITHUB_FEEDBACK_ENABLED = "true";
		process.env.GITHUB_FEEDBACK_TOKEN = "github_pat_test";
		process.env.GITHUB_FEEDBACK_OWNER = "moat-finance";
		process.env.GITHUB_FEEDBACK_REPO = "moat";

		assert.doesNotThrow(() => validateProductionConfig());
	});

	it("does not require TAX_R2 vars while the taxes product is parked", () => {
		assert.equal(TAXES_PRODUCT_ENABLED, false);
		delete process.env.TAX_R2_BUCKET;
		delete process.env.TAX_R2_ACCOUNT_ID;
		delete process.env.TAX_R2_ACCESS_KEY_ID;
		delete process.env.TAX_R2_SECRET_ACCESS_KEY;

		assert.doesNotThrow(() => validateProductionConfig());
	});

	it("starts without Docling parser env and does not require it", () => {
		delete process.env.DOCLING_PARSER_URL;
		delete process.env.DOCLING_RUNTIME_SERVICE_ACCOUNT;
		delete process.env.DOCLING_PARSE_AUDIENCE;

		assert.doesNotThrow(() => validateProductionConfig());
	});
});
