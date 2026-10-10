import type { AppRuntime } from "@moat/runtime";
import { getDesktopDb } from "../db";
import { remoteLogger } from "../lib/remote-logger";
import { detectAndPairTransfers } from "../plaid/transfer-pairing";
import { applyActiveRulesToTransactions } from "./rules-apply";

/**
 * Post-insert CSV import processing: apply rules first so they can recategorize
 * a leg to Transfer, then pair internal transfers. Failures are logged and
 * swallowed so a rules/pairing error cannot unwind an already-committed import.
 */
export async function applyRulesAndPairImportedTransactions(
	appRuntime: AppRuntime,
	transactionIds: string[],
): Promise<void> {
	if (transactionIds.length === 0) return;

	try {
		await applyActiveRulesToTransactions(appRuntime, transactionIds);
	} catch (error) {
		remoteLogger.error("Desktop CSV import rules failed after insert", {
			event: "desktop.transaction_import.rules_failed",
			feature: "transaction_import",
			operation: "applyRules",
			metadata: {
				imported: transactionIds.length,
				errorMessage: error instanceof Error ? error.message : "unknown",
			},
		});
	}

	try {
		const { db } = getDesktopDb();
		await detectAndPairTransfers({
			db,
			userId: appRuntime.userId,
			candidateTransactionIds: transactionIds,
		});
	} catch (error) {
		remoteLogger.error(
			"Desktop CSV import transfer pairing failed after insert",
			{
				event: "desktop.transaction_import.pairing_failed",
				feature: "transaction_import",
				operation: "detectAndPairTransfers",
				metadata: {
					imported: transactionIds.length,
					errorMessage: error instanceof Error ? error.message : "unknown",
				},
			},
		);
	}
}
