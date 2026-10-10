import { useCallback, useEffect, useRef } from "react";
import { MoatAiTimelineBlockRenderer } from "~/components/agent/moat-ai-timeline-block";
import { ScrollArea } from "~/components/ui/scroll-area";
import { useDemoMode } from "~/context/demo-mode-context";
import { useMoatAiMessageListState } from "./chat-store";
import { suggestedPrompts } from "./utils";

export function MessageList() {
	const { isDemoMode } = useDemoMode();
	const { blocks, selectSuggestedPrompt, submitWidgetAction } =
		useMoatAiMessageListState();
	const bottomRef = useRef<HTMLDivElement | null>(null);

	const scrollToBottom = useCallback(() => {
		queueMicrotask(() => bottomRef.current?.scrollIntoView({ block: "end" }));
	}, []);

	// biome-ignore lint/correctness/useExhaustiveDependencies: scroll should fire on every new message/chunk
	useEffect(() => {
		bottomRef.current?.scrollIntoView({ block: "end" });
	}, [blocks.length]);

	return (
		<ScrollArea className="min-h-0 flex-1">
			<div className="space-y-4 p-4">
				{blocks.length === 0 ? (
					<EmptyPromptList
						isDemoMode={isDemoMode}
						onSelectPrompt={selectSuggestedPrompt}
					/>
				) : (
					blocks.map((block) => (
						<MoatAiTimelineBlockRenderer
							block={block}
							key={block.id}
							onWidgetAction={(input) =>
								void submitWidgetAction({ ...input, scrollToBottom })
							}
						/>
					))
				)}
				<div ref={bottomRef} />
			</div>
		</ScrollArea>
	);
}

function EmptyPromptList({
	isDemoMode,
	onSelectPrompt,
}: {
	isDemoMode: boolean;
	onSelectPrompt: (input: { prompt: string; isDemoMode: boolean }) => void;
}) {
	return (
		<div className="flex min-h-72 flex-col items-center justify-center gap-4 text-center">
			<p className="max-w-56 font-medium text-muted-foreground text-xl">
				Let's chat
			</p>
			<div className="flex w-full max-w-72 flex-col gap-2">
				{suggestedPrompts.map((prompt) => (
					<button
						className="rounded-md border bg-card px-3 py-2 text-left text-sm transition-colors hover:bg-muted"
						key={prompt}
						onClick={() => onSelectPrompt({ prompt, isDemoMode })}
						type="button"
					>
						{prompt}
					</button>
				))}
			</div>
		</div>
	);
}
