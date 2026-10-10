/** Reads `{ error: { message } }` from an API error body, or returns the fallback. */
export function getApiErrorMessage(data: unknown, fallback: string): string {
	if (typeof data !== "object" || data === null || !("error" in data)) {
		return fallback;
	}
	const error = data.error;
	if (typeof error !== "object" || error === null || !("message" in error)) {
		return fallback;
	}
	if (typeof error.message !== "string") {
		return fallback;
	}
	return error.message;
}
