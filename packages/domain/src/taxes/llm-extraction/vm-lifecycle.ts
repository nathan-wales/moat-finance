export type ComputeInstanceStatus =
	| "PROVISIONING"
	| "STAGING"
	| "RUNNING"
	| "STOPPING"
	| "SUSPENDING"
	| "SUSPENDED"
	| "REPAIRING"
	| "TERMINATED"
	| "UNKNOWN";

export type EnsureWorkerDecision =
	| { action: "noop"; reason: "already-running" | "already-starting" }
	| { action: "start"; reason: "terminated" | "suspended" }
	| { action: "wait-then-start"; reason: "stopping" }
	| { action: "wait"; reason: "repairing" | "unknown" };

export function normalizeComputeStatus(
	status: string | undefined,
): ComputeInstanceStatus {
	switch (status) {
		case "PROVISIONING":
		case "STAGING":
		case "RUNNING":
		case "STOPPING":
		case "SUSPENDING":
		case "SUSPENDED":
		case "REPAIRING":
		case "TERMINATED":
			return status;
		default:
			return "UNKNOWN";
	}
}

export function decideEnsureWorkerAction(
	status: string | undefined,
): EnsureWorkerDecision {
	const normalized = normalizeComputeStatus(status);
	if (normalized === "RUNNING") {
		return { action: "noop", reason: "already-running" };
	}
	if (normalized === "PROVISIONING" || normalized === "STAGING") {
		return { action: "noop", reason: "already-starting" };
	}
	if (normalized === "TERMINATED") {
		return { action: "start", reason: "terminated" };
	}
	if (normalized === "SUSPENDED") {
		return { action: "start", reason: "suspended" };
	}
	if (normalized === "STOPPING" || normalized === "SUSPENDING") {
		return { action: "wait-then-start", reason: "stopping" };
	}
	if (normalized === "REPAIRING") {
		return { action: "wait", reason: "repairing" };
	}
	return { action: "wait", reason: "unknown" };
}

export function createIdleDeadline(nowMs: number, idleMs: number): number {
	return nowMs + idleMs;
}

export function isIdle(input: {
	nowMs: number;
	idleDeadlineMs: number;
	inFlightCount: number;
}): boolean {
	return input.inFlightCount === 0 && input.nowMs >= input.idleDeadlineMs;
}

export function isAcceptedStopStatus(status: string | undefined): boolean {
	const normalized = normalizeComputeStatus(status);
	return normalized === "STOPPING" || normalized === "TERMINATED";
}

export function shouldStartAfterEnsure(input: {
	action: EnsureWorkerDecision["action"];
	requireRecentEnqueue: boolean;
	enqueuedAtMs: number | null;
	nowMs: number;
	windowMs: number;
}): boolean {
	if (input.action !== "start") return false;
	if (!input.requireRecentEnqueue) return true;
	if (input.enqueuedAtMs === null) return false;
	return input.nowMs - input.enqueuedAtMs <= input.windowMs;
}
