"use client";

import { NotificationsPage } from "@moat/features/notifications";
import { useRouter } from "next/navigation";
import { useCallback } from "react";
import { toast } from "sonner";
import { captureWithCurrentIdentity } from "~/lib/analytics";

export default function NotificationsRoutePage() {
	const router = useRouter();

	const handleCapture = useCallback(
		(event: string, props: Record<string, unknown>) => {
			captureWithCurrentIdentity(event, props);
		},
		[],
	);

	return (
		<NotificationsPage
			onCapture={handleCapture}
			onNotify={(message, type) => {
				if (type === "error") {
					toast.error(message);
					return;
				}
				toast.success(message);
			}}
			openAiAccess={() => router.push("/ai-access")}
		/>
	);
}
