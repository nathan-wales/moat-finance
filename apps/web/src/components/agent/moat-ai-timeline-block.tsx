import type { LucideIcon } from "lucide-react";
import {
	CheckCircle2,
	LayoutDashboard,
	LineChart,
	Loader2,
	Receipt,
	TrendingUp,
	XCircle,
} from "lucide-react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import {
	ActionResultBlock,
	type MoatWidget,
	MoatWidgetRenderer,
	type WidgetActionSubmit,
} from "~/components/agent/moat-ai-widgets";
import { cn } from "~/lib/utils";

export type MoatAiTimelineBlock =
	| {
			id: string;
			type: "markdown";
			role: "user" | "assistant";
			content: string;
			tone?: "default" | "error";
			runId?: string;
			stepId?: string;
	  }
	| {
			id: string;
			type: "widget";
			role: "assistant";
			widget: MoatWidget;
			runId?: string;
			stepId?: string;
	  }
	| {
			id: string;
			type: "action_result";
			role: "assistant";
			actionType: string;
			summary: string;
			result?: unknown;
			runId?: string;
			stepId?: string;
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
	  };

type ToolDisplayConfig = {
	label: string;
	runningLabel: string;
	icon: LucideIcon;
};

const TOOL_CALL_DISPLAY_MAP: Record<string, ToolDisplayConfig> = {
	render_widget: {
		label: "Created widget",
		runningLabel: "Creating widget",
		icon: LayoutDashboard,
	},
	get_transactions: {
		label: "Reviewed transactions",
		runningLabel: "Reviewing transactions",
		icon: Receipt,
	},
	get_net_worth: {
		label: "Checked net worth",
		runningLabel: "Checking net worth",
		icon: TrendingUp,
	},
	get_net_worth_forecast: {
		label: "Forecasted net worth",
		runningLabel: "Forecasting net worth",
		icon: LineChart,
	},
	get_investments: {
		label: "Reviewed investments",
		runningLabel: "Reviewing investments",
		icon: TrendingUp,
	},
};

export function MoatAiTimelineBlockRenderer({
	block,
	onWidgetAction,
}: {
	block: MoatAiTimelineBlock;
	onWidgetAction?: WidgetActionSubmit;
}) {
	if (block.type === "widget") {
		return (
			<div className="min-w-0 max-w-[92%] flex-1">
				<MoatWidgetRenderer onSubmit={onWidgetAction} widget={block.widget} />
			</div>
		);
	}

	if (block.type === "action_result") {
		return (
			<div className="min-w-0 max-w-[92%] flex-1">
				<ActionResultBlock summary={block.summary} />
			</div>
		);
	}

	if (block.type === "run_step") {
		return <RunStepBlock block={block} />;
	}

	if (block.type === "tool_call") {
		return <ToolCallBlock block={block} />;
	}

	return <MarkdownBlock block={block} />;
}

function RunStepBlock(_props: {
	block: Extract<MoatAiTimelineBlock, { type: "run_step" }>;
}) {
	return null;
}

function ToolCallBlock({
	block,
}: {
	block: Extract<MoatAiTimelineBlock, { type: "tool_call" }>;
}) {
	const isRunning = block.status === "running";
	const isFailed = block.summary?.startsWith("status=error") ?? false;
	const config = TOOL_CALL_DISPLAY_MAP[block.toolName];
	const label = isRunning
		? (config?.runningLabel ?? block.displayName ?? block.toolName)
		: (config?.label ?? block.displayName ?? block.toolName);
	const Icon = config?.icon;

	return (
		<div className="flex justify-start">
			<div className="inline-flex max-w-[92%] items-center gap-2 rounded-md border bg-card px-2.5 py-1 text-xs">
				{isRunning ? (
					<Loader2 className="size-3 animate-spin text-muted-foreground" />
				) : Icon ? (
					<Icon className="size-3 text-muted-foreground" />
				) : (
					<CheckCircle2 className="size-3 text-muted-foreground" />
				)}
				<span className="font-medium">{label}</span>
				{!isRunning && isFailed ? (
					<span className="inline-flex items-center gap-1 text-destructive">
						<XCircle className="size-3" />
						<span>failed</span>
					</span>
				) : null}
			</div>
		</div>
	);
}

function MarkdownBlock({
	block,
}: {
	block: Extract<MoatAiTimelineBlock, { type: "markdown" }>;
}) {
	const isUser = block.role === "user";
	const isError = block.tone === "error";

	return (
		<div className={cn("flex", isUser && "flex-row-reverse")}>
			<div
				className={cn(
					"max-w-[82%] rounded-md px-3 py-2 text-sm leading-6",
					isUser
						? "bg-primary/80 text-primary-foreground"
						: "bg-card text-card-foreground",
					isError && "border-destructive/30 bg-destructive/10 text-destructive",
				)}
			>
				{isUser || isError ? (
					<div className="whitespace-pre-wrap break-words">{block.content}</div>
				) : (
					<div className="moat-ai-markdown break-words text-sm leading-6">
						<ReactMarkdown remarkPlugins={[remarkGfm]}>
							{block.content}
						</ReactMarkdown>
					</div>
				)}
			</div>
		</div>
	);
}
