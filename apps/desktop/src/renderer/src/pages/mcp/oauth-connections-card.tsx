import {
	Button,
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
	ConfirmDestructiveDialog,
} from "@moat/ui";
import { LinkIcon, Loader2, Trash2 } from "lucide-react";
import type React from "react";
import { useState } from "react";
import type { LocalOAuthConnection } from "./types";
import { formatDate } from "./utils";

type OAuthConnectionsCardProps = {
	connections: LocalOAuthConnection[];
	isLoading: boolean;
	error: string | null;
	revokingClientId: string | null;
	onRevoke: (clientId: string) => void;
};

function ConnectionRow({
	connection,
	revokingClientId,
	onRevoke,
}: {
	connection: LocalOAuthConnection;
	revokingClientId: string | null;
	onRevoke: (clientId: string) => void;
}) {
	const [confirmOpen, setConfirmOpen] = useState(false);
	const isRevoking = revokingClientId === connection.clientId;
	const revokeLabel = isRevoking ? "Revoking..." : "Revoke";

	return (
		<>
			<div className="flex flex-col gap-3 border-t py-4 first:border-t-0 sm:flex-row sm:items-center sm:justify-between">
				<div className="min-w-0 space-y-1">
					<div className="flex flex-wrap items-center gap-2">
						<p className="font-medium text-sm">{connection.clientName}</p>
						<span className="rounded-full bg-green-500/10 px-2 py-0.5 text-green-700 text-xs">
							Active
						</span>
					</div>
					<p className="text-muted-foreground text-xs">
						Connected {formatDate(connection.createdAt)} · Last used{" "}
						{formatDate(connection.lastUsedAt)}
					</p>
				</div>
				<Button
					disabled={isRevoking}
					onClick={() => setConfirmOpen(true)}
					size="sm"
					variant="outline"
				>
					<Trash2 className="h-4 w-4" />
					{revokeLabel}
				</Button>
			</div>

			<ConfirmDestructiveDialog
				confirmLabel="Revoke"
				description={`Are you sure you want to revoke ${connection.clientName}? It will lose access until you reconnect.`}
				isPending={isRevoking}
				onConfirm={() => {
					setConfirmOpen(false);
					onRevoke(connection.clientId);
				}}
				onOpenChange={setConfirmOpen}
				open={confirmOpen}
				pendingLabel="Revoking…"
				title={`Revoke ${connection.clientName}?`}
			/>
		</>
	);
}

export function OAuthConnectionsCard({
	connections,
	isLoading,
	error,
	revokingClientId,
	onRevoke,
}: OAuthConnectionsCardProps): React.ReactElement {
	return (
		<Card>
			<CardHeader>
				<CardTitle className="flex items-center gap-2 text-base">
					<LinkIcon className="h-4 w-4" />
					OAuth connections
				</CardTitle>
				<CardDescription>
					Assistants that signed in through the local gateway. Revoke to cut off
					access immediately.
				</CardDescription>
			</CardHeader>
			<CardContent className="px-0 pb-0">
				{isLoading && (
					<div className="flex items-center justify-center py-8">
						<Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
					</div>
				)}
				{error && (
					<div className="px-6 py-6 text-center text-destructive text-sm">
						{error}
					</div>
				)}
				{!isLoading && !error && connections.length === 0 && (
					<div className="px-6 py-10 text-center">
						<LinkIcon className="mx-auto mb-2 h-8 w-8 text-muted-foreground/40" />
						<p className="text-muted-foreground text-sm">
							No OAuth connections yet. Connect an assistant from the Connect
							tab, then approve the Moat dialog.
						</p>
					</div>
				)}
				{connections.length > 0 && (
					<div className="px-6 pb-4">
						{connections.map((connection) => (
							<ConnectionRow
								connection={connection}
								key={connection.clientId}
								onRevoke={onRevoke}
								revokingClientId={revokingClientId}
							/>
						))}
					</div>
				)}
			</CardContent>
		</Card>
	);
}
