export const GOLDEN_BLOCKED_ENV = [
	"AXIOM_TOKEN",
	"AXIOM_DATASET",
	"CRON_SECRET",
] as const;

export const GOLDEN_PINNED_DATABASE_ENV = [
	"SERVICE_DATABASE_URL",
	"MOAT_APP_DATABASE_URL",
] as const;

/**
 * Prisma (and other dotenv loaders) can restore these after preload.
 * Call again after the first Prisma query and before enqueueing webhook jobs.
 */
export function blockGoldenSideEffectEnv(): void {
	for (const key of GOLDEN_BLOCKED_ENV) {
		delete process.env[key];
	}
}

export function pinGoldenDatabaseUrls(): void {
	blockGoldenSideEffectEnv();
	const databaseUrl = process.env.DATABASE_URL ?? process.env.DIRECT_URL;
	if (!databaseUrl) return;
	process.env.DATABASE_URL = databaseUrl;
	process.env.DIRECT_URL = process.env.DIRECT_URL ?? databaseUrl;
	for (const key of GOLDEN_PINNED_DATABASE_ENV) {
		process.env[key] = databaseUrl;
	}
}

export function assertGoldenDatabaseIsNotSharedNeon(): void {
	if (process.env.CI) return;
	const url = process.env.DATABASE_URL ?? process.env.DIRECT_URL ?? "";
	if (/neon\.(tech|build)/i.test(url)) {
		throw new Error(
			"Golden tests refuse Neon DATABASE_URL. Point DATABASE_URL and DIRECT_URL at local Postgres, e.g. postgresql://ci:ci@localhost:5432/moat_finance_ci?sslmode=disable",
		);
	}
}
