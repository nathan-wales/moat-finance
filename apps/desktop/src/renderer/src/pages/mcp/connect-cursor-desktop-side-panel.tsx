import { ConnectClaudeInstructionStep } from "@moat/features/mcp";
import {
	cursorOauthInstallOpenedMessage,
	DEFAULT_LOCAL_MCP_SERVER_NAME,
} from "@moat/mcp-contracts";
import {
	Button,
	CursorLogo,
	SidePanel,
	SidePanelBody,
	SidePanelClose,
	SidePanelContent,
	SidePanelDescription,
	SidePanelFooter,
	SidePanelHeader,
	SidePanelTitle,
} from "@moat/ui";
import { Check, Copy, Loader2 } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { captureWithCurrentIdentity } from "~/lib/analytics";
import type { GatewayStatus } from "./types";

const CURSOR_TEST_PROMPT =
	"Give me a snapshot of my finances: net worth, this month's spending by category, and any upcoming bills. Use the moat-finance-local MCP";

function installFeedbackMessage(input: {
	error: string | null;
	installed: boolean;
	serverName: string;
}) {
	if (input.error) {
		return <p className="text-destructive text-sm">{input.error}</p>;
	}
	if (input.installed) {
		return (
			<p className="text-green-700 text-sm dark:text-green-400">
				{cursorOauthInstallOpenedMessage(input.serverName)}
			</p>
		);
	}
	return null;
}

type ConnectCursorDesktopSidePanelProps = {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	gatewayEnabled: boolean;
	gatewayRunning: boolean;
	gatewayPort: number | null;
	autoStart: boolean;
	onEnableGateway: () => Promise<GatewayStatus>;
	onEnableAutoStart: () => Promise<GatewayStatus>;
};

export function ConnectCursorDesktopSidePanel({
	open,
	onOpenChange,
	gatewayEnabled,
	gatewayRunning,
	gatewayPort,
	autoStart,
	onEnableGateway,
	onEnableAutoStart,
}: ConnectCursorDesktopSidePanelProps) {
	const [isStarting, setIsStarting] = useState(false);
	const [isInstalling, setIsInstalling] = useState(false);
	const [copiedPrompt, setCopiedPrompt] = useState(false);
	const [error, setError] = useState<string | null>(null);
	const [installed, setInstalled] = useState(false);
	const [serverName, setServerName] = useState(DEFAULT_LOCAL_MCP_SERVER_NAME);

	useEffect(() => {
		if (!open) return;
		setError(null);
		setInstalled(false);
		setCopiedPrompt(false);
		setServerName(DEFAULT_LOCAL_MCP_SERVER_NAME);
	}, [open]);

	const gatewayReady = gatewayEnabled && gatewayRunning;
	const startLabel = isStarting ? "Starting..." : "Start gateway";
	const installLabel = isInstalling ? "Opening..." : "Add to Cursor";
	const copyPromptLabel = copiedPrompt ? "Copied" : "Copy prompt";
	const CopyPromptIcon = copiedPrompt ? Check : Copy;
	const startIcon = isStarting ? (
		<Loader2 className="h-4 w-4 animate-spin" />
	) : null;
	const installIcon = isInstalling ? (
		<Loader2 className="h-4 w-4 animate-spin" />
	) : null;
	const feedback = installFeedbackMessage({ error, installed, serverName });
	const gatewayStep = gatewayReady ? (
		<div className="flex items-center gap-3 rounded-xl border bg-muted/30 px-3 py-2.5">
			<Check className="h-4 w-4 shrink-0 text-green-600 dark:text-green-400" />
			<p className="font-medium text-sm">Running on localhost:{gatewayPort}</p>
		</div>
	) : (
		<div className="space-y-3">
			<p className="text-muted-foreground text-sm leading-6">
				Cursor reaches Moat on this computer. Start the local gateway before
				adding the server.
			</p>
			<Button
				disabled={isStarting}
				onClick={() => void startGateway()}
				type="button"
			>
				{startIcon}
				{startLabel}
			</Button>
		</div>
	);
	const installStep = gatewayReady ? (
		<div className="space-y-3">
			<p className="text-muted-foreground text-sm leading-6">
				We&apos;ll open Cursor&apos;s MCP install prompt for{" "}
				<span className="font-mono text-xs">
					{DEFAULT_LOCAL_MCP_SERVER_NAME}
				</span>
				. Cursor will sign in with OAuth — approve the Moat dialog when it
				appears.
			</p>
			<Button
				disabled={isInstalling}
				onClick={() => void addToCursor()}
				type="button"
			>
				{installIcon}
				{installLabel}
			</Button>
		</div>
	) : (
		<p className="text-muted-foreground text-sm leading-6">
			Start the gateway first. The add button shows up once it&apos;s running.
		</p>
	);

	async function startGateway() {
		setIsStarting(true);
		setError(null);
		try {
			await onEnableGateway();
			if (!autoStart) {
				await onEnableAutoStart();
			}
		} catch (err) {
			setError(
				err instanceof Error
					? err.message
					: "Failed to start the local gateway",
			);
		} finally {
			setIsStarting(false);
		}
	}

	async function addToCursor() {
		setIsInstalling(true);
		setError(null);
		setInstalled(false);
		captureWithCurrentIdentity("mcp_cursor_install_clicked", {
			surface: "desktop",
			install_kind: "local_deeplink",
		});

		try {
			let port = gatewayPort;
			if (!gatewayReady) {
				const status = await onEnableGateway();
				port = status.port;
			}
			if (!autoStart) {
				await onEnableAutoStart();
			}

			const result = await window.moatDesktop.aiAccess.installCursor({
				port,
			});
			if (!result.ok) {
				setError(result.error);
				return;
			}
			setServerName(result.serverName || DEFAULT_LOCAL_MCP_SERVER_NAME);
			setInstalled(true);
		} catch (err) {
			setError(
				err instanceof Error
					? err.message
					: "Failed to open Cursor install link",
			);
		} finally {
			setIsInstalling(false);
		}
	}

	async function copyTestPrompt() {
		try {
			await navigator.clipboard.writeText(CURSOR_TEST_PROMPT);
			setCopiedPrompt(true);
			window.setTimeout(() => setCopiedPrompt(false), 1600);
		} catch {
			toast.error("Failed to copy prompt");
		}
	}

	return (
		<SidePanel onOpenChange={onOpenChange} open={open}>
			<SidePanelContent size="lg">
				<SidePanelHeader>
					<div className="flex items-center gap-3">
						<CursorLogo className="shrink-0" size={28} />
						<div className="min-w-0 space-y-1.5">
							<SidePanelTitle>Connect Cursor</SidePanelTitle>
							<SidePanelDescription>
								Add Moat to Cursor so it talks to this computer&apos;s data —
								not the cloud.
							</SidePanelDescription>
						</div>
					</div>
				</SidePanelHeader>
				<SidePanelBody>
					<ol className="m-0 list-none p-0">
						<ConnectClaudeInstructionStep step={1} title="Local gateway">
							{gatewayStep}
						</ConnectClaudeInstructionStep>
						<ConnectClaudeInstructionStep step={2} title="Add to Cursor">
							{installStep}
							{feedback}
						</ConnectClaudeInstructionStep>
						<ConnectClaudeInstructionStep step={3} title="Approve in Cursor">
							<p className="text-muted-foreground text-sm leading-6">
								Approve the install prompt if it appears, then click
								Authenticate and allow access in the Moat dialog. Confirm{" "}
								<span className="font-mono text-xs">{serverName}</span> shows as
								connected. Keep Moat running.
							</p>
						</ConnectClaudeInstructionStep>
						<ConnectClaudeInstructionStep step={4} title="Try it in Cursor">
							<p className="text-muted-foreground text-sm leading-6">
								Once the server is connected, paste this into a new Cursor agent
								chat.
							</p>
							<div className="space-y-3 rounded-xl border bg-muted/30 p-4">
								<p className="text-sm leading-6">{CURSOR_TEST_PROMPT}</p>
								<Button
									onClick={() => void copyTestPrompt()}
									type="button"
									variant="secondary"
								>
									<CopyPromptIcon className="h-4 w-4" />
									{copyPromptLabel}
								</Button>
							</div>
						</ConnectClaudeInstructionStep>
					</ol>
				</SidePanelBody>
				<SidePanelFooter>
					<SidePanelClose asChild>
						<Button type="button" variant="ghost">
							Done
						</Button>
					</SidePanelClose>
				</SidePanelFooter>
			</SidePanelContent>
		</SidePanel>
	);
}
