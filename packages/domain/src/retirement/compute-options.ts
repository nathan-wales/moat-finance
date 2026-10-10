export class RetirementComputeAbortedError extends Error {
	readonly name = "RetirementComputeAbortedError";
	constructor() {
		super("Retirement compute was aborted");
	}
}

export type RetirementComputeProgress = {
	completed: number;
	total: number;
};

export type RetirementComputeOptions = {
	yieldEvery?: number;
	signal?: AbortSignal;
	onProgress?: (progress: RetirementComputeProgress) => void;
	yieldFn?: () => Promise<void>;
};

export const DEFAULT_MONTE_CARLO_YIELD_EVERY = 32;

export function isRetirementComputeAborted(error: unknown): boolean {
	return error instanceof RetirementComputeAbortedError;
}

export function throwIfComputeAborted(signal?: AbortSignal): void {
	if (signal?.aborted) throw new RetirementComputeAbortedError();
}

export function defaultComputeYield(): Promise<void> {
	return new Promise((resolve) => {
		setImmediate(resolve);
	});
}
