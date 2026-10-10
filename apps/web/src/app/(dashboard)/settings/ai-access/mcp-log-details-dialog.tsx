"use client";

import { format } from "date-fns";
import {
	Dialog,
	DialogContent,
	DialogHeader,
	DialogTitle,
} from "~/components/ui/dialog";
import type { McpLogEntry } from "~/lib/api/mcp";
import { cn } from "~/lib/utils";

function statusVariant(status: string) {
	if (status === "success")
		return "bg-green-500/10 text-green-700 dark:text-green-400";
	if (status === "denied")
		return "bg-yellow-500/10 text-yellow-700 dark:text-yellow-400";
	return "bg-destructive/10 text-destructive";
}

function authTypeLabel(log: McpLogEntry) {
	if (log.personalAccessTokenId) return "PAT";
	if (log.oauthAccessTokenId) return "OAuth";
	return "Unknown";
}

export function McpLogDetailsDialog({
	log,
	open,
	onOpenChange,
}: {
	log: McpLogEntry | null;
	open: boolean;
	onOpenChange: (open: boolean) => void;
}) {
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
							className={cn(
								"inline-flex w-fit rounded-full px-2 py-0.5 font-medium text-xs",
								statusVariant(log.status),
							)}
						>
							{log.status}
						</span>

						<span className="text-muted-foreground">Time</span>
						<span>{format(new Date(log.createdAt), "PPpp")}</span>

						<span className="text-muted-foreground">Client</span>
						<span>{log.clientName ?? "—"}</span>

						<span className="text-muted-foreground">Profile</span>
						<span>{log.clientProfile ?? "—"}</span>

						<span className="text-muted-foreground">Auth type</span>
						<span>{authTypeLabel(log)}</span>

						<span className="text-muted-foreground">Tool / action</span>
						<span className="font-mono text-xs">{log.toolName}</span>

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

						{log.rateLimited && (
							<>
								<span className="text-muted-foreground">Rate limited</span>
								<span className="text-yellow-700 dark:text-yellow-400">
									Yes
								</span>
							</>
						)}
					</div>

					{log.requiredScopes.length > 0 && (
						<div className="space-y-1">
							<p className="font-medium text-muted-foreground text-xs uppercase tracking-wide">
								Required scopes
							</p>
							<p className="font-mono text-xs leading-relaxed">
								{log.requiredScopes.join(" ")}
							</p>
						</div>
					)}

					{log.grantedScopes.length > 0 && (
						<div className="space-y-1">
							<p className="font-medium text-muted-foreground text-xs uppercase tracking-wide">
								Granted scopes
							</p>
							<p className="font-mono text-xs leading-relaxed">
								{log.grantedScopes.join(" ")}
							</p>
						</div>
					)}
				</div>
			</DialogContent>
		</Dialog>
	);
}
