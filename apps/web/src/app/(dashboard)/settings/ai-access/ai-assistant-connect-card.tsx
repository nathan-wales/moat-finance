"use client";

import {
	AI_CONNECTION_QUERY_KEY,
	ConnectAssistantCard,
	ConnectClaudeCard,
	ConnectClaudeSidePanel,
	ConnectCustomCard,
	openCursorMcpInstallLink,
} from "@moat/features/mcp";
import { SETUP_GUIDE_QUERY_KEY } from "@moat/features/setup-guide";
import {
	buildCursorMcpInstallLink,
	buildUrlOnlyMcpServerConfig,
	cursorOauthInstallOpenedMessage,
	DEFAULT_CLOUD_MCP_SERVER_NAME,
} from "@moat/mcp-contracts";
import { ChatgptLogo, ConfirmDestructiveDialog, CursorLogo } from "@moat/ui";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { captureWithCurrentIdentity } from "~/lib/analytics";
import {
	listMcpOAuthConnections,
	type McpOAuthClientConnection,
	revokeMcpOAuthConnection,
} from "~/lib/api/mcp";
import { MCP_HTTP_URL } from "~/lib/mcp-url";
import { cn } from "~/lib/utils";
import {
	type AssistantProvider,
	CONNECT_CARD_ELEMENT_ID,
	CONNECT_HIGHLIGHT_PARAM,
	CONNECT_HIGHLIGHT_VALUE,
	connectionsForProvider,
	isActiveOAuthConnection,
	latestConnectionForProvider,
	oauthLogsHref,
	onMcpLogsLinkClick,
} from "./oauth-connection-status";
import { CreateTokenDialog } from "./personal-access-tokens-card";

const CONNECT_HIGHLIGHT_MS = 2140;

function formatDate(value: string) {
	return new Intl.DateTimeFormat(undefined, {
		month: "short",
		day: "numeric",
		year: "numeric",
	}).format(new Date(value));
}

function lastUsedLabelForConnection(
	connection: McpOAuthClientConnection | null,
): string | null {
	if (!connection) return null;
	if (connection.lastUsedAt)
		return `Last used ${formatDate(connection.lastUsedAt)}`;
	return `Connected ${formatDate(connection.connectedAt)}`;
}

export function AiAssistantConnectCard() {
	const router = useRouter();
	const pathname = usePathname();
	const searchParams = useSearchParams();
	const queryClient = useQueryClient();
	const shouldHighlight =
		searchParams.get(CONNECT_HIGHLIGHT_PARAM) === CONNECT_HIGHLIGHT_VALUE;
	const [isHighlighted, setIsHighlighted] = useState(false);
	const [claudeGuideOpen, setClaudeGuideOpen] = useState(false);
	const [customTokenOpen, setCustomTokenOpen] = useState(false);
	const [disconnectProvider, setDisconnectProvider] =
		useState<AssistantProvider | null>(null);

	const oauth = useQuery({
		queryKey: ["mcp", "oauth"],
		queryFn: listMcpOAuthConnections,
	});

	const activeConnections = oauth.data?.connections ?? [];
	const hasActiveAssistant = activeConnections.some(isActiveOAuthConnection);
	const claudeConnection = latestConnectionForProvider(
		activeConnections,
		"Claude",
	);
	const chatgptConnection = latestConnectionForProvider(
		activeConnections,
		"ChatGPT",
	);
	const cursorConnection = latestConnectionForProvider(
		activeConnections,
		"Cursor",
	);
	const chatgptComingSoon = !chatgptConnection;
	const disconnectName = disconnectProvider ?? "this assistant";

	const disconnectAssistant = useMutation({
		mutationFn: async (input: {
			provider: AssistantProvider;
			oauthClientIds: string[];
			clientProfile: string;
		}) => {
			await revokeMcpOAuthConnection({ oauthClientIds: input.oauthClientIds });
		},
		onSuccess: (_data, variables) => {
			captureWithCurrentIdentity("mcp_oauth_connection_revoked", {
				surface: "web",
				client_profile: variables.clientProfile,
			});
			toast.success(`${variables.provider} disconnected`);
			setDisconnectProvider(null);
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

	const disconnectingProvider = disconnectAssistant.isPending
		? (disconnectAssistant.variables?.provider ?? null)
		: null;

	useEffect(() => {
		if (!oauth.isSuccess || !hasActiveAssistant) return;
		queryClient.setQueryData(AI_CONNECTION_QUERY_KEY, { connected: true });
		void queryClient.invalidateQueries({ queryKey: SETUP_GUIDE_QUERY_KEY });
	}, [hasActiveAssistant, oauth.isSuccess, queryClient]);

	useEffect(() => {
		if (!shouldHighlight) return;

		setIsHighlighted(true);

		const scrollTimeout = window.setTimeout(() => {
			document.getElementById(CONNECT_CARD_ELEMENT_ID)?.scrollIntoView({
				behavior: "smooth",
				block: "center",
			});
		}, 50);

		const clearHighlightTimeout = window.setTimeout(() => {
			setIsHighlighted(false);
			const params = new URLSearchParams(window.location.search);
			params.delete(CONNECT_HIGHLIGHT_PARAM);
			const qs = params.toString();
			router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
		}, CONNECT_HIGHLIGHT_MS);

		return () => {
			window.clearTimeout(scrollTimeout);
			window.clearTimeout(clearHighlightTimeout);
		};
	}, [shouldHighlight, pathname, router]);

	function connectCursor() {
		captureWithCurrentIdentity("mcp_cursor_install_clicked", {
			surface: "web",
			install_kind: "oauth",
		});
		const link = buildCursorMcpInstallLink({
			name: DEFAULT_CLOUD_MCP_SERVER_NAME,
			config: buildUrlOnlyMcpServerConfig(MCP_HTTP_URL),
		});
		openCursorMcpInstallLink(link);
		toast.success(
			cursorOauthInstallOpenedMessage(DEFAULT_CLOUD_MCP_SERVER_NAME),
		);
	}

	function connectClaude() {
		captureWithCurrentIdentity("mcp_claude_install_clicked", {
			surface: "web",
			install_kind: "oauth",
		});
		setClaudeGuideOpen(true);
	}

	function viewProviderLogs(provider: AssistantProvider) {
		onMcpLogsLinkClick();
		router.push(oauthLogsHref(provider));
	}

	function confirmDisconnect() {
		if (!disconnectProvider) return;
		const matches = connectionsForProvider(
			activeConnections,
			disconnectProvider,
		);
		const first = matches[0];
		const oauthClientIds = matches.flatMap(
			(connection) => connection.oauthClientIds,
		);
		if (!first || oauthClientIds.length === 0) {
			setDisconnectProvider(null);
			return;
		}
		disconnectAssistant.mutate({
			provider: disconnectProvider,
			oauthClientIds,
			clientProfile: first.clientProfile,
		});
	}

	const gridOverflowClassName = isHighlighted
		? "overflow-visible"
		: "overflow-hidden";
	const gridClassName = cn(
		"grid gap-6 rounded-xl lg:grid-cols-2",
		gridOverflowClassName,
		isHighlighted && "animate-connect-focus ring-2 ring-primary",
	);

	return (
		<>
			{oauth.isError && (
				<p className="mb-4 text-muted-foreground text-sm">
					Failed to load connections.
				</p>
			)}
			<div className={gridClassName} id={CONNECT_CARD_ELEMENT_ID}>
				<ConnectClaudeCard
					connected={Boolean(claudeConnection)}
					isDisconnecting={disconnectingProvider === "Claude"}
					lastUsedLabel={lastUsedLabelForConnection(claudeConnection)}
					onConnect={connectClaude}
					onDisconnect={() => setDisconnectProvider("Claude")}
					onViewLogs={() => viewProviderLogs("Claude")}
				/>
				<ConnectAssistantCard
					badgeLabel="ChatGPT"
					buttonLabel="Connect ChatGPT"
					buttonLogo={<ChatgptLogo size={16} />}
					className="border-primary/20 bg-gradient-to-br from-emerald-500/10 via-background to-background"
					comingSoon={chatgptComingSoon}
					connected={Boolean(chatgptConnection)}
					description="Connect ChatGPT to your Moat data through the hosted MCP."
					isDisconnecting={disconnectingProvider === "ChatGPT"}
					lastUsedLabel={lastUsedLabelForConnection(chatgptConnection)}
					logo={<ChatgptLogo size={26} />}
					onConnect={() => undefined}
					onDisconnect={() => setDisconnectProvider("ChatGPT")}
					onViewLogs={() => viewProviderLogs("ChatGPT")}
					title="ChatGPT"
				/>
				<ConnectAssistantCard
					badgeLabel="Cursor Desktop & Web"
					buttonLabel="Connect Cursor"
					buttonLogo={<CursorLogo size={16} />}
					className="border-primary/20 bg-gradient-to-br from-zinc-500/10 via-background to-background"
					connected={Boolean(cursorConnection)}
					description="Connect Cursor to your Moat data in one click. Works with Cursor Desktop and Web."
					isDisconnecting={disconnectingProvider === "Cursor"}
					lastUsedLabel={lastUsedLabelForConnection(cursorConnection)}
					logo={<CursorLogo size={26} />}
					onConnect={connectCursor}
					onDisconnect={() => setDisconnectProvider("Cursor")}
					onViewLogs={() => viewProviderLogs("Cursor")}
					title="Cursor"
				/>
				<ConnectCustomCard onConnect={() => setCustomTokenOpen(true)} />
			</div>
			<ConnectClaudeSidePanel
				mcpServerUrl={MCP_HTTP_URL}
				onOpenChange={setClaudeGuideOpen}
				open={claudeGuideOpen}
			/>
			<CreateTokenDialog
				onOpenChange={setCustomTokenOpen}
				open={customTokenOpen}
			/>
			<ConfirmDestructiveDialog
				confirmLabel="Disconnect"
				description={`Are you sure you want to disconnect ${disconnectName}? It will lose access to your Moat data until you reconnect.`}
				isPending={disconnectAssistant.isPending}
				onConfirm={confirmDisconnect}
				onOpenChange={(open) => {
					if (!open) setDisconnectProvider(null);
				}}
				open={disconnectProvider !== null}
				pendingLabel="Disconnecting…"
				title={`Disconnect ${disconnectName}?`}
			/>
		</>
	);
}
