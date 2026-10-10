import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { after, describe, it } from "node:test";
import { TAXES_PRODUCT_ENABLED } from "@moat/contracts";
import { advertisedMcpScopes, desktopMcpScopes } from "@moat/mcp-contracts";
import {
	filterLocalAgentScopes,
	generateToken,
	localAgentScopes,
	resolveAgentToken,
} from "./local-token-service";

const tempDirs: string[] = [];

function tempUserDataPath(): string {
	const dir = fs.mkdtempSync(path.join(os.tmpdir(), "moat-agent-token-"));
	tempDirs.push(dir);
	return dir;
}

after(() => {
	for (const dir of tempDirs) {
		fs.rmSync(dir, { recursive: true, force: true });
	}
});

describe("filterLocalAgentScopes", () => {
	it("allows mcp:feedback:write for local agent tokens", () => {
		assert.ok(
			(localAgentScopes as readonly string[]).includes("mcp:feedback:write"),
		);
		assert.deepEqual(filterLocalAgentScopes(["mcp:feedback:write"]), [
			"mcp:feedback:write",
		]);
	});

	it("strips cloud-only community-tips scopes", () => {
		assert.deepEqual(
			filterLocalAgentScopes([
				"mcp:read",
				"mcp:community-tips:read",
				"mcp:community-tips:write",
			]),
			["mcp:read"],
		);
	});

	it("matches advertised desktop scopes including transaction import write", () => {
		assert.deepEqual(
			[...localAgentScopes],
			advertisedMcpScopes(desktopMcpScopes),
		);
		assert.ok(localAgentScopes.includes("mcp:transactions:write"));
		assert.ok(localAgentScopes.includes("mcp:retirement:write"));
		assert.equal(
			localAgentScopes.includes("mcp:tax:read"),
			TAXES_PRODUCT_ENABLED,
		);
	});
});

describe("generateToken", () => {
	it("defaults to full desktop scopes including mcp:transactions:write", () => {
		const { token } = generateToken(tempUserDataPath(), "Cursor Desktop");
		assert.deepEqual(token.scopes, [...localAgentScopes]);
		assert.ok(token.scopes.includes("mcp:transactions:write"));
	});

	it("resolves a plaintext local token and rejects unknown values", () => {
		const userDataPath = tempUserDataPath();
		const { token, plaintext } = generateToken(userDataPath, "Cursor Desktop");
		const context = resolveAgentToken(userDataPath, plaintext);
		assert.ok(context);
		assert.equal(context.tokenId, token.id);
		assert.equal(context.label, "Cursor Desktop");
		assert.equal(resolveAgentToken(userDataPath, "moat_local_nope"), null);
	});
});
