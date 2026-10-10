import {
	type PromptLibraryNotifications,
	PromptLibraryPage,
	useMoatNavigation,
} from "@moat/features";
import { Button } from "@moat/ui";
import type React from "react";
import { useMemo, useState } from "react";
import { captureWithCurrentIdentity } from "~/lib/analytics";

type Notice = {
	id: number;
	message: string;
};

export default function DesktopPromptsPage(): React.ReactElement {
	const nav = useMoatNavigation();
	const [notice, setNotice] = useState<Notice | null>(null);

	const notifications = useMemo<PromptLibraryNotifications>(
		() => ({
			success(message) {
				setNotice({ id: Date.now(), message });
			},
			error(message) {
				setNotice({ id: Date.now(), message });
			},
		}),
		[],
	);

	return (
		<>
			<div className="mx-auto w-full max-w-5xl space-y-6 pb-24">
				<PromptLibraryPage
					capabilities={{ mode: "private-only" }}
					navigation={{
						openPrompt: (id) =>
							nav.push(
								`/prompts?tab=mine&userPromptId=${encodeURIComponent(id)}`,
							),
						closePrompt: () => nav.push("/prompts"),
						openCommunityPrompt: () => nav.push("/prompts"),
						closeCommunityPrompt: () => nav.push("/prompts"),
						openAiAccess: () => nav.push("/mcp"),
					}}
					notifications={notifications}
					onCapture={(event, props) => captureWithCurrentIdentity(event, props)}
					onConfirmDelete={(message) => window.confirm(message)}
				/>
			</div>
			{notice ? (
				<div className="fixed right-6 bottom-6 z-50 flex max-w-sm items-center gap-3 rounded-md border bg-card px-4 py-3 text-card-foreground text-sm shadow-lg">
					<span className="min-w-0 flex-1">{notice.message}</span>
					<Button onClick={() => setNotice(null)} size="sm" variant="ghost">
						Dismiss
					</Button>
				</div>
			) : null}
		</>
	);
}
