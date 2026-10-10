/**
 * Background cloud backup scheduler.
 * Runs after vault unlock and once every 24h while backups are enabled.
 */
import type { SqliteDbClient } from "@moat/db-sqlite";
import { runCloudBackup, shouldRunScheduledBackup } from "./engine";

const CHECK_INTERVAL_MS = 60 * 60 * 1000; // hourly check; engine enforces 24h freshness

let cleanup: (() => void) | null = null;

export function startCloudBackupScheduler(
	db: SqliteDbClient,
	userId: string,
): () => void {
	if (cleanup) {
		cleanup();
	}

	const maybeRun = () => {
		if (!shouldRunScheduledBackup()) return;
		void runCloudBackup({ db, userId, enableOnSuccess: true }).catch((err) => {
			console.error("[cloud-backup-scheduler] Backup failed:", err);
		});
	};

	maybeRun();
	const interval = setInterval(maybeRun, CHECK_INTERVAL_MS);
	cleanup = () => {
		clearInterval(interval);
		cleanup = null;
	};
	return cleanup;
}

export function stopCloudBackupScheduler(): void {
	if (cleanup) {
		cleanup();
	}
}
