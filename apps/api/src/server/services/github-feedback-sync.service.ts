import type { FeedbackSource, FeedbackType } from "../../../generated/prisma";
import { createFeedbackIssue } from "../../lib/github/create-feedback-issue";
import { isGitHubFeedbackEnabled } from "../../lib/github/is-github-feedback-enabled";
import { logger } from "../../lib/logger";
import { db } from "../db";

export type SyncFeedbackToGitHubParams = {
	feedbackId: string;
	userId?: string;
	type: FeedbackType;
	source: FeedbackSource;
	message: string;
	route?: string;
	appVersion?: string;
	platform?: string;
	userAgent?: string;
	screenshotUrl?: string;
	metadata?: Record<string, unknown>;
};

async function resolveUserEmail(userId?: string): Promise<string | undefined> {
	if (!userId) {
		return undefined;
	}

	const user = await db.user.findUnique({
		where: { id: userId },
		select: { email: true },
	});

	return user?.email ?? undefined;
}

async function markFeedbackGitHubSyncFailed(
	feedbackId: string,
	errorMessage: string,
): Promise<void> {
	try {
		await db.feedback.update({
			where: { id: feedbackId },
			data: {
				githubSyncStatus: "FAILED",
				githubSyncError: errorMessage,
			},
		});
	} catch (updateErr: unknown) {
		logger.error("feedback.github_sync_status_update_failed", {
			feedbackId,
			error: updateErr instanceof Error ? updateErr.message : String(updateErr),
		});
	}
}

export function scheduleFeedbackGitHubSync(
	params: SyncFeedbackToGitHubParams,
): void {
	if (!isGitHubFeedbackEnabled()) {
		return;
	}

	void syncFeedbackToGitHub(params).catch((err: unknown) => {
		logger.warn("feedback.github_sync_unhandled_failure", {
			feedbackId: params.feedbackId,
			error: err instanceof Error ? err.message : String(err),
		});
	});
}

export async function syncFeedbackToGitHub(
	params: SyncFeedbackToGitHubParams,
): Promise<void> {
	if (!isGitHubFeedbackEnabled()) {
		return;
	}

	try {
		const userEmail = await resolveUserEmail(params.userId);
		const githubIssue = await createFeedbackIssue({
			feedbackId: params.feedbackId,
			type: params.type,
			source: params.source,
			message: params.message,
			userId: params.userId,
			userEmail,
			route: params.route,
			appVersion: params.appVersion,
			platform: params.platform,
			userAgent: params.userAgent,
			screenshotUrl: params.screenshotUrl,
			metadata: params.metadata,
		});

		await db.feedback.update({
			where: { id: params.feedbackId },
			data: {
				githubIssueNumber: githubIssue.issueNumber,
				githubIssueUrl: githubIssue.issueUrl,
				githubSyncStatus: "SYNCED",
				githubSyncError: null,
			},
		});

		logger.info("feedback.github_sync_succeeded", {
			feedbackId: params.feedbackId,
			githubIssueNumber: githubIssue.issueNumber,
		});
	} catch (err: unknown) {
		const errorMessage = err instanceof Error ? err.message : String(err);
		await markFeedbackGitHubSyncFailed(params.feedbackId, errorMessage);

		logger.error("feedback.github_sync_failed", {
			feedbackId: params.feedbackId,
			error: errorMessage,
		});
	}
}
