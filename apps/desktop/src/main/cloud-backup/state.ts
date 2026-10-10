import fs from "node:fs";
import path from "node:path";
import type {
	CloudBackupDomain,
	CloudBackupDomainPreferences,
	CloudBackupDomainStatus,
	CloudBackupStatus,
} from "@moat/contracts";
import { DEFAULT_CLOUD_BACKUP_PREFERENCES } from "@moat/contracts";
import { app } from "electron";
import { getCloudAuthIdentity } from "../lib/cloud-auth";

export type CloudBackupPersistedState = {
	backupsEnabled: boolean;
	preferences: CloudBackupDomainPreferences;
	lastSuccessfulSyncAt: string | null;
	lastAttemptAt: string | null;
	lastError: string | null;
	domainSync: Partial<
		Record<
			CloudBackupDomain,
			{
				lastSyncedAt: string | null;
				lastError: string | null;
				lastLocalCount: number;
			}
		>
	>;
};

const DOMAINS: CloudBackupDomain[] = [
	"rules",
	"categories",
	"budgets",
	"forecasts",
	"hashtags",
	"transactions",
];

let isRunning = false;

function getStatePath(): string {
	return path.join(app.getPath("userData"), "cloud-backup-state.json");
}

export function readBackupState(): CloudBackupPersistedState {
	const statePath = getStatePath();
	if (!fs.existsSync(statePath)) {
		return {
			backupsEnabled: false,
			preferences: { ...DEFAULT_CLOUD_BACKUP_PREFERENCES },
			lastSuccessfulSyncAt: null,
			lastAttemptAt: null,
			lastError: null,
			domainSync: {},
		};
	}

	try {
		const raw = JSON.parse(
			fs.readFileSync(statePath, "utf8"),
		) as Partial<CloudBackupPersistedState>;
		return {
			backupsEnabled: Boolean(raw.backupsEnabled),
			preferences: {
				...DEFAULT_CLOUD_BACKUP_PREFERENCES,
				...(raw.preferences ?? {}),
			},
			lastSuccessfulSyncAt: raw.lastSuccessfulSyncAt ?? null,
			lastAttemptAt: raw.lastAttemptAt ?? null,
			lastError: raw.lastError ?? null,
			domainSync: raw.domainSync ?? {},
		};
	} catch {
		return {
			backupsEnabled: false,
			preferences: { ...DEFAULT_CLOUD_BACKUP_PREFERENCES },
			lastSuccessfulSyncAt: null,
			lastAttemptAt: null,
			lastError: null,
			domainSync: {},
		};
	}
}

export function writeBackupState(state: CloudBackupPersistedState): void {
	fs.writeFileSync(getStatePath(), JSON.stringify(state, null, 2), "utf8");
}

export function setBackupRunning(running: boolean): void {
	isRunning = running;
}

export function isBackupRunning(): boolean {
	return isRunning;
}

export function resolveSelectedDomains(
	preferences: CloudBackupDomainPreferences,
): Set<CloudBackupDomain> {
	if (preferences.everything) {
		return new Set(DOMAINS);
	}
	const selected = new Set<CloudBackupDomain>();
	for (const domain of DOMAINS) {
		if (preferences[domain]) {
			selected.add(domain);
		}
	}

	// Domain dependencies required for valid cloud FKs.
	if (
		selected.has("rules") ||
		selected.has("budgets") ||
		selected.has("transactions")
	) {
		selected.add("categories");
	}
	if (selected.has("rules") || selected.has("transactions")) {
		selected.add("hashtags");
	}

	return selected;
}

export function buildStatus(
	localCounts: Record<CloudBackupDomain, number>,
): CloudBackupStatus {
	const identity = getCloudAuthIdentity();
	const state = readBackupState();
	const selected = resolveSelectedDomains(state.preferences);

	const domains: CloudBackupDomainStatus[] = DOMAINS.map((domain) => {
		const sync = state.domainSync[domain];
		const localCount = localCounts[domain] ?? 0;
		if (!selected.has(domain)) {
			return {
				domain,
				state: "not_selected",
				localCount,
				lastSyncedAt: sync?.lastSyncedAt ?? null,
				lastError: null,
			};
		}
		if (sync?.lastError) {
			return {
				domain,
				state: "failed",
				localCount,
				lastSyncedAt: sync.lastSyncedAt ?? null,
				lastError: sync.lastError,
			};
		}
		if (!sync?.lastSyncedAt) {
			return {
				domain,
				state: "never_synced",
				localCount,
				lastSyncedAt: null,
				lastError: null,
			};
		}
		if (
			typeof sync.lastLocalCount === "number" &&
			sync.lastLocalCount !== localCount
		) {
			return {
				domain,
				state: "needs_sync",
				localCount,
				lastSyncedAt: sync.lastSyncedAt,
				lastError: null,
			};
		}
		return {
			domain,
			state: "up_to_date",
			localCount,
			lastSyncedAt: sync.lastSyncedAt,
			lastError: null,
		};
	});

	return {
		signedIn: identity.signedIn,
		userEmail: identity.email,
		userName: identity.name,
		backupsEnabled: state.backupsEnabled,
		preferences: state.preferences,
		lastSuccessfulSyncAt: state.lastSuccessfulSyncAt,
		lastAttemptAt: state.lastAttemptAt,
		lastError: state.lastError,
		isRunning,
		domains,
	};
}
