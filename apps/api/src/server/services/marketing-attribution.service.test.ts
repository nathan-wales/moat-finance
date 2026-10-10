import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { applyVisit, touchFromVisit } from "@moat/shared";
import { persistSignupAttribution } from "./marketing-attribution.service";

function localAttribution() {
	const visit = touchFromVisit({
		pathname: "/for/local",
		search: "?utm_source=newsletter",
		touchedAt: "2026-09-23T12:00:00.000Z",
	});
	assert.ok(visit);
	return applyVisit(null, visit);
}

describe("persistSignupAttribution", () => {
	it("writes first touch once for a new account", async () => {
		const created: unknown[] = [];
		const result = await persistSignupAttribution(
			{
				findUnique: async () => null,
				create: async (args) => {
					created.push(args.data);
					return {
						userId: "user_1",
						firstChannel: "local",
						latestChannel: "local",
					};
				},
			},
			{
				userId: "user_1",
				isNewUser: true,
				attribution: localAttribution(),
			},
		);
		assert.equal(result, "created");
		assert.equal(created.length, 1);
		const row = created[0] as { firstChannel: string; latestChannel: string };
		assert.equal(row.firstChannel, "local");
		assert.equal(row.latestChannel, "local");
	});

	it("does not replace first touch when a row already exists", async () => {
		let created = false;
		const result = await persistSignupAttribution(
			{
				findUnique: async () => ({
					userId: "user_1",
					firstChannel: "local",
					latestChannel: "local",
				}),
				create: async () => {
					created = true;
					return { userId: "user_1", firstChannel: "ai", latestChannel: "ai" };
				},
			},
			{
				userId: "user_1",
				isNewUser: true,
				attribution: localAttribution(),
			},
		);
		assert.equal(result, "skipped");
		assert.equal(created, false);
	});

	it("leaves an existing user with null attribution unchanged", async () => {
		let lookedUp = false;
		const result = await persistSignupAttribution(
			{
				findUnique: async () => {
					lookedUp = true;
					return null;
				},
				create: async () => {
					throw new Error("should not create");
				},
			},
			{
				userId: "user_existing",
				isNewUser: false,
				attribution: localAttribution(),
			},
		);
		assert.equal(result, "skipped");
		assert.equal(lookedUp, false);
	});
});
