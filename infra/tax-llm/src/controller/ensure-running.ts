import { InstancesClient } from "@google-cloud/compute";
import {
	decideEnsureWorkerAction,
	normalizeComputeStatus,
	shouldStartAfterEnsure,
	TAX_LLM_WATCHDOG_START_WINDOW_MS,
} from "@moat/domain";
import { taxLlmConfig } from "../config";
import { taxLlmLog, taxLlmWarn } from "../safe-log";

const instances = new InstancesClient({ fallback: "rest" });

export async function getWorkerStatus(): Promise<string | undefined> {
	const config = taxLlmConfig();
	const [instance] = await instances.get({
		project: config.projectId,
		zone: config.zone,
		instance: config.instanceName,
	});
	return instance.status ?? undefined;
}

export async function startWorkerInstance(): Promise<void> {
	const config = taxLlmConfig();
	await instances.start({
		project: config.projectId,
		zone: config.zone,
		instance: config.instanceName,
	});
}

export async function stopWorkerInstance(): Promise<void> {
	const config = taxLlmConfig();
	await instances.stop({
		project: config.projectId,
		zone: config.zone,
		instance: config.instanceName,
	});
}

async function sleep(ms: number): Promise<void> {
	await new Promise((resolve) => setTimeout(resolve, ms));
}

function parseEnqueuedAtMs(value: unknown): number | null {
	if (typeof value !== "number" || !Number.isFinite(value) || value <= 0) {
		return null;
	}
	return value;
}

export async function ensureTaxLlmWorkerRunning(
	input: { requireRecentEnqueue?: boolean; enqueuedAtMs?: unknown } = {},
): Promise<{
	status: string;
	action: string;
}> {
	const requireRecentEnqueue = input.requireRecentEnqueue === true;
	const enqueuedAtMs = parseEnqueuedAtMs(input.enqueuedAtMs);
	const nowMs = Date.now();
	let status = await getWorkerStatus();
	let decision = decideEnsureWorkerAction(status);

	if (
		requireRecentEnqueue &&
		(decision.action === "start" || decision.action === "wait-then-start") &&
		!shouldStartAfterEnsure({
			action: "start",
			requireRecentEnqueue: true,
			enqueuedAtMs,
			nowMs,
			windowMs: TAX_LLM_WATCHDOG_START_WINDOW_MS,
		})
	) {
		taxLlmLog("ensure running", {
			operation: "noop-stale-watchdog",
			status: normalizeComputeStatus(status),
		});
		return { status: status ?? "UNKNOWN", action: "noop" };
	}

	if (decision.action === "wait-then-start") {
		for (let attempt = 0; attempt < 30; attempt += 1) {
			await sleep(2000);
			status = await getWorkerStatus();
			decision = decideEnsureWorkerAction(status);
			if (decision.action !== "wait-then-start") break;
		}
	}
	if (decision.action === "wait" || decision.action === "wait-then-start") {
		taxLlmWarn("ensure running", {
			operation: "ensureTaxLlmWorkerRunning",
			status: normalizeComputeStatus(status),
		});
		throw new Error("Worker instance is not startable");
	}
	if (
		shouldStartAfterEnsure({
			action: decision.action,
			requireRecentEnqueue,
			enqueuedAtMs,
			nowMs: Date.now(),
			windowMs: TAX_LLM_WATCHDOG_START_WINDOW_MS,
		})
	) {
		await startWorkerInstance();
		taxLlmLog("ensure running", {
			operation: "start",
			status: normalizeComputeStatus(status),
		});
		return { status: "STARTING", action: "start" };
	}
	taxLlmLog("ensure running", {
		operation: decision.reason,
		status: normalizeComputeStatus(status),
	});
	return { status: status ?? "UNKNOWN", action: "noop" };
}
