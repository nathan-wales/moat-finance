import { PrismaClient } from "../generated/prisma";

const db = new PrismaClient();

const LEGACY_MAP: Record<string, string> = {
	FOOD: "Eating Out",
	HOUSING: "Mortgage & Rent",
	TRANSPORTATION: "Auto & Transport",
	ENTERTAINMENT: "Entertainment",
	SUBSCRIPTIONS: "Bills & Utilities",
	UTILITIES: "Bills & Utilities",
	TRAVEL: "Travel",
	SHOPPING: "Shopping",
	HEALTHCARE: "Health & Medical",
	EDUCATION: "Uncategorized",
	OTHER: "Uncategorized",
};

async function main() {
	// Load all global defaults
	const defaults = await db.category.findMany({ where: { userId: null } });
	const byName = new Map(defaults.map((c) => [c.name.toLowerCase(), c.id]));

	// Find the uncategorized fallback
	const uncategorizedId = byName.get("uncategorized");
	if (!uncategorizedId) {
		console.error("Run seed first — Uncategorized category not found.");
		process.exit(1);
	}

	// Fetch transactions that have no categoryId yet
	const txs = await db.transaction.findMany({
		where: { categoryId: null },
		select: { id: true, category: true },
	});

	console.log(`Migrating ${txs.length} transactions...`);

	let matched = 0;
	let unmatched = 0;

	for (const tx of txs) {
		const targetName = LEGACY_MAP[tx.category] ?? null;
		const categoryId = targetName
			? (byName.get(targetName.toLowerCase()) ?? uncategorizedId)
			: uncategorizedId;

		await db.transaction.update({
			where: { id: tx.id },
			data: { categoryId },
		});

		if (targetName) matched++;
		else unmatched++;
	}

	console.log(
		`Done. Matched: ${matched}, Fell back to Uncategorized: ${unmatched}`,
	);
}

main()
	.catch(console.error)
	.finally(() => db.$disconnect());
