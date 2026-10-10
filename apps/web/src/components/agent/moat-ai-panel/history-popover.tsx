import { Check, Pencil, X } from "lucide-react";
import { type ReactNode, useState } from "react";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import {
	Popover,
	PopoverContent,
	PopoverTrigger,
} from "~/components/ui/popover";
import type { ConversationSummary } from "~/lib/api/agent";
import { useMoatAiHistoryState } from "./chat-store";
import { focusChatInput } from "./utils";

export function ConversationHistoryPopover({
	triggerIcon,
}: {
	triggerIcon: ReactNode;
}) {
	const {
		conversationId,
		conversations,
		historyOpen,
		historySearch,
		setHistoryOpen,
		setHistorySearch,
		loadConversation,
		renameConversationTitle,
	} = useMoatAiHistoryState();
	const [editingId, setEditingId] = useState<string | null>(null);
	const [draftTitle, setDraftTitle] = useState("");
	const [savingId, setSavingId] = useState<string | null>(null);

	const filteredConversations = getFilteredConversations(
		conversations,
		historySearch,
	);

	async function saveTitle() {
		if (!editingId || !draftTitle.trim()) return;
		setSavingId(editingId);
		try {
			await renameConversationTitle({
				conversationId: editingId,
				title: draftTitle,
			});
			setEditingId(null);
			setDraftTitle("");
		} finally {
			setSavingId(null);
		}
	}

	return (
		<Popover
			onOpenChange={(open) => {
				setHistoryOpen(open);
				if (!open) {
					setEditingId(null);
					setDraftTitle("");
				}
			}}
			open={historyOpen}
		>
			<PopoverTrigger asChild>
				<Button
					aria-label="Conversation history"
					disabled={conversations.length === 0}
					size="icon-sm"
					title="Conversation history"
					variant="ghost"
				>
					{triggerIcon}
				</Button>
			</PopoverTrigger>
			<PopoverContent align="end" className="w-80 p-0" sideOffset={8}>
				<div className="border-b p-2">
					<Input
						autoFocus
						className="h-8 text-sm"
						onChange={(event) => setHistorySearch(event.target.value)}
						placeholder="Search conversations..."
						value={historySearch}
					/>
				</div>
				<div className="max-h-64 overflow-y-auto py-1">
					{filteredConversations.length === 0 ? (
						<p className="px-3 py-4 text-center text-muted-foreground text-xs">
							No conversations found
						</p>
					) : (
						filteredConversations.map((conversation) => {
							const label = getConversationLabel(conversation);
							const isEditing = editingId === conversation.id;
							return (
								<div
									className="flex items-center gap-1 px-2 py-1 hover:bg-muted"
									key={conversation.id}
								>
									{isEditing ? (
										<>
											<Input
												className="h-8 min-w-0 flex-1 text-sm"
												onChange={(event) => setDraftTitle(event.target.value)}
												onKeyDown={(event) => {
													if (event.key === "Enter") void saveTitle();
													if (event.key === "Escape") setEditingId(null);
												}}
												value={draftTitle}
											/>
											<Button
												aria-label="Save conversation name"
												disabled={
													savingId === conversation.id || !draftTitle.trim()
												}
												onClick={() => void saveTitle()}
												size="icon-sm"
												type="button"
												variant="ghost"
											>
												<Check className="size-4" />
											</Button>
											<Button
												aria-label="Cancel rename"
												onClick={() => {
													setEditingId(null);
													setDraftTitle("");
												}}
												size="icon-sm"
												type="button"
												variant="ghost"
											>
												<X className="size-4" />
											</Button>
										</>
									) : (
										<>
											<button
												className={`min-w-0 flex-1 truncate rounded-sm px-1 py-1 text-left text-sm transition-colors ${
													conversation.id === conversationId
														? "font-medium text-foreground"
														: "text-muted-foreground"
												}`}
												onClick={() => {
													void loadConversation(conversation.id);
													focusChatInput();
												}}
												type="button"
											>
												{label}
											</button>
											<Button
												aria-label="Rename conversation"
												onClick={() => {
													setEditingId(conversation.id);
													setDraftTitle(label);
												}}
												size="icon-sm"
												type="button"
												variant="ghost"
											>
												<Pencil className="size-3.5" />
											</Button>
										</>
									)}
								</div>
							);
						})
					)}
				</div>
			</PopoverContent>
		</Popover>
	);
}

function getFilteredConversations(
	conversations: ConversationSummary[],
	search: string,
): ConversationSummary[] {
	const query = search.trim().toLowerCase();
	if (!query) return conversations.slice(0, 5);
	return conversations.filter((conversation) =>
		getConversationLabel(conversation).toLowerCase().includes(query),
	);
}

function getConversationLabel(conversation: ConversationSummary): string {
	if (conversation.title) return conversation.title;
	return new Date(conversation.updatedAt).toLocaleDateString(undefined, {
		month: "short",
		day: "numeric",
		year:
			new Date(conversation.updatedAt).getFullYear() !==
			new Date().getFullYear()
				? "numeric"
				: undefined,
	});
}
