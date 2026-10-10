"use client";

import { Badge, Button, Card, CardContent, CardFooter, cn } from "@moat/ui";
import {
	Activity,
	ArrowUpRight,
	CheckCircle2,
	LockKeyhole,
	Plug,
	Unplug,
} from "lucide-react";
import type { ReactNode } from "react";

type ConnectAssistantCardProps = {
	onConnect: () => void;
	title: string;
	buttonLabel: string;
	badgeLabel: string;
	description: string;
	logo: ReactNode;
	buttonLogo?: ReactNode;
	className?: string;
	connected?: boolean;
	comingSoon?: boolean;
	lastUsedLabel?: string | null;
	onViewLogs?: () => void;
	onDisconnect?: () => void;
	onOpen?: () => void;
	isDisconnecting?: boolean;
	isOpening?: boolean;
};

function OpenAssistantButton({
	isOpening,
	onOpen,
}: {
	isOpening: boolean;
	onOpen: () => void;
}) {
	return (
		<Button disabled={isOpening} onClick={onOpen} type="button">
			<ArrowUpRight className="h-4 w-4" />
			Open
		</Button>
	);
}

function ConnectAssistantCardActions({
	connected,
	comingSoon,
	onConnect,
	onViewLogs,
	onDisconnect,
	onOpen,
	isDisconnecting,
	isOpening,
	buttonLabel,
	buttonLogo,
}: Pick<
	ConnectAssistantCardProps,
	| "connected"
	| "comingSoon"
	| "onConnect"
	| "onViewLogs"
	| "onDisconnect"
	| "onOpen"
	| "isDisconnecting"
	| "isOpening"
	| "buttonLabel"
	| "buttonLogo"
>) {
	if (connected) {
		const disconnectLabel = isDisconnecting ? "Disconnecting..." : "Disconnect";
		const openButton =
			onOpen == null ? null : (
				<OpenAssistantButton isOpening={Boolean(isOpening)} onOpen={onOpen} />
			);
		return (
			<>
				<Button onClick={onViewLogs} type="button" variant="outline">
					<Activity className="h-4 w-4" />
					View logs
				</Button>
				<Button
					disabled={isDisconnecting}
					onClick={onDisconnect}
					type="button"
					variant="outline"
				>
					<Unplug className="h-4 w-4" />
					{disconnectLabel}
				</Button>
				{openButton}
			</>
		);
	}

	if (comingSoon) {
		return (
			<Button disabled type="button" variant="outline">
				<LockKeyhole className="h-4 w-4" />
				Coming soon
			</Button>
		);
	}

	return (
		<Button onClick={onConnect} type="button">
			{buttonLogo}
			{buttonLabel}
		</Button>
	);
}

export function ConnectAssistantCard({
	onConnect,
	title,
	buttonLabel,
	badgeLabel,
	description,
	logo,
	buttonLogo,
	className = "border-primary/20 bg-gradient-to-br from-primary/10 via-background to-background",
	connected = false,
	comingSoon = false,
	lastUsedLabel = null,
	onViewLogs,
	onDisconnect,
	onOpen,
	isDisconnecting = false,
	isOpening = false,
}: ConnectAssistantCardProps) {
	const cardClassName = cn("h-full", className, comingSoon && "opacity-80");

	return (
		<Card className={cardClassName}>
			<CardContent className="flex-1">
				<div className="flex min-w-0 items-start gap-4">
					<div className="shrink-0">{logo}</div>
					<div className="min-w-0 space-y-1.5">
						<div className="flex flex-wrap items-center gap-2">
							<p className="font-semibold text-lg tracking-tight">{title}</p>
							<Badge className="gap-1 text-xs" variant="outline">
								<Plug className="h-3 w-3" />
								{badgeLabel}
							</Badge>
							{connected && (
								<span className="inline-flex items-center gap-1 rounded-full bg-green-500/10 px-2 py-0.5 text-green-700 text-xs dark:text-green-400">
									<CheckCircle2 className="h-3 w-3" />
									Connected
								</span>
							)}
						</div>
						<p className="text-muted-foreground text-sm leading-6">
							{description}
						</p>
						{lastUsedLabel && (
							<p className="text-muted-foreground text-xs">{lastUsedLabel}</p>
						)}
					</div>
				</div>
			</CardContent>
			<CardFooter className="mt-auto flex-wrap justify-end gap-2">
				<ConnectAssistantCardActions
					buttonLabel={buttonLabel}
					buttonLogo={buttonLogo}
					comingSoon={comingSoon}
					connected={connected}
					isDisconnecting={isDisconnecting}
					isOpening={isOpening}
					onConnect={onConnect}
					onDisconnect={onDisconnect}
					onOpen={onOpen}
					onViewLogs={onViewLogs}
				/>
			</CardFooter>
		</Card>
	);
}
