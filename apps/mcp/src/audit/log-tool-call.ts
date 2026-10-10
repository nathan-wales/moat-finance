import { createHmac } from "node:crypto";
import { getMcpToolContract, type McpScope } from "@moat/mcp-contracts";
import type { McpAuthContext } from "~/auth/types";
import { getTokenPepper } from "~/config/env";
import { capture } from "~/lib/analytics";
import { logger } from "~/lib/logger";
import {
	durationBucket,
	getMcpAnalyticsTransport,
	getToolDomain,
	isWriteTool,
} from "~/lib/mcp-analytics-props";
import { withMcpUserActor } from "~/lib/with-user-actor";
import type { Prisma } from "../../../api/generated/prisma";

export type McpToolCallStatus = "success" | "error" | "denied" | "rate_limited";

function hashInput(input: unknown): string {
	return createHmac("sha256", getTokenPepper())
		.update(JSON.stringify(input ?? {}))
		.digest("hex");
}

function summarizePrimitive(value: unknown): Prisma.InputJsonValue | undefined {
	if (value === undefined || value === null) return undefined;
	if (typeof value === "boolean") return { kind: "boolean" };
	if (typeof value === "number") return { kind: "number" };
	if (typeof value === "string")
		return { kind: "string", length: value.length };
	if (value instanceof Date) return { kind: "date" };
	return undefined;
}

function summarizeValue(value: unknown): Prisma.InputJsonValue | undefined {
	const primitiveSummary = summarizePrimitive(value);
	if (primitiveSummary) return primitiveSummary;

	if (Array.isArray(value)) {
		return { kind: "array", count: value.length };
	}
	if (value && typeof value === "object") {
		const summary: Record<string, Prisma.InputJsonValue> = {};
		for (const [key, nestedValue] of Object.entries(value)) {
			const nestedSummary = summarizePrimitive(nestedValue);
			if (nestedSummary) {
				summary[key] = nestedSummary;
			} else if (Array.isArray(nestedValue)) {
				summary[key] = { kind: "array", count: nestedValue.length };
			} else if (typeof nestedValue === "object") {
				summary[key] = { kind: "object" };
			}
		}
		return summary;
	}
	return undefined;
}

export async function logToolCall(input: {
	context: McpAuthContext;
	toolName: string;
	requiredScopes: readonly McpScope[];
	toolInput: unknown;
	output: unknown;
	status: McpToolCallStatus;
	durationMs: number;
	errorCode?: string;
	rateLimited?: boolean;
}): Promise<void> {
	const outputSummary = summarizeValue(input.output);
	const inputSummary = summarizeValue(input.toolInput);

	try {
		// Audit rows are owned by the token actor (PAT/OAuth consenting user),
		// matching listMcpLogs and connection ownership. Writes must run under
		// a user DB actor — outside that context FORCE RLS rejects the insert.
		await withMcpUserActor({
			userId: input.context.userId,
			actorUserId: input.context.actorUserId,
			callback: async () => {
				await input.context.db.mcpToolCall.create({
					data: {
						userId: input.context.actorUserId,
						householdId: input.context.householdId,
						personalAccessTokenId: input.context.personalAccessTokenId,
						oauthAccessTokenId: input.context.oauthAccessTokenId,
						oauthClientId: input.context.oauthClientId,
						clientName: input.context.clientName,
						clientProfile: input.context.clientProfile,
						toolName: input.toolName,
						requiredScopes: [...input.requiredScopes],
						grantedScopes: input.context.scopes,
						inputHash: hashInput(input.toolInput),
						inputSummary: inputSummary === undefined ? undefined : inputSummary,
						outputSummary:
							outputSummary === undefined ? undefined : outputSummary,
						status: input.status,
						durationMs: input.durationMs,
						errorCode: input.errorCode,
						rateLimited: input.rateLimited ?? false,
					},
				});
			},
		});
	} catch (error) {
		logger.logError("Failed to write MCP audit log", error, {
			feature: "mcp",
			operation: "auditToolCall",
			userId: input.context.actorUserId,
			toolName: input.toolName,
			authKind: input.context.authKind,
		});
	}

	logger.info("MCP tool call completed", {
		feature: "mcp",
		operation: "toolCall",
		userId: input.context.userId,
		clientName: input.context.clientName,
		clientProfile: input.context.clientProfile,
		toolName: input.toolName,
		status: input.status,
		durationMs: input.durationMs,
		errorCode: input.errorCode,
	});

	const contract = getMcpToolContract(input.toolName);
	capture(
		"mcp_tool_invoked",
		{ userId: input.context.userId },
		{
			client_profile: input.context.clientProfile,
			auth_kind: input.context.authKind,
			tool_name: input.toolName,
			tool_domain: getToolDomain(input.toolName),
			safety_class: contract?.safetyClass ?? "unknown",
			status: input.status,
			is_write: isWriteTool(contract?.safetyClass),
			duration_bucket: durationBucket(input.durationMs),
			rate_limited: input.rateLimited ?? false,
			transport: getMcpAnalyticsTransport(),
		},
	);
}
