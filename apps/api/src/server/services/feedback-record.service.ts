import type {
	FeedbackSource,
	FeedbackType,
	Prisma,
} from "../../../generated/prisma";
import { isGitHubFeedbackEnabled } from "../../lib/github/is-github-feedback-enabled";
import { db } from "../db";

export type CreateFeedbackRecordParams = {
	userId?: string;
	householdId?: string;
	type?: FeedbackType;
	source: FeedbackSource;
	message: string;
	route?: string;
	appVersion?: string;
	platform?: string;
	userAgent?: string;
	metadata?: Record<string, unknown>;
	screenshotUrl?: string;
	screenshotPath?: string;
	screenshotMimeType?: string;
};

export async function createFeedbackRecord(params: CreateFeedbackRecordParams) {
	const feedbackType = params.type ?? "GENERAL";

	return db.feedback.create({
		data: {
			userId: params.userId,
			householdId: params.householdId,
			type: feedbackType,
			source: params.source,
			status: "NEW",
			message: params.message,
			route: params.route,
			appVersion: params.appVersion,
			platform: params.platform,
			userAgent: params.userAgent,
			metadata: params.metadata as Prisma.InputJsonValue | undefined,
			screenshotUrl: params.screenshotUrl,
			screenshotPath: params.screenshotPath,
			screenshotMimeType: params.screenshotMimeType,
			githubSyncStatus: isGitHubFeedbackEnabled() ? "NOT_SYNCED" : undefined,
		},
		select: { id: true },
	});
}
