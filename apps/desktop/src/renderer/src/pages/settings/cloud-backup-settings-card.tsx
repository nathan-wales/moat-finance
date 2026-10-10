import type {
	CloudBackupDomain,
	CloudBackupDomainStatus,
	CloudBackupProgress,
	CloudBackupStatus,
} from "@moat/contracts";
import {
	Badge,
	Button,
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
	Label,
	Separator,
	Switch,
} from "@moat/ui";
import type React from "react";
import { useCallback, useEffect, useState } from "react";
import {
	useCloudAccountIdentity,
	useRefreshCloudAccount,
} from "../../lib/hooks/use-cloud-account";
import { CloudBackupAccountDialog } from "./cloud-backup-account-dialog";

const DOMAIN_LABELS: Record<CloudBackupDomain, string> = {
	rules: "Rules",
	categories: "Categories (custom)",
	budgets: "Budgets",
	forecasts: "Forecasts & profile",
	hashtags: "Hashtags",
	transactions: "Manual accounts & transactions",
};

const DOMAIN_KEYS: CloudBackupDomain[] = [
	"rules",
	"categories",
	"budgets",
	"forecasts",
	"hashtags",
	"transactions",
];

function statusLabel(state: CloudBackupDomainStatus["state"]): string {
	switch (state) {
		case "not_selected":
			return "Not selected";
		case "never_synced":
			return "Never synced";
		case "up_to_date":
			return "Up to date";
		case "needs_sync":
			return "Needs sync";
		case "failed":
			return "Failed";
		default:
			return state;
	}
}

function statusVariant(
	state: CloudBackupDomainStatus["state"],
): "default" | "secondary" | "destructive" | "outline" {
	if (state === "failed") return "destructive";
	if (state === "up_to_date") return "default";
	if (state === "needs_sync") return "secondary";
	return "outline";
}

function formatTimestamp(value: string | null): string {
	if (!value) return "Never";
	const date = new Date(value);
	if (Number.isNaN(date.getTime())) return "Never";
	return date.toLocaleString();
}

export function CloudBackupSettingsCard(): React.ReactElement {
	const [status, setStatus] = useState<CloudBackupStatus | null>(null);
	const [loadError, setLoadError] = useState<string | null>(null);
	const [accountOpen, setAccountOpen] = useState(false);
	const [busy, setBusy] = useState(false);
	const [progress, setProgress] = useState<CloudBackupProgress | null>(null);
	const [actionError, setActionError] = useState<string | null>(null);
	const { data: identity } = useCloudAccountIdentity();
	const refreshCloudAccount = useRefreshCloudAccount();

	const refresh = useCallback(async () => {
		try {
			const next = await window.moatDesktop.cloudBackup.getStatus();
			setStatus(next);
			setLoadError(null);
		} catch (error) {
			setLoadError(error instanceof Error ? error.message : String(error));
		}
	}, []);

	useEffect(() => {
		void refresh();
	}, [refresh]);

	useEffect(() => {
		if (!identity || !status) return;
		if (
			status.signedIn === identity.signedIn &&
			status.userEmail === identity.email
		) {
			return;
		}
		void refresh();
	}, [identity, refresh, status]);

	useEffect(() => {
		return window.moatDesktop.cloudBackup.onProgress((next) => {
			setProgress(next);
		});
	}, []);

	async function updatePreference(patch: {
		backupsEnabled?: boolean;
		everything?: boolean;
		rules?: boolean;
		categories?: boolean;
		budgets?: boolean;
		forecasts?: boolean;
		hashtags?: boolean;
		transactions?: boolean;
	}) {
		if (!status) return;
		setBusy(true);
		setActionError(null);
		try {
			const { backupsEnabled, ...preferences } = patch;
			const next = await window.moatDesktop.cloudBackup.setPreferences({
				backupsEnabled,
				preferences:
					Object.keys(preferences).length > 0 ? preferences : undefined,
			});
			setStatus(next);
		} catch (error) {
			setActionError(error instanceof Error ? error.message : String(error));
		} finally {
			setBusy(false);
		}
	}

	async function runBackup(options?: { skipAccountGate?: boolean }) {
		const latest = status ?? (await window.moatDesktop.cloudBackup.getStatus());
		if (!options?.skipAccountGate && !latest.signedIn) {
			setAccountOpen(true);
			return;
		}
		setBusy(true);
		setActionError(null);
		setProgress({ phase: "start", message: "Starting backup…" });
		try {
			const result = await window.moatDesktop.cloudBackup.runBackup();
			setStatus(result.status);
			if (!result.ok) {
				setActionError(result.error ?? "Backup failed");
			}
		} catch (error) {
			setActionError(error instanceof Error ? error.message : String(error));
			await refresh();
		} finally {
			setBusy(false);
			setProgress(null);
		}
	}

	async function handleAuthenticated() {
		await refreshCloudAccount();
		await runBackup({ skipAccountGate: true });
	}

	async function handleSignOut() {
		setBusy(true);
		setActionError(null);
		try {
			const next = await window.moatDesktop.cloudBackup.signOut();
			setStatus(next);
			await refreshCloudAccount();
		} catch (error) {
			setActionError(error instanceof Error ? error.message : String(error));
		} finally {
			setBusy(false);
		}
	}

	const preferences = status?.preferences;
	const rulesOrBudgetsOrTx =
		Boolean(preferences?.everything) ||
		Boolean(preferences?.rules) ||
		Boolean(preferences?.budgets) ||
		Boolean(preferences?.transactions);
	const rulesOrTx =
		Boolean(preferences?.everything) ||
		Boolean(preferences?.rules) ||
		Boolean(preferences?.transactions);
	const forcedDomains = new Set<CloudBackupDomain>();
	if (rulesOrBudgetsOrTx) forcedDomains.add("categories");
	if (rulesOrTx) forcedDomains.add("hashtags");

	function isDomainChecked(domain: CloudBackupDomain): boolean {
		if (preferences?.everything) return true;
		if (forcedDomains.has(domain)) return true;
		return Boolean(preferences?.[domain]);
	}

	function isDomainDisabled(domain: CloudBackupDomain): boolean {
		return (
			busy || Boolean(preferences?.everything) || forcedDomains.has(domain)
		);
	}

	return (
		<>
			<Card className="scroll-mt-20" id="settings-cloud-backup">
				<CardHeader>
					<CardTitle className="text-base">Cloud Backup</CardTitle>
					<CardDescription>
						Optionally save selected local data to your Moat cloud account. Your
						desktop app stays local-first. This is not the same as vault
						recovery email.
					</CardDescription>
				</CardHeader>
				<CardContent className="space-y-5">
					{loadError ? (
						<p className="text-destructive text-sm">{loadError}</p>
					) : null}

					{status ? (
						<div className="space-y-4">
							<div className="flex flex-wrap items-center justify-between gap-3">
								<div className="space-y-1">
									<p className="font-medium text-sm">
										{status.signedIn
											? `Signed in as ${status.userEmail}`
											: "Not signed in"}
									</p>
									<p className="text-muted-foreground text-xs">
										Last successful sync:{" "}
										{formatTimestamp(status.lastSuccessfulSyncAt)}
									</p>
								</div>
								<div className="flex gap-2">
									{status.signedIn ? (
										<Button
											disabled={busy}
											onClick={() => void handleSignOut()}
											size="sm"
											type="button"
											variant="outline"
										>
											Sign out
										</Button>
									) : (
										<Button
											disabled={busy}
											onClick={() => setAccountOpen(true)}
											size="sm"
											type="button"
											variant="outline"
										>
											Create account
										</Button>
									)}
								</div>
							</div>

							<div className="rounded-lg border">
								<div className="flex items-center gap-3 px-3 py-2.5">
									<Switch
										checked={preferences?.everything ?? false}
										disabled={busy}
										id="cloud-backup-everything"
										onCheckedChange={(checked) =>
											void updatePreference({ everything: checked })
										}
									/>
									<div>
										<Label htmlFor="cloud-backup-everything">
											Backup everything
										</Label>
										<p className="text-muted-foreground text-xs">
											Include all backup domains below
										</p>
									</div>
								</div>

								<Separator />

								{DOMAIN_KEYS.map((domain) => (
									<div
										className="flex items-center gap-3 px-3 py-2.5"
										key={domain}
									>
										<Switch
											checked={isDomainChecked(domain)}
											disabled={isDomainDisabled(domain)}
											id={`cloud-backup-${domain}`}
											onCheckedChange={(checked) =>
												void updatePreference({ [domain]: checked })
											}
										/>
										<div>
											<Label htmlFor={`cloud-backup-${domain}`}>
												{DOMAIN_LABELS[domain]}
											</Label>
											{forcedDomains.has(domain) && !preferences?.everything ? (
												<p className="text-muted-foreground text-xs">
													Required by another selected backup
												</p>
											) : null}
										</div>
									</div>
								))}
							</div>

							<div className="space-y-2">
								<p className="font-medium text-sm">Backup status</p>
								{status.domains.map((domainStatus) => (
									<div
										className="flex items-center justify-between gap-3 text-sm"
										key={domainStatus.domain}
									>
										<span>
											{DOMAIN_LABELS[domainStatus.domain]}
											<span className="text-muted-foreground">
												{" "}
												· {domainStatus.localCount}
											</span>
										</span>
										<Badge variant={statusVariant(domainStatus.state)}>
											{statusLabel(domainStatus.state)}
										</Badge>
									</div>
								))}
							</div>

							{status.backupsEnabled ? (
								<div className="flex items-center justify-between gap-3 rounded-lg border px-3 py-2">
									<div>
										<p className="font-medium text-sm">Backups on</p>
										<p className="text-muted-foreground text-xs">
											Syncs when you open the app if the last backup is older
											than a day.
										</p>
									</div>
									<Button
										disabled={busy}
										onClick={() =>
											void updatePreference({ backupsEnabled: false })
										}
										size="sm"
										type="button"
										variant="outline"
									>
										Turn off
									</Button>
								</div>
							) : null}

							{progress ? (
								<p className="text-muted-foreground text-sm">
									{progress.message}
									{progress.percent != null ? ` (${progress.percent}%)` : ""}
								</p>
							) : null}

							{actionError || status.lastError ? (
								<p className="text-destructive text-sm">
									{actionError ?? status.lastError}
								</p>
							) : null}

							<div className="flex flex-wrap gap-2">
								<Button
									disabled={busy || status.isRunning}
									onClick={() => void runBackup()}
									type="button"
								>
									{status.backupsEnabled ? "Back up now" : "Backup"}
								</Button>
							</div>
						</div>
					) : !loadError ? (
						<p className="text-muted-foreground text-sm">Loading…</p>
					) : null}
				</CardContent>
			</Card>

			<CloudBackupAccountDialog
				onAuthenticated={handleAuthenticated}
				onOpenChange={setAccountOpen}
				open={accountOpen}
			/>
		</>
	);
}
