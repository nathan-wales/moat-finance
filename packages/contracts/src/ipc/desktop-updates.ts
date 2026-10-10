import { z } from "zod";

export const DESKTOP_UPDATE_CHANNELS = {
	getStatus: "desktop-updates:get-status",
	checkForUpdates: "desktop-updates:check-for-updates",
	install: "desktop-updates:install",
	statusChanged: "desktop-updates:status-changed",
} as const;

export const DesktopUpdateStatusSchema = z.discriminatedUnion("state", [
	z.object({
		state: z.literal("idle"),
	}),
	z.object({
		state: z.literal("checking"),
	}),
	z.object({
		state: z.literal("available"),
		version: z.string().optional(),
	}),
	z.object({
		state: z.literal("downloading"),
		version: z.string().optional(),
		percent: z.number(),
	}),
	z.object({
		state: z.literal("ready"),
		version: z.string().optional(),
		releaseDate: z.string().optional(),
	}),
	z.object({
		state: z.literal("error"),
		message: z.string(),
	}),
]);

export type DesktopUpdateStatus = z.infer<typeof DesktopUpdateStatusSchema>;
