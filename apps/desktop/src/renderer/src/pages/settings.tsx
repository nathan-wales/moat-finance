import type { LocalDbCounts, LocalDbStatus } from "@moat/contracts";
import {
	Badge,
	Button,
	Card,
	CardContent,
	CardHeader,
	CardTitle,
	Separator,
} from "@moat/ui";
import type React from "react";
import { useCallback, useEffect, useState } from "react";
import { captureWithCurrentIdentity } from "../lib/analytics";
import { SUPPORT_EMAIL } from "../lib/contact-emails";
// Window augmentation is centralized in lib/ipc-api-client.ts.
import "../lib/ipc-api-client";
import { AccountProfileSettingsCard } from "./settings/account-profile-settings-card";
import { AppearanceSettingsCard } from "./settings/appearance-settings-card";
import { BusinessSettingsCard } from "./settings/business-settings-card";
import { CloudBackupSettingsCard } from "./settings/cloud-backup-settings-card";
import { DangerModeSettingsCard } from "./settings/danger-mode-settings-card";
import { LocalVaultSettingsCard } from "./settings/local-vault-settings-card";
import { RecoveryEmailSettingsCard } from "./settings/recovery-email-settings-card";
import { SettingsSectionNav } from "./settings/settings-section-nav";

type LoadState<T> =
	| { status: "idle" }
	| { status: "loading" }
	| { status: "ok"; data: T }
	| { status: "error"; message: string };

export default function SettingsPage(): React.ReactElement {
	const [dbStatus, setDbStatus] = useState<LoadState<LocalDbStatus>>({
		status: "idle",
	});
	const [dbCounts, setDbCounts] = useState<LoadState<LocalDbCounts>>({
		status: "idle",
	});
	const [webDemoBusy, setWebDemoBusy] = useState(false);
	const [webDemoMessage, setWebDemoMessage] = useState<string | null>(null);

	const refreshLocalDb = useCallback(() => {
		setDbStatus({ status: "loading" });
		setDbCounts({ status: "loading" });

		window.moatDesktop.localDb
			.getStatus()
			.then((data: LocalDbStatus) => setDbStatus({ status: "ok", data }))
			.catch((err: unknown) =>
				setDbStatus({
					status: "error",
					message: String(err),
				}),
			);

		window.moatDesktop.localDb
			.getCounts()
			.then((data: LocalDbCounts) => setDbCounts({ status: "ok", data }))
			.catch((err: unknown) =>
				setDbCounts({
					status: "error",
					message: String(err),
				}),
			);
	}, []);

	useEffect(() => {
		refreshLocalDb();
	}, [refreshLocalDb]);

	const handleOpenWebDemo = useCallback(async () => {
		setWebDemoBusy(true);
		setWebDemoMessage(null);
		try {
			await window.moatDesktop.localDb.openWebDemo();
			captureWithCurrentIdentity("desktop_web_demo_opened", {
				source: "settings",
			});
		} catch (err) {
			setWebDemoMessage(err instanceof Error ? err.message : String(err));
		} finally {
			setWebDemoBusy(false);
		}
	}, []);

	return (
		<div className="mx-auto flex min-h-full w-full min-w-0 max-w-6xl flex-col gap-6 space-y-6 overflow-x-hidden pb-8">
			<div className="min-w-0">
				<h1 className="font-bold text-2xl tracking-tight">Settings</h1>
				<p className="mt-1 text-muted-foreground text-sm">
					Manage your settings, or email{" "}
					<a
						className="text-primary underline underline-offset-4"
						href={`mailto:${SUPPORT_EMAIL}`}
					>
						{SUPPORT_EMAIL}
					</a>{" "}
					if you need help.
				</p>
			</div>

			<div className="flex min-w-0 flex-col gap-8 pb-24 lg:flex-row lg:items-start lg:gap-16">
				<div className="flex min-w-0 flex-1 flex-col gap-6">
					<AccountProfileSettingsCard />

					<BusinessSettingsCard />

					<AppearanceSettingsCard />

					<RecoveryEmailSettingsCard />

					<LocalVaultSettingsCard />

					<Card className="scroll-mt-20" id="settings-local-database">
						<CardHeader>
							<CardTitle className="text-base">Local Database</CardTitle>
						</CardHeader>
						<CardContent className="flex flex-col gap-3">
							{dbStatus.status === "loading" && (
								<p className="text-muted-foreground text-sm">
									Checking database…
								</p>
							)}
							{dbStatus.status === "error" && (
								<p className="text-destructive text-sm">
									Error: {dbStatus.message}
								</p>
							)}
							{dbStatus.status === "ok" && (
								<dl className="grid grid-cols-[140px_1fr] gap-x-4 gap-y-2 text-sm">
									<dt className="font-medium text-muted-foreground">Status</dt>
									<dd>
										<Badge
											variant={dbStatus.data.ok ? "secondary" : "destructive"}
										>
											{dbStatus.data.ok ? "Ready" : "Not ready"}
										</Badge>
									</dd>
									<dt className="font-medium text-muted-foreground">
										Encryption
									</dt>
									<dd>
										{dbStatus.data.encrypted
											? "Encrypted at rest"
											: "Not ready"}
									</dd>
									<dt className="font-medium text-muted-foreground">
										Local user
									</dt>
									<dd>{dbStatus.data.hasLocalUser ? "Created" : "Missing"}</dd>
								</dl>
							)}

							<Separator />

							{dbCounts.status === "loading" && (
								<p className="text-muted-foreground text-sm">Loading counts…</p>
							)}
							{dbCounts.status === "error" && (
								<p className="text-destructive text-sm">
									Error: {dbCounts.message}
								</p>
							)}
							{dbCounts.status === "ok" && (
								<dl className="grid grid-cols-[140px_1fr] gap-x-4 gap-y-2 text-sm">
									<dt className="font-medium text-muted-foreground">Users</dt>
									<dd>{dbCounts.data.users}</dd>
									<dt className="font-medium text-muted-foreground">
										Accounts
									</dt>
									<dd>{dbCounts.data.accounts}</dd>
									<dt className="font-medium text-muted-foreground">
										Transactions
									</dt>
									<dd>{dbCounts.data.transactions}</dd>
								</dl>
							)}

							<Separator />

							<div className="flex flex-col gap-2">
								<p className="font-medium text-sm">Sample data</p>
								<p className="text-muted-foreground text-sm">
									Explore a full demo workspace in the web app. Sample data
									stays on the web so it never mixes with your local vault.
								</p>
								<div className="flex flex-wrap gap-2">
									<Button
										disabled={webDemoBusy}
										onClick={() => void handleOpenWebDemo()}
										size="sm"
										variant="outline"
									>
										{webDemoBusy ? "Opening…" : "Open web demo"}
									</Button>
								</div>
								{webDemoMessage ? (
									<p className="text-destructive text-xs">{webDemoMessage}</p>
								) : null}
							</div>
						</CardContent>
					</Card>

					<CloudBackupSettingsCard />

					<DangerModeSettingsCard />
				</div>
				<SettingsSectionNav />
			</div>
		</div>
	);
}
