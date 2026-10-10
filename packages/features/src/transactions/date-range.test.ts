import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
	formatDateRangeQueryParams,
	isCompleteDateRange,
	parseTransactionsDateParam,
} from "./date-range";

describe("transaction date range helpers", () => {
	it("parses URL dates as local calendar days", () => {
		const from = parseTransactionsDateParam("2026-08-01");
		const to = parseTransactionsDateParam("2026-08-31");
		assert.equal(from.getFullYear(), 2026);
		assert.equal(from.getMonth(), 7);
		assert.equal(from.getDate(), 1);
		assert.equal(to.getDate(), 31);
	});

	it("treats same-day ranges as complete", () => {
		const from = new Date(2026, 8, 1);
		const range = { from, to: from };
		assert.equal(isCompleteDateRange(range), true);
		assert.deepEqual(formatDateRangeQueryParams(range), {
			from: "2026-09-01",
			to: "2026-09-01",
		});
	});

	it("does not treat an open-ended range as complete", () => {
		assert.equal(
			isCompleteDateRange({ from: new Date(2026, 7, 1), to: undefined }),
			false,
		);
		assert.equal(
			formatDateRangeQueryParams({ from: new Date(2026, 7, 1) }),
			undefined,
		);
	});
});
