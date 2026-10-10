import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { computeErrorName, parseZoneFromMetadata } from "./stop-instance";

describe("stop instance helpers", () => {
	it("reads the zone name from the metadata path", () => {
		assert.equal(
			parseZoneFromMetadata("projects/418506358288/zones/us-central1-c"),
			"us-central1-c",
		);
		assert.equal(parseZoneFromMetadata("us-central1-c"), "us-central1-c");
	});

	it("prefers Compute status codes over generic error names", () => {
		assert.equal(
			computeErrorName({ status: "PERMISSION_DENIED", name: "Error" }),
			"PERMISSION_DENIED",
		);
		assert.equal(computeErrorName({ code: 403 }), "code_403");
		assert.equal(computeErrorName(new Error("hidden")), "Error");
	});
});
