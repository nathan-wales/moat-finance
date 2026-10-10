import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { defaultLeverFor } from "@moat/domain/retirement-levers";
import {
	compileCustomLever,
	DEFAULT_CUSTOM_LEVER_KIND,
} from "./compile-custom-lever";
import {
	catalogLeadInLabel,
	commitMappedDraft,
	customKindForCatalogLever,
	draftFieldsFor,
	draftValuesFromLever,
	patchDraftLever,
} from "./lever-draft-fields";

const ctx = {
	currentAge: 45,
	retirementAge: 65,
	spouseCurrentAge: 43,
	spouseRetirementAge: 65,
	hasSpouse: true,
	annualEmploymentIncome: 120_000,
	annualSpouseEmploymentIncome: 80_000,
	expectedRetirementMonthlySpending: 7_500,
	returnRate: 0.07,
	socialSecurityClaimAge: 67,
	spouseSocialSecurityClaimAge: 67,
	rmdStartAge: 75,
	primaryPropertyId: "home",
	rentalPropertyId: null,
};

describe("draftFieldsFor", () => {
	it("maps retire_at_age to an age field", () => {
		const lever = defaultLeverFor("retire_at_age", ctx);
		const fields = draftFieldsFor(lever);
		assert.deepEqual(
			fields.map((field) => field.key),
			["age"],
		);
		assert.equal(fields[0]?.control, "age");
		assert.equal(draftValuesFromLever(lever).age, "65");
	});

	it("maps retire_later to years", () => {
		const lever = defaultLeverFor("retire_later", ctx);
		const fields = draftFieldsFor(lever);
		assert.deepEqual(
			fields.map((field) => field.key),
			["years"],
		);
		assert.equal(fields[0]?.control, "years");
		assert.equal(draftValuesFromLever(lever).years, "2");
	});

	it("maps max_roth_ira to includeCatchUp", () => {
		const lever = defaultLeverFor("max_roth_ira", ctx);
		const fields = draftFieldsFor(lever);
		assert.deepEqual(
			fields.map((field) => field.key),
			["includeCatchUp"],
		);
		assert.equal(fields[0]?.control, "bool");
		assert.equal(draftValuesFromLever(lever).includeCatchUp, "true");
	});

	it("maps contribution_change to monthlyDelta", () => {
		const lever = defaultLeverFor("contribution_change", ctx);
		const fields = draftFieldsFor(lever);
		assert.equal(fields.length, 1);
		assert.equal(fields[0]?.key, "monthlyDelta");
		assert.equal(fields[0]?.control, "money");
		assert.equal(draftValuesFromLever(lever).monthlyDelta, "500");
	});
});

describe("patchDraftLever", () => {
	it("patches age onto retire_at_age", () => {
		const lever = defaultLeverFor("retire_at_age", ctx);
		const next = patchDraftLever(lever, { age: "57" });
		assert.equal(next?.type, "retire_at_age");
		if (next?.type !== "retire_at_age") return;
		assert.equal(next.params.age, 57);
	});

	it("rejects a non-finite age", () => {
		const lever = defaultLeverFor("retire_at_age", ctx);
		assert.equal(patchDraftLever(lever, { age: "abc" }), null);
	});

	it("rejects a non-positive required amount", () => {
		const lever = defaultLeverFor("custom_one_time", ctx);
		const values = draftValuesFromLever(lever);
		values.amount = "0";
		assert.equal(patchDraftLever(lever, values), null);
	});
});

describe("customKindForCatalogLever", () => {
	it("maps retire_at_age to retire_at", () => {
		assert.equal(
			customKindForCatalogLever(defaultLeverFor("retire_at_age", ctx)),
			"retire_at",
		);
	});

	it("maps primary negative income_change to reduce_income", () => {
		assert.equal(
			customKindForCatalogLever(defaultLeverFor("income_change", ctx)),
			"reduce_income",
		);
	});

	it("does not map a raise onto reduce_income", () => {
		assert.equal(
			customKindForCatalogLever({
				type: "income_change",
				params: { annualDelta: 10_000, fromAge: 45, whom: "primary" },
			}),
			null,
		);
	});

	it("does not invent a kind for retire_later", () => {
		assert.equal(
			customKindForCatalogLever(defaultLeverFor("retire_later", ctx)),
			null,
		);
		assert.equal(catalogLeadInLabel("retire_later"), "I retire later");
	});
});

describe("commitMappedDraft", () => {
	it("keeps retire_at_age and patches the edited age", () => {
		const draft = defaultLeverFor("retire_at_age", ctx);
		const next = commitMappedDraft(draft, {
			kind: "retire_at",
			amount: 0,
			fromAge: 57,
			toAge: 65,
			label: "",
		});
		assert.equal(next?.type, "retire_at_age");
		if (next?.type !== "retire_at_age") return;
		assert.equal(next.params.age, 57);
	});
});

describe("compileCustomLever", () => {
	it("defaults the idle builder to retire_at", () => {
		assert.equal(DEFAULT_CUSTOM_LEVER_KIND, "retire_at");
	});

	it("compiles the idle retire_at sentence", () => {
		assert.deepEqual(
			compileCustomLever({
				kind: "retire_at",
				amount: 0,
				fromAge: 62,
				toAge: 65,
				label: "",
			}),
			{ type: "retire_at_age", params: { age: 62 } },
		);
	});

	it("still requires a positive amount for receive_income", () => {
		assert.equal(
			compileCustomLever({
				kind: "receive_income",
				amount: 0,
				fromAge: 45,
				toAge: 65,
				label: "Bonus",
			}),
			null,
		);
	});

	it("compiles spend with from and until ages", () => {
		assert.deepEqual(
			compileCustomLever({
				kind: "spend",
				amount: 12_000,
				fromAge: 65,
				toAge: 85,
				label: "Travel",
			}),
			{
				type: "custom_expense",
				params: {
					amount: 12_000,
					cadence: "annual",
					fromAge: 65,
					toAge: 85,
					essentiality: "flexible",
					label: "Travel",
				},
			},
		);
	});
});
