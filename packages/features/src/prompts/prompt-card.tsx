import { type AiPrompt, assemblePrompt } from "@moat/ai-prompts";
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
import { useMoatNavigation } from "../navigation-context";
import { PromptPinButton } from "./prompt-pin-button";
import { formatLaunchCount } from "./utils";

export interface PromptCardProps {
	prompt: AiPrompt;
	launchCount?: number;
	isPinned?: boolean;
	onTogglePin?: () => void;
	onCapture?: (event: string, props: Record<string, unknown>) => void;
}

export function PromptCard({
	prompt,
	launchCount = 0,
	isPinned = false,
	onTogglePin,
	onCapture,
}: PromptCardProps) {
	const nav = useMoatNavigation();

	const handleOpen = useCallback(() => {
		onCapture?.("ai_prompt_clicked", {
			promptId: prompt.id,
			surface: "prompt-library",
		});
		nav.push(`/prompts?promptId=${encodeURIComponent(prompt.id)}`);
	}, [prompt.id, nav, onCapture]);

	const handleKeyDown = useCallback(
		(event: KeyboardEvent) => {
			if (event.key !== "Enter" && event.key !== " ") return;
			event.preventDefault();
			handleOpen();
		},
		[handleOpen],
	);

	const assembled = assemblePrompt(prompt, {
		currentDate: new Date().toISOString().split("T")[0] ?? "",
	});

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
				<CardTitle className="text-base">{prompt.title}</CardTitle>
			</CardHeader>
			<CardContent className="flex-1 pb-3">
				<p className="line-clamp-3 text-muted-foreground text-sm">
					{assembled}
				</p>
			</CardContent>
			<CardFooter className="flex items-center justify-between gap-2 pt-0">
				<div className="flex flex-wrap gap-1">
					{prompt.tags.map((tag) => (
						<Badge className="text-xs" key={tag} variant="secondary">
							{tag}
						</Badge>
					))}
				</div>
				<span className="shrink-0 text-muted-foreground text-xs">
					{formatLaunchCount(launchCount)}
				</span>
			</CardFooter>
		</Card>
	);
}
