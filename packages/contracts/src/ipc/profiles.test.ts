import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { CreateProfileInputSchema, UpdateProfileInputSchema } from "./profiles";

describe("CreateProfileInputSchema", () => {
	it("requires a name for family profiles", () => {
		assert.throws(() =>
			CreateProfileInputSchema.parse({
				kind: "FAMILY",
				displayName: "  ",
			}),
		);
	});

	it("accepts a family profile without a business type", () => {
		const parsed = CreateProfileInputSchema.parse({
			kind: "FAMILY",
			displayName: "Alex",
		});
		assert.equal(parsed.businessType, undefined);
	});

	it("requires a business type for business profiles", () => {
		assert.throws(() =>
			CreateProfileInputSchema.parse({
				kind: "BUSINESS",
				displayName: "Acme LLC",
			}),
		);
	});

	it("rejects a business type on family profiles", () => {
		assert.throws(() =>
			CreateProfileInputSchema.parse({
				kind: "FAMILY",
				displayName: "Alex",
				businessType: "SOLE_PROPRIETOR",
			}),
		);
	});

	it("accepts a business profile with a type", () => {
		const parsed = CreateProfileInputSchema.parse({
			kind: "BUSINESS",
			displayName: "Acme LLC",
			businessType: "SINGLE_MEMBER_LLC",
		});
		assert.equal(parsed.businessType, "SINGLE_MEMBER_LLC");
	});
});

describe("UpdateProfileInputSchema", () => {
	it("accepts a business type update", () => {
		const parsed = UpdateProfileInputSchema.parse({
			id: "pf_1",
			businessType: "S_CORPORATION",
		});
		assert.equal(parsed.businessType, "S_CORPORATION");
	});

	it("rejects an empty update", () => {
		assert.throws(() => UpdateProfileInputSchema.parse({ id: "pf_1" }));
	});
});
