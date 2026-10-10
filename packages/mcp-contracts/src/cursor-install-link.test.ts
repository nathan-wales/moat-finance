import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
	buildCursorMcpInstallLink,
	buildHttpMcpServerConfig,
	buildUrlOnlyMcpServerConfig,
	CLAUDE_CUSTOM_CONNECTOR_NAME,
	CLAUDE_CUSTOM_CONNECTOR_SETUP_URL,
	CLOUD_MCP_HTTP_URL,
	cursorInstallOpenedMessage,
	cursorOauthInstallOpenedMessage,
	utf8ToBase64,
} from "./cursor-install-link";

describe("claude custom connector constants", () => {
	it("points at the hosted MCP url and Claude connector form", () => {
		assert.equal(CLOUD_MCP_HTTP_URL, "https://mcp.moatfinance.ai/mcp");
		assert.equal(CLAUDE_CUSTOM_CONNECTOR_NAME, "Moat Finance");
		assert.equal(
			CLAUDE_CUSTOM_CONNECTOR_SETUP_URL,
			"https://claude.ai/new?modal=add-custom-connector#customize/connectors",
		);
	});
});

describe("buildHttpMcpServerConfig", () => {
	it("builds url + bearer authorization header", () => {
		assert.deepEqual(
			buildHttpMcpServerConfig({
				url: "http://localhost:3030/mcp",
				bearerToken: "moat_test_token",
			}),
			{
				url: "http://localhost:3030/mcp",
				headers: {
					Authorization: "Bearer moat_test_token",
				},
			},
		);
	});
});

describe("buildUrlOnlyMcpServerConfig", () => {
	it("defaults to the hosted MCP url with no headers", () => {
		assert.deepEqual(buildUrlOnlyMcpServerConfig(), {
			url: CLOUD_MCP_HTTP_URL,
		});
	});
});

describe("buildCursorMcpInstallLink", () => {
	it("encodes a url-only config into the HTTPS install page", () => {
		const config = buildUrlOnlyMcpServerConfig();
		const link = buildCursorMcpInstallLink({
			name: "moat-finance",
			config,
		});

		assert.ok(link.startsWith("https://cursor.com/en/install-mcp?"));

		const url = new URL(link);
		assert.equal(url.searchParams.get("name"), "moat-finance");

		const encoded = url.searchParams.get("config");
		assert.ok(encoded);
		assert.equal(encoded, utf8ToBase64(JSON.stringify(config)));
		assert.deepEqual(JSON.parse(atob(encoded)), config);
		assert.equal("headers" in config, false);
	});

	it("keeps the native deeplink for local desktop OAuth installs", () => {
		const config = buildUrlOnlyMcpServerConfig("http://127.0.0.1:3030/mcp");
		const link = buildCursorMcpInstallLink({
			name: "moat-finance-local",
			config,
			scheme: "deeplink",
		});

		assert.ok(
			link.startsWith("cursor://anysphere.cursor-deeplink/mcp/install?"),
		);

		const url = new URL(link);
		assert.equal(url.searchParams.get("name"), "moat-finance-local");
		assert.deepEqual(
			JSON.parse(atob(url.searchParams.get("config") ?? "")),
			config,
		);
		assert.equal("headers" in config, false);
	});
});

describe("cursorInstallOpenedMessage", () => {
	it("names the server and points to the install confirm + fallback", () => {
		const message = cursorInstallOpenedMessage("moat-finance-local");
		assert.match(message, /Approve the install prompt/);
		assert.match(message, /moat-finance-local/);
		assert.match(message, /Copy config/);
	});
});

describe("cursorOauthInstallOpenedMessage", () => {
	it("tells the user to authenticate after install", () => {
		const message = cursorOauthInstallOpenedMessage("moat-finance");
		assert.match(message, /Authenticate/);
		assert.match(message, /moat-finance/);
	});
});
