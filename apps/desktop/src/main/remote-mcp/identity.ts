import { randomBytes, randomUUID } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import {
	type DesktopTunnelIdentity,
	desktopTunnelIdentitySchema,
} from "@moat/contracts";

const IDENTITY_FILE = "remote-mcp-identity.json";

function identityPath(userDataPath: string): string {
	return path.join(userDataPath, IDENTITY_FILE);
}

export function readDesktopTunnelIdentity(
	userDataPath: string,
): DesktopTunnelIdentity | null {
	const filePath = identityPath(userDataPath);
	if (!fs.existsSync(filePath)) return null;
	try {
		const parsed = desktopTunnelIdentitySchema.safeParse(
			JSON.parse(fs.readFileSync(filePath, "utf8")),
		);
		return parsed.success ? parsed.data : null;
	} catch {
		return null;
	}
}

export function createDesktopTunnelIdentity(
	userDataPath: string,
): DesktopTunnelIdentity {
	const identity: DesktopTunnelIdentity = {
		deviceId: randomUUID(),
		publicTunnelId: `dv_${randomBytes(24).toString("base64url")}`,
	};
	fs.mkdirSync(userDataPath, { recursive: true });
	fs.writeFileSync(identityPath(userDataPath), JSON.stringify(identity), {
		mode: 0o600,
	});
	return identity;
}
