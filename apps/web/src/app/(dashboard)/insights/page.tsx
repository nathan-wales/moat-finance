"use client";

import { InsightsPage } from "@moat/features";
import {
	type FeatureNotifications,
	TransactionsNotificationProvider,
} from "@moat/features/transactions";
import { FeedbackDialog, useFeedbackDialog } from "@moat/feedback";
import { useRouter } from "next/navigation";
import { Suspense, useEffect } from "react";
import { captureWithCurrentIdentity } from "~/lib/analytics";
import {
	getWebFeedbackContext,
	webFeedbackSubmitAdapter,
} from "~/lib/feedback-adapters";
import { webNotifications } from "~/lib/transactions/web-notifications";

function InsightsPageTracked() {
	const router = useRouter();
	const feedback = useFeedbackDialog();

	useEffect(() => {
		captureWithCurrentIdentity("insights_viewed");
	}, []);

	return (
		<>
			<InsightsPage
				onFeatureRequest={feedback.openDialog}
				openAiAccess={() => router.push("/ai-access")}
			/>
			<FeedbackDialog
				getContext={getWebFeedbackContext}
				initialMessage={feedback.initialMessage}
				onOpenChange={feedback.setOpen}
				open={feedback.open}
				source="WEB_APP"
				submitAdapter={webFeedbackSubmitAdapter}
			/>
		</>
	);
}

export default function Page() {
	return (
		<Suspense>
			<TransactionsNotificationProvider
				notifications={webNotifications as FeatureNotifications}
			>
				<InsightsPageTracked />
			</TransactionsNotificationProvider>
		</Suspense>
	);
}
