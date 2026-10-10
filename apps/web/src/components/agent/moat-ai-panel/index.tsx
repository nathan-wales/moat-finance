"use client";

import { useFeatureFlagEnabled } from "posthog-js/react";
import { useEffect } from "react";
import { ChatComposer } from "./chat-composer";
import { ChatHeader } from "./chat-header";
import { useMoatAiChatActions } from "./chat-store";
import { MoatAiComingSoonOverlay } from "./coming-soon-overlay";
import { MessageList } from "./message-list";

export function MoatAiPanel({ onClose }: { onClose: () => void }) {
	const hasMoatAiFlag = useFeatureFlagEnabled("moat-ai-agent");
	const { abortActiveRun, loadStoredTimeline, refreshConversationList } =
		useMoatAiChatActions();

	useEffect(() => {
		void loadStoredTimeline();
		void refreshConversationList();
		return () => abortActiveRun();
	}, [abortActiveRun, loadStoredTimeline, refreshConversationList]);

	return (
		<section className="relative flex h-full min-h-0 w-full flex-col bg-background">
			{!hasMoatAiFlag && <MoatAiComingSoonOverlay />}
			<ChatHeader onClose={onClose} />
			<div
				className={
					hasMoatAiFlag
						? "flex min-h-0 flex-1 flex-col"
						: "pointer-events-none flex min-h-0 flex-1 flex-col blur-sm"
				}
			>
				<MessageList />
				<ChatComposer />
			</div>
		</section>
	);
}
