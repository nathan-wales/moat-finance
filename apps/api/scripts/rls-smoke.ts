/**
 * End-to-end actor-context smoke test against a live database.
 *
 * Usage: DATABASE_URL=... npx tsx scripts/rls-smoke.ts
 *
 * Point DATABASE_URL at the restricted runtime role (moat_app) with the RLS
 * migrations applied. Verifies that the service startup option, the request
 * transaction path, and cross-tenant denial all behave as designed.
 */
import { db } from "../src/server/db";
import {
	elevateToAdminDatabaseActor,
	userDatabaseActor,
	withDatabaseActor,
	withElevatedServiceActor,
} from "../src/server/db-actor";
import { withServiceDatabaseActor } from "../src/server/lib/with-service-actor";
import { getServiceSessionClient } from "../src/server/service-db";

const USER_A = "rls_smoke_user_a";
const USER_B = "rls_smoke_user_b";
const DEMO_USER = "rls_smoke_demo_user";
const DEMO_SESSION_KEY = "rls_smoke_demo_session";

let failures = 0;

function check(name: string, passed: boolean, detail?: unknown): void {
	if (passed) {
		console.log(`PASS ${name}`);
		return;
	}
	failures += 1;
	console.error(`FAIL ${name}`, detail ?? "");
}

async function readActorType(): Promise<string | null> {
	const rows = await db.$queryRaw<Array<{ actor_type: string | null }>>`
		SELECT current_setting('app.actor_type', true) AS actor_type
	`;
	return rows[0]?.actor_type ?? null;
}

async function main(): Promise<void> {
	check(
		"service session connection carries the startup option",
		(await getServiceSessionClient()) !== null,
	);

	await withServiceDatabaseActor(async () => {
		check(
			"service scope sets actor type",
			(await readActorType()) === "service",
		);

		for (const id of [USER_A, USER_B, DEMO_USER]) {
			await db.user.upsert({
				where: { id },
				create: { id, email: `${id}@example.invalid`, name: id },
				update: {},
			});
			await db.transaction.upsert({
				where: { id: `${id}_tx` },
				create: {
					id: `${id}_tx`,
					userId: id,
					date: new Date(),
					amount: 1,
					type: "EXPENSE",
					description: `${id} only`,
				},
				update: {},
			});
		}

		await db.demoOverlaySession.upsert({
			where: { sessionKey: DEMO_SESSION_KEY },
			create: {
				sessionKey: DEMO_SESSION_KEY,
				demoUserId: DEMO_USER,
				expiresAt: new Date(Date.now() + 60_000),
			},
			update: {},
		});
	});

	await withDatabaseActor(userDatabaseActor({ userId: USER_A }), async () => {
		check("user scope sets actor type", (await readActorType()) === "user");

		const visible = await db.transaction.findMany({
			where: { id: { in: [`${USER_A}_tx`, `${USER_B}_tx`] } },
			select: { id: true },
		});
		check(
			"user sees only own transaction",
			visible.length === 1 && visible[0]?.id === `${USER_A}_tx`,
			visible,
		);

		const peer = await db.transaction.updateMany({
			where: { id: `${USER_B}_tx` },
			data: { description: "tampered" },
		});
		check("user cannot update peer rows", peer.count === 0, peer);

		// A rejected write aborts the surrounding transaction, so the nested
		// $transaction savepoint is what lets the request keep going.
		let denied = false;
		try {
			await db.$transaction(async (tx) => {
				await tx.transaction.create({
					data: {
						id: "rls_smoke_mismatch",
						userId: USER_B,
						date: new Date(),
						amount: 1,
						type: "EXPENSE",
					},
				});
			});
		} catch {
			denied = true;
		}
		check("user cannot insert rows owned by a peer", denied);

		const stillUsable = await db.transaction.count({
			where: { id: `${USER_A}_tx` },
		});
		check(
			"savepoint keeps the request usable after a denied write",
			stillUsable === 1,
			stillUsable,
		);

		await withElevatedServiceActor(
			userDatabaseActor({ userId: USER_A }),
			async () => {
				const all = await db.transaction.findMany({
					where: { id: { in: [`${USER_A}_tx`, `${USER_B}_tx`] } },
					select: { id: true },
				});
				check(
					"elevated service scope reads across tenants",
					all.length === 2,
					all,
				);
			},
		);

		const afterRestore = await db.transaction.findMany({
			where: { id: { in: [`${USER_A}_tx`, `${USER_B}_tx`] } },
			select: { id: true },
		});
		check(
			"elevation is reverted to the original actor",
			afterRestore.length === 1,
			afterRestore,
		);

		await elevateToAdminDatabaseActor(USER_A);
		const asAdmin = await db.transaction.findMany({
			where: { id: { in: [`${USER_A}_tx`, `${USER_B}_tx`] } },
			select: { id: true },
		});
		check(
			"admin elevation reads across tenants",
			asAdmin.length === 2,
			asAdmin,
		);
	});

	await withDatabaseActor(
		userDatabaseActor({ userId: DEMO_USER, isDemoMode: true }),
		async () => {
			const session = await db.demoOverlaySession.findUnique({
				where: { sessionKey: DEMO_SESSION_KEY },
				select: { sessionKey: true },
			});
			check("demo actor reads anonymous overlay session", session !== null);
		},
	);

	await withServiceDatabaseActor(async () => {
		await db.demoOverlaySession.deleteMany({
			where: { sessionKey: DEMO_SESSION_KEY },
		});

		const all = await db.transaction.findMany({
			where: { id: { in: [`${USER_A}_tx`, `${USER_B}_tx`] } },
			select: { id: true },
		});
		check("service reads across tenants", all.length === 2, all);

		await db.transaction.deleteMany({
			where: {
				id: {
					in: [
						`${USER_A}_tx`,
						`${USER_B}_tx`,
						`${DEMO_USER}_tx`,
						"rls_smoke_mismatch",
					],
				},
			},
		});
		await db.user.deleteMany({
			where: { id: { in: [USER_A, USER_B, DEMO_USER] } },
		});
	});

	if (failures > 0) {
		console.error(`\n${failures} check(s) failed`);
		process.exit(1);
	}
	console.log("\nAll actor-context checks passed");
}

main()
	.catch((error) => {
		console.error(error);
		process.exit(1);
	})
	.finally(() => process.exit(failures > 0 ? 1 : 0));
