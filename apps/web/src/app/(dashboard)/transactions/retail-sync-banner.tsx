import type { RetailTransactionDetection } from "@moat/client-ts";
import { RefreshCw, ShoppingBag } from "lucide-react";
import { Button } from "~/components/ui/button";
import { cn } from "~/lib/utils";

function getRetailerBannerClasses(retailer: string) {
	switch (retailer) {
		case "walmart":
			return "bg-blue-50 border-blue-500";
		case "target":
			return "bg-red-50 border-red-500";
		case "multiple":
			return "bg-green-50 border-green-500";
		case "amazon":
			return "bg-yellow-50 border-yellow-500";
		default:
			return "bg-yellow-50 border-yellow-500";
	}
}

function getRetailerTransactionLabel(retailer: string) {
	switch (retailer) {
		case "amazon":
			return "Amazon";
		case "walmart":
			return "Walmart";
		case "target":
			return "Target";
		default:
			return "Retail";
	}
}

export function RetailSyncBanner({
	detection,
	isRunning,
	onRunSync,
}: {
	detection: RetailTransactionDetection | undefined;
	isRunning: boolean;
	onRunSync: () => void;
}) {
	if (!detection?.hasActionableSync) return null;

	const retailerTransactionLabel = getRetailerTransactionLabel(
		detection.retailer,
	);

	return (
		<section
			className={cn(
				"flex w-full items-center justify-between gap-4 rounded-lg border px-4 py-3 text-card-foreground shadow-sm",
				getRetailerBannerClasses(detection.retailer),
			)}
		>
			<div className="flex min-w-0 items-center gap-3">
				<div className="flex size-9 shrink-0 items-center justify-center rounded-md bg-muted text-muted-foreground">
					<ShoppingBag className="size-4" />
				</div>
				<div className="min-w-0">
					<p className="font-medium text-sm">Retail transactions detected</p>
					<p className="truncate text-muted-foreground text-xs">
						{detection.unlinkedDetectedCount} {retailerTransactionLabel}
						transaction{detection.unlinkedDetectedCount === 1 ? "" : "s"} may be
						missing item details
					</p>
				</div>
			</div>
			<Button disabled={isRunning} onClick={onRunSync} size="sm" type="button">
				{isRunning ? <RefreshCw className="size-4 animate-spin" /> : null}
				Run sync
			</Button>
		</section>
	);
}
