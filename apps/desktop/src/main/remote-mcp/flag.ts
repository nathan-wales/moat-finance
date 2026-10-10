import { DESKTOP_REMOTE_MCP_FEATURE_FLAG } from "@moat/contracts";
import { app } from "electron";
import { isMainProcessFeatureEnabled } from "../lib/analytics";
import { getCloudAuthIdentity } from "../lib/cloud-auth";

export async function isDesktopRemoteMcpEnabled(): Promise<boolean> {
	if (!app.isPackaged && process.env.MOAT_DESKTOP_REMOTE_MCP === "1") {
		return true;
	}
	const { userId, email } = getCloudAuthIdentity();
	if (!userId) return false;
	return isMainProcessFeatureEnabled(
		DESKTOP_REMOTE_MCP_FEATURE_FLAG,
		userId,
		email ? { email } : undefined,
	);
}
