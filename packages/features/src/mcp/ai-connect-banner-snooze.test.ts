import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
	isBannerSnoozed,
	parseSnoozeUntil,
	snoozeUntilFrom,
} from "./ai-connect-banner-snooze";

describe("ai connect banner snooze", () => {
	it("parses a numeric timestamp and rejects invalid values", () => {
		assert.equal(parseSnoozeUntil("1710000000000"), 1710000000000);
		assert.equal(parseSnoozeUntil(null), null);
		assert.equal(parseSnoozeUntil("later"), null);
	});

	it("hides the banner only before the snooze expires", () => {
		assert.equal(isBannerSnoozed(100, 99), true);
		assert.equal(isBannerSnoozed(100, 100), false);
		assert.equal(isBannerSnoozed(null, 100), false);
	});

	it("snoozes for one calendar month", () => {
		const now = new Date(2026, 0, 15, 12, 0, 0);
		const until = new Date(snoozeUntilFrom(now));
		assert.equal(until.getFullYear(), 2026);
		assert.equal(until.getMonth(), 1);
		assert.equal(until.getDate(), 15);
	});
});
