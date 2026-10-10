import {
	cleanupGoldenFixtureResidue,
	createGoldenUser,
	seedGoldenCategories,
	seedGoldenCostcoRule,
} from "./seed";
import { withGoldenActor } from "./with-golden-actor";

process.env.MOAT_E2E = "1";

async function main(): Promise<void> {
	const user = await withGoldenActor(async () => {
		await seedGoldenCategories();
		await cleanupGoldenFixtureResidue();
		const created = await createGoldenUser();
		await seedGoldenCostcoRule(created.id);
		return created;
	});
	process.stdout.write(`${JSON.stringify(user)}\n`);
}

void main().catch((error) => {
	process.stderr.write(
		`${error instanceof Error ? (error.stack ?? error.message) : String(error)}\n`,
	);
	process.exit(1);
});
