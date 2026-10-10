import { CANONICAL_DEFAULT_CATEGORIES } from "@moat/category-mapping";
import { PrismaClient } from "../generated/prisma";
import { buildServiceDatabaseUrl } from "../src/server/service-db-url";
import { seedDemoWorkspace } from "./seeds/demo-workspace.seed";

const serviceUrl = buildServiceDatabaseUrl(
	process.env.DIRECT_URL ?? process.env.DATABASE_URL,
);

const db = serviceUrl
	? new PrismaClient({ datasources: { db: { url: serviceUrl } } })
	: new PrismaClient();

const defaults = CANONICAL_DEFAULT_CATEGORIES.map((cat) => ({
	...cat,
	isDefault: true as const,
}));

async function main() {
	console.log("Seeding default categories...");

	for (const cat of defaults) {
		const existing = await db.category.findFirst({
			where: { userId: null, name: cat.name },
		});
		if (!existing) {
			await db.category.create({ data: { userId: null, ...cat } });
			console.log(`  Created: ${cat.name}`);
		} else {
			await db.category.update({
				where: { id: existing.id },
				data: {
					parentCategory: cat.parentCategory ?? null,
					color: cat.color,
				},
			});
			console.log(`  Updated parent: ${cat.name}`);
		}
	}

	console.log("Done.");

	await seedDemoWorkspace(db);
}

main()
	.catch(console.error)
	.finally(() => db.$disconnect());
