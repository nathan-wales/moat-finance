import type { MoatWidgetActionType } from "../widgets/actions";
import type { MoatWidget } from "../widgets/types";

export type AgentTimelineBlock =
	| {
			id: string;
			type: "markdown";
			role: "user" | "assistant";
			content: string;
			runId?: string;
			stepId?: string;
			createdAt: string;
	  }
	| {
			id: string;
			type: "widget";
			role: "assistant";
			widget: MoatWidget;
			runId?: string;
			stepId?: string;
			createdAt: string;
	  }
	| {
			id: string;
			type: "action_result";
			role: "assistant";
			actionType: MoatWidgetActionType;
			summary: string;
			result?: unknown;
			runId?: string;
			stepId?: string;
			createdAt: string;
	  }
	| {
			id: string;
			type: "run_step";
			role: "assistant";
			stepType: "model_response" | "tool_execution" | "user_input_required";
			stepIndex: number;
			status: "running" | "completed";
			runId?: string;
			stepId?: string;
			createdAt: string;
	  }
	| {
			id: string;
			type: "tool_call";
			role: "assistant";
			toolCallId: string;
			toolName: string;
			displayName?: string;
			status: "running" | "completed";
			summary?: string;
			runId?: string;
			stepId?: string;
			createdAt: string;
	  };
