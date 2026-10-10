import { resolveLogEvent } from "@moat/logging";

type ClientLogLevel = "info" | "warn" | "error";

type ClientLogMetadata = Record<string, string | number | boolean>;

type ClientLogInput = {
	level: ClientLogLevel;
	message: string;
	event?: string;
	feature?: string;
	operation?: string;
	metadata?: ClientLogMetadata;
};

async function sendClientLog(input: ClientLogInput): Promise<void> {
	if (typeof window === "undefined") return;

	try {
		await window.moatDesktop.clientLog.ingest({
			...input,
			event: resolveLogEvent(input.message, input.event),
		});
	} catch {
		// Remote logging must never affect app behavior.
	}
}

export const clientLogger = {
	info: (
		message: string,
		context: Omit<ClientLogInput, "level" | "message"> = {},
	) => {
		void sendClientLog({ level: "info", message, ...context });
	},
	warn: (
		message: string,
		context: Omit<ClientLogInput, "level" | "message"> = {},
	) => {
		void sendClientLog({ level: "warn", message, ...context });
	},
	error: (
		message: string,
		context: Omit<ClientLogInput, "level" | "message"> = {},
	) => {
		void sendClientLog({ level: "error", message, ...context });
	},
};
