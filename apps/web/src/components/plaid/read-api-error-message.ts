export function readApiErrorMessage(data: unknown, fallback: string): string {
	if (typeof data !== "object" || data === null || !("error" in data)) {
		return fallback;
	}
	const error = (data as { error?: unknown }).error;
	if (typeof error === "string") return error;
	if (
		typeof error === "object" &&
		error !== null &&
		"message" in error &&
		typeof (error as { message?: unknown }).message === "string"
	) {
		return (error as { message: string }).message;
	}
	return fallback;
}
