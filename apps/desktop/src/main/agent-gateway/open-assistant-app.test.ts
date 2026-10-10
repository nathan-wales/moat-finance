import assert from "node:assert/strict";
import os from "node:os";
import path from "node:path";
import { describe, it } from "node:test";
import {
	macApplicationCandidates,
	type OpenAssistantAppDeps,
	openAssistantApp,
	windowsExecutableCandidates,
} from "./open-assistant-app";

function createDeps(
	overrides: Partial<OpenAssistantAppDeps> &
		Pick<OpenAssistantAppDeps, "platform">,
): OpenAssistantAppDeps {
	return {
		homedir: () => "/Users/test",
		existsSync: () => false,
		execFile: async () => {
			throw new Error("not installed");
		},
		openPath: async () => "failed",
		openExternal: async () => {
			throw new Error("no handler");
		},
		...overrides,
	};
}

describe("openAssistantApp", () => {
	it("opens Claude on macOS with open -a", async () => {
		const calls: Array<{ file: string; args: string[] }> = [];
		const result = await openAssistantApp(
			"Claude",
			createDeps({
				platform: "darwin",
				execFile: async (file, args) => {
					calls.push({ file, args });
				},
			}),
		);

		assert.deepEqual(result, { ok: true });
		assert.deepEqual(calls, [{ file: "open", args: ["-a", "Claude"] }]);
	});

	it("opens ChatGPT and Cursor on macOS with their app names", async () => {
		const names: string[] = [];
		for (const provider of ["ChatGPT", "Cursor"] as const) {
			await openAssistantApp(
				provider,
				createDeps({
					platform: "darwin",
					execFile: async (_file, args) => {
						const name = args[1];
						if (name) names.push(name);
					},
				}),
			);
		}

		assert.deepEqual(names, ["ChatGPT", "Cursor"]);
	});

	it("falls back to the Applications path on macOS", async () => {
		const opened: string[] = [];
		const claudeApp = path.join("/Applications", "Claude.app");
		const result = await openAssistantApp(
			"Claude",
			createDeps({
				platform: "darwin",
				existsSync: (filePath) => filePath === claudeApp,
				openPath: async (filePath) => {
					opened.push(filePath);
					return "";
				},
			}),
		);

		assert.deepEqual(result, { ok: true });
		assert.deepEqual(opened, [claudeApp]);
	});

	it("opens a Windows Cursor install from Local AppData", async () => {
		const exe = path.join(
			"C:",
			"Users",
			"test",
			"AppData",
			"Local",
			"Programs",
			"cursor",
			"Cursor.exe",
		);
		const result = await openAssistantApp(
			"Cursor",
			createDeps({
				platform: "win32",
				homedir: () => path.join("C:", "Users", "test"),
				localAppData: path.join("C:", "Users", "test", "AppData", "Local"),
				existsSync: (filePath) => filePath === exe,
				openPath: async (filePath) => (filePath === exe ? "" : "failed"),
			}),
		);

		assert.deepEqual(result, { ok: true });
	});

	it("falls back to a URL scheme on Windows when no exe is present", async () => {
		const urls: string[] = [];
		const result = await openAssistantApp(
			"ChatGPT",
			createDeps({
				platform: "win32",
				openExternal: async (url) => {
					urls.push(url);
				},
			}),
		);

		assert.deepEqual(result, { ok: true });
		assert.deepEqual(urls, ["chatgpt://"]);
	});

	it("opens Cursor on Linux via the cursor binary", async () => {
		const calls: Array<{ file: string; args: string[] }> = [];
		const result = await openAssistantApp(
			"Cursor",
			createDeps({
				platform: "linux",
				execFile: async (file, args) => {
					calls.push({ file, args });
				},
			}),
		);

		assert.deepEqual(result, { ok: true });
		assert.deepEqual(calls, [{ file: "cursor", args: [] }]);
	});

	it("returns a not-installed error when every strategy fails", async () => {
		const result = await openAssistantApp(
			"Claude",
			createDeps({ platform: "linux" }),
		);

		assert.deepEqual(result, { ok: false, error: "Claude is not installed" });
	});
});

describe("app path candidates", () => {
	it("includes /Applications and ~/Applications on macOS", () => {
		const homedir = os.homedir();
		assert.deepEqual(macApplicationCandidates("Claude", homedir), [
			"/Applications/Claude.app",
			path.join(homedir, "Applications", "Claude.app"),
		]);
	});

	it("includes known Cursor exe locations on Windows", () => {
		const homedir = path.join("C:", "Users", "test");
		const localAppData = path.join(homedir, "AppData", "Local");
		const candidates = windowsExecutableCandidates(
			"Cursor",
			homedir,
			localAppData,
		);
		assert.ok(candidates.some((candidate) => candidate.endsWith("Cursor.exe")));
	});
});
