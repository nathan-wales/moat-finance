import fs from "node:fs";
import path from "node:path";

const SETTINGS_FILE = "remote-mcp-settings.json";

export type RemoteMcpSettings = {
	remoteMcpEnabled: boolean;
};

function settingsPath(userDataPath: string): string {
	return path.join(userDataPath, SETTINGS_FILE);
}

export function readRemoteMcpSettings(userDataPath: string): RemoteMcpSettings {
	const filePath = settingsPath(userDataPath);
	if (!fs.existsSync(filePath)) return { remoteMcpEnabled: false };
	try {
		const parsed: unknown = JSON.parse(fs.readFileSync(filePath, "utf8"));
		if (
			!parsed ||
			typeof parsed !== "object" ||
			!("remoteMcpEnabled" in parsed)
		) {
			return { remoteMcpEnabled: false };
		}
		const enabled = parsed.remoteMcpEnabled;
		if (typeof enabled !== "boolean") return { remoteMcpEnabled: false };
		return { remoteMcpEnabled: enabled };
	} catch {
		return { remoteMcpEnabled: false };
	}
}

export function writeRemoteMcpSettings(
	userDataPath: string,
	settings: RemoteMcpSettings,
): void {
	fs.mkdirSync(userDataPath, { recursive: true });
	fs.writeFileSync(settingsPath(userDataPath), JSON.stringify(settings), {
		mode: 0o600,
	});
}
