import {
	catalogsMatch,
	type NativeSqliteDatabase,
	openEncryptedSqliteConnection,
	snapshotSqliteCatalog,
} from "@moat/db-sqlite";

const CRITICAL_TABLES = [
	"Transaction",
	"Account",
	"PlaidItem",
	"Category",
	"TransactionRule",
	"RetirementPlan",
	"NotificationRule",
	"_MoatSchemaFlag",
] as const;

export function validateEncryptedCatalog(params: {
	expected: ReturnType<typeof snapshotSqliteCatalog>;
	actual: ReturnType<typeof snapshotSqliteCatalog>;
}): void {
	if (!catalogsMatch(params.expected, params.actual)) {
		throw new Error("Encrypted database catalog does not match the source.");
	}
	for (const table of CRITICAL_TABLES) {
		if (
			params.expected.rowCounts[table] !== undefined &&
			params.actual.rowCounts[table] !== params.expected.rowCounts[table]
		) {
			throw new Error(`Encrypted database row count mismatch for ${table}.`);
		}
	}
}

export function integrityCheck(db: NativeSqliteDatabase): void {
	const result = db.pragma("integrity_check", { simple: true });
	if (result !== "ok") {
		throw new Error("Encrypted database failed integrity check.");
	}
}

export function validateEncryptedCandidate(params: {
	dbPath: string;
	key: Buffer;
	expected: ReturnType<typeof snapshotSqliteCatalog>;
	nativeBinding?: string;
}): void {
	const db = openEncryptedSqliteConnection(params.dbPath, params.key, {
		fileMustExist: true,
		nativeBinding: params.nativeBinding,
	});
	try {
		integrityCheck(db);
		const actual = snapshotSqliteCatalog(db);
		validateEncryptedCatalog({ expected: params.expected, actual });
	} finally {
		if (db.open) db.close();
	}
}
