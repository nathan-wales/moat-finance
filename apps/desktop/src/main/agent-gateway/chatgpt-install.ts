import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import {
	buildCodexMcpServerTomlSection,
	type McpUrlOnlyServerConfig,
	mergeCodexMcpServerToml,
} from "@moat/mcp-contracts";

export type ChatgptInstallResult =
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

function codexConfigPath(): string {
	return path.join(os.homedir(), ".codex", "config.toml");
}

function backupPathFor(configPath: string): string {
	const stamp = new Date().toISOString().replace(/[:.]/g, "-");
	return `${configPath}.moat-backup-${stamp}`;
}

export function installChatgptDesktopMcp(options: {
	config: McpUrlOnlyServerConfig;
}): ChatgptInstallResult {
	const configPath = codexConfigPath();
	const configDir = path.dirname(configPath);

	try {
		fs.mkdirSync(configDir, { recursive: true });

		const existed = fs.existsSync(configPath);
		let existingToml = "";
		let backupPath: string | null = null;

		if (existed) {
			existingToml = fs.readFileSync(configPath, "utf8");
			backupPath = backupPathFor(configPath);
			fs.copyFileSync(configPath, backupPath);
		}

		const merged = existed
			? mergeCodexMcpServerToml({
					existingToml,
					config: options.config,
				})
			: buildCodexMcpServerTomlSection({ config: options.config });

		fs.writeFileSync(
			configPath,
			merged.endsWith("\n") ? merged : `${merged}\n`,
			{
				encoding: "utf8",
				mode: 0o600,
			},
		);

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
					: "Failed to update Codex config",
		};
	}
}
