import type { RemoteMcpState, RemoteMcpStatus } from "@moat/contracts";
import {
	Button,
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
	Switch,
} from "@moat/ui";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";

export const REMOTE_MCP_STATE_QUERY_KEY = ["remote-mcp-state"] as const;

const STATUS_LABELS: Record<RemoteMcpStatus, string> = {
	off: "Off",
	connecting: "Connecting",
	connected: "Connected",
	offline: "Offline",
	authentication_error: "Authentication error",
};

function SignInNote({ signedIn }: { signedIn: boolean }) {
	if (signedIn) return null;
	return (
		<p className="text-muted-foreground text-sm">
			Sign in to a Moat account before this computer can accept remote MCP
			clients.
		</p>
	);
}

function EndpointRow({ url }: { url: string | null }) {
	if (!url) return null;
	return (
		<div className="flex items-center gap-2">
			<code className="min-w-0 flex-1 truncate rounded bg-muted px-2 py-1 text-xs">
				{url}
			</code>
			<Button
				onClick={() => {
					void navigator.clipboard.writeText(url);
				}}
				size="sm"
				type="button"
				variant="outline"
			>
				Copy
			</Button>
		</div>
	);
}

export function RemoteMcpCard() {
	const queryClient = useQueryClient();
	const stateQuery = useQuery({
		queryKey: REMOTE_MCP_STATE_QUERY_KEY,
		queryFn: () => window.moatDesktop.remoteMcp.getState(),
	});

	useEffect(() => {
		return window.moatDesktop.remoteMcp.onStatusChanged((state) => {
			queryClient.setQueryData(REMOTE_MCP_STATE_QUERY_KEY, state);
		});
	}, [queryClient]);

	const state = stateQuery.data;
	if (!state) return null;
	return <RemoteMcpCardBody state={state} />;
}

function RemoteMcpCardBody({ state }: { state: RemoteMcpState }) {
	const queryClient = useQueryClient();

	async function setEnabled(enabled: boolean) {
		const next = await window.moatDesktop.remoteMcp.setEnabled({ enabled });
		queryClient.setQueryData(REMOTE_MCP_STATE_QUERY_KEY, next);
	}

	return (
		<Card>
			<CardHeader>
				<CardTitle>Remote MCP</CardTitle>
				<CardDescription>
					Financial data stays on this computer. The app must be running and
					online. The URL is not a password.
				</CardDescription>
			</CardHeader>
			<CardContent className="space-y-4">
				<div className="flex items-center justify-between gap-4">
					<div className="space-y-1">
						<p className="font-medium text-sm">Enable remote MCP</p>
						<SignInNote signedIn={state.cloudSignedIn} />
					</div>
					<Switch
						checked={state.userEnabled}
						onCheckedChange={(checked) => {
							void setEnabled(checked);
						}}
					/>
				</div>
				<p className="text-muted-foreground text-sm">
					{STATUS_LABELS[state.status]}
				</p>
				<EndpointRow url={state.endpointUrl} />
			</CardContent>
		</Card>
	);
}
