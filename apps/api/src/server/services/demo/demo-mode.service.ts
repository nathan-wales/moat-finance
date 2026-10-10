import { getDemoUserId } from "../../context/resolve-active-context";

export const DEMO_USER_EMAIL = "demo@internal.system";

/**
 * Determines whether the given request context is operating in demo mode.
 */
export function isDemoContext(ctx: { isDemoMode: boolean }): boolean {
	return ctx.isDemoMode;
}

/**
 * Returns the demo system user ID. Throws if the demo user has not been seeded.
 */
export async function requireDemoUserId(): Promise<string> {
	const id = await getDemoUserId();
	if (!id) {
		throw new Error(
			`Demo user (${DEMO_USER_EMAIL}) not found. Run 'npx prisma db seed' to seed the demo workspace.`,
		);
	}
	return id;
}
