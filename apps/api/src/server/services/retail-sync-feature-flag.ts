import { AMAZON_RETAIL_SYNC_FEATURE_FLAG } from "@moat/contracts";
import type { PrismaClient } from "../../../generated/prisma";
import {
	evaluateFeatureFlag,
	type FeatureFlagClient,
} from "../lib/posthog-flags";

export async function isAmazonRetailSyncEnabled(input: {
	userId: string;
	db?: PrismaClient;
	client?: FeatureFlagClient | null;
}): Promise<boolean> {
	const db = input.db;
	return evaluateFeatureFlag(AMAZON_RETAIL_SYNC_FEATURE_FLAG, input.userId, {
		client: input.client,
		resolveEmail: db
			? async () => {
					const user = await db.user.findUnique({
						where: { id: input.userId },
						select: { email: true },
					});
					return user?.email ?? undefined;
				}
			: undefined,
	});
}
