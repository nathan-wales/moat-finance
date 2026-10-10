import {
	type AiReportsNotifications,
	AiReportsPage,
	useMoatNavigation,
} from "@moat/features";
import { Button } from "@moat/ui";
import type React from "react";
import { useMemo, useState } from "react";

type Notice = {
	id: number;
	message: string;
};

export default function DesktopAiReportsPage(): React.ReactElement {
	const nav = useMoatNavigation();
	const [notice, setNotice] = useState<Notice | null>(null);

	const notifications = useMemo<AiReportsNotifications>(
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
			<div className="mx-auto w-full max-w-5xl space-y-6 pb-24 [&_.report-viewer-sticky]:-top-8">
				<AiReportsPage
					capabilities={{ shareViaLink: false, updateSnapshot: false }}
					navigation={{
						openReport: (id) =>
							nav.push(`/ai-reports?reportId=${encodeURIComponent(id)}`),
						closeReport: () => nav.push("/ai-reports"),
					}}
					notifications={notifications}
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
