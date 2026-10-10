import { createApiError } from "../api-context";
import { checkDeviceRateLimit } from "./device-rate-limit.service";
import { type CreateFeedbackParams, createFeedback } from "./feedback.service";
import {
	type FeedbackScreenshotUploadResult,
	uploadFeedbackScreenshot,
} from "./feedback-screenshot.service";

const MAX_FEEDBACK_CREATES_PER_HOUR = 20;
const MAX_SCREENSHOT_UPLOADS_PER_HOUR = 20;

function assertDesktopFeedbackRateLimit(
	desktopDeviceId: string,
	operation: "create" | "upload-screenshot",
): void {
	const limit =
		operation === "create"
			? MAX_FEEDBACK_CREATES_PER_HOUR
			: MAX_SCREENSHOT_UPLOADS_PER_HOUR;

	const result = checkDeviceRateLimit({
		recoveryDeviceId: desktopDeviceId,
		operation: `desktop-feedback:${operation}`,
		limit,
		windowMs: 3_600_000,
	});

	if (!result.allowed) {
		const err = createApiError(
			"Too many feedback requests for this device. Try again later.",
			429,
		) as ReturnType<typeof createApiError> & { retryAfterSeconds?: number };
		err.retryAfterSeconds = Math.max(
			1,
			Math.ceil((result.resetAt.getTime() - Date.now()) / 1000),
		);
		throw err;
	}
}

export async function createDesktopFeedback(params: {
	desktopDeviceId: string;
	feedback: Omit<CreateFeedbackParams, "userId" | "householdId" | "source">;
}) {
	assertDesktopFeedbackRateLimit(params.desktopDeviceId, "create");

	const metadata = {
		...(params.feedback.metadata ?? {}),
		desktopDeviceId: params.desktopDeviceId,
	};

	return createFeedback({
		...params.feedback,
		source: "DESKTOP_APP",
		metadata,
	});
}

export async function uploadDesktopFeedbackScreenshot(params: {
	desktopDeviceId: string;
	data: string;
	filename: string;
	mimeType?: string;
}): Promise<FeedbackScreenshotUploadResult> {
	assertDesktopFeedbackRateLimit(params.desktopDeviceId, "upload-screenshot");

	return uploadFeedbackScreenshot({
		data: params.data,
		filename: params.filename,
		mimeType: params.mimeType,
		storageKeyPrefix: `desktop/${params.desktopDeviceId}`,
	});
}
