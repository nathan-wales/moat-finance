import type { AiReport } from "@moat/contracts";
import { MoatReportRenderer } from "@moat/reports";

interface ReportPreviewProps {
	report: AiReport;
	className?: string;
}

export function ReportPreview({ report, className }: ReportPreviewProps) {
	if (report.document != null) {
		return (
			<div className={className} style={{ overflowY: "auto" }}>
				<MoatReportRenderer className="p-4" document={report.document} />
			</div>
		);
	}

	const srcDoc = `<!DOCTYPE html><html><head><style>${report.sanitizedCss}</style></head><body>${report.sanitizedHtml}</body></html>`;

	return (
		<iframe
			className={className}
			sandbox=""
			srcDoc={srcDoc}
			style={{ border: 0 }}
			title="AI generated financial report"
		/>
	);
}
