const ALLOWED = new Set([
	"worker starting",
	"model healthy",
	"job queued",
	"job processing",
	"job completed",
	"worker idle",
	"worker shutting down",
	"ensure running",
	"enqueue accepted",
]);

export function taxLlmLog(
	message: string,
	context: Record<string, string | number | boolean | null | undefined> = {},
): void {
	const safe = Object.fromEntries(
		Object.entries(context).filter(
			([key, value]) =>
				value !== undefined &&
				!/text|prompt|payload|ssn|ein|cipher|key|token|body|response/i.test(
					key,
				),
		),
	);
	process.stdout.write(
		`${JSON.stringify({
			severity: "INFO",
			message,
			feature: "tax-llm",
			allowed: ALLOWED.has(message),
			...safe,
		})}\n`,
	);
}

export function taxLlmWarn(
	message: string,
	context: Record<string, string | number | boolean | null | undefined> = {},
): void {
	process.stderr.write(
		`${JSON.stringify({
			severity: "WARNING",
			message,
			feature: "tax-llm",
			errorName: context.errorName,
			status: context.status,
			jobId: context.jobId,
			operation: context.operation,
		})}\n`,
	);
}
