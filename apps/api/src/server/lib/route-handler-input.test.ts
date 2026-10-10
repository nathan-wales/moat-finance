import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { TaxYearInputSchema } from "@moat/contracts";
import { buildRouteHandlerInput } from "./route-handler-input";

describe("buildRouteHandlerInput", () => {
	it("strips Next.js path params from POST bodies used by strict tax schemas", () => {
		const input = buildRouteHandlerInput({
			method: "POST",
			query: { router: "taxes", action: "listDocuments" },
			body: { taxYear: 2026 },
		});

		assert.deepEqual(input, { taxYear: 2026 });
		assert.deepEqual(TaxYearInputSchema.parse(input), { taxYear: 2026 });
	});

	it("fails TaxYearInputSchema when router and action leak into the body", () => {
		assert.throws(
			() =>
				TaxYearInputSchema.parse({
					taxYear: 2026,
					router: "taxes",
					action: "listDocuments",
				}),
			(error: unknown) => {
				assert.ok(error instanceof Error);
				assert.match(error.message, /unrecognized_keys/);
				assert.match(error.message, /router/);
				assert.match(error.message, /action/);
				return true;
			},
		);
	});

	it("strips path params from GET query input", () => {
		const input = buildRouteHandlerInput({
			method: "GET",
			query: { router: "taxes", action: "listYears", taxYear: "2026" },
		});

		assert.deepEqual(input, { taxYear: "2026" });
	});

	it("lets POST body override remaining query params", () => {
		const input = buildRouteHandlerInput({
			method: "POST",
			query: { router: "taxes", action: "listFacts", taxYear: "2025" },
			body: { taxYear: 2026, category: "income" },
		});

		assert.deepEqual(input, { taxYear: 2026, category: "income" });
	});
});
