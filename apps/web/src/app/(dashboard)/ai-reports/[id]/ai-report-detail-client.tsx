"use client";

import { AiReportDetailPage } from "@moat/features";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

interface AiReportDetailClientProps {
	id: string;
}

export function AiReportDetailClient({ id }: AiReportDetailClientProps) {
	const router = useRouter();

	return (
		<AiReportDetailPage
			capabilities={{ shareViaLink: true, updateSnapshot: true }}
			navigation={{
				openReport: (reportId) =>
					window.open(`/ai-reports/${reportId}`, "_blank"),
				closeReport: () => router.push("/ai-reports"),
			}}
			notifications={{ success: toast.success, error: toast.error }}
			reportId={id}
			shareBaseUrl={typeof window !== "undefined" ? window.location.origin : ""}
		/>
	);
}
