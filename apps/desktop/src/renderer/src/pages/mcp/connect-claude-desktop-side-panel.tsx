import { ConnectClaudeInstructionStep } from "@moat/features/mcp";
import {
	Button,
	ClaudeLogo,
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

const CLAUDE_TEST_PROMPT =
	"Give me a snapshot of my finances: net worth, this month's spending by category, and any upcoming bills. Use the moat-finance-local MCP";

function installFeedbackMessage(input: {
	error: string | null;
	installed: boolean;
}) {
	if (input.error) {
		return <p className="text-destructive text-sm">{input.error}</p>;
	}
	if (input.installed) {
		return (
			<p className="text-green-700 text-sm dark:text-green-400">
				Added Moat to Claude Desktop&apos;s MCP config. Restart Claude Desktop,
				then approve the Moat dialog when Claude asks to connect.
			</p>
		);
	}
	return null;
}

type ConnectClaudeDesktopSidePanelProps = {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	gatewayEnabled: boolean;
	gatewayRunning: boolean;
	gatewayPort: number | null;
	autoStart: boolean;
	onEnableGateway: () => Promise<GatewayStatus>;
	onEnableAutoStart: () => Promise<GatewayStatus>;
};

export function ConnectClaudeDesktopSidePanel({
	open,
	onOpenChange,
	gatewayEnabled,
	gatewayRunning,
	gatewayPort,
	autoStart,
	onEnableGateway,
	onEnableAutoStart,
}: ConnectClaudeDesktopSidePanelProps) {
	const [isStarting, setIsStarting] = useState(false);
	const [isInstalling, setIsInstalling] = useState(false);
	const [copiedPrompt, setCopiedPrompt] = useState(false);
	const [error, setError] = useState<string | null>(null);
	const [installed, setInstalled] = useState(false);

	useEffect(() => {
		if (!open) return;
		setError(null);
		setInstalled(false);
		setCopiedPrompt(false);
	}, [open]);

	const gatewayReady = gatewayEnabled && gatewayRunning;
	const startLabel = isStarting ? "Starting..." : "Start gateway";
	const installLabel = isInstalling ? "Adding..." : "Add to Claude Desktop";
	const copyPromptLabel = copiedPrompt ? "Copied" : "Copy prompt";
	const CopyPromptIcon = copiedPrompt ? Check : Copy;
	const startIcon = isStarting ? (
		<Loader2 className="h-4 w-4 animate-spin" />
	) : null;
	const installIcon = isInstalling ? (
		<Loader2 className="h-4 w-4 animate-spin" />
	) : null;
	const feedback = installFeedbackMessage({ error, installed });
	const gatewayStep = gatewayReady ? (
		<div className="flex items-center gap-3 rounded-xl border bg-muted/30 px-3 py-2.5">
			<Check className="h-4 w-4 shrink-0 text-green-600 dark:text-green-400" />
			<p className="font-medium text-sm">Running on localhost:{gatewayPort}</p>
		</div>
	) : (
		<div className="space-y-3">
			<p className="text-muted-foreground text-sm leading-6">
				Claude Desktop reaches Moat on this computer. Start the local gateway
				before adding the server.
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
				We&apos;ll write a URL-only MCP entry into Claude Desktop&apos;s config.
				Confirm the system dialog if it appears, then approve the Moat dialog
				when Claude asks to connect.
			</p>
			<Button
				disabled={isInstalling}
				onClick={() => void installInClaudeDesktop()}
				type="button"
			>
				{installIcon}
				{installLabel}
			</Button>
		</div>
	) : (
		<p className="text-muted-foreground text-sm leading-6">
			Start the gateway first. The install button shows up once it&apos;s
			running.
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

	async function installInClaudeDesktop() {
		setIsInstalling(true);
		setError(null);
		setInstalled(false);
		captureWithCurrentIdentity("mcp_claude_install_clicked", {
			surface: "desktop",
			install_kind: "local_config",
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

			const result = await window.moatDesktop.aiAccess.installClaude({
				port,
			});
			if (!result.ok) {
				if ("cancelled" in result && result.cancelled) {
					return;
				}
				setError(result.error);
				return;
			}
			setInstalled(true);
		} catch (err) {
			setError(
				err instanceof Error
					? err.message
					: "Failed to install the Claude Desktop extension",
			);
		} finally {
			setIsInstalling(false);
		}
	}

	async function copyTestPrompt() {
		try {
			await navigator.clipboard.writeText(CLAUDE_TEST_PROMPT);
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
						<ClaudeLogo className="shrink-0" size={28} />
						<div className="min-w-0 space-y-1.5">
							<SidePanelTitle>Connect Claude Desktop</SidePanelTitle>
							<SidePanelDescription>
								Add Moat to Claude Desktop so it talks to this computer&apos;s
								data — not the cloud.
							</SidePanelDescription>
						</div>
					</div>
				</SidePanelHeader>
				<SidePanelBody>
					<ol className="m-0 list-none p-0">
						<ConnectClaudeInstructionStep step={1} title="Local gateway">
							{gatewayStep}
						</ConnectClaudeInstructionStep>
						<ConnectClaudeInstructionStep
							step={2}
							title="Add to Claude Desktop"
						>
							{installStep}
							{feedback}
						</ConnectClaudeInstructionStep>
						<ConnectClaudeInstructionStep
							step={3}
							title="Restart and authenticate"
						>
							<p className="text-muted-foreground text-sm leading-6">
								Quit and reopen Claude Desktop so it reloads its MCP config.
								When Claude asks to connect, approve the Moat dialog on this
								computer.
							</p>
						</ConnectClaudeInstructionStep>
						<ConnectClaudeInstructionStep step={4} title="Try it in Claude">
							<p className="text-muted-foreground text-sm leading-6">
								After it&apos;s installed, paste this into a new Claude Desktop
								chat. Keep Moat running.
							</p>
							<div className="space-y-3 rounded-xl border bg-muted/30 p-4">
								<p className="text-sm leading-6">{CLAUDE_TEST_PROMPT}</p>
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
