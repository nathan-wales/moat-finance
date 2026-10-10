import { put } from "@vercel/blob";
import { logger } from "~/lib/logger";

const ALLOWED_MIME_TYPES = ["image/png", "image/jpeg", "image/webp"] as const;

export type FeedbackScreenshotUploadResult = {
	url: string | null;
	path: string | null;
	mimeType: string;
};

export function resolveFeedbackScreenshotMimeType(
	mimeType: string | undefined,
): (typeof ALLOWED_MIME_TYPES)[number] {
	if (
		mimeType === "image/png" ||
		mimeType === "image/jpeg" ||
		mimeType === "image/webp"
	) {
		return mimeType;
	}
	return "image/png";
}

export async function uploadFeedbackScreenshot(params: {
	data: string;
	filename: string;
	mimeType?: string;
	storageKeyPrefix: string;
}): Promise<FeedbackScreenshotUploadResult> {
	const resolvedMimeType = resolveFeedbackScreenshotMimeType(params.mimeType);

	if (!process.env.BLOB_READ_WRITE_TOKEN) {
		return { url: null, path: null, mimeType: resolvedMimeType };
	}

	const base64 = params.data.replace(/^data:[^;]+;base64,/, "");
	const buffer = Buffer.from(base64, "base64");
	const blob = new Blob([buffer], { type: resolvedMimeType });

	try {
		const result = await put(
			`feedback-screenshots/${params.storageKeyPrefix}/${Date.now()}-${params.filename}`,
			blob,
			{
				access: "public",
				contentType: resolvedMimeType,
				token: process.env.BLOB_READ_WRITE_TOKEN,
			},
		);

		return {
			url: result.url,
			path: result.pathname,
			mimeType: resolvedMimeType,
		};
	} catch (err) {
		logger.error("feedback.screenshot_upload_failed", {
			error: err instanceof Error ? err.message : String(err),
		});
		throw err;
	}
}
