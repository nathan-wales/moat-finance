import {
	buildAccountNameOverrideMap,
	resolveAccountDisplayName,
} from "@moat/domain";
import type { SqliteDbClient } from "./db-client";

export async function loadAccountNameOverrides(
	db: SqliteDbClient,
	userId: string,
): Promise<Map<string, string>> {
	const rows = await db.$queryRaw<{ accounts: string }[]>`
		SELECT "accounts" FROM "FinancialProfileData" WHERE "userId" = ${userId} LIMIT 1
	`;
	const raw = rows[0]?.accounts;
	if (!raw) return new Map();
	try {
		return buildAccountNameOverrideMap(JSON.parse(raw) as unknown);
	} catch {
		return new Map();
	}
}

export function applyAccountDisplayName(
	fallbackName: string | null,
	plaidAccountId: string | null | undefined,
	nameOverrides: Map<string, string>,
): string | null {
	if (!fallbackName) return null;
	if (!plaidAccountId) return fallbackName;
	return resolveAccountDisplayName(
		nameOverrides.get(plaidAccountId),
		fallbackName,
	);
}
