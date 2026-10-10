import { spawnSync } from "node:child_process";
import { createRequire } from "node:module";

// Other CI jobs skip the Electron zip. pnpm's store/side-effects cache then
// reuses that empty install, so path.txt is missing unless we download here.
delete process.env.ELECTRON_SKIP_BINARY_DOWNLOAD;

const require = createRequire(import.meta.url);
const installJs = require.resolve("electron/install.js");
const result = spawnSync(process.execPath, [installJs], {
	stdio: "inherit",
	env: { ...process.env },
});

if (result.status !== 0) {
	process.exit(result.status ?? 1);
}

const electronBinary = require("electron");
console.log(`Electron binary: ${electronBinary}`);
