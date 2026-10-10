import type { db as Db } from "~/server/db";
import { AgentToolCallStatus } from "../../../generated/prisma";

export type ToolCallStatus = "completed" | "skipped";

function toPrismaCompleteStatus(status: ToolCallStatus): AgentToolCallStatus {
	return status === "skipped"
		? AgentToolCallStatus.skipped
		: AgentToolCallStatus.completed;
}

export class ToolCallStore {
	constructor(private readonly db: typeof Db) {}

	async createToolCall(input: {
		runId: string;
		stepId?: string;
		toolCallId: string;
		toolName: string;
		input?: unknown;
	}) {
		return this.db.agentToolCall.create({
			data: {
				runId: input.runId,
				stepId: input.stepId ?? null,
				toolCallId: input.toolCallId,
				toolName: input.toolName,
				input: (input.input ?? undefined) as object | undefined,
				status: AgentToolCallStatus.running,
			},
		});
	}

	async completeToolCall(input: {
		id: string;
		output?: unknown;
		status?: ToolCallStatus;
	}) {
		await this.db.agentToolCall.update({
			where: { id: input.id },
			data: {
				status: toPrismaCompleteStatus(input.status ?? "completed"),
				output: (input.output ?? undefined) as object | undefined,
				completedAt: new Date(),
			},
		});
	}

	async failToolCall(input: { id: string; code?: string; error?: unknown }) {
		const message =
			input.error instanceof Error
				? input.error.message
				: input.error
					? String(input.error)
					: null;
		await this.db.agentToolCall.update({
			where: { id: input.id },
			data: {
				status: AgentToolCallStatus.failed,
				errorCode: input.code ?? null,
				errorMessage: message,
				completedAt: new Date(),
			},
		});
	}

	async cancelToolCall(input: { id: string; reason?: string }) {
		await this.db.agentToolCall.update({
			where: { id: input.id },
			data: {
				status: AgentToolCallStatus.cancelled,
				errorCode: "CANCELLED",
				errorMessage: input.reason ?? null,
				completedAt: new Date(),
			},
		});
	}
}
