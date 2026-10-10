import { InstancesClient } from "@google-cloud/compute";
import { isAcceptedStopStatus } from "@moat/domain";
import { taxLlmConfig } from "../config";
import { withTimeout } from "../with-timeout";

const METADATA_BASE = "http://metadata.google.internal/computeMetadata/v1";
const STOP_REQUEST_TIMEOUT_MS = 30_000;
const STOP_POLL_MS = 2_000;
const STOP_POLL_TIMEOUT_MS = 60_000;

export type WorkerInstanceIdentity = {
	projectId: string;
	zone: string;
	instanceName: string;
};

export function parseZoneFromMetadata(zonePath: string): string {
	const trimmed = zonePath.trim();
	const parts = trimmed.split("/").filter((part) => part.length > 0);
	const last = parts.at(-1);
	if (!last) {
		throw new Error("TAX_LLM_ZONE is required");
	}
	return last;
}

export function computeErrorName(error: unknown): string {
	if (error && typeof error === "object") {
		const rec = error as { status?: unknown; code?: unknown; name?: unknown };
		if (typeof rec.status === "string" && rec.status.trim()) return rec.status;
		if (typeof rec.code === "number") return `code_${rec.code}`;
		if (typeof rec.name === "string" && rec.name.trim()) return rec.name;
	}
	if (error instanceof Error && error.name.trim()) return error.name;
	return "unknown";
}

async function readMetadata(path: string): Promise<string | null> {
	try {
		const response = await withTimeout(
			fetch(`${METADATA_BASE}/${path}`, {
				headers: { "Metadata-Flavor": "Google" },
			}),
			3_000,
			"metadata",
		);
		if (!response.ok) return null;
		const text = (await response.text()).trim();
		return text || null;
	} catch {
		return null;
	}
}

export async function resolveWorkerInstanceIdentity(): Promise<WorkerInstanceIdentity> {
	const config = taxLlmConfig();
	const [projectId, zonePath, instanceName] = await Promise.all([
		readMetadata("project/project-id"),
		readMetadata("instance/zone"),
		readMetadata("instance/name"),
	]);
	return {
		projectId: projectId || config.projectId,
		zone: zonePath ? parseZoneFromMetadata(zonePath) : config.zone,
		instanceName: instanceName || config.instanceName,
	};
}

export async function stopThisInstance(): Promise<string> {
	const identity = await resolveWorkerInstanceIdentity();
	const instances = new InstancesClient({ fallback: "rest" });
	await withTimeout(
		instances.stop({
			project: identity.projectId,
			zone: identity.zone,
			instance: identity.instanceName,
		}),
		STOP_REQUEST_TIMEOUT_MS,
		"compute_stop_request",
	);

	const deadline = Date.now() + STOP_POLL_TIMEOUT_MS;
	while (Date.now() < deadline) {
		const [instance] = await withTimeout(
			instances.get({
				project: identity.projectId,
				zone: identity.zone,
				instance: identity.instanceName,
			}),
			10_000,
			"compute_stop_poll",
		);
		const status = instance.status ?? undefined;
		if (isAcceptedStopStatus(status)) {
			return status ?? "STOPPING";
		}
		await new Promise((resolve) => setTimeout(resolve, STOP_POLL_MS));
	}
	throw new Error("compute_stop_not_accepted");
}
