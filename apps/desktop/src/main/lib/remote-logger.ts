import { createRequire } from "node:module";
import { resolveLogEvent } from "@moat/logging";

const nodeRequire = createRequire(import.meta.url);

const DEFAULT_MOAT_API_URL = "https://api.moatfinance.ai";
const MAX_QUEUE_SIZE = 200;
const DEFAULT_RETRY_DELAY_MS = 2_000;

type RemoteLogLevel = "info" | "warn" | "error";

type RemoteLogMetadata = Record<string, string | number | boolean>;

export type RemoteLogInput = {
	level: RemoteLogLevel;
	message: string;
	event?: string;
	feature?: string;
	operation?: string;
	metadata?: RemoteLogMetadata;
};

export type RemoteLoggerDeps = {
	getAccessToken: () => Promise<string | null>;
	fetchFn: typeof fetch;
	getAppVersion: () => string | Promise<string>;
	getApiBaseUrl?: () => string;
	isOnline?: () => boolean;
	retryDelayMs?: number;
};

function defaultApiBaseUrl(): string {
	const configured = process.env.MOAT_API_URL?.trim();
	const base = configured || DEFAULT_MOAT_API_URL;
	return base.replace(/\/$/, "");
}

function defaultIsOnline(): boolean {
	try {
		const { net } = nodeRequire("electron") as {
			net: { isOnline: () => boolean };
		};
		return net.isOnline();
	} catch {
		return true;
	}
}

async function getLogAccessToken(): Promise<string | null> {
	try {
		const { getCloudAuthIdentity, resolveCloudAccessToken } = await import(
			"./cloud-auth"
		);
		if (!getCloudAuthIdentity().signedIn) return null;
		return await resolveCloudAccessToken();
	} catch {
		return null;
	}
}

async function defaultGetAppVersion(): Promise<string> {
	const { app } = await import("electron");
	return app.getVersion();
}

function shouldDropFailedResponse(status: number): boolean {
	return status >= 400 && status < 500 && status !== 401 && status !== 403;
}

export function createRemoteLogger(deps: RemoteLoggerDeps) {
	const getApiBaseUrl = deps.getApiBaseUrl ?? defaultApiBaseUrl;
	const isOnline = deps.isOnline ?? (() => true);
	const queue: RemoteLogInput[] = [];
	let draining = false;
	let retryTimer: ReturnType<typeof setTimeout> | null = null;

	function enqueue(input: RemoteLogInput): void {
		if (queue.length >= MAX_QUEUE_SIZE) {
			queue.shift();
		}
		queue.push(input);
	}

	function scheduleRetry(): void {
		const delayMs = deps.retryDelayMs;
		if (delayMs == null || retryTimer) return;
		retryTimer = setTimeout(() => {
			retryTimer = null;
			void drain();
		}, delayMs);
		// Background retries must not pin short-lived processes (tests, CLI).
		// The Electron app stays alive on its own, so the timer still fires there.
		retryTimer.unref();
	}

	async function trySend(
		input: RemoteLogInput,
	): Promise<"sent" | "retry" | "drop"> {
		try {
			if (!isOnline()) return "retry";

			const token = await deps.getAccessToken();
			if (!token) return "retry";

			const message = input.message.slice(0, 500);
			const event = resolveLogEvent(message, input.event);

			const response = await deps.fetchFn(
				`${getApiBaseUrl()}/api/v1/clientLog/ingest`,
				{
					method: "POST",
					headers: {
						"Content-Type": "application/json",
						Authorization: `Bearer ${token}`,
					},
					body: JSON.stringify({
						level: input.level,
						message,
						event,
						feature: input.feature,
						operation: input.operation,
						platform: "DESKTOP",
						appVersion: await deps.getAppVersion(),
						metadata: input.metadata,
					}),
				},
			);

			if (response.ok) return "sent";
			if (shouldDropFailedResponse(response.status)) return "drop";
			return "retry";
		} catch {
			return "retry";
		}
	}

	async function drain(): Promise<void> {
		if (draining) return;
		draining = true;
		try {
			while (queue.length > 0) {
				const next = queue[0];
				if (!next) break;
				const result = await trySend(next);
				if (result === "retry") {
					scheduleRetry();
					break;
				}
				queue.shift();
			}
		} finally {
			draining = false;
		}
	}

	function sendRemoteLog(input: RemoteLogInput): Promise<void> {
		enqueue(input);
		return drain();
	}

	return {
		info: (
			message: string,
			context: Omit<RemoteLogInput, "level" | "message"> = {},
		) => {
			void sendRemoteLog({ level: "info", message, ...context });
		},
		warn: (
			message: string,
			context: Omit<RemoteLogInput, "level" | "message"> = {},
		) => {
			void sendRemoteLog({ level: "warn", message, ...context });
		},
		error: (
			message: string,
			context: Omit<RemoteLogInput, "level" | "message"> = {},
		) => {
			void sendRemoteLog({ level: "error", message, ...context });
		},
		drain,
		/** Awaitable send for tests. */
		flush: sendRemoteLog,
	};
}

export const remoteLogger = createRemoteLogger({
	getAccessToken: getLogAccessToken,
	fetchFn: fetch,
	getAppVersion: defaultGetAppVersion,
	isOnline: defaultIsOnline,
	retryDelayMs: DEFAULT_RETRY_DELAY_MS,
});
