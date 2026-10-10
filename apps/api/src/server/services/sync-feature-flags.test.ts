import assert from "node:assert/strict";
import { afterEach, describe, it } from "node:test";
import { isRealtimeBalanceSyncEnabled } from "./sync-feature-flags";

const originalRealtime = process.env.ENABLE_REALTIME_BALANCE_SYNC;
const originalAdminIds = process.env.ADMIN_USER_IDS;

afterEach(() => {
	if (originalRealtime === undefined) {
		delete process.env.ENABLE_REALTIME_BALANCE_SYNC;
	} else {
		process.env.ENABLE_REALTIME_BALANCE_SYNC = originalRealtime;
	}
	if (originalAdminIds === undefined) {
		delete process.env.ADMIN_USER_IDS;
	} else {
		process.env.ADMIN_USER_IDS = originalAdminIds;
	}
});

describe("isRealtimeBalanceSyncEnabled", () => {
	it("is on when the env override is true", () => {
		process.env.ENABLE_REALTIME_BALANCE_SYNC = "true";
		delete process.env.ADMIN_USER_IDS;
		assert.equal(isRealtimeBalanceSyncEnabled("anyone"), true);
	});

	it("is on for admin user ids", () => {
		delete process.env.ENABLE_REALTIME_BALANCE_SYNC;
		process.env.ADMIN_USER_IDS = "admin-1, admin-2";
		assert.equal(isRealtimeBalanceSyncEnabled("admin-2"), true);
		assert.equal(isRealtimeBalanceSyncEnabled("other"), false);
	});
});
