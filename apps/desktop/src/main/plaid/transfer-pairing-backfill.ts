/**
 * One-shot full-history transfer pairing for existing desktop databases.
 * Incremental Plaid sync only looks back ±5 days from newly written rows, so
 * previously imported history would otherwise stay unpaired.
 */

import { listLocalProfiles, type SqliteDbClient } from "@moat/db-sqlite";
import { remoteLogger } from "../lib/remote-logger";
import { detectAndPairTransfers } from "./transfer-pairing";

export const TRANSFER_PAIRING_BACKFILL_META_KEY =
	"transfer_pairing_backfill_v1";

export type TransferPairingBackfillResult = {
	profilesCompleted: number;
	profilesSkipped: number;
	profilesFailed: number;
	pairsCreated: number;
	pairsReconciled: number;
};

export async function backfillDesktopTransferPairing(
	db: SqliteDbClient,
): Promise<TransferPairingBackfillResult> {
	const profiles = await listLocalProfiles(db);
	const summary: TransferPairingBackfillResult = {
		profilesCompleted: 0,
		profilesSkipped: 0,
		profilesFailed: 0,
		pairsCreated: 0,
		pairsReconciled: 0,
	};

	for (const profile of profiles) {
		const existing = (await db.userMetadata.findUnique({
			where: {
				userId_key: {
					userId: profile.profileUserId,
					key: TRANSFER_PAIRING_BACKFILL_META_KEY,
				},
			},
		})) as { id: string } | null;
		if (existing) {
			summary.profilesSkipped += 1;
			continue;
		}

		try {
			const result = await detectAndPairTransfers({
				db,
				userId: profile.profileUserId,
				fullHistory: true,
			});
			const completedAt = new Date().toISOString();

			await db.userMetadata.upsert({
				where: {
					userId_key: {
						userId: profile.profileUserId,
						key: TRANSFER_PAIRING_BACKFILL_META_KEY,
					},
				},
				update: {
					valueJson: JSON.stringify({ ...result, completedAt }),
				},
				create: {
					id: `meta_${profile.profileUserId}_${TRANSFER_PAIRING_BACKFILL_META_KEY}`,
					userId: profile.profileUserId,
					key: TRANSFER_PAIRING_BACKFILL_META_KEY,
					valueJson: JSON.stringify({ ...result, completedAt }),
				},
			});

			summary.profilesCompleted += 1;
			summary.pairsCreated += result.pairsCreated;
			summary.pairsReconciled += result.pairsReconciled;
		} catch (err) {
			summary.profilesFailed += 1;
			const errorMessage = err instanceof Error ? err.message : "Unknown error";
			remoteLogger.error(
				"Desktop transfer pairing backfill failed for profile",
				{
					event: "desktop.transfer_pairing.backfill_profile_failed",
					feature: "transfer-pairing",
					operation: "launch",
					metadata: { errorMessage },
				},
			);
		}
	}

	if (summary.profilesFailed > 0) {
		throw new Error(
			`Transfer pairing backfill failed for ${summary.profilesFailed} profile(s)`,
		);
	}

	return summary;
}

export function runTransferPairingBackfillOnLaunch(db: SqliteDbClient): void {
	void backfillDesktopTransferPairing(db)
		.then((summary) => {
			if (summary.profilesCompleted === 0) return;
			remoteLogger.info("Desktop transfer pairing backfill complete", {
				event: "desktop.transfer_pairing.backfill_complete",
				feature: "transfer-pairing",
				operation: "launch",
				metadata: {
					profilesCompleted: summary.profilesCompleted,
					pairsCreated: summary.pairsCreated,
					pairsReconciled: summary.pairsReconciled,
				},
			});
		})
		.catch((err) => {
			const errorMessage = err instanceof Error ? err.message : "Unknown error";
			console.error("[transfer-pairing] Launch backfill failed:", err);
			remoteLogger.error("Desktop transfer pairing backfill failed", {
				event: "desktop.transfer_pairing.backfill_failed",
				feature: "transfer-pairing",
				operation: "launch",
				metadata: { errorMessage },
			});
		});
}
