import { CLIENT_LOG_CHANNELS } from "@moat/contracts";
import { clientLogBodySchema } from "@moat/logging";
import { ipcMain } from "electron";
import { remoteLogger } from "../lib/remote-logger";

export function registerClientLogHandlers(): void {
	ipcMain.handle(CLIENT_LOG_CHANNELS.ingest, async (_event, raw: unknown) => {
		const parsed = clientLogBodySchema.safeParse(raw);
		if (!parsed.success) return { status: "ignored" as const };

		const input = parsed.data;
		const context = {
			event: input.event,
			feature: input.feature,
			operation: input.operation,
			metadata: input.metadata,
		};

		switch (input.level) {
			case "error":
				remoteLogger.error(input.message, context);
				break;
			case "warn":
				remoteLogger.warn(input.message, context);
				break;
			default:
				remoteLogger.info(input.message, context);
		}

		return { status: "queued" as const };
	});
}
