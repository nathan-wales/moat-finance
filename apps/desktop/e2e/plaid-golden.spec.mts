import assert from "node:assert/strict";
import fs from "node:fs";
import { createRequire } from "node:module";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
	assertNormalizedStateEqual,
	expectedInitialState,
	expectedState,
	GOLDEN_PLAID_MOCK_PORT,
	type NormalizedFinancialState,
} from "@moat/plaid-golden-ledger";
import { _electron as electron, expect, test } from "@playwright/test";
import {
	GOLDEN_PLAID_FIXTURE,
	GOLDEN_VAULT_PASSWORD,
} from "./golden-fixture.mts";

const desktopRoot = path.resolve(
	path.dirname(fileURLToPath(import.meta.url)),
	"..",
);
const require = createRequire(import.meta.url);
const mainEntry = path.join(desktopRoot, "out/main/index.js");
const mockBaseUrl = `http://127.0.0.1:${GOLDEN_PLAID_MOCK_PORT}`;
const ciChromiumFlags = process.env.CI ? ["--no-sandbox", "--disable-gpu"] : [];

function resolveElectronBinary(): string {
	try {
		return require("electron") as string;
	} catch (error) {
		const message = error instanceof Error ? error.message : String(error);
		throw new Error(
			`Electron binary is missing (${message}). Run \`pnpm --filter moat-desktop run ensure-electron\`.`,
		);
	}
}

async function dumpFromApp(
	app: Awaited<ReturnType<typeof electron.launch>>,
): Promise<NormalizedFinancialState> {
	return app.evaluate(async () => {
		const hooks = (
			globalThis as {
				__moatGoldenDesktop?: {
					dumpNormalizedState: () => Promise<NormalizedFinancialState>;
				};
			}
		).__moatGoldenDesktop;
		if (!hooks) {
			throw new Error("Golden desktop dump hook is missing");
		}
		return hooks.dumpNormalizedState();
	});
}

test.describe("desktop Playwright Plaid Golden Ledger", () => {
	test("privacy notice, overlay catch-up, and expected-state", async () => {
		if (!fs.existsSync(mainEntry)) {
			throw new Error(
				"Desktop unpacked build is missing. Run `pnpm --filter moat-desktop run build` first.",
			);
		}

		const userData = fs.mkdtempSync(
			path.join(os.tmpdir(), "moat-golden-desktop-e2e-"),
		);
		const app = await electron.launch({
			executablePath: resolveElectronBinary(),
			args: [...ciChromiumFlags, mainEntry, `--user-data-dir=${userData}`],
			cwd: desktopRoot,
			timeout: 120_000,
			env: {
				...process.env,
				MOAT_E2E: "1",
				MOAT_E2E_USER_DATA: userData,
				MOAT_E2E_GOLDEN_PLAID_JSON: JSON.stringify(GOLDEN_PLAID_FIXTURE),
				PLAID_CLIENT_ID: process.env.PLAID_CLIENT_ID ?? "golden-client-id",
				PLAID_SECRET: process.env.PLAID_SECRET ?? "golden-secret",
				PLAID_ENV: "sandbox",
				PLAID_BASE_PATH: mockBaseUrl,
				PLAID_CATCH_UP_DELAYS_MS: "0,0,0,0,0",
				PLAID_HISTORICAL_CATCH_UP_DELAYS_MS: "15000,0,0,0,0,0,0",
			},
		});

		try {
			const page = await app.firstWindow();
			await expect(page.getByText("Your data stays here")).toBeVisible({
				timeout: 60_000,
			});
			await page.getByTestId("onboarding-next").click();
			await expect(page.getByText("Protecting your data")).toBeVisible();
			await page.getByTestId("onboarding-next").click();
			await expect(page.getByLabel("App password")).toBeVisible();
			await page.locator("#vault-password").fill(GOLDEN_VAULT_PASSWORD);
			await page.getByRole("button", { name: "Set up local vault" }).click();
			await expect(page.getByTestId("onboarding-skip")).toBeVisible({
				timeout: 60_000,
			});
			await page.getByTestId("onboarding-skip").click();

			await page.getByTestId("nav-financial-profile").click();
			const connect = page.getByTestId("connect-account");
			await expect(connect).toBeEnabled();
			await connect.click();

			await expect(page.getByTestId("privacy-notice")).toBeVisible();
			await expect(page.getByText("Privacy Notice")).toBeVisible();
			await expect(
				page.getByText("You are enabling automatic bank syncing through"),
			).toBeVisible();
			await expect(page.getByTestId("privacy-notice-cancel")).toBeVisible();
			await expect(page.getByTestId("privacy-notice-understand")).toBeVisible();
			await page.getByTestId("privacy-notice-understand").click();

			await expect(
				page.getByTestId("connection-import-overlay-syncing"),
			).toBeVisible();

			await expect(async () => {
				const dump = await dumpFromApp(app);
				assert.ok(
					dump.transactions.length >= expectedInitialState.transactions.length,
				);
			}).toPass({ timeout: 60_000 });

			await app.evaluate(async () => {
				const hooks = (
					globalThis as {
						__moatGoldenDesktop?: { prepareAfterInitial: () => Promise<void> };
					}
				).__moatGoldenDesktop;
				if (!hooks) {
					throw new Error("Golden desktop after-initial hook is missing");
				}
				await hooks.prepareAfterInitial();
			});

			await expect(
				page.getByTestId("connection-import-overlay-success"),
			).toBeVisible({ timeout: 120_000 });
			await expect(page.getByText("Success!")).toBeVisible();

			const dump = await dumpFromApp(app);
			assertNormalizedStateEqual(dump, expectedState, "playwright-historical");

			const mockCalls = (await (
				await fetch(`${mockBaseUrl}/_golden/calls`)
			).json()) as { calls?: string[] };
			assert.ok(
				mockCalls.calls?.includes("/item/public_token/exchange"),
				`Golden mock was not used: ${JSON.stringify(mockCalls)}`,
			);
			assert.equal(
				mockCalls.calls?.includes("/webhook_verification_key/get"),
				false,
				"desktop Golden must not post Plaid webhooks",
			);

			const exchangeCount = (mockCalls.calls ?? []).filter(
				(call) => call === "/item/public_token/exchange",
			).length;

			const done = page.getByTestId("connection-import-overlay-done");
			if (await done.isVisible().catch(() => false)) {
				await done.click();
			}

			await page.getByTestId("nav-transactions").click();
			const table = page.getByRole("table", { name: "Transactions" });
			await expect(
				table.getByRole("row", { name: /COSTCO WHSE #0421/ }).first(),
			).toBeVisible();

			await page.getByTestId("nav-financial-profile").click();
			await expect(page.getByTestId("connect-account")).toBeEnabled();
			await page.getByTestId("connect-account").click();
			await expect(page.getByTestId("privacy-notice")).toBeVisible();
			await page.getByTestId("privacy-notice-understand").click();
			await expect(
				page.getByTestId("connection-import-overlay-already_linked"),
			).toBeVisible({ timeout: 60_000 });
			await expect(
				page
					.getByTestId("connection-import-overlay-already_linked")
					.locator("p.font-semibold"),
			).toHaveText("Already in Moat");

			const afterCalls = (await (
				await fetch(`${mockBaseUrl}/_golden/calls`)
			).json()) as { calls?: string[] };
			const laterExchangeCount = (afterCalls.calls ?? []).filter(
				(call) => call === "/item/public_token/exchange",
			).length;
			assert.equal(laterExchangeCount, exchangeCount);
		} finally {
			await app.close();
			fs.rmSync(userData, { recursive: true, force: true });
		}
	});
});
