import { db } from "~/server/db";
import { blockGoldenSideEffectEnv } from "./block-side-effect-env";

export async function postgresAvailable(): Promise<boolean> {
	if (!process.env.DATABASE_URL) return false;
	try {
		await db.$queryRaw`SELECT 1`;
		return true;
	} catch {
		return false;
	} finally {
		blockGoldenSideEffectEnv();
	}
}
