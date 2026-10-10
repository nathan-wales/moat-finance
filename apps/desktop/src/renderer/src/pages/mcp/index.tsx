import { useMoatNavigation } from "@moat/features";
import {
	AI_CONNECTION_QUERY_KEY,
	ConnectAssistantCard,
	ConnectClaudeCard,
	ConnectCustomCard,
} from "@moat/features/mcp";
import { SETUP_GUIDE_QUERY_KEY } from "@moat/features/setup-guide";
import {
	Button,
	ChatgptLogo,
	ConfirmDestructiveDialog,
	CursorLogo,
	Tabs,
	TabsContent,
	TabsList,
	TabsTrigger,
} from "@moat/ui";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Brain } from "lucide-react";
import type React from "react";
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { captureWithCurrentIdentity } from "~/lib/analytics";
import { useDesktopRemoteMcpEnabled } from "~/lib/feature-flags";
import {
	GATEWAY_STATUS_QUERY_KEY,
	useGatewayStatus,
} from "~/lib/hooks/use-gateway-status";
import { AccessTokensCard } from "./access-tokens-card";
import {
	type DesktopAssistantProvider,
	LOGS_HIGHLIGHT_PARAM,
	LOGS_HIGHLIGHT_VALUE,
	latestOAuthConnectionForProvider,
	latestTokenForProvider,
	oauthConnectionsForProvider,
	parseDesktopLogProvider,
	tokensForProvider,
} from "./assistant-providers";
import { ConnectChatgptDesktopSidePanel } from "./connect-chatgpt-desktop-side-panel";
import { ConnectClaudeDesktopSidePanel } from "./connect-claude-desktop-side-panel";
import { ConnectCursorDesktopSidePanel } from "./connect-cursor-desktop-side-panel";
import { CreateAccessTokenDialog } from "./create-access-token-dialog";
import { GatewayHeaderActions } from "./gateway-header-actions";
import { McpLogsCard } from "./mcp-logs-card";
import { OAuthConnectionsCard } from "./oauth-connections-card";
import { RemoteMcpCard } from "./remote-mcp-card";
import type {
	AccessToken,
	CreatedAccessToken,
	LocalOAuthConnection,
} from "./types";
import { formatDate } from "./utils";

const MCP_TOKENS_QUERY_KEY = ["desktop", "mcp", "tokens"] as const;
const MCP_OAUTH_QUERY_KEY = ["desktop", "mcp", "oauth"] as const;

function parseAiAccessTab(value: string | null): "connect" | "settings" {
	if (value === "settings") return "settings";
	return "connect";
}

type McpPageProps = {
	onTokenStateChange?: (hasTokens: boolean) => void;
};

function errorMessage(error: unknown, fallback: string): string | null {
	if (!error) return null;
	return error instanceof Error ? error.message : fallback;
}

function lastUsedLabelForConnection(input: {
	token: AccessToken | null;
	connection: LocalOAuthConnection | null;
}): string | null {
	const token = input.token;
	const connection = input.connection;
	if (!token && !connection) return null;
	const lastUsedAt = [token?.lastUsedAt, connection?.lastUsedAt]
		.filter((value): value is string => Boolean(value))
		.sort()
		.at(-1);
	if (lastUsedAt) return `Last used ${formatDate(lastUsedAt)}`;
	const createdAt = [token?.createdAt, connection?.createdAt]
		.filter((value): value is string => Boolean(value))
		.sort()
		.at(-1);
	if (createdAt) return `Connected ${formatDate(createdAt)}`;
	return null;
}

function RemoteMcpSettings() {
	const enabled = useDesktopRemoteMcpEnabled();
	if (!enabled) return null;
	return <RemoteMcpCard />;
}

export default function McpPage({
	onTokenStateChange,
}: McpPageProps): React.ReactElement {
	const nav = useMoatNavigation();
	const queryClient = useQueryClient();
	const [claudeGuideOpen, setClaudeGuideOpen] = useState(false);
	const [chatgptGuideOpen, setChatgptGuideOpen] = useState(false);
	const [cursorGuideOpen, setCursorGuideOpen] = useState(false);
	const [customTokenOpen, setCustomTokenOpen] = useState(false);
	const [disconnectProvider, setDisconnectProvider] =
		useState<DesktopAssistantProvider | null>(null);
	const tab = parseAiAccessTab(nav.getSearchParam("tab"));
	const logProvider = parseDesktopLogProvider(nav.getSearchParam("provider"));

	useEffect(() => {
		captureWithCurrentIdentity("mcp_ai_access_viewed", {
			surface: "desktop",
			tab,
		});
	}, [tab]);

	function setTab(nextTab: string) {
		if (nextTab === "connect") {
			nav.removeSearchParam("tab");
			nav.removeSearchParam("provider");
			nav.removeSearchParam(LOGS_HIGHLIGHT_PARAM);
			return;
		}
		nav.removeSearchParam(LOGS_HIGHLIGHT_PARAM);
		nav.setSearchParam("tab", nextTab);
	}

	function viewProviderLogs(provider: DesktopAssistantProvider) {
		nav.setSearchParam("tab", "settings");
		nav.setSearchParam("provider", provider);
		nav.setSearchParam(LOGS_HIGHLIGHT_PARAM, LOGS_HIGHLIGHT_VALUE);
	}

	const gateway = useGatewayStatus();
	const connectGuideOpen =
		claudeGuideOpen || chatgptGuideOpen || cursorGuideOpen;

	const tokens = useQuery({
		queryKey: MCP_TOKENS_QUERY_KEY,
		queryFn: () =>
			window.moatDesktop.aiAccess.listTokens() as Promise<AccessToken[]>,
	});

	const oauthConnections = useQuery({
		queryKey: MCP_OAUTH_QUERY_KEY,
		queryFn: () =>
			window.moatDesktop.aiAccess.listOAuthConnections() as Promise<
				LocalOAuthConnection[]
			>,
	});

	const refetchMcpTokens = useCallback(() => {
		void queryClient.invalidateQueries({ queryKey: MCP_TOKENS_QUERY_KEY });
		void queryClient.invalidateQueries({ queryKey: MCP_OAUTH_QUERY_KEY });
		void queryClient.invalidateQueries({
			queryKey: AI_CONNECTION_QUERY_KEY,
		});
		void queryClient.invalidateQueries({ queryKey: SETUP_GUIDE_QUERY_KEY });
	}, [queryClient]);

	useEffect(() => {
		if (!connectGuideOpen) return;
		function onFocus() {
			refetchMcpTokens();
		}
		window.addEventListener("focus", onFocus);
		return () => window.removeEventListener("focus", onFocus);
	}, [connectGuideOpen, refetchMcpTokens]);

	function handleConnectGuideOpenChange(
		setOpen: (open: boolean) => void,
	): (open: boolean) => void {
		return (open) => {
			setOpen(open);
			if (!open) refetchMcpTokens();
		};
	}

	const toggleGateway = useMutation({
		mutationFn: (enabled: boolean) =>
			window.moatDesktop.aiAccess.setEnabled({ enabled }),
		onSuccess: (status) => {
			captureWithCurrentIdentity("mcp_gateway_toggled", {
				enabled: status.enabled,
				auto_start: status.autoStart,
			});
			queryClient.setQueryData(GATEWAY_STATUS_QUERY_KEY, status);
		},
	});

	const setAutoStart = useMutation({
		mutationFn: (autoStart: boolean) =>
			window.moatDesktop.aiAccess.setAutoStart({ autoStart }),
		onSuccess: (status) => {
			queryClient.setQueryData(GATEWAY_STATUS_QUERY_KEY, status);
		},
	});

	const createToken = useMutation({
		mutationFn: (input: { label: string; scopes: string[] }) =>
			window.moatDesktop.aiAccess.generateToken(
				input,
			) as Promise<CreatedAccessToken>,
		onSuccess: async (data, variables) => {
			captureWithCurrentIdentity("mcp_local_token_created", {
				scope_count: variables.scopes.length,
				has_write_scope: variables.scopes.some((scope) =>
					scope.includes(":write"),
				),
			});
			queryClient.setQueryData<AccessToken[]>(
				MCP_TOKENS_QUERY_KEY,
				(current) => {
					const existing = current ?? [];
					if (existing.some((token) => token.id === data.token.id)) {
						return existing;
					}
					return [...existing, data.token];
				},
			);
			queryClient.setQueryData(AI_CONNECTION_QUERY_KEY, { connected: true });
			await queryClient.invalidateQueries({ queryKey: MCP_TOKENS_QUERY_KEY });
			await queryClient.invalidateQueries({ queryKey: SETUP_GUIDE_QUERY_KEY });
		},
	});

	const revokeToken = useMutation({
		mutationFn: (tokenId: string) =>
			window.moatDesktop.aiAccess.revokeToken({ tokenId }),
		onSuccess: () => {
			captureWithCurrentIdentity("mcp_local_token_revoked");
			refetchMcpTokens();
		},
	});

	const revokeAll = useMutation({
		mutationFn: () => window.moatDesktop.aiAccess.revokeAll(),
		onSuccess: () => {
			captureWithCurrentIdentity("mcp_local_token_revoked");
			refetchMcpTokens();
		},
	});

	const revokeOAuth = useMutation({
		mutationFn: (clientId: string) =>
			window.moatDesktop.aiAccess.revokeOAuthConnection({ clientId }),
		onSuccess: () => {
			captureWithCurrentIdentity("mcp_oauth_connection_revoked", {
				surface: "desktop",
			});
			refetchMcpTokens();
		},
	});

	const disconnectAssistant = useMutation({
		mutationFn: async (input: {
			provider: DesktopAssistantProvider;
			tokenIds: string[];
			clientIds: string[];
		}) => {
			await Promise.all([
				...input.tokenIds.map((tokenId) =>
					window.moatDesktop.aiAccess.revokeToken({ tokenId }),
				),
				...input.clientIds.map((clientId) =>
					window.moatDesktop.aiAccess.revokeOAuthConnection({ clientId }),
				),
			]);
		},
		onSuccess: (_data, variables) => {
			captureWithCurrentIdentity("mcp_local_token_revoked");
			refetchMcpTokens();
			toast.success(`${variables.provider} disconnected`);
			setDisconnectProvider(null);
		},
		onError: () => {
			toast.error("Failed to disconnect");
		},
	});

	const openAssistant = useMutation({
		mutationFn: (provider: DesktopAssistantProvider) =>
			window.moatDesktop.aiAccess.openAssistant({ provider }),
		onSuccess: (result, provider) => {
			if (result.ok) return;
			toast.error(result.error ?? `Couldn't open ${provider}`);
		},
		onError: (_error, provider) => {
			toast.error(`Couldn't open ${provider}`);
		},
	});

	useEffect(() => {
		if (!tokens.data && !oauthConnections.data) return;
		const hasConnection =
			(tokens.data?.length ?? 0) > 0 ||
			(oauthConnections.data?.length ?? 0) > 0;
		onTokenStateChange?.(hasConnection);
		queryClient.setQueryData(AI_CONNECTION_QUERY_KEY, {
			connected: hasConnection,
		});
	}, [onTokenStateChange, oauthConnections.data, queryClient, tokens.data]);

	function connectClaude() {
		setClaudeGuideOpen(true);
	}

	function connectChatgpt() {
		setChatgptGuideOpen(true);
	}

	function connectCursor() {
		setCursorGuideOpen(true);
	}

	function connectCustom() {
		setCustomTokenOpen(true);
	}

	function openProvider(provider: DesktopAssistantProvider) {
		captureWithCurrentIdentity("mcp_assistant_open_clicked", {
			surface: "desktop",
			provider,
		});
		openAssistant.mutate(provider);
	}

	const gatewayStatus = gateway.data ?? null;
	const tokenRows = tokens.data ?? [];
	const oauthRows = oauthConnections.data ?? [];
	const claudeToken = latestTokenForProvider(tokenRows, "Claude");
	const chatgptToken = latestTokenForProvider(tokenRows, "ChatGPT");
	const cursorToken = latestTokenForProvider(tokenRows, "Cursor");
	const claudeOAuth = latestOAuthConnectionForProvider(oauthRows, "Claude");
	const chatgptOAuth = latestOAuthConnectionForProvider(oauthRows, "ChatGPT");
	const cursorOAuth = latestOAuthConnectionForProvider(oauthRows, "Cursor");
	const disconnectName = disconnectProvider ?? "this assistant";
	const disconnectingProvider = disconnectAssistant.isPending
		? (disconnectAssistant.variables?.provider ?? null)
		: null;
	const openingProvider = openAssistant.isPending
		? (openAssistant.variables ?? null)
		: null;
	const gatewayError =
		errorMessage(gateway.error, "Failed to load gateway status") ||
		errorMessage(toggleGateway.error, "Failed to update gateway") ||
		errorMessage(setAutoStart.error, "Failed to update auto-start");

	function confirmDisconnect() {
		if (!disconnectProvider) return;
		const tokenIds = tokensForProvider(tokenRows, disconnectProvider).map(
			(token) => token.id,
		);
		const clientIds = oauthConnectionsForProvider(
			oauthRows,
			disconnectProvider,
		).map((connection) => connection.clientId);
		if (tokenIds.length === 0 && clientIds.length === 0) {
			setDisconnectProvider(null);
			return;
		}
		disconnectAssistant.mutate({
			provider: disconnectProvider,
			tokenIds,
			clientIds,
		});
	}

	return (
		<div className="mx-auto w-full max-w-6xl space-y-6 pb-24">
			<div className="flex items-start justify-between gap-4">
				<div>
					<h1 className="font-bold text-2xl tracking-tight">AI Access</h1>
					<p className="text-muted-foreground text-sm">
						Connect Moat to your personal AI assistant via the MCP gateway.
					</p>
				</div>
				<GatewayHeaderActions
					isToggling={toggleGateway.isPending}
					isUpdatingAutoStart={setAutoStart.isPending}
					onToggleAutoStart={(checked) => setAutoStart.mutate(checked)}
					onToggleGateway={() => {
						if (!gatewayStatus) return;
						toggleGateway.mutate(!gatewayStatus.enabled);
					}}
					status={gatewayStatus}
				/>
			</div>
			{gatewayError && (
				<p className="text-destructive text-sm">{gatewayError}</p>
			)}

			<Tabs onValueChange={setTab} value={tab}>
				<div className="flex flex-wrap items-center justify-between gap-3">
					<TabsList>
						<TabsTrigger value="connect">Connect</TabsTrigger>
						<TabsTrigger value="settings">Settings</TabsTrigger>
					</TabsList>
					<Button
						className="h-auto gap-1.5 px-0 text-muted-foreground hover:bg-transparent hover:text-foreground"
						onClick={() => nav.push("/settings/memories")}
						variant="ghost"
					>
						<Brain className="size-3.5" />
						Manage memories
					</Button>
				</div>
				<TabsContent className="mt-4 space-y-6" value="connect">
					<div className="grid gap-6 lg:grid-cols-2">
						<ConnectClaudeCard
							badgeLabel="Claude Desktop"
							connected={Boolean(claudeToken || claudeOAuth)}
							description="Connect Claude Desktop to this computer's Moat data through the local gateway."
							isDisconnecting={disconnectingProvider === "Claude"}
							isOpening={openingProvider === "Claude"}
							lastUsedLabel={lastUsedLabelForConnection({
								token: claudeToken,
								connection: claudeOAuth,
							})}
							onConnect={connectClaude}
							onDisconnect={() => setDisconnectProvider("Claude")}
							onOpen={() => openProvider("Claude")}
							onViewLogs={() => viewProviderLogs("Claude")}
						/>
						<ConnectAssistantCard
							badgeLabel="ChatGPT Desktop"
							buttonLabel="Connect ChatGPT"
							buttonLogo={<ChatgptLogo size={16} />}
							className="border-primary/20 bg-gradient-to-br from-emerald-500/10 via-background to-background"
							connected={Boolean(chatgptToken || chatgptOAuth)}
							description="Connect ChatGPT Desktop to this computer's Moat data through the local gateway."
							isDisconnecting={disconnectingProvider === "ChatGPT"}
							isOpening={openingProvider === "ChatGPT"}
							lastUsedLabel={lastUsedLabelForConnection({
								token: chatgptToken,
								connection: chatgptOAuth,
							})}
							logo={<ChatgptLogo size={26} />}
							onConnect={connectChatgpt}
							onDisconnect={() => setDisconnectProvider("ChatGPT")}
							onOpen={() => openProvider("ChatGPT")}
							onViewLogs={() => viewProviderLogs("ChatGPT")}
							title="ChatGPT"
						/>
						<ConnectAssistantCard
							badgeLabel="Cursor Desktop"
							buttonLabel="Connect Cursor"
							buttonLogo={<CursorLogo size={16} />}
							className="border-primary/20 bg-gradient-to-br from-zinc-500/10 via-background to-background"
							connected={Boolean(cursorToken || cursorOAuth)}
							description="Connect Cursor to this computer's Moat data through the local gateway."
							isDisconnecting={disconnectingProvider === "Cursor"}
							isOpening={openingProvider === "Cursor"}
							lastUsedLabel={lastUsedLabelForConnection({
								token: cursorToken,
								connection: cursorOAuth,
							})}
							logo={<CursorLogo size={26} />}
							onConnect={connectCursor}
							onDisconnect={() => setDisconnectProvider("Cursor")}
							onOpen={() => openProvider("Cursor")}
							onViewLogs={() => viewProviderLogs("Cursor")}
							title="Cursor"
						/>
						<ConnectCustomCard onConnect={connectCustom} />
					</div>
				</TabsContent>
				<TabsContent className="mt-4 space-y-6" value="settings">
					<RemoteMcpSettings />
					<OAuthConnectionsCard
						connections={oauthRows}
						error={
							errorMessage(
								oauthConnections.error,
								"Failed to load OAuth connections",
							) || null
						}
						isLoading={oauthConnections.isLoading}
						onRevoke={(clientId) => revokeOAuth.mutate(clientId)}
						revokingClientId={
							revokeOAuth.isPending && typeof revokeOAuth.variables === "string"
								? revokeOAuth.variables
								: null
						}
					/>

					<AccessTokensCard
						error={errorMessage(tokens.error, "Failed to load tokens") || null}
						isLoading={tokens.isLoading}
						isRevokingAll={revokeAll.isPending}
						onCreateToken={(input) => createToken.mutateAsync(input)}
						onRevokeAll={() => revokeAll.mutate()}
						onRevokeToken={(tokenId) => revokeToken.mutate(tokenId)}
						port={gatewayStatus?.port ?? null}
						revokingTokenId={
							revokeToken.isPending && typeof revokeToken.variables === "string"
								? revokeToken.variables
								: null
						}
						tokens={tokenRows}
					/>

					<McpLogsCard providerFromUrl={logProvider} tokens={tokenRows} />
				</TabsContent>
			</Tabs>

			<ConnectClaudeDesktopSidePanel
				autoStart={gatewayStatus?.autoStart ?? false}
				gatewayEnabled={gatewayStatus?.enabled ?? false}
				gatewayPort={gatewayStatus?.port ?? null}
				gatewayRunning={gatewayStatus?.running ?? false}
				onEnableAutoStart={() => setAutoStart.mutateAsync(true)}
				onEnableGateway={() => toggleGateway.mutateAsync(true)}
				onOpenChange={handleConnectGuideOpenChange(setClaudeGuideOpen)}
				open={claudeGuideOpen}
			/>
			<ConnectChatgptDesktopSidePanel
				autoStart={gatewayStatus?.autoStart ?? false}
				gatewayEnabled={gatewayStatus?.enabled ?? false}
				gatewayPort={gatewayStatus?.port ?? null}
				gatewayRunning={gatewayStatus?.running ?? false}
				onEnableAutoStart={() => setAutoStart.mutateAsync(true)}
				onEnableGateway={() => toggleGateway.mutateAsync(true)}
				onOpenChange={handleConnectGuideOpenChange(setChatgptGuideOpen)}
				open={chatgptGuideOpen}
			/>
			<ConnectCursorDesktopSidePanel
				autoStart={gatewayStatus?.autoStart ?? false}
				gatewayEnabled={gatewayStatus?.enabled ?? false}
				gatewayPort={gatewayStatus?.port ?? null}
				gatewayRunning={gatewayStatus?.running ?? false}
				onEnableAutoStart={() => setAutoStart.mutateAsync(true)}
				onEnableGateway={() => toggleGateway.mutateAsync(true)}
				onOpenChange={handleConnectGuideOpenChange(setCursorGuideOpen)}
				open={cursorGuideOpen}
			/>
			<CreateAccessTokenDialog
				onCreate={(input) => createToken.mutateAsync(input)}
				onOpenChange={setCustomTokenOpen}
				open={customTokenOpen}
				port={gatewayStatus?.port ?? null}
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
		</div>
	);
}
