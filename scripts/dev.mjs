import { spawn } from "node:child_process";

const TRUE_VALUES = new Set(["1", "true", "yes"]);

const scriptArgs = process.argv.slice(2);
const turboArgs = ["run", "dev"];
let includeExtension = false;

for (let index = 0; index < scriptArgs.length; index += 1) {
	const arg = scriptArgs[index];

	if (arg === "--") {
		continue;
	}

	if (arg === "--ext") {
		const value = scriptArgs[index + 1];
		includeExtension = TRUE_VALUES.has(value?.toLowerCase() ?? "");

		if (value !== undefined && !value.startsWith("--")) {
			index += 1;
		}

		continue;
	}

	if (arg.startsWith("--ext=")) {
		includeExtension = TRUE_VALUES.has(arg.slice("--ext=".length).toLowerCase());
		continue;
	}

	turboArgs.push(arg);
}

if (!includeExtension) {
	turboArgs.push("--filter=!moat-finance-extension");
}

const child = spawn("turbo", turboArgs, {
	stdio: "inherit",
	shell: process.platform === "win32",
});

for (const signal of ["SIGINT", "SIGTERM"]) {
	process.on(signal, () => {
		child.kill(signal);
	});
}

child.on("exit", (code, signal) => {
	if (signal) {
		process.exit(1);
	}

	process.exit(code ?? 1);
});