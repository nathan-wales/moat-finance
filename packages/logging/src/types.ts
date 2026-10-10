import { z } from "zod";

export type LogLevel = "info" | "warn" | "error";

export type LogApp = "web" | "api" | "desktop" | "ios" | "mcp";

export type LogPlatform = "nextjs" | "electron" | "ios";

export type LogEnv = "local" | "preview" | "production";

export type LogContext = {
	event?: string;
	feature?: string;
	operation?: string;
	userId?: string;
	sessionId?: string;
	requestId?: string;
	demoUser?: boolean;
	errorMessage?: string;
	errorCode?: string;
	stack?: string;
	[key: string]: unknown;
};

export const clientLogPlatformSchema = z.enum(["IOS", "WEB", "DESKTOP"]);

export type ClientLogPlatform = z.infer<typeof clientLogPlatformSchema>;

export type AxiomCredentials = {
	token: string;
	dataset: string;
};
