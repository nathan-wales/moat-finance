import {
	type ArgType,
	type ColumnType,
	ColumnTypeEnum,
	DriverAdapterError,
	type IsolationLevel,
	type Error as PrismaAdapterError,
	type SqlDriverAdapter,
	type SqlDriverAdapterFactory,
	type SqlQuery,
	type SqlResultSet,
	type Transaction,
	type TransactionOptions,
} from "@prisma/driver-adapter-utils";
import type { NativeSqliteDatabase } from "./encrypted-sqlite-connection";

const ADAPTER_NAME = "moat-sqlcipher";

type NativeRow = {
	length: number;
	[index: number]: null | string | number | bigint | ArrayBuffer | Buffer;
};

class Mutex {
	#locked = false;
	#queue: Array<() => void> = [];

	acquire(): Promise<() => void> {
		return new Promise((resolve) => {
			const tryAcquire = () => {
				if (this.#locked) {
					this.#queue.push(tryAcquire);
					return;
				}
				this.#locked = true;
				resolve(() => {
					this.#locked = false;
					const next = this.#queue.shift();
					next?.();
				});
			};
			tryAcquire();
		});
	}
}

function mapDeclType(declType: string | null): ColumnType | null {
	if (declType === null || declType === "") return null;
	switch (declType.toUpperCase()) {
		case "DECIMAL":
			return ColumnTypeEnum.Numeric;
		case "FLOAT":
			return ColumnTypeEnum.Float;
		case "DOUBLE":
		case "DOUBLE PRECISION":
		case "NUMERIC":
		case "REAL":
			return ColumnTypeEnum.Double;
		case "TINYINT":
		case "SMALLINT":
		case "MEDIUMINT":
		case "INT":
		case "INTEGER":
		case "SERIAL":
		case "INT2":
			return ColumnTypeEnum.Int32;
		case "BIGINT":
		case "UNSIGNED BIG INT":
		case "INT8":
			return ColumnTypeEnum.Int64;
		case "DATETIME":
		case "TIMESTAMP":
			return ColumnTypeEnum.DateTime;
		case "TIME":
			return ColumnTypeEnum.Time;
		case "DATE":
			return ColumnTypeEnum.Date;
		case "TEXT":
		case "CLOB":
		case "CHARACTER":
		case "VARCHAR":
		case "VARYING CHARACTER":
		case "NCHAR":
		case "NATIVE CHARACTER":
		case "NVARCHAR":
			return ColumnTypeEnum.Text;
		case "BLOB":
			return ColumnTypeEnum.Bytes;
		case "BOOLEAN":
			return ColumnTypeEnum.Boolean;
		case "JSONB":
			return ColumnTypeEnum.Json;
		default:
			return null;
	}
}

function inferColumnType(value: NonNullable<NativeRow[number]>): ColumnType {
	switch (typeof value) {
		case "string":
			return ColumnTypeEnum.Text;
		case "bigint":
			return ColumnTypeEnum.Int64;
		case "boolean":
			return ColumnTypeEnum.Boolean;
		case "number":
			return ColumnTypeEnum.UnknownNumber;
		case "object":
			if (value instanceof ArrayBuffer || Buffer.isBuffer(value)) {
				return ColumnTypeEnum.Bytes;
			}
			throw new Error("Unexpected SQLite value type");
		default:
			throw new Error("Unexpected SQLite value type");
	}
}

function getColumnTypes(
	declaredTypes: Array<string | null>,
	rows: NativeRow[],
): ColumnType[] {
	const empty = new Set<number>();
	const columnTypes = declaredTypes.map((typeName, index) => {
		const mapped = mapDeclType(typeName);
		if (mapped === null) empty.add(index);
		return mapped;
	});

	for (const columnIndex of empty) {
		let inferred: ColumnType | null = null;
		for (const row of rows) {
			const candidate = row[columnIndex];
			if (candidate !== null && candidate !== undefined) {
				inferred = inferColumnType(candidate);
				break;
			}
		}
		columnTypes[columnIndex] = inferred ?? ColumnTypeEnum.Int32;
	}

	return columnTypes as ColumnType[];
}

function mapRow(row: NativeRow, columnTypes: ColumnType[]): unknown[] {
	const result: unknown[] = [];
	for (let i = 0; i < row.length; i += 1) {
		const value = row[i];
		const columnType = columnTypes[i];
		if (value instanceof ArrayBuffer || Buffer.isBuffer(value)) {
			result[i] = Array.from(new Uint8Array(value));
			continue;
		}
		if (
			typeof value === "number" &&
			(columnType === ColumnTypeEnum.Int32 ||
				columnType === ColumnTypeEnum.Int64) &&
			!Number.isInteger(value)
		) {
			result[i] = Math.trunc(value);
			continue;
		}
		if (
			(typeof value === "number" || typeof value === "bigint") &&
			columnType === ColumnTypeEnum.DateTime
		) {
			result[i] = new Date(Number(value)).toISOString();
			continue;
		}
		if (typeof value === "bigint") {
			result[i] = value.toString();
			continue;
		}
		result[i] = value;
	}
	return result;
}

function isInactiveTransactionError(error: unknown): boolean {
	const message = error instanceof Error ? error.message : String(error);
	return /no transaction is active/i.test(message);
}

function mapArg(
	arg: unknown,
	argType: ArgType,
): null | number | bigint | Uint8Array | string | unknown {
	if (arg === null) return null;
	if (typeof arg === "string" && argType.scalarType === "int") {
		return Number.parseInt(arg, 10);
	}
	if (typeof arg === "string" && argType.scalarType === "float") {
		return Number.parseFloat(arg);
	}
	if (typeof arg === "string" && argType.scalarType === "decimal") {
		return Number.parseFloat(arg);
	}
	if (typeof arg === "string" && argType.scalarType === "bigint") {
		return BigInt(arg);
	}
	if (typeof arg === "boolean") return arg ? 1 : 0;
	let next = arg;
	if (typeof next === "string" && argType.scalarType === "datetime") {
		next = new Date(next);
	}
	if (next instanceof Date) {
		return next.toISOString().replace("Z", "+00:00");
	}
	if (typeof next === "string" && argType.scalarType === "bytes") {
		return Buffer.from(next, "base64");
	}
	if (Array.isArray(next) && argType.scalarType === "bytes") {
		return Buffer.from(next);
	}
	return next;
}

type DriverError = { code: string; message: string };

function isDriverError(error: unknown): error is DriverError {
	return (
		typeof error === "object" &&
		error !== null &&
		typeof (error as { code?: unknown }).code === "string" &&
		typeof (error as { message?: unknown }).message === "string"
	);
}

function convertDriverError(error: unknown): never {
	if (!isDriverError(error)) throw error;
	const mapped = mapSqliteError(error);
	throw new DriverAdapterError({
		...mapped,
		originalCode: error.code,
		originalMessage: error.message,
	});
}

function constraintFields(message: string): string[] | undefined {
	const fields = message
		.split("constraint failed: ")
		.at(1)
		?.split(", ")
		.map((field) => field.split(".").pop())
		.filter((field): field is string => typeof field === "string");
	return fields && fields.length > 0 ? fields : undefined;
}

function mapSqliteError(error: DriverError): PrismaAdapterError {
	switch (error.code) {
		case "SQLITE_BUSY":
			return { kind: "SocketTimeout" };
		case "SQLITE_CONSTRAINT_UNIQUE":
		case "SQLITE_CONSTRAINT_PRIMARYKEY": {
			const fields = constraintFields(error.message);
			return {
				kind: "UniqueConstraintViolation",
				constraint: fields ? { fields } : undefined,
			};
		}
		case "SQLITE_CONSTRAINT_NOTNULL": {
			const fields = constraintFields(error.message);
			return {
				kind: "NullConstraintViolation",
				constraint: fields ? { fields } : undefined,
			};
		}
		case "SQLITE_CONSTRAINT_FOREIGNKEY":
		case "SQLITE_CONSTRAINT_TRIGGER":
			return {
				kind: "ForeignKeyConstraintViolation",
				constraint: { foreignKey: {} },
			};
		default:
			if (error.message.startsWith("no such table")) {
				return {
					kind: "TableDoesNotExist",
					table: error.message.split(": ").at(1),
				};
			}
			if (error.message.startsWith("no such column")) {
				return {
					kind: "ColumnNotFound",
					column: error.message.split(": ").at(1),
				};
			}
			if (error.message.includes("has no column named ")) {
				return {
					kind: "ColumnNotFound",
					column: error.message.split("has no column named ").at(1),
				};
			}
			return {
				kind: "sqlite",
				extendedCode: 1,
				message: error.message,
			};
	}
}

class KeyedSqliteQueryable {
	readonly provider = "sqlite" as const;
	readonly adapterName = ADAPTER_NAME;

	constructor(protected readonly client: NativeSqliteDatabase) {}

	async queryRaw(query: SqlQuery): Promise<SqlResultSet> {
		try {
			const args = query.args.map((arg, i) => {
				const argType = query.argTypes[i];
				return argType ? mapArg(arg, argType) : arg;
			});
			const stmt = this.client.prepare(query.sql).bind(args);
			if (!stmt.reader) {
				stmt.run();
				return { columnNames: [], columnTypes: [], rows: [] };
			}
			const columns = stmt.columns() as Array<{
				name: string;
				type: string | null;
			}>;
			const values = stmt.raw().all() as NativeRow[];
			const columnTypes = getColumnTypes(
				columns.map((column) => column.type),
				values,
			);
			return {
				columnNames: columns.map((column) => column.name),
				columnTypes,
				rows: values.map((row) => mapRow(row, columnTypes)),
			};
		} catch (error) {
			convertDriverError(error);
		}
	}

	async executeRaw(query: SqlQuery): Promise<number> {
		try {
			const args = query.args.map((arg, i) => {
				const argType = query.argTypes[i];
				return argType ? mapArg(arg, argType) : arg;
			});
			const result = this.client.prepare(query.sql).bind(args).run();
			return Number(result.changes);
		} catch (error) {
			convertDriverError(error);
		}
	}
}

class KeyedSqliteTransaction
	extends KeyedSqliteQueryable
	implements Transaction
{
	readonly options: TransactionOptions;

	constructor(
		client: NativeSqliteDatabase,
		options: TransactionOptions,
		private readonly unlockParent: () => void,
		private readonly savepointName: string | null = null,
	) {
		super(client);
		this.options = options;
	}

	commit(): Promise<void> {
		try {
			if (this.savepointName) {
				this.client.prepare(`RELEASE SAVEPOINT ${this.savepointName}`).run();
			} else {
				this.client.prepare("COMMIT").run();
			}
		} catch (error) {
			if (!isInactiveTransactionError(error)) throw error;
		} finally {
			this.unlockParent();
		}
		return Promise.resolve();
	}

	rollback(): Promise<void> {
		try {
			if (this.savepointName) {
				this.client.prepare(`ROLLBACK TO ${this.savepointName}`).run();
				this.client.prepare(`RELEASE SAVEPOINT ${this.savepointName}`).run();
			} else {
				this.client.prepare("ROLLBACK").run();
			}
		} catch (error) {
			if (!isInactiveTransactionError(error)) throw error;
		} finally {
			this.unlockParent();
		}
		return Promise.resolve();
	}
}

export class KeyedSqliteAdapter
	extends KeyedSqliteQueryable
	implements SqlDriverAdapter
{
	#mutex = new Mutex();
	#savepointSeq = 0;

	executeScript(script: string): Promise<void> {
		try {
			this.client.exec(script);
		} catch (error) {
			convertDriverError(error);
		}
		return Promise.resolve();
	}

	async startTransaction(
		isolationLevel?: IsolationLevel,
	): Promise<Transaction> {
		if (isolationLevel && isolationLevel !== "SERIALIZABLE") {
			throw new DriverAdapterError({
				kind: "InvalidIsolationLevel",
				level: isolationLevel,
			});
		}
		const options: TransactionOptions = { usePhantomQuery: false };
		if (this.client.inTransaction) {
			this.#savepointSeq += 1;
			const savepointName = `moat_sp_${this.#savepointSeq}`;
			this.client.prepare(`SAVEPOINT ${savepointName}`).run();
			return new KeyedSqliteTransaction(
				this.client,
				options,
				() => {},
				savepointName,
			);
		}
		const release = await this.#mutex.acquire();
		try {
			this.client.prepare("BEGIN").run();
			return new KeyedSqliteTransaction(this.client, options, release);
		} catch (error) {
			release();
			convertDriverError(error);
		}
	}

	dispose(): Promise<void> {
		return Promise.resolve();
	}
}

export function createKeyedSqliteAdapterFactory(
	nativeDb: NativeSqliteDatabase,
): SqlDriverAdapterFactory {
	return {
		provider: "sqlite",
		adapterName: ADAPTER_NAME,
		connect(): Promise<SqlDriverAdapter> {
			return Promise.resolve(new KeyedSqliteAdapter(nativeDb));
		},
	};
}
