import type { NextApiRequest, NextApiResponse } from "next";
import { logger } from "../../../../src/lib/logger";
import {
	createApiContext,
	requireAuthenticated,
} from "../../../../src/server/api-context";
import { uploadFeedbackScreenshot } from "../../../../src/server/services/feedback-screenshot.service";

export const config = {
	api: {
		bodyParser: {
			sizeLimit: "5mb",
		},
	},
};

export default async function handler(
	req: NextApiRequest,
	res: NextApiResponse,
) {
	if (req.method !== "POST") {
		return res.status(405).json({ error: "Method not allowed" });
	}

	const ctx = await createApiContext(req, res);

	try {
		requireAuthenticated(ctx);
	} catch {
		return res.status(401).json({ error: "Unauthorized" });
	}

	const { data, filename, mimeType } = req.body as {
		data?: string;
		filename?: string;
		mimeType?: string;
	};

	if (!data || typeof data !== "string") {
		return res.status(400).json({ error: "Missing screenshot data" });
	}

	if (!filename || typeof filename !== "string") {
		return res.status(400).json({ error: "Missing filename" });
	}

	try {
		const result = await uploadFeedbackScreenshot({
			data,
			filename,
			mimeType,
			storageKeyPrefix: ctx.userId ?? "anonymous",
		});

		return res.status(200).json(result);
	} catch (err) {
		logger.error("feedback.screenshot_upload_failed", {
			error: err instanceof Error ? err.message : String(err),
		});
		return res.status(500).json({ error: "Screenshot upload failed" });
	}
}
