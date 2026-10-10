import type { db as Db } from "~/server/db";
import {
	AgentRunStepStatus,
	type AgentRunStepType,
} from "../../../generated/prisma";

export type StepType =
	| "model_response"
	| "tool_execution"
	| "user_input_required";

function toPrismaType(type: StepType): AgentRunStepType {
	return type as AgentRunStepType;
}

export class RunStepStore {
	constructor(private readonly db: typeof Db) {}

	async createStep(input: {
		runId: string;
		stepIndex: number;
		type: StepType;
		input?: unknown;
	}) {
		return this.db.agentRunStep.create({
			data: {
				runId: input.runId,
				stepIndex: input.stepIndex,
				type: toPrismaType(input.type),
				status: AgentRunStepStatus.running,
				input: (input.input ?? undefined) as object | undefined,
			},
		});
	}

	async completeStep(input: {
		stepId: string;
		output?: unknown;
		providerResponseId?: string;
	}) {
		await this.db.agentRunStep.update({
			where: { id: input.stepId },
			data: {
				status: AgentRunStepStatus.completed,
				output: (input.output ?? undefined) as object | undefined,
				providerResponseId: input.providerResponseId ?? null,
				completedAt: new Date(),
			},
		});
	}

	async failStep(input: { stepId: string; code?: string; error?: unknown }) {
		const message =
			input.error instanceof Error
				? input.error.message
				: input.error
					? String(input.error)
					: null;
		await this.db.agentRunStep.update({
			where: { id: input.stepId },
			data: {
				status: AgentRunStepStatus.failed,
				errorCode: input.code ?? null,
				errorMessage: message,
				completedAt: new Date(),
			},
		});
	}

	async cancelStep(input: { stepId: string; reason?: string }) {
		await this.db.agentRunStep.update({
			where: { id: input.stepId },
			data: {
				status: AgentRunStepStatus.cancelled,
				errorCode: "CANCELLED",
				errorMessage: input.reason ?? null,
				completedAt: new Date(),
			},
		});
	}
}
