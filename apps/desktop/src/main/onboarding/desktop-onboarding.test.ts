import { describe, expect, it } from "node:test";
import type { UserMetadataRepository } from "@moat/data-access";
import {
	getDesktopOnboardingState,
	markDesktopOnboardingCompleted,
	markDesktopOnboardingSkipped,
	ONBOARDING_METADATA_KEYS,
} from "./desktop-onboarding";

function createMemoryRepo(
	initial: Record<string, string> = {},
): UserMetadataRepository {
	const store = new Map<string, string>(Object.entries(initial));
	return {
		async get({ key }) {
			return store.get(key) ?? null;
		},
		async upsert({ key, valueJson }) {
			store.set(key, valueJson);
		},
		async delete({ key }) {
			store.delete(key);
		},
	};
}

describe("desktop onboarding state", () => {
	it("shows onboarding when no completion metadata exists", async () => {
		const userMetadata = createMemoryRepo();
		const state = await getDesktopOnboardingState({
			userId: "local-user",
			userMetadata,
		});
		expect(state.shouldShow).toBe(true);
	});

	it("hides onboarding after skip", async () => {
		const userMetadata = createMemoryRepo();
		await markDesktopOnboardingSkipped({
			userId: "local-user",
			userMetadata,
		});
		const state = await getDesktopOnboardingState({
			userId: "local-user",
			userMetadata,
		});
		expect(state.shouldShow).toBe(false);
		expect(state.skippedAt).not.toBeNull();
	});

	it("hides onboarding after completion", async () => {
		const userMetadata = createMemoryRepo();
		await markDesktopOnboardingCompleted({
			userId: "local-user",
			userMetadata,
		});
		const state = await getDesktopOnboardingState({
			userId: "local-user",
			userMetadata,
		});
		expect(state.shouldShow).toBe(false);
		expect(state.completedAt).not.toBeNull();
	});

	it("shows V2 onboarding for users who completed V1", async () => {
		const userMetadata = createMemoryRepo({
			[ONBOARDING_METADATA_KEYS.version]: JSON.stringify("1"),
			[ONBOARDING_METADATA_KEYS.completedAt]: JSON.stringify(
				"2026-01-01T00:00:00.000Z",
			),
		});
		const state = await getDesktopOnboardingState({
			userId: "local-user",
			userMetadata,
		});
		expect(state.shouldShow).toBe(true);
		expect(state.version).toBe("1");
	});

	it("persists seen metadata", async () => {
		const userMetadata = createMemoryRepo();
		await markDesktopOnboardingSkipped({
			userId: "local-user",
			userMetadata,
		});
		const seen = await userMetadata.get({
			userId: "local-user",
			key: ONBOARDING_METADATA_KEYS.seenAt,
		});
		expect(seen).not.toBeNull();
	});
});
