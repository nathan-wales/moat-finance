import path from "node:path";
import { Worker } from "node:worker_threads";
import { RetirementComputeAbortedError } from "@moat/domain";
import type { RetirementComputeJob } from "@moat/domain/retirement-compute";
import type {
	ComputeWorkerRequest,
	ComputeWorkerResponse,
} from "./compute-protocol";

export type WorkerLike = {
	postMessage: (message: ComputeWorkerRequest) => void;
	on: (
		event: "message" | "error" | "exit",
		listener: (...args: never[]) => void,
	) => void;
	off?: (
		event: "message" | "error" | "exit",
		listener: (...args: never[]) => void,
	) => void;
	terminate: () => Promise<number>;
};

export type RetirementComputeQueueHooks = {
	createWorker?: () => WorkerLike;
};

type Slot = {
	id: number;
	kind: RetirementComputeJob["kind"];
	job: RetirementComputeJob;
	resolve: (value: unknown) => void;
	reject: (error: unknown) => void;
};

function defaultWorkerPath(): string {
	return path.join(__dirname, "compute-worker.js");
}

export class RetirementComputeQueue {
	private readonly createWorker: () => WorkerLike;
	private worker: WorkerLike | null = null;
	private nextId = 1;
	private inFlight: Slot | null = null;
	private pending: Slot[] = [];
	private readonly onMessage = (message: ComputeWorkerResponse) => {
		this.handleMessage(message);
	};
	private readonly onError = (error: Error) => {
		this.failInFlight(error);
		this.drain();
	};

	constructor(hooks: RetirementComputeQueueHooks = {}) {
		this.createWorker =
			hooks.createWorker ??
			(() => new Worker(defaultWorkerPath()) as unknown as WorkerLike);
	}

	run<T>(job: RetirementComputeJob): Promise<T> {
		return new Promise<T>((resolve, reject) => {
			this.enqueue({
				id: this.nextId,
				kind: job.kind,
				job,
				resolve: (value) => resolve(value as T),
				reject,
			});
			this.nextId += 1;
		});
	}

	async stop(): Promise<void> {
		const worker = this.worker;
		this.worker = null;
		if (this.inFlight) {
			this.inFlight.reject(new RetirementComputeAbortedError());
			this.inFlight = null;
		}
		for (const slot of this.pending) {
			slot.reject(new RetirementComputeAbortedError());
		}
		this.pending = [];
		if (worker) await worker.terminate();
	}

	private enqueue(slot: Slot): void {
		this.pending = this.pending.filter((queued) => {
			if (queued.kind !== slot.kind) return true;
			queued.reject(new RetirementComputeAbortedError());
			return false;
		});
		this.pending.push(slot);
		if (this.inFlight?.kind === slot.kind) {
			this.abortInFlight();
			return;
		}
		this.drain();
	}

	private drain(): void {
		if (this.inFlight) return;
		const next = this.pending.shift();
		if (!next) return;
		this.inFlight = next;
		this.ensureWorker().postMessage({
			type: "run",
			id: next.id,
			job: next.job,
		});
	}

	private abortInFlight(): void {
		const current = this.inFlight;
		if (!current || !this.worker) return;
		this.worker.postMessage({ type: "abort", id: current.id });
	}

	private ensureWorker(): WorkerLike {
		if (this.worker) return this.worker;
		const worker = this.createWorker();
		worker.on("message", this.onMessage as (...args: never[]) => void);
		worker.on("error", this.onError as (...args: never[]) => void);
		this.worker = worker;
		return worker;
	}

	private handleMessage(message: ComputeWorkerResponse): void {
		const current = this.inFlight;
		if (!current || current.id !== message.id) return;
		this.inFlight = null;
		if (message.type === "result") {
			current.resolve(message.result);
		} else if (message.type === "aborted") {
			current.reject(new RetirementComputeAbortedError());
		} else {
			const error = new Error(message.message);
			error.name = message.name;
			current.reject(error);
		}
		this.drain();
	}

	private failInFlight(error: Error): void {
		const current = this.inFlight;
		this.inFlight = null;
		current?.reject(error);
	}
}

let sharedQueue: RetirementComputeQueue | null = null;

export function getRetirementComputeQueue(): RetirementComputeQueue {
	sharedQueue ??= new RetirementComputeQueue();
	return sharedQueue;
}

export async function stopRetirementComputeQueue(): Promise<void> {
	const queue = sharedQueue;
	sharedQueue = null;
	if (queue) await queue.stop();
}
