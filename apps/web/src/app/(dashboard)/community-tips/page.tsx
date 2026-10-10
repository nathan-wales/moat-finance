"use client";

import { CommunityTipsFeedPage } from "@moat/features";
import { useRouter } from "next/navigation";
import { useCallback } from "react";
import { toast } from "sonner";
import { captureWithCurrentIdentity } from "~/lib/analytics";

export default function CommunityTipsPage() {
	const router = useRouter();

	const handlePageView = useCallback(() => {
		captureWithCurrentIdentity("community_tips_feed_viewed");
	}, []);

	const handleCapture = useCallback(
		(event: string, props: Record<string, unknown>) => {
			captureWithCurrentIdentity(event, props);
		},
		[],
	);

	return (
		<div className="mx-auto w-full max-w-5xl space-y-6 pb-24">
			<CommunityTipsFeedPage
				navigation={{
					openTip: (tipId) => router.push(`/community-tips/${tipId}`),
					closeTip: () => router.push("/community-tips"),
					openMyTips: () => router.push("/community-tips/my-tips"),
					openAiAccess: () => router.push("/ai-access"),
				}}
				notifications={{ success: toast.success, error: toast.error }}
				onCapture={handleCapture}
				onPageView={handlePageView}
			/>
		</div>
	);
}
