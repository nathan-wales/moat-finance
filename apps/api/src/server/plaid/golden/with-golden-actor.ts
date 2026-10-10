import { serviceDatabaseActor, withDatabaseActor } from "~/server/db-actor";

export function withGoldenActor<T>(fn: () => Promise<T>): Promise<T> {
	return withDatabaseActor(serviceDatabaseActor(), () => fn(), {
		timeoutMs: 180_000,
	});
}
