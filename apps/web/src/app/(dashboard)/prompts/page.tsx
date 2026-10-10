"use client";

import { PromptLibraryPage } from "@moat/features";
import { useRouter } from "next/navigation";
import { useCallback } from "react";
import { toast } from "sonner";
import { captureWithCurrentIdentity } from "~/lib/analytics";

export default function PromptsPage() {
	const router = useRouter();

	const handlePageView = useCallback(() => {
		captureWithCurrentIdentity("ai_prompt_library_viewed");
	}, []);

	const handleCapture = useCallback(
		(event: string, props: Record<string, unknown>) => {
			captureWithCurrentIdentity(event, props);
		},
		[],
	);

	const handleCopySuccess = useCallback(() => {
		toast.success("Prompt copied to clipboard");
	}, []);

	return (
		<div className="mx-auto w-full max-w-5xl space-y-6 pb-24">
			<PromptLibraryPage
				capabilities={{ mode: "community" }}
				navigation={{
					openPrompt: (id) =>
						router.push(
							`/prompts?tab=mine&userPromptId=${encodeURIComponent(id)}`,
						),
					closePrompt: () => router.push("/prompts"),
					openCommunityPrompt: (id) =>
						router.push(
							`/prompts?tab=community&communityPromptId=${encodeURIComponent(id)}`,
						),
					closeCommunityPrompt: () => router.push("/prompts?tab=community"),
					openAiAccess: () => router.push("/ai-access"),
				}}
				notifications={{ success: toast.success, error: toast.error }}
				onCapture={handleCapture}
				onConfirmDelete={(message) => window.confirm(message)}
				onConfirmWithdraw={(message) => window.confirm(message)}
				onCopySuccess={handleCopySuccess}
				onPageView={handlePageView}
			/>
		</div>
	);
}
