import type { db as Db } from "~/server/db";
import { AgentRunStatus as PrismaAgentRunStatus } from "../../../generated/prisma";
import { type AgentRunStatus, assertValidTransition } from "../run-state";
import {
	MOAT_AGENT_VERSION,
	MOAT_PROMPT_VERSION,
	MOAT_STREAM_PROTOCOL_VERSION,
	MOAT_TOOL_REGISTRY_VERSION,
} from "../version";

export class RunStore {
	constructor(private readonly db: typeof Db) {}

	private async getCurrentStatus(runId: string): Promise<AgentRunStatus> {
		const run = await this.db.agentRun.findUnique({
			where: { id: runId },
			select: { status: true },
		});
		if (!run) throw new Error("Agent run not found");
		return fromPrismaRunStatus(run.status);
	}

	async createRun(input: {
		userId: string;
		householdId?: string;
		conversationId: string;
		clientRequestId?: string;
		kind?: "chat" | "widget_action";
		model?: string;
		provider?: string;
	}) {
		return this.db.agentRun.create({
			data: {
				userId: input.userId,
				householdId: input.householdId ?? null,
				conversationId: input.conversationId,
				clientRequestId: input.clientRequestId ?? null,
				status: PrismaAgentRunStatus.queued,
				kind: input.kind ?? "chat",
				model: input.model ?? null,
				provider: input.provider ?? null,
				agentVersion: MOAT_AGENT_VERSION,
				promptVersion: MOAT_PROMPT_VERSION,
				toolRegistryVersion: MOAT_TOOL_REGISTRY_VERSION,
				streamProtocolVersion: MOAT_STREAM_PROTOCOL_VERSION,
			},
		});
	}

	async findExistingByClientRequestId(input: {
		userId: string;
		clientRequestId: string;
	}) {
		return this.db.agentRun.findUnique({
			where: {
				userId_clientRequestId: {
					userId: input.userId,
					clientRequestId: input.clientRequestId,
				},
			},
		});
	}

	async markRunning(input: { runId: string }) {
		assertValidTransition(await this.getCurrentStatus(input.runId), "running");
		await this.db.agentRun.update({
			where: { id: input.runId },
			data: { status: PrismaAgentRunStatus.running, startedAt: new Date() },
		});
	}

	async completeRun(input: {
		runId: string;
		providerResponseId?: string;
		inputTokens?: number;
		outputTokens?: number;
	}) {
		assertValidTransition(
			await this.getCurrentStatus(input.runId),
			"completed",
		);
		await this.db.agentRun.update({
			where: { id: input.runId },
			data: {
				status: PrismaAgentRunStatus.completed,
				providerResponseId: input.providerResponseId ?? null,
				inputTokens: input.inputTokens ?? null,
				outputTokens: input.outputTokens ?? null,
				completedAt: new Date(),
			},
		});
	}

	async failRun(input: { runId: string; code?: string; error?: unknown }) {
		assertValidTransition(await this.getCurrentStatus(input.runId), "failed");
		const message =
			input.error instanceof Error
				? input.error.message
				: input.error
					? String(input.error)
					: null;
		await this.db.agentRun.update({
			where: { id: input.runId },
			data: {
				status: PrismaAgentRunStatus.failed,
				errorCode: input.code ?? null,
				errorMessage: message,
				completedAt: new Date(),
			},
		});
	}

	async cancelRun(input: { runId: string; reason?: string }) {
		assertValidTransition(
			await this.getCurrentStatus(input.runId),
			"cancelled",
		);
		await this.db.agentRun.update({
			where: { id: input.runId },
			data: {
				status: PrismaAgentRunStatus.cancelled,
				errorCode: "CANCELLED",
				errorMessage: input.reason ?? null,
				completedAt: new Date(),
				cancelledAt: new Date(),
			},
		});
	}
}

function fromPrismaRunStatus(status: PrismaAgentRunStatus): AgentRunStatus {
	switch (status) {
		case PrismaAgentRunStatus.queued:
			return "queued";
		case PrismaAgentRunStatus.running:
			return "running";
		case PrismaAgentRunStatus.completed:
			return "completed";
		case PrismaAgentRunStatus.failed:
			return "failed";
		case PrismaAgentRunStatus.cancelled:
			return "cancelled";
		case PrismaAgentRunStatus.waiting_for_user:
			return "waiting_for_user";
	}
}
