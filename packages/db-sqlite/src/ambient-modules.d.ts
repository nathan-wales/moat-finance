declare module "better-sqlite3-multiple-ciphers" {
	import Database from "better-sqlite3";
	export = Database;
}

declare module "node:sqlite" {
	export class DatabaseSync {
		constructor(path: string);
		prepare(sql: string): { get(): unknown };
		close(): void;
	}
}
