import { Button } from "@moat/ui";
import type React from "react";
import { useDesktopUpdateStatus } from "./use-desktop-update-status";

export function DesktopUpdateWidget(): React.ReactElement | null {
	const { status, dismissed, isInstalling, installError, dismiss, install } =
		useDesktopUpdateStatus();

	if (!status || status.state !== "ready" || dismissed) {
		return null;
	}

	return (
		<div className="fixed bottom-4 left-4 z-50 w-80 rounded-lg border bg-background p-4 shadow-sm">
			<div className="space-y-1">
				<p className="font-medium text-sm">Update ready</p>
				<p className="text-muted-foreground text-sm">
					A new version is ready to install.
				</p>
				{installError ? (
					<p className="text-destructive text-sm">{installError}</p>
				) : null}
			</div>
			<div className="mt-4 flex items-center justify-between gap-2">
				<Button
					disabled={isInstalling}
					onClick={dismiss}
					size="sm"
					type="button"
					variant="ghost"
				>
					Later
				</Button>
				<Button
					disabled={isInstalling}
					onClick={() => {
						void install();
					}}
					size="sm"
					type="button"
				>
					{isInstalling ? "Updating..." : "Update"}
				</Button>
			</div>
		</div>
	);
}
