import { z } from "zod";
import type { ApiContext } from "../api-context";
import { createApiError } from "../api-context";
import {
	type AuthenticatedContext,
	withAuth,
	withPublic,
} from "../handler-wrappers";
import {
	createDesktopFeedback,
	uploadDesktopFeedbackScreenshot,
} from "../services/desktop-feedback.service";
import { createFeedback } from "../services/feedback.service";

const feedbackTypeSchema = z
	.enum([
		"GENERAL",
		"BUG",
		"FEATURE_REQUEST",
		"UX_FEEDBACK",
		"MCP_TOOL_ISSUE",
		"INCORRECT_RESULT",
		"OTHER",
	])
	.optional();

const feedbackMessageSchema = z
	.string()
	.min(1, "Message is required")
	.max(2000, "Message must be at most 2000 characters")
	.transform((v) => v.trim())
	.refine((v) => v.length > 0, "Message cannot be empty");

const screenshotMetaSchema = z
	.object({
		url: z.string().url().optional(),
		path: z.string().optional(),
		mimeType: z.string().optional(),
	})
	.optional();

const createFeedbackInput = z.object({
	type: feedbackTypeSchema,
	source: z.enum(["WEB_APP", "DESKTOP_APP", "MCP"]),
	message: feedbackMessageSchema,
	route: z.string().max(500).optional(),
	appVersion: z.string().max(50).optional(),
	platform: z.string().max(50).optional(),
	userAgent: z.string().max(500).optional(),
	metadata: z.record(z.unknown()).optional(),
	screenshot: screenshotMetaSchema,
});

const createFromDesktopInput = z.object({
	desktopDeviceId: z.string().min(1).max(128),
	type: feedbackTypeSchema,
	message: feedbackMessageSchema,
	route: z.string().max(500).optional(),
	appVersion: z.string().max(50).optional(),
	platform: z.string().max(50).optional(),
	userAgent: z.string().max(500).optional(),
	metadata: z.record(z.unknown()).optional(),
	screenshot: screenshotMetaSchema,
});

const uploadScreenshotFromDesktopInput = z.object({
	desktopDeviceId: z.string().min(1).max(128),
	data: z.string().min(1),
	filename: z.string().min(1).max(200),
	mimeType: z.enum(["image/png", "image/jpeg", "image/webp"]).optional(),
});

export const feedback = {
	create: withAuth(async (ctx: AuthenticatedContext, body: unknown) => {
		const parsed = createFeedbackInput.safeParse(body);
		if (!parsed.success) {
			throw createApiError(
				parsed.error.errors[0]?.message ?? "Invalid input",
				400,
			);
		}

		const input = parsed.data;

		const record = await createFeedback({
			userId: ctx.effectiveUserId,
			type: input.type,
			source: input.source,
			message: input.message,
			route: input.route,
			appVersion: input.appVersion,
			platform: input.platform,
			userAgent: input.userAgent,
			metadata: input.metadata,
			screenshotUrl: input.screenshot?.url,
			screenshotPath: input.screenshot?.path,
			screenshotMimeType: input.screenshot?.mimeType,
		});

		return { feedbackId: record.id, status: "created" as const };
	}),

	createFromDesktop: withPublic(async (_ctx: ApiContext, body: unknown) => {
		const parsed = createFromDesktopInput.safeParse(body);
		if (!parsed.success) {
			throw createApiError(
				parsed.error.errors[0]?.message ?? "Invalid input",
				400,
			);
		}

		const input = parsed.data;
		const record = await createDesktopFeedback({
			desktopDeviceId: input.desktopDeviceId,
			feedback: {
				type: input.type,
				message: input.message,
				route: input.route,
				appVersion: input.appVersion,
				platform: input.platform ?? "desktop",
				userAgent: input.userAgent,
				metadata: input.metadata,
				screenshotUrl: input.screenshot?.url,
				screenshotPath: input.screenshot?.path,
				screenshotMimeType: input.screenshot?.mimeType,
			},
		});

		return { feedbackId: record.id, status: "created" as const };
	}),

	uploadScreenshotFromDesktop: withPublic(
		async (_ctx: ApiContext, body: unknown) => {
			const parsed = uploadScreenshotFromDesktopInput.safeParse(body);
			if (!parsed.success) {
				throw createApiError(
					parsed.error.errors[0]?.message ?? "Invalid input",
					400,
				);
			}

			const input = parsed.data;

			try {
				return await uploadDesktopFeedbackScreenshot({
					desktopDeviceId: input.desktopDeviceId,
					data: input.data,
					filename: input.filename,
					mimeType: input.mimeType,
				});
			} catch (err) {
				if (
					err &&
					typeof err === "object" &&
					"status" in err &&
					typeof (err as { status: unknown }).status === "number"
				) {
					throw err;
				}
				throw createApiError("Screenshot upload failed", 500);
			}
		},
	),
};

export type FeedbackHandlers = typeof feedback;
