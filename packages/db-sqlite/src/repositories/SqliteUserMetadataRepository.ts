import { randomUUID } from "node:crypto";
import type { UserMetadataRepository } from "@moat/data-access";
import type { SqliteDbClient } from "../db-client";

type UserMetadataRow = {
	id: string;
	userId: string;
	key: string;
	valueJson: string;
};

export class SqliteUserMetadataRepository implements UserMetadataRepository {
	constructor(private db: SqliteDbClient) {}

	async get(input: { userId: string; key: string }): Promise<string | null> {
		const row = (await this.db.userMetadata.findUnique({
			where: {
				userId_key: {
					userId: input.userId,
					key: input.key,
				},
			},
		})) as UserMetadataRow | null;
		return row?.valueJson ?? null;
	}

	async upsert(input: {
		userId: string;
		key: string;
		valueJson: string;
	}): Promise<void> {
		await this.db.userMetadata.upsert({
			where: {
				userId_key: {
					userId: input.userId,
					key: input.key,
				},
			},
			update: { valueJson: input.valueJson },
			create: {
				id: randomUUID(),
				userId: input.userId,
				key: input.key,
				valueJson: input.valueJson,
			},
		});
	}

	async delete(input: { userId: string; key: string }): Promise<void> {
		await this.db.userMetadata.deleteMany({
			where: {
				userId: input.userId,
				key: input.key,
			},
		});
	}
}
