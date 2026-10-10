"use client";

import { ClaudeLogo } from "@moat/ui";
import { ConnectAssistantCard } from "./connect-assistant-card";

type ConnectClaudeCardProps = {
	onConnect: () => void;
	badgeLabel?: string;
	description?: string;
	connected?: boolean;
	lastUsedLabel?: string | null;
	onViewLogs?: () => void;
	onDisconnect?: () => void;
	onOpen?: () => void;
	isDisconnecting?: boolean;
	isOpening?: boolean;
};

export function ConnectClaudeCard({
	onConnect,
	badgeLabel = "Claude.ai",
	description = "Add Moat as a custom connector in Claude. We'll walk you through each step.",
	connected = false,
	lastUsedLabel = null,
	onViewLogs,
	onDisconnect,
	onOpen,
	isDisconnecting = false,
	isOpening = false,
}: ConnectClaudeCardProps) {
	return (
		<ConnectAssistantCard
			badgeLabel={badgeLabel}
			buttonLabel="Connect Claude"
			buttonLogo={<ClaudeLogo size={16} />}
			className="border-primary/20 bg-gradient-to-br from-orange-500/10 via-background to-background"
			connected={connected}
			description={description}
			isDisconnecting={isDisconnecting}
			isOpening={isOpening}
			lastUsedLabel={lastUsedLabel}
			logo={<ClaudeLogo size={26} />}
			onConnect={onConnect}
			onDisconnect={onDisconnect}
			onOpen={onOpen}
			onViewLogs={onViewLogs}
			title="Claude"
		/>
	);
}
