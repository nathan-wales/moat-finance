"use client";

import { MyCommunityTipsPage } from "@moat/features";
import { useRouter } from "next/navigation";
import { useCallback } from "react";
import { toast } from "sonner";
import { captureWithCurrentIdentity } from "~/lib/analytics";

export default function MyCommunityTipsRoutePage() {
	const router = useRouter();

	const handleCapture = useCallback(
		(event: string, props: Record<string, unknown>) => {
			captureWithCurrentIdentity(event, props);
		},
		[],
	);

	return (
		<div className="mx-auto w-full max-w-5xl space-y-6 pb-24">
			<MyCommunityTipsPage
				notifications={{ success: toast.success, error: toast.error }}
				onCapture={handleCapture}
				onOpen={(tipId) => router.push(`/community-tips/${tipId}`)}
				openAiAccess={() => router.push("/ai-access")}
			/>
		</div>
	);
}
