import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import {
	DEFAULT_LOCAL_MCP_SERVER_NAME,
	mergeClaudeDesktopMcpConfig,
} from "@moat/mcp-contracts";
import { app } from "electron";

export type ClaudeInstallResult =
	| {
			ok: true;
			configPath: string;
			backupPath: string | null;
			createdConfigFile: boolean;
	  }
	| {
			ok: false;
			error: string;
	  };

function backupPathFor(configPath: string): string {
	const stamp = new Date().toISOString().replace(/[:.]/g, "-");
	return `${configPath}.moat-backup-${stamp}`;
}

export function claudeDesktopConfigPath(): string {
	if (process.platform === "darwin") {
		return path.join(
			os.homedir(),
			"Library",
			"Application Support",
			"Claude",
			"claude_desktop_config.json",
		);
	}
	if (process.platform === "win32") {
		const appData = process.env.APPDATA ?? app.getPath("appData");
		return path.join(appData, "Claude", "claude_desktop_config.json");
	}
	return path.join(
		os.homedir(),
		".config",
		"Claude",
		"claude_desktop_config.json",
	);
}

export function installClaudeDesktopMcp(options: {
	mcpUrl: string;
}): ClaudeInstallResult {
	const configPath = claudeDesktopConfigPath();
	const configDir = path.dirname(configPath);

	try {
		fs.mkdirSync(configDir, { recursive: true });

		const existed = fs.existsSync(configPath);
		let existingJson = "";
		let backupPath: string | null = null;

		if (existed) {
			existingJson = fs.readFileSync(configPath, "utf8");
			backupPath = backupPathFor(configPath);
			fs.copyFileSync(configPath, backupPath);
		}

		const merged = mergeClaudeDesktopMcpConfig({
			existingJson,
			name: DEFAULT_LOCAL_MCP_SERVER_NAME,
			url: options.mcpUrl,
		});

		fs.writeFileSync(configPath, merged, {
			encoding: "utf8",
			mode: 0o600,
		});

		return {
			ok: true,
			configPath,
			backupPath,
			createdConfigFile: !existed,
		};
	} catch (error) {
		return {
			ok: false,
			error:
				error instanceof Error
					? error.message
					: "Failed to update Claude Desktop config",
		};
	}
}
