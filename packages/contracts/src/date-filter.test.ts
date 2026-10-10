import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { parseInclusiveEndDate, parseInclusiveStartDate } from "./date-filter";
import { ListTransactionsInputSchema } from "./ipc/transactions";

describe("transaction date filters", () => {
	it("parses yyyy-MM-dd as a local calendar start/end", () => {
		const start = parseInclusiveStartDate("2026-08-01");
		const end = parseInclusiveEndDate("2026-08-31");

		assert.equal(start.getFullYear(), 2026);
		assert.equal(start.getMonth(), 7);
		assert.equal(start.getDate(), 1);
		assert.equal(start.getHours(), 0);
		assert.equal(start.getMinutes(), 0);

		assert.equal(end.getFullYear(), 2026);
		assert.equal(end.getMonth(), 7);
		assert.equal(end.getDate(), 31);
		assert.equal(end.getHours(), 23);
		assert.equal(end.getMinutes(), 59);
		assert.ok(start.getTime() < end.getTime());
	});

	it("keeps ISO instants as absolute timestamps", () => {
		const start = parseInclusiveStartDate("2026-08-01T06:00:00.000Z");
		const end = parseInclusiveEndDate("2026-09-01T05:59:59.999Z");
		assert.equal(start.toISOString(), "2026-08-01T06:00:00.000Z");
		assert.equal(end.toISOString(), "2026-09-01T05:59:59.999Z");
	});

	it("parses list filter dates as inclusive local calendar bounds", () => {
		const parsed = ListTransactionsInputSchema.parse({
			startDate: "2026-08-01",
			endDate: "2026-08-31",
		});
		assert.equal(
			parsed.startDate?.getTime(),
			parseInclusiveStartDate("2026-08-01").getTime(),
		);
		assert.equal(
			parsed.endDate?.getTime(),
			parseInclusiveEndDate("2026-08-31").getTime(),
		);
	});
});
