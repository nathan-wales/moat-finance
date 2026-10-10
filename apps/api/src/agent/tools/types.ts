import type { z } from "zod";

export type MoatToolCapability =
	| "read:transactions"
	| "read:net_worth"
	| "read:investments"
	| "write:transactions"
	| "write:rules"
	| "write:budget"
	| "read:scenarios"
	| "write:scenarios"
	| "external:web"
	| "execute:python";

export type ToolSafetyClass =
	| "read_only_app_data"
	| "mutates_app_data"
	| "mutates_user_financial_data"
	| "external_network"
	| "sandboxed_code_execution"
	| "unsafe_disabled";

export type MoatToolExecutionContext = {
	userId: string;
	householdId?: string;
	conversationId: string;
	runId: string;
	stepId: string;
	abortSignal?: AbortSignal;
	emit?: (event: import("../events").MoatStreamEvent) => void | Promise<void>;
};

export type ToolExecutionContext = MoatToolExecutionContext;

export type MoatToolDefinition<TInput = unknown, TOutput = unknown> = {
	name: string;
	displayName: string;
	description: string;
	enabled: boolean;
	capabilities: MoatToolCapability[];
	safetyClass: ToolSafetyClass;
	inputSchema: z.ZodType<TInput>;
	outputSchema?: z.ZodType<TOutput>;
	requiresConfirmation?: boolean;
	execute(input: TInput, context: MoatToolExecutionContext): Promise<TOutput>;
};

export type ToolExecutionResult =
	| {
			status: "success";
			data: unknown;
			summary?: string;
	  }
	| {
			status: "needs_user_input";
			questions: string[];
	  }
	| {
			status: "needs_confirmation";
			confirmationId: string;
			summary: string;
			preview: unknown;
	  }
	| {
			status: "error";
			message: string;
	  };
