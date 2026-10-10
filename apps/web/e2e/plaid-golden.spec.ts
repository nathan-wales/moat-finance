import assert from "node:assert/strict";
import {
	assertNormalizedStateEqual,
	expectedState,
	type NormalizedFinancialState,
} from "@moat/plaid-golden-ledger";
import { expect, test } from "@playwright/test";
import {
	GOLDEN_PLAID_INIT_SCRIPT,
	readGoldenUserRecord,
} from "./golden-fixture";
import { parseCliJson, runApiGoldenCli } from "./run-api-cli";

test.describe("web Playwright Plaid Golden Ledger", () => {
	test("connects through the overlay and matches expected-state", async ({
		page,
	}) => {
		const user = readGoldenUserRecord();
		await page.addInitScript(GOLDEN_PLAID_INIT_SCRIPT);

		await page.goto("/financial-profile");
		const acknowledgement = page.getByTestId(
			"ai-guidance-acknowledgement-accept",
		);
		if (await acknowledgement.isVisible().catch(() => false)) {
			await acknowledgement.click();
		}
		const connect = page.getByTestId("connect-account");
		await expect(connect).toBeVisible({ timeout: 60_000 });
		await expect(connect).toBeEnabled();
		const linkTokenResponsePromise = page.waitForResponse(
			(response) =>
				response.url().includes("/api/v1/plaid/createLinkToken") &&
				response.request().method() === "POST",
			{ timeout: 60_000 },
		);
		const exchangeResponsePromise = page.waitForResponse(
			(response) =>
				response.url().includes("/api/v1/plaid/exchangePublicToken") &&
				response.request().method() === "POST",
			{ timeout: 120_000 },
		);
		await connect.click();
		const linkTokenResponse = await linkTokenResponsePromise;
		assert.ok(
			linkTokenResponse.ok(),
			`createLinkToken ${linkTokenResponse.status()}: ${await linkTokenResponse.text()}`,
		);
		await expect(
			page.getByTestId("connection-import-overlay-syncing"),
		).toBeVisible({ timeout: 60_000 });
		const exchangeResponse = await exchangeResponsePromise;
		const exchangeBody = await exchangeResponse.text();
		assert.ok(
			exchangeResponse.ok(),
			`exchangePublicToken ${exchangeResponse.status()}: ${exchangeBody}`,
		);
		const exchangeJson = JSON.parse(exchangeBody) as {
			data?: { addedCount?: number; outcome?: string; plaidItemDbId?: string };
		};
		assert.ok(
			(exchangeJson.data?.addedCount ?? 0) > 0,
			`expected initial Golden txs, got ${exchangeBody}`,
		);

		const mockCalls = (await (
			await fetch("http://127.0.0.1:18080/_golden/calls")
		).json()) as { calls?: string[] };
		assert.ok(
			mockCalls.calls?.includes("/item/public_token/exchange"),
			`Golden mock was not used: ${JSON.stringify(mockCalls)}`,
		);

		runApiGoldenCli("golden:drive-historical", [user.id]);

		await expect(
			page.getByTestId("connection-import-overlay-success"),
		).toBeVisible({ timeout: 120_000 });
		await expect(page.getByText("Success!")).toBeVisible();

		const dump = parseCliJson<NormalizedFinancialState>(
			runApiGoldenCli("golden:dump", [user.id]),
		);
		assertNormalizedStateEqual(dump, expectedState, "playwright-historical");

		const done = page.getByTestId("connection-import-overlay-done");
		if (await done.isVisible().catch(() => false)) {
			await done.click();
		}
		await expect(
			page.getByTestId("connection-import-overlay-success"),
		).toBeHidden();
		await expect(
			page.getByRole("row", { name: "View details for Golden Checking" }),
		).toBeVisible();

		await page.goto("/transactions");
		await expect(page).toHaveURL(/\/transactions/);

		const table = page.getByRole("table", { name: "Transactions" });
		await expect(
			table.getByRole("row", { name: /COSTCO WHSE #0421/ }).first(),
		).toBeVisible();
		await expect(
			table.getByRole("row", { name: /LOCAL BOOKSTORE/ }).first(),
		).toBeVisible();

		await page.goto("/financial-profile");
		await expect(page.getByTestId("connect-account")).toBeEnabled();
		await page.getByTestId("connect-account").click();
		await expect(
			page.getByTestId("connection-import-overlay-already_linked"),
		).toBeVisible({ timeout: 60_000 });
		await expect(
			page
				.getByTestId("connection-import-overlay-already_linked")
				.locator("p.font-semibold"),
		).toHaveText("Already in Moat");
		const afterCalls = (await (
			await fetch("http://127.0.0.1:18080/_golden/calls")
		).json()) as { calls?: string[] };
		const exchangeCount = (afterCalls.calls ?? []).filter(
			(call) => call === "/item/public_token/exchange",
		).length;
		assert.equal(exchangeCount, 1);
	});
});
