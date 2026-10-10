"use client";

import { AI_CONNECTION_QUERY_KEY } from "@moat/features/mcp";
import { SETUP_GUIDE_QUERY_KEY } from "@moat/features/setup-guide";
import {
	detectPrivacyLevel,
	domainSummaryLabels,
	privacyLevelLabel,
} from "@moat/mcp-contracts";
import { ConfirmDestructiveDialog } from "@moat/ui";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Activity, LinkIcon, Loader2, Plug, Plus, Trash2 } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { toast } from "sonner";
import { Badge } from "~/components/ui/badge";
import { Button } from "~/components/ui/button";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "~/components/ui/card";
import { captureWithCurrentIdentity } from "~/lib/analytics";
import {
	listMcpOAuthConnections,
	type McpOAuthClientConnection,
	revokeMcpOAuthConnection,
} from "~/lib/api/mcp";
import { cn } from "~/lib/utils";
import {
	assistantProviderForProfile,
	oauthConnectHighlightHref,
	oauthConnectionStatus,
	oauthLogsHref,
	onMcpLogsLinkClick,
} from "./oauth-connection-status";

function formatDate(value: string | null | undefined) {
	if (!value) return "Never";
	return new Intl.DateTimeFormat(undefined, {
		month: "short",
		day: "numeric",
		year: "numeric",
	}).format(new Date(value));
}

function connectionDisplayName(connection: McpOAuthClientConnection) {
	const provider = assistantProviderForProfile(connection.clientProfile);
	if (provider) return provider;
	return connection.name || connection.clientProfile;
}

function OAuthConnectionRow({
	connection,
}: {
	connection: McpOAuthClientConnection;
}) {
	const queryClient = useQueryClient();
	const [confirmOpen, setConfirmOpen] = useState(false);
	const revoke = useMutation({
		mutationFn: () =>
			revokeMcpOAuthConnection({ oauthClientIds: connection.oauthClientIds }),
		onSuccess: () => {
			captureWithCurrentIdentity("mcp_oauth_connection_revoked", {
				surface: "web",
				client_profile: connection.clientProfile,
			});
			toast.success("Connection disconnected");
			setConfirmOpen(false);
			void queryClient.invalidateQueries({ queryKey: ["mcp", "oauth"] });
			void queryClient.invalidateQueries({
				queryKey: AI_CONNECTION_QUERY_KEY,
			});
			void queryClient.invalidateQueries({
				queryKey: SETUP_GUIDE_QUERY_KEY,
			});
		},
		onError: () => toast.error("Failed to disconnect"),
	});
	const status = oauthConnectionStatus(connection);
	const isActive = status === "Active";
	const statusClassName = isActive
		? "bg-green-500/10 text-green-700 dark:text-green-400"
		: "bg-muted text-muted-foreground";
	const accessLevel = detectPrivacyLevel(connection.scopes);
	const accessSummaryLabels = domainSummaryLabels(connection.scopes);
	const accessSummary =
		accessSummaryLabels.length > 0 ? accessSummaryLabels.join(", ") : null;
	const provider = assistantProviderForProfile(connection.clientProfile);
	const displayName = connectionDisplayName(connection);
	const logsHref = oauthLogsHref(provider);

	return (
		<>
			<div className="flex flex-col gap-3 border-t py-4 first:border-t-0">
				<div className="min-w-0 space-y-1">
					<div className="flex flex-wrap items-center gap-2">
						<p className="font-medium text-sm">
							{connection.name || connection.clientProfile}
						</p>
						<Badge className="text-xs" variant="secondary">
							{connection.clientProfile}
						</Badge>
						<Badge className="text-xs" variant="outline">
							{privacyLevelLabel(accessLevel)}
						</Badge>
						<span
							className={cn(
								"rounded-full px-2 py-0.5 text-xs",
								statusClassName,
							)}
						>
							{status}
						</span>
					</div>
					<p className="font-mono text-muted-foreground text-xs">
						{connection.tokenPrefix}…
					</p>
					{accessSummary ? (
						<p className="text-muted-foreground text-xs">{accessSummary}</p>
					) : null}
					<p className="text-muted-foreground text-xs">
						Connected {formatDate(connection.connectedAt)} · Last used{" "}
						{formatDate(connection.lastUsedAt)} · Refresh expires{" "}
						{formatDate(connection.refreshTokenExpiresAt)}
					</p>
				</div>
				<div className="flex shrink-0 flex-wrap items-center gap-2">
					{isActive && (
						<Button asChild size="sm" variant="outline">
							<Link href={logsHref} onClick={() => onMcpLogsLinkClick()}>
								<Activity className="h-4 w-4" />
								View logs
							</Link>
						</Button>
					)}
					<Button
						disabled={!isActive || revoke.isPending}
						onClick={() => setConfirmOpen(true)}
						size="sm"
						variant="outline"
					>
						<Trash2 className="h-4 w-4" />
						Disconnect
					</Button>
				</div>
			</div>

			<ConfirmDestructiveDialog
				confirmLabel="Disconnect"
				description={`Are you sure you want to disconnect ${displayName}? It will lose access to your Moat data until you reconnect.`}
				isPending={revoke.isPending}
				onConfirm={() => revoke.mutate()}
				onOpenChange={setConfirmOpen}
				open={confirmOpen}
				pendingLabel="Disconnecting…"
				title={`Disconnect ${displayName}?`}
			/>
		</>
	);
}

export function OAuthConnectionsCard() {
	const oauth = useQuery({
		queryKey: ["mcp", "oauth"],
		queryFn: listMcpOAuthConnections,
	});

	return (
		<Card>
			<CardHeader>
				<div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
					<div className="space-y-1">
						<CardTitle className="flex items-center gap-2 text-base">
							<LinkIcon className="h-4 w-4" />
							OAuth connections
						</CardTitle>
						<CardDescription>
							Hosted MCP clients connected via OAuth.
						</CardDescription>
					</div>
					<Button asChild size="sm">
						<Link href={oauthConnectHighlightHref()}>
							<Plus className="h-4 w-4" />
							New
						</Link>
					</Button>
				</div>
			</CardHeader>
			<CardContent className="px-0 pb-0">
				{oauth.isLoading && (
					<div className="flex items-center justify-center py-8">
						<Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
					</div>
				)}
				{oauth.isError && (
					<div className="px-6 py-6 text-center text-muted-foreground text-sm">
						Failed to load connections.
					</div>
				)}
				{oauth.data && oauth.data.connections.length === 0 && (
					<div className="px-6 py-10 text-center">
						<Plug className="mx-auto mb-2 h-8 w-8 text-muted-foreground/40" />
						<p className="text-muted-foreground text-sm">
							No OAuth clients connected.
						</p>
					</div>
				)}
				{oauth.data && oauth.data.connections.length > 0 && (
					<div className="px-6 pb-4">
						{oauth.data.connections.map((connection) => (
							<OAuthConnectionRow
								connection={connection}
								key={connection.oauthClientIds.join(":")}
							/>
						))}
					</div>
				)}
			</CardContent>
		</Card>
	);
}
