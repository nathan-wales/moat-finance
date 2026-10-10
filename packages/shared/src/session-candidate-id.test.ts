import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
	classifySessionCandidateId,
	describeSessionJwtCandidate,
	repairSessionTokenUserId,
	signSessionResolveEmail,
	verifySessionResolveEmail,
} from "./session-candidate-id";

const DATABASE_USER_ID = "clh0abc123def456ghi789jkl";

describe("classifySessionCandidateId", () => {
	it("recognizes a Prisma cuid and a Google subject", () => {
		assert.equal(classifySessionCandidateId(DATABASE_USER_ID), "cuid");
		assert.equal(
			classifySessionCandidateId("109988776655443322110"),
			"google_subject",
		);
		assert.equal(classifySessionCandidateId("provider_subject"), "other");
		assert.equal(classifySessionCandidateId(null), "other");
	});
});

describe("describeSessionJwtCandidate", () => {
	it("describes which claims are present without returning their values", () => {
		assert.deepEqual(
			describeSessionJwtCandidate({
				id: "109988776655443322110",
				sub: "109988776655443322110",
			}),
			{
				candidateIdKind: "google_subject",
				idPresent: true,
				subPresent: true,
				idEqualsSub: true,
			},
		);
		assert.deepEqual(
			describeSessionJwtCandidate({
				id: DATABASE_USER_ID,
				sub: "109988776655443322110",
			}),
			{
				candidateIdKind: "cuid",
				idPresent: true,
				subPresent: true,
				idEqualsSub: false,
			},
		);
	});
});

describe("signSessionResolveEmail", () => {
	it("accepts a signature for the same normalized email and secret", async () => {
		const secret = "test-auth-secret";
		const signature = await signSessionResolveEmail("User@Example.com", secret);

		assert.equal(
			await verifySessionResolveEmail(" user@example.com ", signature, secret),
			true,
		);
		assert.equal(
			await verifySessionResolveEmail("user@example.com", signature, "other"),
			false,
		);
		assert.equal(
			await verifySessionResolveEmail("user@example.com", "nope", secret),
			false,
		);
	});
});

describe("repairSessionTokenUserId", () => {
	it("replaces a Google subject with the database user id", async () => {
		const token = {
			id: "109988776655443322110",
			sub: "109988776655443322110",
			email: "user@example.com",
		};

		const result = await repairSessionTokenUserId(token, async (email) => {
			assert.equal(email, "user@example.com");
			return DATABASE_USER_ID;
		});

		assert.deepEqual(result, {
			status: "repaired",
			candidateIdKind: "google_subject",
			resolvedUserId: DATABASE_USER_ID,
		});
		assert.equal(token.id, DATABASE_USER_ID);
		assert.equal(token.sub, DATABASE_USER_ID);
	});

	it("leaves a database user id unchanged", async () => {
		const token = {
			id: DATABASE_USER_ID,
			sub: "109988776655443322110",
			email: "user@example.com",
		};
		let lookups = 0;

		const result = await repairSessionTokenUserId(token, async () => {
			lookups += 1;
			return "clh0otheruseridthatshouldnotapply";
		});

		assert.deepEqual(result, { status: "skipped" });
		assert.equal(lookups, 0);
		assert.equal(token.id, DATABASE_USER_ID);
	});

	it("does not invent an id when email lookup misses", async () => {
		const token = {
			sub: "109988776655443322110",
			email: "missing@example.com",
		};

		const result = await repairSessionTokenUserId(token, async () => null);

		assert.deepEqual(result, {
			status: "unresolved",
			candidateIdKind: "google_subject",
		});
		assert.equal(token.sub, "109988776655443322110");
	});
});
