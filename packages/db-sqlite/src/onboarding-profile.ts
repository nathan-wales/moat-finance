import { randomUUID } from "node:crypto";
import type { SqliteDbClient } from "./db-client";

export type SqliteOnboardingProfile = {
	currentAge: number | null;
	retirementAge: number | null;
};

export async function getSqliteOnboardingProfile(
	db: SqliteDbClient,
	userId: string,
): Promise<SqliteOnboardingProfile> {
	const rows = await db.$queryRaw<
		Array<{ currentAge: number | null; retirementAge: number | null }>
	>`
		SELECT "currentAge", "retirementAge"
		FROM "UserSettings"
		WHERE "userId" = ${userId}
		LIMIT 1
	`;
	const row = rows[0];
	return {
		currentAge: row?.currentAge ?? null,
		retirementAge: row?.retirementAge ?? null,
	};
}

export async function saveSqliteOnboardingProfile(
	db: SqliteDbClient,
	userId: string,
	input: { currentAge?: number; retirementAge?: number },
): Promise<SqliteOnboardingProfile> {
	const existing = await db.$queryRaw<Array<{ id: string }>>`
		SELECT "id" FROM "UserSettings" WHERE "userId" = ${userId} LIMIT 1
	`;

	if (existing.length === 0) {
		await db.$executeRaw`
			INSERT INTO "UserSettings" (
				"id", "userId", "memoryEnabled", "currentAge", "retirementAge", "createdAt", "updatedAt"
			)
			VALUES (
				${randomUUID()},
				${userId},
				1,
				${input.currentAge ?? null},
				${input.retirementAge ?? null},
				CURRENT_TIMESTAMP,
				CURRENT_TIMESTAMP
			)
		`;
		return getSqliteOnboardingProfile(db, userId);
	}

	if (input.currentAge !== undefined) {
		await db.$executeRaw`
			UPDATE "UserSettings"
			SET "currentAge" = ${input.currentAge}, "updatedAt" = CURRENT_TIMESTAMP
			WHERE "userId" = ${userId}
		`;
	}
	if (input.retirementAge !== undefined) {
		await db.$executeRaw`
			UPDATE "UserSettings"
			SET "retirementAge" = ${input.retirementAge}, "updatedAt" = CURRENT_TIMESTAMP
			WHERE "userId" = ${userId}
		`;
	}

	return getSqliteOnboardingProfile(db, userId);
}
