import { sendFeedbackNotificationEmail } from "~/lib/email/send-feedback-notification-email";
import { logger } from "~/lib/logger";
import { db } from "../db";
import {
	type CreateFeedbackRecordParams,
	createFeedbackRecord,
} from "./feedback-record.service";
import { scheduleFeedbackGitHubSync } from "./github-feedback-sync.service";

export type CreateFeedbackParams = CreateFeedbackRecordParams;

async function resolveFeedbackUser(userId?: string): Promise<{
	name?: string;
	email?: string;
}> {
	if (!userId) {
		return {};
	}

	const user = await db.user.findUnique({
		where: { id: userId },
		select: { name: true, email: true },
	});

	return {
		name: user?.name ?? undefined,
		email: user?.email ?? undefined,
	};
}

export async function createFeedback(params: CreateFeedbackParams) {
	const feedbackType = params.type ?? "GENERAL";
	const feedback = await createFeedbackRecord(params);
	const user = await resolveFeedbackUser(params.userId);

	logger.info("feedback.created", {
		feedbackId: feedback.id,
		source: params.source,
		type: feedbackType,
		hasScreenshot: Boolean(params.screenshotUrl || params.screenshotPath),
	});

	sendFeedbackNotificationEmail({
		feedbackId: feedback.id,
		message: params.message,
		source: params.source,
		type: feedbackType,
		screenshotUrl: params.screenshotUrl,
		route: params.route,
		platform: params.platform,
		userName: user.name,
		userEmail: user.email,
	}).catch((err: unknown) => {
		logger.warn("feedback.email_notification_failed", {
			feedbackId: feedback.id,
			error: err instanceof Error ? err.message : String(err),
		});
	});

	scheduleFeedbackGitHubSync({
		feedbackId: feedback.id,
		userId: params.userId,
		type: feedbackType,
		source: params.source,
		message: params.message,
		route: params.route,
		appVersion: params.appVersion,
		platform: params.platform,
		userAgent: params.userAgent,
		screenshotUrl: params.screenshotUrl,
		metadata: params.metadata,
	});

	return feedback;
}
