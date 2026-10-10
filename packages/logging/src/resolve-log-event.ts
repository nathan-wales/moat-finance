function slugifyEvent(value: string): string {
	const collapsed = value
		.toLowerCase()
		.replace(/[^a-z0-9]+/g, "_")
		.replace(/^_+|_+$/g, "");
	return collapsed || "client_log";
}

function looksLikeEventId(value: string): boolean {
	return /^[a-z][a-z0-9_.]+$/.test(value);
}

export function resolveLogEvent(message: string, event?: string): string {
	if (event) {
		return event.slice(0, 100);
	}

	const trimmedMessage = message.trim();
	if (looksLikeEventId(trimmedMessage)) {
		return trimmedMessage.slice(0, 100);
	}

	return slugifyEvent(trimmedMessage).slice(0, 100);
}
