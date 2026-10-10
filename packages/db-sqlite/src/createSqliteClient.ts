import fs from "node:fs";
import path from "node:path";
import type { SqliteDbClient } from "./db-client";
import { createKeyedSqliteAdapterFactory } from "./encrypted-prisma-adapter";
import {
	MOAT_SQLITE_USER_VERSION,
	type NativeSqliteDatabase,
	openEncryptedSqliteConnection,
} from "./encrypted-sqlite-connection";

function getElectronResourcesPath(): string | null {
	const resourcesPath = (
		process as NodeJS.Process & { resourcesPath?: unknown }
	).resourcesPath;
	return typeof resourcesPath === "string" && resourcesPath.length > 0
		? resourcesPath
		: null;
}

function hasQueryEngine(clientDir: string): boolean {
	try {
		return fs
			.readdirSync(clientDir)
			.some(
				(name) =>
					name.startsWith("libquery_engine") ||
					name.startsWith("query_engine") ||
					name.endsWith(".node") ||
					name.endsWith(".dll.node"),
			);
	} catch {
		return false;
	}
}

function isUsableClientDir(candidate: string): boolean {
	return (
		fs.existsSync(path.join(candidate, "index.js")) && hasQueryEngine(candidate)
	);
}

const REQUIRED_PRISMA_DELEGATES = [
	"memory",
	"retirementPlan",
	"retirementScenario",
	"retirementScenarioLever",
	"retirementStandingRule",
	"retirementSpendingCategoryPlan",
] as const;

function assertGeneratedClientHasModels(client: object): void {
	const missing = REQUIRED_PRISMA_DELEGATES.filter((key) => !(key in client));
	if (missing.length === 0) return;

	throw new Error(
		`SQLite Prisma client is missing ${missing.join(", ")}. ` +
			"Run `pnpm --filter @moat/db-sqlite run db:generate` and restart the desktop app.",
	);
}

function resolveGeneratedClientDir(): string {
	const electronResourcesPath = getElectronResourcesPath();
	const candidates = [
		electronResourcesPath
			? path.join(electronResourcesPath, "prisma-client")
			: null,
		electronResourcesPath
			? path.join(
					electronResourcesPath,
					"app.asar.unpacked",
					"node_modules",
					"@moat",
					"db-sqlite",
					"src",
					"generated",
					"client",
				)
			: null,
		electronResourcesPath
			? path.join(
					electronResourcesPath,
					"app.asar",
					"node_modules",
					"@moat",
					"db-sqlite",
					"src",
					"generated",
					"client",
				)
			: null,
		path.resolve(__dirname, "generated/client"),
		path.resolve(process.cwd(), "packages/db-sqlite/src/generated/client"),
		path.resolve(
			process.cwd(),
			"../../packages/db-sqlite/src/generated/client",
		),
		path.resolve(
			__dirname,
			"../../node_modules/@moat/db-sqlite/src/generated/client",
		),
		path.resolve(
			__dirname,
			"../../../../packages/db-sqlite/src/generated/client",
		),
	].filter((candidate): candidate is string => candidate !== null);

	for (const candidate of candidates) {
		if (isUsableClientDir(candidate)) {
			return candidate;
		}
	}

	throw new Error(
		`Unable to locate generated Prisma client with query engine. Checked: ${candidates.join(", ")}`,
	);
}

export type CreateSqliteClientOptions = {
	key: Buffer;
	nativeBinding?: string;
	fileMustExist?: boolean;
};

export type SqliteClientHandle = {
	client: SqliteDbClient;
	nativeDb: NativeSqliteDatabase;
	close: () => Promise<void>;
};

export function createSqliteClientHandle(
	dbPath: string,
	options: CreateSqliteClientOptions,
): SqliteClientHandle {
	process.env.DATABASE_URL = `file:${dbPath}`;

	const nativeDb = openEncryptedSqliteConnection(dbPath, options.key, {
		fileMustExist: options.fileMustExist,
		nativeBinding: options.nativeBinding,
	});
	const currentUserVersion = Number(
		nativeDb.pragma("user_version", { simple: true }) ?? 0,
	);
	if (currentUserVersion === 0) {
		nativeDb.pragma(`user_version = ${MOAT_SQLITE_USER_VERSION}`);
	}

	const clientDir = resolveGeneratedClientDir();
	// Dynamic require so the native query engine binary resolves next to the
	// generated client at runtime (not bundled into the main process).
	const { PrismaClient } = require(clientDir) as {
		PrismaClient: new (options: {
			adapter: ReturnType<typeof createKeyedSqliteAdapterFactory>;
		}) => SqliteDbClient;
	};

	const client = new PrismaClient({
		adapter: createKeyedSqliteAdapterFactory(nativeDb),
	});
	assertGeneratedClientHasModels(client);

	return {
		client,
		nativeDb,
		async close() {
			await client.$disconnect();
			if (nativeDb.open) {
				nativeDb.close();
			}
		},
	};
}

export function createSqliteClient(
	dbPath: string,
	options: CreateSqliteClientOptions,
): SqliteDbClient {
	return createSqliteClientHandle(dbPath, options).client;
}
