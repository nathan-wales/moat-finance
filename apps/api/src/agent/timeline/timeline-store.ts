import type { db as Db } from "~/server/db";
import type { MoatWidgetActionType } from "../widgets/actions";
import { moatWidgetSchema } from "../widgets/schemas";
import type { MoatWidget } from "../widgets/types";
import type { AgentTimelineBlock } from "./types";

type TimelineRole = "user" | "assistant";

function optionalString(value: string | null): string | undefined {
	return value ?? undefined;
}

function toTimelineBlock(row: {
	id: string;
	role: string;
	type: string;
	content: string | null;
	data: unknown;
	runId: string | null;
	stepId: string | null;
	createdAt: Date;
}): AgentTimelineBlock | null {
	const createdAt = row.createdAt.toISOString();
	const runId = optionalString(row.runId);
	const stepId = optionalString(row.stepId);

	if (row.type === "markdown") {
		if (row.role !== "user" && row.role !== "assistant") return null;
		return {
			id: row.id,
			type: "markdown",
			role: row.role,
			content: row.content ?? "",
			runId,
			stepId,
			createdAt,
		};
	}

	if (row.type === "widget") {
		const parsed = moatWidgetSchema.safeParse(row.data);
		if (!parsed.success) return null;
		return {
			id: row.id,
			type: "widget",
			role: "assistant",
			widget: parsed.data,
			runId,
			stepId,
			createdAt,
		};
	}

	if (row.type === "action_result") {
		const data = row.data;
		if (!data || typeof data !== "object") return null;
		const record = data as Record<string, unknown>;
		if (typeof record.actionType !== "string") return null;
		if (typeof record.summary !== "string") return null;
		return {
			id: row.id,
			type: "action_result",
			role: "assistant",
			actionType: record.actionType as MoatWidgetActionType,
			summary: record.summary,
			result: record.result,
			runId,
			stepId,
			createdAt,
		};
	}

	if (row.type === "run_step") {
		const data = row.data;
		if (!data || typeof data !== "object") return null;
		const record = data as Record<string, unknown>;
		if (
			record.stepType !== "model_response" &&
			record.stepType !== "tool_execution" &&
			record.stepType !== "user_input_required"
		) {
			return null;
		}
		if (typeof record.stepIndex !== "number") return null;
		if (record.status !== "running" && record.status !== "completed")
			return null;
		return {
			id: row.id,
			type: "run_step",
			role: "assistant",
			stepType: record.stepType,
			stepIndex: record.stepIndex,
			status: record.status,
			runId,
			stepId,
			createdAt,
		};
	}

	if (row.type === "tool_call") {
		const data = row.data;
		if (!data || typeof data !== "object") return null;
		const record = data as Record<string, unknown>;
		if (typeof record.toolCallId !== "string") return null;
		if (typeof record.toolName !== "string") return null;
		if (record.status !== "running" && record.status !== "completed")
			return null;
		return {
			id: row.id,
			type: "tool_call",
			role: "assistant",
			toolCallId: record.toolCallId,
			toolName: record.toolName,
			displayName:
				typeof record.displayName === "string" ? record.displayName : undefined,
			status: record.status,
			summary: typeof record.summary === "string" ? record.summary : undefined,
			runId,
			stepId,
			createdAt,
		};
	}

	return null;
}

export class TimelineStore {
	constructor(private readonly db: typeof Db) {}

	async createMarkdownBlock(input: {
		conversationId: string;
		role: TimelineRole;
		content: string;
		runId?: string;
		stepId?: string;
	}): Promise<AgentTimelineBlock> {
		const row = await this.db.agentTimelineBlock.create({
			data: {
				conversationId: input.conversationId,
				role: input.role,
				type: "markdown",
				content: input.content,
				runId: input.runId ?? null,
				stepId: input.stepId ?? null,
			},
		});
		return {
			id: row.id,
			type: "markdown",
			role: input.role,
			content: row.content ?? "",
			runId: optionalString(row.runId),
			stepId: optionalString(row.stepId),
			createdAt: row.createdAt.toISOString(),
		};
	}

	async appendAssistantMarkdownDelta(input: {
		conversationId: string;
		content: string;
		runId?: string;
		stepId?: string;
	}): Promise<void> {
		const existing = await this.db.agentTimelineBlock.findFirst({
			where: {
				conversationId: input.conversationId,
				role: "assistant",
				type: "markdown",
				runId: input.runId ?? null,
				stepId: input.stepId ?? null,
			},
			orderBy: { createdAt: "desc" },
		});

		if (!existing) {
			await this.createMarkdownBlock({
				conversationId: input.conversationId,
				role: "assistant",
				content: input.content,
				runId: input.runId,
				stepId: input.stepId,
			});
			return;
		}

		await this.db.agentTimelineBlock.update({
			where: { id: existing.id },
			data: { content: `${existing.content ?? ""}${input.content}` },
		});
	}

	async createWidgetBlock(input: {
		conversationId: string;
		widget: MoatWidget;
		runId?: string;
		stepId?: string;
	}): Promise<AgentTimelineBlock> {
		const widget = moatWidgetSchema.parse(input.widget);
		const row = await this.db.agentTimelineBlock.create({
			data: {
				conversationId: input.conversationId,
				role: "assistant",
				type: "widget",
				data: widget as object,
				runId: input.runId ?? null,
				stepId: input.stepId ?? null,
			},
		});
		return {
			id: row.id,
			type: "widget",
			role: "assistant",
			widget,
			runId: optionalString(row.runId),
			stepId: optionalString(row.stepId),
			createdAt: row.createdAt.toISOString(),
		};
	}

	async createActionResultBlock(input: {
		conversationId: string;
		actionType: MoatWidgetActionType;
		summary: string;
		result?: unknown;
		runId?: string;
		stepId?: string;
	}): Promise<AgentTimelineBlock> {
		const row = await this.db.agentTimelineBlock.create({
			data: {
				conversationId: input.conversationId,
				role: "assistant",
				type: "action_result",
				data: {
					actionType: input.actionType,
					summary: input.summary,
					result: input.result ?? null,
				},
				runId: input.runId ?? null,
				stepId: input.stepId ?? null,
			},
		});
		return {
			id: row.id,
			type: "action_result",
			role: "assistant",
			actionType: input.actionType,
			summary: input.summary,
			result: input.result,
			runId: optionalString(row.runId),
			stepId: optionalString(row.stepId),
			createdAt: row.createdAt.toISOString(),
		};
	}

	async createRunStepBlock(input: {
		conversationId: string;
		runId: string;
		stepId: string;
		stepIndex: number;
		stepType: "model_response" | "tool_execution" | "user_input_required";
		status: "running" | "completed";
	}): Promise<AgentTimelineBlock> {
		const row = await this.db.agentTimelineBlock.create({
			data: {
				conversationId: input.conversationId,
				role: "assistant",
				type: "run_step",
				data: {
					stepIndex: input.stepIndex,
					stepType: input.stepType,
					status: input.status,
				},
				runId: input.runId,
				stepId: input.stepId,
			},
		});
		return {
			id: row.id,
			type: "run_step",
			role: "assistant",
			stepIndex: input.stepIndex,
			stepType: input.stepType,
			status: input.status,
			runId: input.runId,
			stepId: input.stepId,
			createdAt: row.createdAt.toISOString(),
		};
	}

	async updateRunStepBlock(input: {
		conversationId: string;
		runId: string;
		stepId: string;
		stepIndex: number;
		stepType: "model_response" | "tool_execution" | "user_input_required";
		status: "running" | "completed";
	}) {
		await this.db.agentTimelineBlock.updateMany({
			where: {
				conversationId: input.conversationId,
				runId: input.runId,
				stepId: input.stepId,
				type: "run_step",
			},
			data: {
				data: {
					stepIndex: input.stepIndex,
					stepType: input.stepType,
					status: input.status,
				},
			},
		});
	}

	async createToolCallBlock(input: {
		conversationId: string;
		runId: string;
		stepId: string;
		toolCallId: string;
		toolName: string;
		displayName?: string;
		status: "running" | "completed";
		summary?: string;
	}): Promise<AgentTimelineBlock> {
		const row = await this.db.agentTimelineBlock.create({
			data: {
				conversationId: input.conversationId,
				role: "assistant",
				type: "tool_call",
				data: {
					toolCallId: input.toolCallId,
					toolName: input.toolName,
					displayName: input.displayName ?? null,
					status: input.status,
					summary: input.summary ?? null,
				},
				runId: input.runId,
				stepId: input.stepId,
			},
		});
		return {
			id: row.id,
			type: "tool_call",
			role: "assistant",
			toolCallId: input.toolCallId,
			toolName: input.toolName,
			displayName: input.displayName,
			status: input.status,
			summary: input.summary,
			runId: input.runId,
			stepId: input.stepId,
			createdAt: row.createdAt.toISOString(),
		};
	}

	async updateToolCallBlock(input: {
		conversationId: string;
		runId: string;
		stepId: string;
		toolCallId: string;
		toolName: string;
		displayName?: string;
		status: "running" | "completed";
		summary?: string;
	}) {
		const rows = await this.db.agentTimelineBlock.findMany({
			where: {
				conversationId: input.conversationId,
				runId: input.runId,
				stepId: input.stepId,
				type: "tool_call",
			},
			orderBy: { createdAt: "desc" },
			take: 50,
		});

		const existing = rows.find((row) => {
			const data = row.data;
			return (
				data &&
				typeof data === "object" &&
				(data as Record<string, unknown>).toolCallId === input.toolCallId
			);
		});

		if (!existing) {
			await this.createToolCallBlock(input);
			return;
		}

		await this.db.agentTimelineBlock.update({
			where: { id: existing.id },
			data: {
				data: {
					toolCallId: input.toolCallId,
					toolName: input.toolName,
					displayName: input.displayName ?? null,
					status: input.status,
					summary: input.summary ?? null,
				},
			},
		});
	}

	async listConversationTimeline(input: {
		conversationId: string;
		limit?: number;
	}): Promise<AgentTimelineBlock[]> {
		const rows = await this.db.agentTimelineBlock.findMany({
			where: { conversationId: input.conversationId },
			orderBy: { createdAt: "asc" },
			take: input.limit ?? 200,
		});
		return rows.flatMap((row) => {
			const block = toTimelineBlock(row);
			return block ? [block] : [];
		});
	}

	async findWidgetBlock(input: { conversationId: string; widgetId: string }) {
		const rows = await this.db.agentTimelineBlock.findMany({
			where: {
				conversationId: input.conversationId,
				type: "widget",
			},
			orderBy: { createdAt: "desc" },
			take: 200,
		});

		for (const row of rows) {
			const parsed = moatWidgetSchema.safeParse(row.data);
			if (parsed.success && parsed.data.id === input.widgetId) {
				return { row, widget: parsed.data };
			}
		}

		return null;
	}
}
