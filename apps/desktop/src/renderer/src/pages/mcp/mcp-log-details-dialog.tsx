import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@moat/ui";
import type React from "react";
import type { AccessToken, LocalAuditEntry } from "./types";
import { clientNameForLog, formatDateTime } from "./utils";

type McpLogDetailsDialogProps = {
	log: LocalAuditEntry | null;
	tokens: AccessToken[];
	open: boolean;
	onOpenChange: (open: boolean) => void;
};

function statusClassName(status: LocalAuditEntry["status"]): string {
	if (status === "success") return "bg-green-500/10 text-green-700";
	if (status === "denied") return "bg-yellow-500/10 text-yellow-700";
	return "bg-destructive/10 text-destructive";
}

export function McpLogDetailsDialog({
	log,
	tokens,
	open,
	onOpenChange,
}: McpLogDetailsDialogProps): React.ReactElement | null {
	if (!log) return null;

	return (
		<Dialog onOpenChange={onOpenChange} open={open}>
			<DialogContent className="sm:max-w-lg">
				<DialogHeader>
					<DialogTitle>Log details</DialogTitle>
				</DialogHeader>
				<div className="space-y-4 text-sm">
					<div className="grid grid-cols-2 gap-x-4 gap-y-2">
						<span className="text-muted-foreground">Status</span>
						<span
							className={`inline-flex w-fit rounded-full px-2 py-0.5 font-medium text-xs ${statusClassName(log.status)}`}
						>
							{log.status}
						</span>

						<span className="text-muted-foreground">Time</span>
						<span>{formatDateTime(log.ts)}</span>

						<span className="text-muted-foreground">Token</span>
						<span>{clientNameForLog(log, tokens)}</span>

						<span className="text-muted-foreground">Tool</span>
						<span className="font-mono text-xs">{log.tool}</span>

						<span className="text-muted-foreground">Duration</span>
						<span>{log.durationMs} ms</span>

						{log.errorCode && (
							<>
								<span className="text-muted-foreground">Error code</span>
								<span className="font-mono text-destructive text-xs">
									{log.errorCode}
								</span>
							</>
						)}
					</div>

					{log.scopes.length > 0 && (
						<div className="space-y-1">
							<p className="font-medium text-muted-foreground text-xs uppercase tracking-wide">
								Granted scopes
							</p>
							<p className="font-mono text-xs leading-relaxed">
								{log.scopes.join(" ")}
							</p>
						</div>
					)}
				</div>
			</DialogContent>
		</Dialog>
	);
}
