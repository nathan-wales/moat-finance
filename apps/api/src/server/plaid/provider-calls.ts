import { logger } from "~/lib/logger";
import type { ProviderEndpointCall } from "~/server/services/sync-types";

type LogProviderCallInput = {
	endpoint: string;
	costCategory: ProviderEndpointCall["costCategory"];
	durationMs: number;
	status: "success" | "error";
	userId?: string;
	plaidItemDbId?: string;
	operation?: string;
};

export async function trackPlaidProviderCall<T>(input: {
	endpoint: string;
	costCategory: ProviderEndpointCall["costCategory"];
	userId?: string;
	plaidItemDbId?: string;
	operation?: string;
	callLog?: ProviderEndpointCall[];
	fn: () => Promise<T>;
}): Promise<T> {
	const startedAt = Date.now();
	try {
		const result = await input.fn();
		const entry: ProviderEndpointCall = {
			endpoint: input.endpoint,
			costCategory: input.costCategory,
			durationMs: Date.now() - startedAt,
			status: "success",
		};
		input.callLog?.push(entry);
		logProviderCall({
			...input,
			durationMs: entry.durationMs,
			status: "success",
		});
		return result;
	} catch (error) {
		const entry: ProviderEndpointCall = {
			endpoint: input.endpoint,
			costCategory: input.costCategory,
			durationMs: Date.now() - startedAt,
			status: "error",
		};
		input.callLog?.push(entry);
		logProviderCall({
			...input,
			durationMs: entry.durationMs,
			status: "error",
		});
		throw error;
	}
}

function logProviderCall(input: LogProviderCallInput) {
	logger.info("Provider API call completed", {
		feature: "plaid",
		operation: input.operation ?? "providerCall",
		endpoint: input.endpoint,
		costCategory: input.costCategory,
		durationMs: input.durationMs,
		status: input.status,
		userId: input.userId,
		itemId: input.plaidItemDbId,
	});
}
