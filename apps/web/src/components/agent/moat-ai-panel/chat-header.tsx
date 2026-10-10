import { History, Plus, Sparkles, X } from "lucide-react";
import { Button } from "~/components/ui/button";
import { useDemoMode } from "~/context/demo-mode-context";
import { useMoatAiHeaderState } from "./chat-store";
import { ConversationHistoryPopover } from "./history-popover";
import { focusChatInput } from "./utils";

export function ChatHeader({ onClose }: { onClose: () => void }) {
	const { isDemoMode } = useDemoMode();
	const { status, startNewConversation } = useMoatAiHeaderState();

	return (
		<header className="flex h-14 shrink-0 items-center justify-between border-b px-4">
			<div className="flex min-w-0 items-center gap-3">
				<div className="flex size-8 shrink-0 items-center justify-center rounded-md bg-primary text-primary-foreground">
					<Sparkles className="size-4" />
				</div>
				<div className="min-w-0">
					<h2 className="truncate font-semibold text-sm">Moat AI</h2>
					<p className="truncate text-muted-foreground text-xs">{status}</p>
				</div>
			</div>
			<div className="flex items-center gap-1">
				<Button
					aria-label="Start a new conversation"
					onClick={() => {
						startNewConversation({ isDemoMode });
						focusChatInput();
					}}
					size="icon-sm"
					title="New conversation"
					variant="ghost"
				>
					<Plus className="size-4" />
				</Button>
				<ConversationHistoryPopover
					triggerIcon={<History className="size-4" />}
				/>
				<Button
					aria-label="Close Moat AI"
					onClick={onClose}
					size="icon-sm"
					title="Close Moat AI"
					variant="ghost"
				>
					<X className="size-4" />
				</Button>
			</div>
		</header>
	);
}
