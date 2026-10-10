import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
	collectUniqueUserIds,
	isDesktopDeviceInfo,
	toAdminUserStats,
} from "./admin-user-stats.service";

describe("isDesktopDeviceInfo", () => {
	it("detects desktop auth device info", () => {
		assert.equal(isDesktopDeviceInfo("moat-desktop-cloud-backup"), true);
		assert.equal(isDesktopDeviceInfo("Moat Desktop"), true);
	});

	it("ignores mobile, extension, and empty values", () => {
		assert.equal(isDesktopDeviceInfo('{"platform":"ios"}'), false);
		assert.equal(
			isDesktopDeviceInfo("Moat Retail Sync Chrome Extension"),
			false,
		);
		assert.equal(isDesktopDeviceInfo(null), false);
		assert.equal(isDesktopDeviceInfo(undefined), false);
	});
});

describe("toAdminUserStats", () => {
	it("counts remaining users as web after desktop sign-ins", () => {
		const stats = toAdminUserStats({
			totalUsers: 10,
			desktopUserIds: collectUniqueUserIds([
				{ userId: "desktop-1" },
				{ userId: "desktop-1" },
				{ userId: "desktop-2" },
				{ userId: null },
			]),
			activeUserIds: new Set(["desktop-1", "web-1"]),
		});

		assert.deepEqual(stats, {
			totalUsers: 10,
			activeLast7Days: 2,
			webUsers: 8,
			desktopUsers: 2,
		});
	});
});
