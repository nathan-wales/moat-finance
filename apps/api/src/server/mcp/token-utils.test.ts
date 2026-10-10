import assert from "node:assert/strict";
import { afterEach, describe, it } from "node:test";
import { getMcpTokenPepper } from "./token-utils";

const ORIGINAL_ENV = {
	DATABASE_URL: process.env.DATABASE_URL,
	MCP_TOKEN_PEPPER: process.env.MCP_TOKEN_PEPPER,
	NODE_ENV: process.env.NODE_ENV,
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

afterEach(() => {
	restoreEnv();
});

describe("MCP token pepper", () => {
	it("uses MCP_TOKEN_PEPPER when configured", () => {
		setNodeEnv("production");
		process.env.MCP_TOKEN_PEPPER = "p".repeat(32);
		process.env.DATABASE_URL = "postgresql://fallback";

		assert.equal(getMcpTokenPepper(), "p".repeat(32));
	});

	it("rejects production fallback to DATABASE_URL", () => {
		setNodeEnv("production");
		delete process.env.MCP_TOKEN_PEPPER;
		process.env.DATABASE_URL = "postgresql://fallback";

		assert.throws(
			() => getMcpTokenPepper(),
			/MCP_TOKEN_PEPPER is required in production/,
		);
	});

	it("allows DATABASE_URL fallback outside production", () => {
		setNodeEnv("development");
		delete process.env.MCP_TOKEN_PEPPER;
		process.env.DATABASE_URL = "postgresql://fallback";

		assert.equal(getMcpTokenPepper(), "postgresql://fallback");
	});
});
