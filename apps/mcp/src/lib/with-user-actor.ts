import {
	isDatabaseActorContextEnabled,
	userDatabaseActor,
	withDatabaseActor,
} from "../../../api/src/server/db-actor";
import { mcpPrismaBase } from "./db";

/**
 * Runs authenticated MCP work as the token's user actor so FORCE RLS
 * WITH CHECK policies succeed for tenant-owned rows (e.g. audit logs).
 */
export async function withMcpUserActor<T>(input: {
	userId: string;
	actorUserId: string;
	callback: () => Promise<T>;
}): Promise<T> {
	if (!isDatabaseActorContextEnabled()) return input.callback();

	return withDatabaseActor(
		userDatabaseActor({
			userId: input.userId,
			actorUserId: input.actorUserId,
		}),
		async () => input.callback(),
		{ client: mcpPrismaBase },
	);
}
