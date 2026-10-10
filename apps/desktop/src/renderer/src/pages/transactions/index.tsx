import { ImportEmptyStateActions } from "@moat/features/import";
import {
	type FeatureNotifications,
	TransactionsHeaderActions,
	TransactionsPage,
} from "@moat/features/transactions";
import { Button } from "@moat/ui";
import { useMemo, useState } from "react";
import { captureWithCurrentIdentity } from "../../lib/analytics";
import { useAmazonRetailSyncEnabled } from "../../lib/hooks/use-amazon-retail-sync-enabled";

type Notice = {
	id: number;
	message: string;
	actionLabel?: string;
	onAction?: () => void;
};

export default function DesktopTransactionsPage(): React.ReactElement {
	const [notice, setNotice] = useState<Notice | null>(null);
	const amazonRetailSyncEnabled = useAmazonRetailSyncEnabled();

	const notifications = useMemo<FeatureNotifications>(() => {
		let nextId = 0;
		return {
			success(message) {
				setNotice({ id: nextId++, message });
			},
			error(message) {
				setNotice({ id: nextId++, message });
			},
			showAction({ message, actionLabel, onAction }) {
				setNotice({
					id: nextId++,
					message,
					actionLabel,
					onAction,
				});
			},
			dismissAll() {
				setNotice(null);
			},
		};
	}, []);

	const retailSyncAdapter = useMemo(() => {
		if (!amazonRetailSyncEnabled) return undefined;
		return {
			async detect() {
				const detection = await window.moatDesktop.retailSync.detectAmazon();
				return {
					retailer: detection.retailer,
					hasActionableSync: detection.hasActionableSync,
					unlinkedDetectedCount: detection.unlinkedDetectedCount,
					extensionStatus: "unknown",
					candidates: detection.candidates,
				};
			},
			async run() {
				const started =
					await window.moatDesktop.retailSync.startDesktopAmazonSync();
				if (started.status === "extension_id_missing") {
					return {
						status: "extension_id_missing",
						warnings: [
							"Set MOAT_RETAIL_EXTENSION_ID so desktop can open the Chrome extension.",
						],
					};
				}

				const deadline = Date.now() + 3 * 60_000;
				while (Date.now() < deadline) {
					const status = await window.moatDesktop.retailSync.getSyncStatus({
						sessionId: started.sessionId,
					});
					if (status.status === "success") {
						return {
							status: "success",
							ordersFound: status.ordersFound,
						};
					}
					if (status.status === "failed") {
						return {
							status: "failed",
							warnings: status.errorMessage
								? [status.errorMessage]
								: ["Desktop retail sync failed"],
						};
					}
					await new Promise((resolve) => setTimeout(resolve, 1500));
				}

				return {
					status: "timeout",
					warnings: [
						"Timed out waiting for the extension to finish desktop sync.",
					],
				};
			},
		};
	}, [amazonRetailSyncEnabled]);

	return (
		<>
			<TransactionsPage
				emptyStateAction={<ImportEmptyStateActions />}
				headerActions={<TransactionsHeaderActions />}
				notifications={notifications}
				onCapture={(event, props) => captureWithCurrentIdentity(event, props)}
				retailSyncAdapter={retailSyncAdapter}
			/>
			{notice ? (
				<div className="fixed right-6 bottom-6 z-50 flex max-w-sm items-center gap-3 rounded-md border bg-card px-4 py-3 text-card-foreground text-sm shadow-lg">
					<span className="min-w-0 flex-1">{notice.message}</span>
					{notice.actionLabel && notice.onAction ? (
						<Button
							onClick={() => {
								notice.onAction?.();
								setNotice(null);
							}}
							size="sm"
							variant="secondary"
						>
							{notice.actionLabel}
						</Button>
					) : null}
					<Button onClick={() => setNotice(null)} size="sm" variant="ghost">
						Dismiss
					</Button>
				</div>
			) : null}
		</>
	);
}
