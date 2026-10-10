import { execFile as execFileCallback } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { promisify } from "node:util";

const defaultExecFile = promisify(execFileCallback);

export const ASSISTANT_APPS = ["Claude", "ChatGPT", "Cursor"] as const;
export type AssistantApp = (typeof ASSISTANT_APPS)[number];

export function isAssistantApp(value: unknown): value is AssistantApp {
	return (
		typeof value === "string" &&
		(ASSISTANT_APPS as readonly string[]).includes(value)
	);
}

export type OpenAssistantAppResult =
	| { ok: true }
	| { ok: false; error: string };

export type OpenAssistantAppDeps = {
	platform: NodeJS.Platform;
	homedir: () => string;
	localAppData?: string;
	existsSync: (filePath: string) => boolean;
	execFile: (file: string, args: string[]) => Promise<unknown>;
	openPath: (filePath: string) => Promise<string>;
	openExternal: (url: string) => Promise<void>;
};

const MAC_APP_NAMES: Record<AssistantApp, string> = {
	Claude: "Claude",
	ChatGPT: "ChatGPT",
	Cursor: "Cursor",
};

const LINUX_BINARIES: Record<AssistantApp, string> = {
	Claude: "claude",
	ChatGPT: "chatgpt",
	Cursor: "cursor",
};

const URL_SCHEMES: Record<AssistantApp, string> = {
	Claude: "claude://",
	ChatGPT: "chatgpt://",
	Cursor: "cursor://",
};

function notInstalledError(provider: AssistantApp): string {
	return `${provider} is not installed`;
}

export function macApplicationCandidates(
	provider: AssistantApp,
	homedir: string,
): string[] {
	const appName = `${MAC_APP_NAMES[provider]}.app`;
	return [
		path.join("/Applications", appName),
		path.join(homedir, "Applications", appName),
	];
}

export function windowsExecutableCandidates(
	provider: AssistantApp,
	homedir: string,
	localAppData?: string,
): string[] {
	const base = localAppData ?? path.join(homedir, "AppData", "Local");
	if (provider === "Claude") {
		return [
			path.join(base, "AnthropicClaude", "claude.exe"),
			path.join(base, "Programs", "Claude", "Claude.exe"),
		];
	}
	if (provider === "ChatGPT") {
		return [
			path.join(base, "Programs", "ChatGPT", "ChatGPT.exe"),
			path.join(base, "ChatGPT", "ChatGPT.exe"),
		];
	}
	return [
		path.join(base, "Programs", "cursor", "Cursor.exe"),
		path.join(base, "Programs", "Cursor", "Cursor.exe"),
	];
}

async function tryOpenPath(
	filePath: string,
	deps: Pick<OpenAssistantAppDeps, "existsSync" | "openPath">,
): Promise<boolean> {
	if (!deps.existsSync(filePath)) return false;
	const error = await deps.openPath(filePath);
	return error.length === 0;
}

async function tryOpenExternal(
	provider: AssistantApp,
	openExternal: OpenAssistantAppDeps["openExternal"],
): Promise<boolean> {
	try {
		await openExternal(URL_SCHEMES[provider]);
		return true;
	} catch {
		return false;
	}
}

export async function openAssistantApp(
	provider: AssistantApp,
	deps: OpenAssistantAppDeps,
): Promise<OpenAssistantAppResult> {
	if (deps.platform === "darwin") {
		try {
			await deps.execFile("open", ["-a", MAC_APP_NAMES[provider]]);
			return { ok: true };
		} catch {
			// Fall through to path and URL-scheme lookups.
		}

		for (const appPath of macApplicationCandidates(provider, deps.homedir())) {
			if (await tryOpenPath(appPath, deps)) return { ok: true };
		}

		if (await tryOpenExternal(provider, deps.openExternal)) {
			return { ok: true };
		}
		return { ok: false, error: notInstalledError(provider) };
	}

	if (deps.platform === "win32") {
		for (const exePath of windowsExecutableCandidates(
			provider,
			deps.homedir(),
			deps.localAppData,
		)) {
			if (await tryOpenPath(exePath, deps)) return { ok: true };
		}

		if (await tryOpenExternal(provider, deps.openExternal)) {
			return { ok: true };
		}
		return { ok: false, error: notInstalledError(provider) };
	}

	try {
		await deps.execFile(LINUX_BINARIES[provider], []);
		return { ok: true };
	} catch {
		// Fall through to URL scheme.
	}

	if (await tryOpenExternal(provider, deps.openExternal)) {
		return { ok: true };
	}
	return { ok: false, error: notInstalledError(provider) };
}

export function createOpenAssistantAppDeps(shell: {
	openPath: (filePath: string) => Promise<string>;
	openExternal: (url: string) => Promise<void>;
}): OpenAssistantAppDeps {
	return {
		platform: process.platform,
		homedir: () => os.homedir(),
		localAppData: process.env.LOCALAPPDATA,
		existsSync: (filePath) => fs.existsSync(filePath),
		execFile: (file, args) => defaultExecFile(file, args),
		openPath: shell.openPath,
		openExternal: shell.openExternal,
	};
}
