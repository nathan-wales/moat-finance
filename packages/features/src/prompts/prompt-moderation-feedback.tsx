import { Alert, AlertDescription, AlertTitle } from "@moat/ui";

type PromptModerationFeedbackProps = {
	feedback?: string | null;
	rejectionReason?: string | null;
	reviewStatus?: string;
};

export function PromptModerationFeedback({
	feedback,
	rejectionReason,
	reviewStatus,
}: PromptModerationFeedbackProps) {
	if (!feedback && !rejectionReason) return null;

	const title =
		reviewStatus === "REJECTED"
			? "This prompt was rejected"
			: "Changes requested";

	const message = rejectionReason ?? feedback;

	if (!message) return null;

	return (
		<Alert variant={reviewStatus === "REJECTED" ? "destructive" : "default"}>
			<AlertTitle>{title}</AlertTitle>
			<AlertDescription className="whitespace-pre-wrap">
				{message}
			</AlertDescription>
		</Alert>
	);
}
