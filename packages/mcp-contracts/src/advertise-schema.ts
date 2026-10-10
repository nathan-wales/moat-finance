import { z } from "zod";

const optionalProfileIdSchema = z
	.string()
	.min(1)
	.optional()
	.describe(
		"Profile to read. The server checks that this account owns it. Omit to use the token's current profile.",
	);

/**
 * MCP SDK `normalizeObjectSchema` only advertises ZodObject `.shape`.
 * `.refine()` / `.superRefine()` wrap schemas in ZodEffects, which causes
 * tools/list to fall back to an empty object schema. Unwrap for advertising
 * while keeping the full refined schema for runtime `.parse()`.
 *
 * Read tools advertise an optional `profileId`. Runtime parsing strips that
 * key before the tool schema runs, then verifies ownership separately, so a
 * client-supplied id never becomes the query scope on its own.
 */
export function getAdvertisedInputSchema(
	schema: z.ZodTypeAny,
	options?: { includeProfileId?: boolean },
): z.ZodTypeAny {
	let current: z.ZodTypeAny = schema;

	while (isZodEffects(current)) {
		const inner = current._def.schema as z.ZodTypeAny | undefined;
		if (!inner) break;
		current = inner;
	}

	if (options?.includeProfileId && current instanceof z.ZodObject) {
		return current.extend({ profileId: optionalProfileIdSchema });
	}

	return current;
}

function isZodEffects(
	schema: z.ZodTypeAny,
): schema is z.ZodTypeAny & { _def: { typeName: string; schema: unknown } } {
	const def = schema._def as
		| { typeName?: string; schema?: unknown }
		| undefined;
	return Boolean(def && def.typeName === "ZodEffects" && def.schema);
}
