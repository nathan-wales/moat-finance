export function normalizeError(
	error: unknown,
	includeStack = process.env.NODE_ENV === "development",
): {
	errorMessage: string;
	errorCode?: string;
	stack?: string;
} {
	if (error instanceof Error) {
		return {
			errorMessage: error.message,
			errorCode: (error as { code?: string }).code,
			stack: includeStack ? error.stack : undefined,
		};
	}

	if (typeof error === "string") {
		return { errorMessage: error };
	}

	return { errorMessage: "Unknown error" };
}
