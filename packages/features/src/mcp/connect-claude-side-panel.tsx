"use client";

import {
	CLAUDE_CUSTOM_CONNECTOR_NAME,
	CLAUDE_CUSTOM_CONNECTOR_SETUP_URL,
	CLOUD_MCP_HTTP_URL,
} from "@moat/mcp-contracts";
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
import { Check, ExternalLink } from "lucide-react";
import { ConnectClaudeInstructionStep } from "./connect-claude-instruction-step";
import { CopyableValueRow } from "./copyable-value-row";

const CONNECTOR_DEFAULTS = [
	{ label: "Authentication", value: "Always" },
	{ label: "OAuth client", value: "No client ID" },
	{ label: "Advanced settings — Transport", value: "Streamable HTTP" },
] as const;

type ConnectClaudeSidePanelProps = {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	/** Remote MCP URL to display; defaults to the hosted Moat endpoint. */
	mcpServerUrl?: string;
};

export function ConnectClaudeSidePanel({
	open,
	onOpenChange,
	mcpServerUrl = CLOUD_MCP_HTTP_URL,
}: ConnectClaudeSidePanelProps) {
	return (
		<SidePanel onOpenChange={onOpenChange} open={open}>
			<SidePanelContent size="lg">
				<SidePanelHeader>
					<div className="flex items-center gap-3">
						<ClaudeLogo className="shrink-0" size={28} />
						<div className="min-w-0 space-y-1.5">
							<SidePanelTitle>Connect Claude</SidePanelTitle>
							<SidePanelDescription>
								Add Moat as a custom connector in Claude. It takes about a
								minute.
							</SidePanelDescription>
						</div>
					</div>
				</SidePanelHeader>
				<SidePanelBody>
					<ol className="m-0 list-none p-0">
						<ConnectClaudeInstructionStep
							step={1}
							title="Open Claude connectors"
						>
							<p className="text-muted-foreground text-sm leading-6">
								Claude will open the custom connector form. Stay on that page
								and come back here for the values to enter.
							</p>
							<Button asChild className="w-full sm:w-auto">
								<a
									href={CLAUDE_CUSTOM_CONNECTOR_SETUP_URL}
									rel="noreferrer"
									target="_blank"
								>
									<ExternalLink className="h-4 w-4" />
									Open Claude
								</a>
							</Button>
						</ConnectClaudeInstructionStep>
						<ConnectClaudeInstructionStep step={2} title="Enter these details">
							<div className="space-y-4 rounded-xl border bg-muted/30 p-4">
								<CopyableValueRow
									id="claude-connector-name"
									label="Name"
									value={CLAUDE_CUSTOM_CONNECTOR_NAME}
								/>
								<CopyableValueRow
									id="claude-connector-url"
									label="Remote MCP server URL"
									value={mcpServerUrl}
								/>
							</div>
						</ConnectClaudeInstructionStep>
						<ConnectClaudeInstructionStep step={3} title="Keep the defaults">
							<ul className="space-y-2 rounded-xl border bg-muted/30 p-3">
								{CONNECTOR_DEFAULTS.map((item) => (
									<li
										className="flex items-start gap-3 rounded-lg px-1 py-1.5"
										key={item.label}
									>
										<Check className="mt-0.5 h-4 w-4 shrink-0 text-green-600 dark:text-green-400" />
										<div className="min-w-0">
											<p className="text-muted-foreground text-xs">
												{item.label}
											</p>
											<p className="font-medium text-sm">{item.value}</p>
										</div>
									</li>
								))}
							</ul>
						</ConnectClaudeInstructionStep>
						<ConnectClaudeInstructionStep step={4} title="Click Connect">
							<div className="space-y-3 rounded-xl border border-dashed bg-background p-4">
								<p className="text-muted-foreground text-sm leading-6">
									Claude will say you are not yet connected. Click the Connect
									button on that screen to finish sign-in.
								</p>
								<div className="flex items-center justify-between gap-3 rounded-lg border bg-muted/40 px-3 py-2.5">
									<p className="font-medium text-sm">
										You are not yet connected
									</p>
									<span className="inline-flex h-8 shrink-0 items-center rounded-md bg-primary px-3 font-medium text-primary-foreground text-xs">
										Connect
									</span>
								</div>
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
					<Button asChild>
						<a
							href={CLAUDE_CUSTOM_CONNECTOR_SETUP_URL}
							rel="noreferrer"
							target="_blank"
						>
							<ExternalLink className="h-4 w-4" />
							Open Claude
						</a>
					</Button>
				</SidePanelFooter>
			</SidePanelContent>
		</SidePanel>
	);
}
