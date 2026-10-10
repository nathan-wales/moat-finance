export type TaxLlmInlineWaitOutcome = "completed" | "failed" | "wait";

export function taxLlmInlineWaitOutcome(job: {
	status: string | null | undefined;
	lastErrorCode: string | null | undefined;
}): TaxLlmInlineWaitOutcome {
	if (job.status === "COMPLETED") return "completed";
	if (job.status === "FAILED") return "failed";
	if (!job.status || job.status === "missing") return "failed";
	if (job.lastErrorCode && job.lastErrorCode !== "MODEL_STARTING") {
		return "failed";
	}
	return "wait";
}
