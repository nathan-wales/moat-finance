import { PrismaClient } from "../../generated/prisma";

const createPrismaClient = () =>
	new PrismaClient({
		log:
			process.env.NODE_ENV === "development"
				? ["query", "error", "warn"]
				: ["error"],
	});

const globalForPrisma = globalThis as unknown as {
	prismaBase: ReturnType<typeof createPrismaClient> | undefined;
};

/** Raw Prisma client. Prefer `db` from `./db` so actor context is honored. */
export const prismaBase = globalForPrisma.prismaBase ?? createPrismaClient();

if (process.env.NODE_ENV !== "production") {
	globalForPrisma.prismaBase = prismaBase;
}
