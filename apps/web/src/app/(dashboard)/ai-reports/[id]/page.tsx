import { AiReportDetailClient } from "./ai-report-detail-client";

interface Props {
	params: Promise<{ id: string }>;
}

export const metadata = {
	title: "AI Report",
};

export default async function AiReportDetailPage({ params }: Props) {
	const { id } = await params;
	return (
		<div className="mx-auto w-full max-w-5xl space-y-6">
			<AiReportDetailClient id={id} />
		</div>
	);
}
