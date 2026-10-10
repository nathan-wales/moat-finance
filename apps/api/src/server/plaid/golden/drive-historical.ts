import {
	GOLDEN_ACCOUNT_IDS,
	GOLDEN_ITEM_ID,
	goldenHistoricalUpdatePayload,
	USER_CATEGORY_OVERRIDES_AFTER_INITIAL,
} from "@moat/plaid-golden-ledger";
import { db } from "~/server/db";
import { resetPlaidClientForTests } from "~/server/lib/plaidClient";
import { setAccountSyncEnabled } from "~/server/plaid/set-account-sync-enabled";
import { processProviderSyncJobById } from "~/server/services/provider-sync-job.service";
import { requireGoldenCliUserId } from "./parse-cli-user-id";
import { applyGoldenUserCategoryOverride } from "./seed";
import { withGoldenActor } from "./with-golden-actor";

process.env.MOAT_E2E = "1";
process.env.PLAID_BASE_PATH ??= "http://127.0.0.1:18080";
resetPlaidClientForTests();

const userId = requireGoldenCliUserId("usage: drive-historical.ts <userId>");

const mockBase = process.env.PLAID_BASE_PATH;
const apiBase = (process.env.API_URL ?? "http://127.0.0.1:3001").replace(
	/\/$/,
	"",
);

async function sleep(ms: number): Promise<void> {
	await new Promise((resolve) => setTimeout(resolve, ms));
}

async function waitForInitialTransaction(): Promise<void> {
	const deadline = Date.now() + 60_000;
	while (Date.now() < deadline) {
		const row = await withGoldenActor(() =>
			db.transaction.findFirst({
				where: { userId, externalTransactionId: "gtx-bookstore" },
				select: { id: true },
			}),
		);
		if (row) return;
		await sleep(250);
	}
	throw new Error("Timed out waiting for Golden initial sync");
}

async function postSignedWebhook(rawBody: string): Promise<number> {
	const signed = await fetch(`${mockBase}/_golden/sign`, {
		method: "POST",
		headers: { "content-type": "application/json" },
		body: JSON.stringify({ body: rawBody }),
	});
	if (!signed.ok) {
		throw new Error(`Golden mock sign failed (${signed.status})`);
	}
	const payload = (await signed.json()) as { token?: string };
	if (!payload.token) {
		throw new Error("Golden mock sign did not return a token");
	}
	const posted = await fetch(`${apiBase}/api/webhook/plaid`, {
		method: "POST",
		headers: {
			"content-type": "application/json",
			"Plaid-Verification": payload.token,
		},
		body: rawBody,
	});
	return posted.status;
}

async function waitForSyncJob(): Promise<string> {
	const deadline = Date.now() + 15_000;
	while (Date.now() < deadline) {
		const job = await withGoldenActor(() =>
			db.providerSyncJob.findFirst({
				where: { userId },
				orderBy: { createdAt: "desc" },
				select: { id: true },
			}),
		);
		if (job) return job.id;
		await sleep(100);
	}
	throw new Error("HISTORICAL_UPDATE did not enqueue a ProviderSyncJob");
}

async function main(): Promise<void> {
	await waitForInitialTransaction();

	await withGoldenActor(async () => {
		for (const override of USER_CATEGORY_OVERRIDES_AFTER_INITIAL) {
			await applyGoldenUserCategoryOverride(
				userId,
				override.providerTransactionId,
				override.category,
			);
		}

		const disabled = await db.plaidAccount.findFirst({
			where: { userId, plaidAccountId: GOLDEN_ACCOUNT_IDS.disabledChecking },
			select: { id: true },
		});
		if (!disabled) {
			throw new Error("Golden disabled checking account was not imported");
		}
		await setAccountSyncEnabled({
			db,
			userId,
			accountId: disabled.id,
			syncEnabled: false,
		});
	});

	const enableHistorical = await fetch(
		`${mockBase}/_golden/enable-historical`,
		{
			method: "POST",
		},
	);
	if (!enableHistorical.ok) {
		throw new Error("Failed to enable Golden historical pages");
	}
	const armMutation = await fetch(
		`${mockBase}/_golden/arm-mutation-during-pagination`,
		{ method: "POST" },
	);
	if (!armMutation.ok) {
		throw new Error("Failed to arm Golden mutation-during-pagination");
	}

	const rawBody = goldenHistoricalUpdatePayload(GOLDEN_ITEM_ID);
	const webhookStatus = await postSignedWebhook(rawBody);
	if (webhookStatus !== 204) {
		throw new Error(`Expected webhook 204, got ${webhookStatus}`);
	}

	const jobId = await waitForSyncJob();
	const processed = await withGoldenActor(() =>
		processProviderSyncJobById(jobId),
	);
	if (processed.outcome !== "processed") {
		throw new Error(`ProviderSyncJob outcome was ${processed.outcome}`);
	}

	const duplicateStatus = await postSignedWebhook(rawBody);
	if (duplicateStatus !== 204) {
		throw new Error(`Expected duplicate webhook 204, got ${duplicateStatus}`);
	}

	const complete = await fetch(`${mockBase}/_golden/complete-historical`, {
		method: "POST",
	});
	if (!complete.ok) {
		throw new Error("Failed to mark Golden historical update complete");
	}

	await db.$disconnect();
}

void main().catch((error) => {
	process.stderr.write(
		`${error instanceof Error ? (error.stack ?? error.message) : String(error)}\n`,
	);
	process.exit(1);
});
