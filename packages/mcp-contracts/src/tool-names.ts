/**
 * Cursor (and some other MCP hosts) sanitize tool names to `[a-zA-Z0-9_]`,
 * rewriting `moat.getProfileSummary` → `moat_getProfileSummary` for discovery
 * and `tools/call`. Advertise both forms so those hosts keep working.
 *
 * ChatGPT / OpenAI plugin review lists every registered name. Exposing the
 * underscore alias there looks like a duplicate tool, so skip it for that profile.
 */
export function toClientCompatibleToolName(canonicalName: string): string {
	return canonicalName.replaceAll(".", "_");
}

export function getAdvertisedToolNames(
	canonicalName: string,
	options?: { includeCompatibleAlias?: boolean },
): string[] {
	const compatible = toClientCompatibleToolName(canonicalName);
	if (
		options?.includeCompatibleAlias === false ||
		compatible === canonicalName
	) {
		return [canonicalName];
	}
	return [canonicalName, compatible];
}
