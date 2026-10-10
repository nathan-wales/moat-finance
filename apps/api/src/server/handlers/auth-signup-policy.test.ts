import assert from "node:assert/strict";
import { afterEach, beforeEach, describe, it, mock } from "node:test";
import { OAuth2Client } from "google-auth-library";
import type { ApiContext } from "../api-context";
import { SIGNUPS_CLOSED_CODE } from "../lib/signup-policy";
import { auth } from "./auth";

const ENV_KEYS = [
	"SIGNUPS_ENABLED",
	"SIGNUP_ALLOWED_EMAILS",
	"MOAT_DATABASE_ACTOR_CONTEXT",
	"RESEND_API_KEY",
	"AUTH_GOOGLE_ID",
] as const;

type ExistingUser = {
	id: string;
	email: string;
	name: string;
	image: null;
	twoFactorEnabled: boolean;
	twoFactorVerified: boolean;
};

function createDb(existing: ExistingUser | null = null) {
	const created: Array<Record<string, unknown>> = [];
	const db = {
		user: {
			findUnique: async () => existing,
			update: async () => existing,
			create: async (args: { data: Record<string, unknown> }) => {
				created.push(args.data);
				return {
					id: "new-user",
					email: args.data.email,
					name: args.data.name,
					image: null,
					twoFactorEnabled: false,
					twoFactorVerified: false,
				};
			},
		},
		marketingAttribution: {
			findUnique: async () => null,
			create: async () => ({}),
		},
	};
	return { db, created };
}

function apiContext(db: unknown): ApiContext {
	return {
		session: null,
		jwtPayload: null,
		isDemoMode: false,
		userId: null,
		actorUserId: null,
		db,
	} as unknown as ApiContext;
}

const isSignupsClosed = (error: Error & { status?: number; code?: string }) =>
	error.status === 403 && error.code === SIGNUPS_CLOSED_CODE;

describe("auth handlers honor the sign-up policy", () => {
	const previous = new Map<string, string | undefined>();

	beforeEach(() => {
		for (const key of ENV_KEYS) previous.set(key, process.env[key]);
		process.env.MOAT_DATABASE_ACTOR_CONTEXT = "false";
		process.env.AUTH_GOOGLE_ID = "test-google-client-id";
		delete process.env.RESEND_API_KEY;
		delete process.env.SIGNUPS_ENABLED;
		delete process.env.SIGNUP_ALLOWED_EMAILS;
	});

	afterEach(() => {
		for (const key of ENV_KEYS) {
			const value = previous.get(key);
			if (value === undefined) delete process.env[key];
			else process.env[key] = value;
		}
		mock.restoreAll();
	});

	const registerBody = {
		name: "New Person",
		email: "New.Person@example.com",
		password: "correct-horse-battery",
	};

	it("register creates a user when SIGNUPS_ENABLED is unset", async () => {
		const { db, created } = createDb();
		const user = await auth.register(apiContext(db), registerBody);
		assert.equal(user.email, "new.person@example.com");
		assert.equal(created.length, 1);
	});

	it("register refuses a new user when SIGNUPS_ENABLED=false", async () => {
		process.env.SIGNUPS_ENABLED = "false";
		const { db, created } = createDb();
		await assert.rejects(
			() => auth.register(apiContext(db), registerBody),
			isSignupsClosed,
		);
		assert.equal(created.length, 0);
	});

	it("register allows an allowlisted email when SIGNUPS_ENABLED=false", async () => {
		process.env.SIGNUPS_ENABLED = "false";
		process.env.SIGNUP_ALLOWED_EMAILS =
			"owner@example.com, new.person@example.com";
		const { db, created } = createDb();
		await auth.register(apiContext(db), registerBody);
		assert.equal(created.length, 1);
	});

	it("register refuses desktop-sourced sign-ups too", async () => {
		process.env.SIGNUPS_ENABLED = "false";
		const { db, created } = createDb();
		await assert.rejects(
			() =>
				auth.register(apiContext(db), { ...registerBody, source: "desktop" }),
			isSignupsClosed,
		);
		assert.equal(created.length, 0);
	});

	function mockGoogleToken(email: string) {
		mock.method(OAuth2Client.prototype, "verifyIdToken", async () => ({
			getPayload: () => ({
				email,
				name: "Google Person",
				email_verified: true,
			}),
		}));
	}

	it("first-time Google sign-in is refused when SIGNUPS_ENABLED=false", async () => {
		process.env.SIGNUPS_ENABLED = "false";
		mockGoogleToken("stranger@example.com");
		const { db, created } = createDb();
		await assert.rejects(
			() => auth.nextAuthGoogle(apiContext(db), { idToken: "token" }),
			isSignupsClosed,
		);
		assert.equal(created.length, 0);
	});

	it("existing users still sign in with Google when SIGNUPS_ENABLED=false", async () => {
		process.env.SIGNUPS_ENABLED = "false";
		mockGoogleToken("owner@example.com");
		const { db, created } = createDb({
			id: "existing-user",
			email: "owner@example.com",
			name: "Owner",
			image: null,
			twoFactorEnabled: false,
			twoFactorVerified: false,
		});
		const user = await auth.nextAuthGoogle(apiContext(db), {
			idToken: "token",
		});
		assert.equal(user.id, "existing-user");
		assert.equal(user.isNewUser, false);
		assert.equal(created.length, 0);
	});

	it("Google exchange (iOS / desktop) refuses a new user when SIGNUPS_ENABLED=false", async () => {
		process.env.SIGNUPS_ENABLED = "false";
		mockGoogleToken("stranger@example.com");
		const { db, created } = createDb();
		await assert.rejects(
			() => auth.exchange(apiContext(db), { type: "google", idToken: "token" }),
			isSignupsClosed,
		);
		assert.equal(created.length, 0);
	});
});

describe("auth.signupStatus (public)", () => {
	const previous = new Map<string, string | undefined>();

	beforeEach(() => {
		for (const key of ENV_KEYS) previous.set(key, process.env[key]);
		process.env.MOAT_DATABASE_ACTOR_CONTEXT = "false";
		delete process.env.SIGNUPS_ENABLED;
		delete process.env.SIGNUP_ALLOWED_EMAILS;
	});

	afterEach(() => {
		for (const key of ENV_KEYS) {
			const value = previous.get(key);
			if (value === undefined) delete process.env[key];
			else process.env[key] = value;
		}
	});

	function statusContext() {
		const headers = new Map<string, string>();
		const ctx = {
			...apiContext(null),
			res: {
				setHeader: (name: string, value: string) => {
					headers.set(name.toLowerCase(), value);
				},
			},
		} as unknown as ApiContext;
		return { ctx, headers };
	}

	it("reports sign-ups open when SIGNUPS_ENABLED is unset", async () => {
		const { ctx, headers } = statusContext();
		const result = await auth.signupStatus(ctx, undefined);
		assert.deepEqual(result, { signupsEnabled: true });
		assert.match(headers.get("cache-control") ?? "", /max-age=\d+/);
	});

	it("reports sign-ups closed without exposing the allowlist", async () => {
		process.env.SIGNUPS_ENABLED = "false";
		process.env.SIGNUP_ALLOWED_EMAILS = "owner@example.com";
		const { ctx } = statusContext();
		const result = await auth.signupStatus(ctx, undefined);
		assert.deepEqual(result, { signupsEnabled: false });
		assert.doesNotMatch(JSON.stringify(result), /owner@example\.com/);
	});
});
