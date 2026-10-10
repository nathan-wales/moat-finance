"use client";

import { AiReportsPage } from "@moat/features";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

export default function Page() {
	const router = useRouter();

	return (
		<div className="mx-auto w-full max-w-5xl space-y-6">
			<AiReportsPage
				capabilities={{ shareViaLink: true, updateSnapshot: true }}
				navigation={{
					openReport: (id) => window.open(`/ai-reports/${id}`, "_blank"),
					closeReport: () => router.push("/ai-reports"),
				}}
				notifications={{ success: toast.success, error: toast.error }}
				shareBaseUrl={
					typeof window !== "undefined" ? window.location.origin : ""
				}
			/>
		</div>
	);
}
