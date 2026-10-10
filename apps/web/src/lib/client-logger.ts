import { getCsrfToken } from "@moat/client-ts";
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
	if (typeof window === "undefined") {
		return;
	}

	try {
		const csrfToken = await getCsrfToken();
		const headers: Record<string, string> = {
			"Content-Type": "application/json",
		};

		if (csrfToken) {
			headers["x-csrf-token"] = csrfToken;
		}

		await fetch("/api/client-log", {
			method: "POST",
			credentials: "include",
			headers,
			body: JSON.stringify({
				...input,
				event: resolveLogEvent(input.message, input.event),
			}),
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
