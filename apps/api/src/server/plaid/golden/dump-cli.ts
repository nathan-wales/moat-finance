import { dumpPostgresNormalizedState } from "./dump-normalized-state";
import { requireGoldenCliUserId } from "./parse-cli-user-id";

process.env.MOAT_E2E = "1";

async function main(): Promise<void> {
	const userId = requireGoldenCliUserId("usage: dump-cli.ts <userId>");

	const state = await dumpPostgresNormalizedState(userId);
	process.stdout.write(`${JSON.stringify(state)}\n`);
}

void main().catch((error) => {
	process.stderr.write(
		`${error instanceof Error ? (error.stack ?? error.message) : String(error)}\n`,
	);
	process.exit(1);
});
