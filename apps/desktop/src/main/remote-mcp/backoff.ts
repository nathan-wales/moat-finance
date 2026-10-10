const BACKOFF_STEPS_MS = [1_000, 2_000, 4_000, 8_000, 15_000, 30_000, 60_000];

export const REMOTE_MCP_STABLE_CONNECTION_MS = 30_000;

export function backoffDelayMs(attempt: number, random: () => number): number {
	const index = Math.min(Math.max(attempt, 0), BACKOFF_STEPS_MS.length - 1);
	const base = BACKOFF_STEPS_MS[index] ?? 60_000;
	const jitter = (random() * 2 - 1) * 0.2;
	return Math.max(0, Math.round(base * (1 + jitter)));
}

export function interruptibleSleep(
	ms: number,
	signal: AbortSignal,
): Promise<void> {
	if (signal.aborted) return Promise.resolve();
	return new Promise((resolve) => {
		const timer = setTimeout(finish, ms);
		function finish() {
			clearTimeout(timer);
			signal.removeEventListener("abort", finish);
			resolve();
		}
		signal.addEventListener("abort", finish, { once: true });
	});
}
