"use client";

import { ImportEmptyStateActions } from "@moat/features/import";
import {
	TransactionsHeaderActions,
	TransactionsPage,
} from "@moat/features/transactions";
import { Suspense } from "react";
import { useDemoMode } from "~/context/demo-mode-context";
import { captureWithCurrentIdentity } from "~/lib/analytics";
import { useAmazonRetailSyncEnabled } from "~/lib/feature-flags";
import { webNotifications } from "~/lib/transactions/web-notifications";
import { webRetailSyncAdapter } from "~/lib/transactions/web-retail-sync-adapter";

function TransactionsPageRoute() {
	const { isDemoMode } = useDemoMode();
	const amazonRetailSyncEnabled = useAmazonRetailSyncEnabled();

	return (
		<TransactionsPage
			emptyStateAction={isDemoMode ? undefined : <ImportEmptyStateActions />}
			headerActions={<TransactionsHeaderActions showImport={!isDemoMode} />}
			notifications={webNotifications}
			onCapture={(event, props) => captureWithCurrentIdentity(event, props)}
			retailSyncAdapter={
				amazonRetailSyncEnabled ? webRetailSyncAdapter : undefined
			}
		/>
	);
}

export default function Page() {
	return (
		<Suspense>
			<TransactionsPageRoute />
		</Suspense>
	);
}
