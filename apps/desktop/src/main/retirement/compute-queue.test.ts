import assert from "node:assert/strict";
import { EventEmitter } from "node:events";
import { describe, it } from "node:test";
import { RetirementComputeAbortedError } from "@moat/domain";
import type { RetirementComputeJob } from "@moat/domain/retirement-compute";
import type {
	ComputeWorkerRequest,
	ComputeWorkerResponse,
} from "./compute-protocol";
import { RetirementComputeQueue, type WorkerLike } from "./compute-queue";

class FakeWorker extends EventEmitter {
	readonly messages: ComputeWorkerRequest[] = [];
	private hangUntilAbort = false;

	postMessage(message: ComputeWorkerRequest): void {
		this.messages.push(message);
		if (message.type === "abort") {
			this.hangUntilAbort = false;
			this.emit("message", {
				type: "aborted",
				id: message.id,
			} satisfies ComputeWorkerResponse);
			return;
		}
		if (message.type !== "run") return;
		if (this.hangUntilAbort) return;
		queueMicrotask(() => {
			this.emit("message", {
				type: "result",
				id: message.id,
				result: { kind: message.job.kind, id: message.id },
			} satisfies ComputeWorkerResponse);
		});
	}

	hang(): void {
		this.hangUntilAbort = true;
	}

	async terminate(): Promise<number> {
		return 0;
	}
}

function stubJob(kind: RetirementComputeJob["kind"]): RetirementComputeJob {
	return { kind, payload: { id: kind } } as unknown as RetirementComputeJob;
}

describe("RetirementComputeQueue", () => {
	it("replaces an in-flight job of the same kind", async () => {
		const worker = new FakeWorker();
		worker.hang();
		const queue = new RetirementComputeQueue({
			createWorker: () => worker as unknown as WorkerLike,
		});
		const first = queue.run(stubJob("monteCarlo"));
		await Promise.resolve();
		const second = queue.run(stubJob("monteCarlo"));
		await assert.rejects(first, (error: unknown) => {
			return error instanceof RetirementComputeAbortedError;
		});
		const result = await second;
		assert.equal((result as { kind: string }).kind, "monteCarlo");
		assert.equal(
			worker.messages.filter((message) => message.type === "abort").length,
			1,
		);
		await queue.stop();
	});

	it("serializes different kinds instead of aborting them", async () => {
		const worker = new FakeWorker();
		const queue = new RetirementComputeQueue({
			createWorker: () => worker as unknown as WorkerLike,
		});
		const first = queue.run(stubJob("monteCarlo"));
		const second = queue.run(stubJob("opportunities"));
		const [monteCarlo, opportunities] = await Promise.all([first, second]);
		assert.equal((monteCarlo as { kind: string }).kind, "monteCarlo");
		assert.equal((opportunities as { kind: string }).kind, "opportunities");
		assert.equal(
			worker.messages.filter((message) => message.type === "abort").length,
			0,
		);
		await queue.stop();
	});

	it("surfaces worker failures", async () => {
		const worker = new FakeWorker();
		worker.postMessage = (message: ComputeWorkerRequest) => {
			if (message.type !== "run") return;
			queueMicrotask(() => {
				worker.emit("message", {
					type: "error",
					id: message.id,
					message: "boom",
					name: "Error",
				} satisfies ComputeWorkerResponse);
			});
		};
		const queue = new RetirementComputeQueue({
			createWorker: () => worker as unknown as WorkerLike,
		});
		await assert.rejects(queue.run(stubJob("stressTests")), /boom/);
		await queue.stop();
	});
});
