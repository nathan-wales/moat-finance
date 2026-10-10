import { repairSessionTokenUserId } from "@moat/shared";
import type { JWT } from "next-auth/jwt";

import { logger } from "~/lib/logger";
import { resolveSessionUserIdByEmail } from "./api-auth";

export async function repairPersistedSessionUser(token: JWT): Promise<void> {
	const result = await repairSessionTokenUserId(
		token,
		resolveSessionUserIdByEmail,
	);
	if (result.status === "repaired") {
		void logger.info("Repaired session user id", {
			feature: "auth",
			operation: "repairPersistedSessionUser",
			event: "session_user_id_repaired",
			userId: result.resolvedUserId,
			candidateIdKind: result.candidateIdKind,
		});
		return;
	}
	if (result.status === "unresolved") {
		void logger.warn("Could not repair session user id", {
			feature: "auth",
			operation: "repairPersistedSessionUser",
			event: "session_user_repair_unresolved",
			candidateIdKind: result.candidateIdKind,
		});
	}
}
