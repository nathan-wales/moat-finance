"use client";

import { KeyRound } from "lucide-react";
import { ConnectAssistantCard } from "./connect-assistant-card";

type ConnectCustomCardProps = {
	onConnect: () => void;
	description?: string;
};

export function ConnectCustomCard({
	onConnect,
	description = "Generate a scoped token, then copy the config into that tool's MCP settings.",
}: ConnectCustomCardProps) {
	return (
		<ConnectAssistantCard
			badgeLabel="Any MCP client"
			buttonLabel="Add custom"
			buttonLogo={<KeyRound className="h-4 w-4" />}
			className="border-primary/20 border-dashed bg-gradient-to-br from-muted/60 via-background to-background"
			description={description}
			logo={<KeyRound className="h-[26px] w-[26px] text-muted-foreground" />}
			onConnect={onConnect}
			title="Custom"
		/>
	);
}
