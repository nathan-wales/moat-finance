import { parentPort } from "node:worker_threads";
import {
	RetirementComputeAbortedError,
	type RetirementComputeJob,
	runRetirementComputeJob,
} from "@moat/domain/retirement-compute";
import type {
	ComputeWorkerRequest,
	ComputeWorkerResponse,
} from "./compute-protocol";

if (parentPort === null) {
	throw new Error("Retirement compute worker must run as a worker thread");
}

const port = parentPort;
let currentId: number | null = null;
let currentAbort: AbortController | null = null;

port.on("message", (message: ComputeWorkerRequest) => {
	if (message.type === "abort") {
		if (currentId === message.id) currentAbort?.abort();
		return;
	}

	if (message.type !== "run") return;
	void runJob(message.id, message.job);
});

async function runJob(id: number, job: RetirementComputeJob): Promise<void> {
	currentAbort?.abort();
	const abort = new AbortController();
	currentId = id;
	currentAbort = abort;
	try {
		const result = await runRetirementComputeJob(job, {
			signal: abort.signal,
		});
		if (abort.signal.aborted) {
			port.postMessage({ type: "aborted", id } satisfies ComputeWorkerResponse);
			return;
		}
		port.postMessage({
			type: "result",
			id,
			result,
		} satisfies ComputeWorkerResponse);
	} catch (error) {
		if (
			error instanceof RetirementComputeAbortedError ||
			abort.signal.aborted
		) {
			port.postMessage({ type: "aborted", id } satisfies ComputeWorkerResponse);
			return;
		}
		const failure = error instanceof Error ? error : new Error(String(error));
		port.postMessage({
			type: "error",
			id,
			message: failure.message,
			name: failure.name,
		} satisfies ComputeWorkerResponse);
	} finally {
		if (currentId === id) {
			currentId = null;
			currentAbort = null;
		}
	}
}
