import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { buildServiceDatabaseUrl } from "./service-db-url";

describe("buildServiceDatabaseUrl", () => {
	it("appends the service actor startup option", () => {
		const url = buildServiceDatabaseUrl("postgresql://u:p@host/db");
		assert.equal(
			url,
			"postgresql://u:p@host/db?options=-c%20app.actor_type%3Dservice",
		);
	});

	it("percent-encodes the space rather than using a plus", () => {
		const url = buildServiceDatabaseUrl("postgresql://u:p@host/db");
		assert.ok(!url?.includes("+"), "libpq does not decode + as a space");
	});

	it("preserves existing query params and options", () => {
		const url = buildServiceDatabaseUrl(
			"postgresql://u:p@host/db?sslmode=require&options=-c%20statement_timeout%3D5000",
		);
		assert.equal(
			url,
			"postgresql://u:p@host/db?sslmode=require&options=-c%20statement_timeout%3D5000%20-c%20app.actor_type%3Dservice",
		);
	});

	it("leaves a url that already sets the actor type untouched", () => {
		const original =
			"postgresql://u:p@host/db?options=-c%20app.actor_type%3Dservice";
		assert.equal(buildServiceDatabaseUrl(original), original);
	});

	it("returns undefined when no connection string is available", () => {
		assert.equal(buildServiceDatabaseUrl(undefined), undefined);
		assert.equal(buildServiceDatabaseUrl("not a url"), undefined);
	});
});
