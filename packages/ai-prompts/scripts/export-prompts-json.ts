import { writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { ALL_PROMPTS } from "../src/utils";

const scriptDir = dirname(fileURLToPath(import.meta.url));
const outputPath = join(
	scriptDir,
	"../../../apps/ios/Moat/Resources/prompts.json",
);

writeFileSync(outputPath, `${JSON.stringify(ALL_PROMPTS, null, 2)}\n`, "utf8");
console.log(`Exported ${ALL_PROMPTS.length} prompts to ${outputPath}`);
