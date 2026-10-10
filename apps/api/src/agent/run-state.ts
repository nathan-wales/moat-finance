export type AgentRunStatus =
	| "queued"
	| "running"
	| "completed"
	| "failed"
	| "cancelled"
	| "waiting_for_user";

const ALLOWED_TRANSITIONS: Record<
	AgentRunStatus,
	ReadonlyArray<AgentRunStatus>
> = {
	queued: ["running", "cancelled", "failed"],
	running: ["completed", "failed", "cancelled", "waiting_for_user"],
	waiting_for_user: ["running", "cancelled"],
	completed: [],
	failed: [],
	cancelled: [],
};

export function assertValidTransition(
	from: AgentRunStatus,
	to: AgentRunStatus,
): void {
	if (!ALLOWED_TRANSITIONS[from].includes(to)) {
		throw new Error(`Invalid agent run status transition: ${from} -> ${to}`);
	}
}
