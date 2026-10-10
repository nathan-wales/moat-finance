"use client";

import { CommunityTipSubmitForm } from "@moat/features";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

export default function CommunityTipsNewPage() {
	const router = useRouter();

	return (
		<div className="mx-auto w-full max-w-2xl space-y-6 pb-24">
			<CommunityTipSubmitForm
				notifications={{ success: toast.success, error: toast.error }}
				onOpenChange={(open) => {
					if (!open) router.push("/community-tips");
				}}
				onSuccess={() => router.push("/community-tips/my-tips")}
				open
			/>
		</div>
	);
}
