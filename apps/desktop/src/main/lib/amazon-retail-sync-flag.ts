import { AMAZON_RETAIL_SYNC_FEATURE_FLAG } from "@moat/contracts";
import { isMainProcessFeatureEnabled } from "./analytics";
import { getCloudAuthIdentity } from "./cloud-auth";

export async function isAmazonRetailSyncEnabled(): Promise<boolean> {
	const { userId, email } = getCloudAuthIdentity();
	if (!userId) return false;
	return isMainProcessFeatureEnabled(
		AMAZON_RETAIL_SYNC_FEATURE_FLAG,
		userId,
		email ? { email } : undefined,
	);
}
