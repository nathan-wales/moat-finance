import { DropdownMenuItem } from "@moat/ui";
import { RefreshCw } from "lucide-react";
import { useSyncInstitution } from "./use-sync-institution";

export function SyncInstitutionMenuItem({
	plaidItemId,
	institutionName,
	onSyncSuccess,
	onSyncError,
}: {
	plaidItemId: string;
	institutionName: string;
	onSyncSuccess?: (message: string) => void;
	onSyncError?: (error: Error) => void;
}) {
	const sync = useSyncInstitution({
		plaidItemId,
		onSyncSuccess,
		onSyncError,
	});
	const label = sync.isPending ? "Syncing…" : "Sync latest data";
	const iconClassName = sync.isPending
		? "mr-2 h-3.5 w-3.5 animate-spin"
		: "mr-2 h-3.5 w-3.5";

	return (
		<DropdownMenuItem
			disabled={sync.isPending}
			onSelect={(event) => {
				event.preventDefault();
				sync.sync();
			}}
		>
			<RefreshCw className={iconClassName} />
			<span>{label}</span>
			<span className="sr-only"> for {institutionName}</span>
		</DropdownMenuItem>
	);
}
