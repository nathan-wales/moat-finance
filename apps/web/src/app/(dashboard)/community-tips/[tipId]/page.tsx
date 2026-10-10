"use client";

import { CommunityTipDetailPage } from "@moat/features";
import { useParams, useRouter } from "next/navigation";
import { toast } from "sonner";

export default function CommunityTipDetailRoutePage() {
	const params = useParams<{ tipId: string }>();
	const router = useRouter();
	const tipId = params.tipId;

	if (!tipId) return null;

	return (
		<div className="mx-auto w-full max-w-3xl space-y-6 pb-24">
			<CommunityTipDetailPage
				notifications={{ success: toast.success, error: toast.error }}
				onBack={() => router.push("/community-tips")}
				tipId={tipId}
			/>
		</div>
	);
}
