export function getServerApiBaseUrl(): string {
	const configured =
		process.env.API_URL ?? process.env.NEXT_PUBLIC_API_URL ?? "";

	if (configured) return configured.replace(/\/$/, "");

	if (process.env.NODE_ENV === "development") {
		return "http://localhost:3001";
	}

	throw new Error("API_URL or NEXT_PUBLIC_API_URL must be set");
}
