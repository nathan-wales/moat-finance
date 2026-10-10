/**
 * Seed an existing real account with the demo financial fixture set.
 *
 * Intended for ChatGPT / partner reviewer accounts — not the shared
 * anonymous demo user (`demo@internal.system`).
 *
 * Prerequisites:
 *   1. Create the user account in the target environment (sign up / invite).
 *   2. Point DATABASE_URL (and ideally DIRECT_URL) at that environment.
 *
 * Usage (from apps/api, with env loaded):
 *   pnpm db:seed:reviewer
 *
 * Optional env:
 *   SEED_USER_EMAIL        default: chatgpt-reviewer@moatfinance.ai
 *   SEED_PLAID_ID_PREFIX   default: reviewer  (must be unique vs "demo")
 *
 * Safety:
 *   - Does NOT create the user if missing
 *   - Does NOT touch demo@internal.system
 *   - Does NOT seed system categories
 *   - Uses a separate Plaid ID prefix so accounts do not collide with demo
 */

import { PrismaClient } from "../../generated/prisma";
import { buildServiceDatabaseUrl } from "../../src/server/service-db-url";
import { DEMO_USER_EMAIL, seedDemoWorkspace } from "./demo-workspace.seed";

const DEFAULT_REVIEWER_EMAIL = "chatgpt-reviewer@moatfinance.ai";
const DEFAULT_PLAID_ID_PREFIX = "reviewer";

async function main() {
	const email = (process.env.SEED_USER_EMAIL ?? DEFAULT_REVIEWER_EMAIL).trim();
	const plaidIdPrefix = (
		process.env.SEED_PLAID_ID_PREFIX ?? DEFAULT_PLAID_ID_PREFIX
	).trim();

	if (!email) {
		throw new Error("SEED_USER_EMAIL must be a non-empty email address.");
	}
	if (email === DEMO_USER_EMAIL) {
		throw new Error(
			`Refusing to seed ${DEMO_USER_EMAIL} via the reviewer script. Use pnpm db:seed instead.`,
		);
	}
	if (!plaidIdPrefix || plaidIdPrefix === "demo") {
		throw new Error(
			'SEED_PLAID_ID_PREFIX must be set and must not be "demo" (reserved for the shared demo workspace).',
		);
	}

	const serviceUrl = buildServiceDatabaseUrl(
		process.env.DIRECT_URL ?? process.env.DATABASE_URL,
	);
	if (!serviceUrl && !process.env.DATABASE_URL) {
		throw new Error(
			"DATABASE_URL (or DIRECT_URL) is required. Load apps/api/.env or export the prod/staging URL explicitly.",
		);
	}

	const db = serviceUrl
		? new PrismaClient({ datasources: { db: { url: serviceUrl } } })
		: new PrismaClient();

	try {
		const user = await seedDemoWorkspace(db, {
			email,
			createIfMissing: false,
			plaidIdPrefix,
			displayName: "ChatGPT Reviewer",
		});
		console.log(`Done. Seeded userId=${user.id}`);
	} finally {
		await db.$disconnect();
	}
}

main().catch((err) => {
	console.error(err);
	process.exit(1);
});
