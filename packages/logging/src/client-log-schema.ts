import { z } from "zod";
import { clientLogPlatformSchema } from "./types";

const metadataValueSchema = z.union([
	z.string().max(500),
	z.number(),
	z.boolean(),
]);

export const clientLogBodySchema = z.object({
	level: z.enum(["info", "warn", "error"]),
	message: z
		.string()
		.min(1, "Message is required")
		.max(500, "Message must be at most 500 characters"),
	event: z.string().max(100).optional(),
	feature: z.string().max(100).optional(),
	operation: z.string().max(100).optional(),
	metadata: z.record(metadataValueSchema).optional(),
});

export const clientLogIngestSchema = clientLogBodySchema.extend({
	platform: clientLogPlatformSchema.default("IOS"),
	appVersion: z.string().max(50).optional(),
	buildNumber: z.string().max(50).optional(),
});
