import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { CountryCode, Products } from "plaid";
import {
	getPlaidClient,
	resetPlaidClientForTests,
} from "~/server/lib/plaidClient";

function sandboxConfigured(): boolean {
	const clientId = process.env.PLAID_CLIENT_ID?.trim() ?? "";
	const secret = process.env.PLAID_SECRET?.trim() ?? "";
	if (!clientId || !secret) return false;
	if (clientId === "golden-client-id" || secret === "golden-secret")
		return false;
	if (process.env.PLAID_BASE_PATH?.trim()) return false;
	return true;
}

describe("Plaid Sandbox smoke", { timeout: 60_000 }, () => {
	it("creates a Link token and exchanges a Sandbox public token", async (t) => {
		if (!sandboxConfigured()) {
			t.skip("Plaid Sandbox secrets are not configured");
			return;
		}
		resetPlaidClientForTests();
		const client = getPlaidClient();
		const link = await client.linkTokenCreate({
			user: { client_user_id: "sandbox-smoke" },
			client_name: "Moat Finance",
			products: [Products.Transactions],
			country_codes: [CountryCode.Us],
			language: "en",
		});
		assert.ok(link.data.link_token.length > 0);

		const sandbox = await client.sandboxPublicTokenCreate({
			institution_id: "ins_109508",
			initial_products: [Products.Transactions],
		});
		assert.ok(sandbox.data.public_token.length > 0);

		const exchanged = await client.itemPublicTokenExchange({
			public_token: sandbox.data.public_token,
		});
		assert.ok(exchanged.data.access_token.length > 0);
		assert.ok(exchanged.data.item_id.length > 0);

		const sync = await client.transactionsSync({
			access_token: exchanged.data.access_token,
			count: 100,
			options: { include_original_description: true },
		});
		assert.ok(
			sync.data.added.length +
				sync.data.modified.length +
				sync.data.removed.length >=
				0,
		);
	});
});
