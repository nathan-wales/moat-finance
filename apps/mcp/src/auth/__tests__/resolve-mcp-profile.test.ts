import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
	argumentsWithoutProfileId,
	resolveMcpReadProfileUserId,
} from "../resolve-mcp-profile";
import { McpAuthorizationError } from "../scope-checker";

function createDb(input: { owned?: boolean; granted?: boolean }) {
	return {
		householdProfileAccess: {
			findFirst: async () =>
				input.granted
					? { profileLink: { profileUserId: "business_profile" } }
					: null,
		},
		profileLink: {
			findFirst: async () =>
				input.owned ? { profileUserId: "business_profile" } : null,
		},
	};
}

describe("resolveMcpReadProfileUserId", () => {
	it("accepts the caller's own profile without a database lookup", async () => {
		const profileUserId = await resolveMcpReadProfileUserId({
			actorUserId: "owner_1",
			db: createDb({}) as never,
			effectiveUserId: "owner_1",
			isHouseholdMember: false,
			requestedProfileId: "owner_1",
		});
		assert.equal(profileUserId, "owner_1");
	});

	it("accepts a business profile the caller owns", async () => {
		const profileUserId = await resolveMcpReadProfileUserId({
			actorUserId: "owner_1",
			db: createDb({ owned: true }) as never,
			effectiveUserId: "owner_1",
			isHouseholdMember: false,
			requestedProfileId: "business_profile",
		});
		assert.equal(profileUserId, "business_profile");
	});

	it("rejects a profile the caller does not own", async () => {
		await assert.rejects(
			() =>
				resolveMcpReadProfileUserId({
					actorUserId: "owner_1",
					db: createDb({}) as never,
					effectiveUserId: "owner_1",
					isHouseholdMember: false,
					requestedProfileId: "someone_else",
				}),
			(error: unknown) => error instanceof McpAuthorizationError,
		);
	});

	it("accepts a household grant and still rejects an ungranted profile", async () => {
		const granted = await resolveMcpReadProfileUserId({
			actorUserId: "member_1",
			db: createDb({ granted: true }) as never,
			effectiveUserId: "owner_1",
			isHouseholdMember: true,
			requestedProfileId: "business_profile",
		});
		assert.equal(granted, "business_profile");

		await assert.rejects(
			() =>
				resolveMcpReadProfileUserId({
					actorUserId: "member_1",
					db: createDb({}) as never,
					effectiveUserId: "owner_1",
					isHouseholdMember: true,
					requestedProfileId: "business_profile",
				}),
			(error: unknown) => error instanceof McpAuthorizationError,
		);
	});

	it("strips profileId before a strict tool schema parses", () => {
		assert.deepEqual(
			argumentsWithoutProfileId({ limit: 10, profileId: "business_profile" }),
			{ limit: 10 },
		);
	});
});
