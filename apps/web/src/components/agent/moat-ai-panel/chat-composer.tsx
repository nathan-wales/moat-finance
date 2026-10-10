import { Send, Square } from "lucide-react";
import { usePathname } from "next/navigation";
import type { FormEvent, KeyboardEvent } from "react";
import { Button } from "~/components/ui/button";
import { Textarea } from "~/components/ui/textarea";
import { useDemoMode } from "~/context/demo-mode-context";
import { useMoatAiComposerState } from "./chat-store";

export function ChatComposer() {
	const pathname = usePathname();
	const { isDemoMode } = useDemoMode();
	const { input, isRunning, setInput, sendMessage, stopRun } =
		useMoatAiComposerState();

	const submitMessage = () =>
		void sendMessage({ pathname, isDemoMode, messageText: input });

	const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
		event.preventDefault();
		submitMessage();
	};

	const handleKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
		if (event.key !== "Enter" || event.shiftKey) return;
		event.preventDefault();
		submitMessage();
	};

	return (
		<form className="shrink-0 px-3 pb-2" onSubmit={handleSubmit}>
			<div className="flex items-center gap-2 rounded-xl border bg-background py-1.5 pr-1.5 pl-4 shadow-sm focus-within:ring-1 focus-within:ring-ring">
				<Textarea
					className="max-h-48 min-h-5 resize-none border-0 bg-transparent p-1 pr-0 text-sm shadow-none focus-visible:ring-0 focus-visible:ring-offset-0"
					id="moat-ai-input"
					onChange={(event) => setInput(event.target.value)}
					onKeyDown={handleKeyDown}
					placeholder="Ask Moat..."
					rows={1}
					value={input}
				/>
				{isRunning ? (
					<Button
						aria-label="Stop response"
						className="size-8 shrink-0 self-end rounded-lg"
						onClick={() => stopRun({ isDemoMode })}
						size="icon"
						title="Stop response"
						type="button"
						variant="outline"
					>
						<Square className="size-4" />
					</Button>
				) : (
					<Button
						aria-label="Send message"
						className="size-8 shrink-0 self-end rounded-lg"
						disabled={isRunning || !input.trim()}
						size="icon"
						title="Send message"
						type="submit"
					>
						<Send className="size-4" />
					</Button>
				)}
			</div>
			<p className="mx-auto mt-1.5 max-w-xs text-center text-[11px] text-muted-foreground/70 leading-3">
				Moat AI can make mistakes. All responses are for informational purposes
				only and are not professional advice.
			</p>
		</form>
	);
}
