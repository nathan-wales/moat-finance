import type { UserPromptSummary } from "@moat/contracts";
import {
	Badge,
	Card,
	CardContent,
	CardFooter,
	CardHeader,
	CardTitle,
	cn,
} from "@moat/ui";
import { type KeyboardEvent, useCallback } from "react";
import { PromptPinButton } from "./prompt-pin-button";
import { PromptStatusBadge } from "./prompt-status-badge";
import type { PromptLibraryMode } from "./types";
import { formatLaunchCount } from "./utils";

type UserPromptCardProps = {
	prompt: UserPromptSummary;
	mode?: PromptLibraryMode;
	isPinned?: boolean;
	onTogglePin?: () => void;
	onOpen: (id: string) => void;
};

export function UserPromptCard({
	prompt,
	mode = "community",
	isPinned = false,
	onTogglePin,
	onOpen,
}: UserPromptCardProps) {
	const handleOpen = useCallback(() => {
		onOpen(prompt.id);
	}, [onOpen, prompt.id]);

	const handleKeyDown = useCallback(
		(event: KeyboardEvent) => {
			if (event.key !== "Enter" && event.key !== " ") return;
			event.preventDefault();
			handleOpen();
		},
		[handleOpen],
	);

	return (
		<Card
			className={cn(
				"group relative cursor-pointer transition-[box-shadow,transform] hover:-translate-y-0.5 hover:shadow-xl",
				"focus-visible:border-ring focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50",
			)}
			onClick={handleOpen}
			onKeyDown={handleKeyDown}
			role="button"
			tabIndex={0}
		>
			{onTogglePin ? (
				<PromptPinButton
					className="absolute top-2 right-2 z-10"
					isPinned={isPinned}
					onTogglePin={onTogglePin}
				/>
			) : null}
			<CardHeader className="pr-10 pb-2">
				<div className="flex items-start justify-between gap-2">
					<CardTitle className="text-base">{prompt.title}</CardTitle>
					<PromptStatusBadge
						mode={mode}
						reviewStatus={prompt.reviewStatus}
						visibility={prompt.visibility}
					/>
				</div>
			</CardHeader>
			{prompt.description ? (
				<CardContent className="flex-1 pb-3">
					<p className="line-clamp-3 text-muted-foreground text-sm">
						{prompt.description}
					</p>
				</CardContent>
			) : null}
			<CardFooter className="flex items-center justify-between gap-2 pt-0">
				<div className="flex flex-wrap gap-1">
					{prompt.tags.map((tag) => (
						<Badge className="text-xs" key={tag} variant="secondary">
							{tag}
						</Badge>
					))}
				</div>
				<span className="shrink-0 text-muted-foreground text-xs">
					{formatLaunchCount(prompt.launchCount)}
				</span>
			</CardFooter>
		</Card>
	);
}
