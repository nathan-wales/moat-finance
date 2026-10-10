import { getAxiomClient, getAxiomDataset } from "./axiom-client";
import { normalizeError } from "./normalize-error";
import { resolveLogEnv } from "./resolve-env";
import { resolveLogEvent } from "./resolve-log-event";
import type {
	AxiomCredentials,
	LogApp,
	LogContext,
	LogLevel,
	LogPlatform,
} from "./types";

export type LoggerConfig = {
	app: LogApp;
	platform: LogPlatform;
	source: string;
	version?: string;
	getAxiomCredentials?: () => AxiomCredentials | null;
	getBaseContext?: () => LogContext;
	shouldDisableIngest?: () => boolean;
	isDevelopment?: () => boolean;
};

export type Logger = {
	info: (message: string, context?: LogContext) => Promise<void>;
	warn: (message: string, context?: LogContext) => Promise<void>;
	error: (message: string, context?: LogContext) => Promise<void>;
	logError: (
		message: string,
		error: unknown,
		context?: LogContext,
	) => Promise<void>;
	withContext: (context: LogContext) => Logger;
	flush: () => Promise<void>;
};

function formatMessage(
	level: LogLevel,
	message: string,
	context: LogContext,
): string {
	const contextStr = Object.entries(context)
		.filter(([, value]) => value !== undefined)
		.map(([key, value]) => `${key}=${JSON.stringify(value)}`)
		.join(" ");
	return `[${level.toUpperCase()}] ${message}${contextStr ? ` | ${contextStr}` : ""}`;
}

function buildLogPayload(
	level: LogLevel,
	message: string,
	context: LogContext,
	config: LoggerConfig,
	mergedContext: LogContext,
): Record<string, unknown> {
	const explicitEvent =
		typeof context.event === "string"
			? context.event
			: typeof mergedContext.event === "string"
				? mergedContext.event
				: undefined;
	const event = resolveLogEvent(message, explicitEvent);

	return {
		level,
		message,
		event,
		timestamp: new Date().toISOString(),
		app: config.app,
		platform: config.platform,
		source: config.source,
		env: resolveLogEnv(),
		version: config.version,
		...mergedContext,
		...context,
	};
}

export function createLogger(config: LoggerConfig): Logger {
	const isDevelopment =
		config.isDevelopment ?? (() => process.env.NODE_ENV === "development");

	const getCredentials = (): AxiomCredentials | null => {
		if (isDevelopment()) {
			return null;
		}
		if (config.shouldDisableIngest?.()) {
			return null;
		}
		return config.getAxiomCredentials?.() ?? null;
	};

	function createScopedLogger(scopedContext: LogContext = {}): Logger {
		async function log(
			level: LogLevel,
			message: string,
			context: LogContext = {},
		): Promise<void> {
			const baseContext = config.getBaseContext?.() ?? {};
			const mergedContext = { ...baseContext, ...scopedContext };
			const logData = buildLogPayload(
				level,
				message,
				context,
				config,
				mergedContext,
			);

			if (isDevelopment()) {
				const formatted = formatMessage(level, message, {
					...mergedContext,
					...context,
				});
				switch (level) {
					case "error":
						console.error(formatted);
						break;
					case "warn":
						console.warn(formatted);
						break;
					default:
						console.log(formatted);
				}
			}

			const client = getAxiomClient(getCredentials);
			const dataset = getAxiomDataset(getCredentials);
			if (client && dataset) {
				client.ingest(dataset, [logData]);
				if (level === "error") {
					await flushAxiom();
				}
			}
		}

		async function flushAxiom(): Promise<void> {
			const client = getAxiomClient(getCredentials);
			if (!client) return;
			await client.flush().catch(() => undefined);
		}

		return {
			info: (message: string, context: LogContext = {}) =>
				log("info", message, context),
			warn: (message: string, context: LogContext = {}) =>
				log("warn", message, context),
			error: (message: string, context: LogContext = {}) =>
				log("error", message, context),
			logError: (message: string, error: unknown, context: LogContext = {}) =>
				log("error", message, {
					...context,
					...normalizeError(error, isDevelopment()),
				}),
			withContext: (context: LogContext) =>
				createScopedLogger({ ...scopedContext, ...context }),
			flush: flushAxiom,
		};
	}

	return createScopedLogger();
}
