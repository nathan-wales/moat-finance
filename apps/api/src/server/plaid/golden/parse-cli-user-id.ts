export function parseGoldenCliUserId(): string | undefined {
	return process.argv
		.slice(2)
		.find((arg) => arg !== "--" && !arg.startsWith("-"));
}

export function requireGoldenCliUserId(usage: string): string {
	const userId = parseGoldenCliUserId();
	if (!userId) {
		process.stderr.write(`${usage}\n`);
		throw new Error(usage);
	}
	return userId;
}
