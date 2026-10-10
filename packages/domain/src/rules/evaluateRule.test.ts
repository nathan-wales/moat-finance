import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { RuleCondition } from "@moat/data-access";
import { type MatchableTransaction, matchRuleConditions } from "./evaluateRule";

function condition(
	partial: Partial<RuleCondition> & Pick<RuleCondition, "field" | "operator">,
): RuleCondition {
	return {
		id: "c1",
		valueText: null,
		valueNumber: null,
		valueDate: null,
		secondValueNumber: null,
		secondValueDate: null,
		sortOrder: 0,
		...partial,
	};
}

const tx: MatchableTransaction = {
	description: "Amazon Marketplace",
	account: "Checking",
	amount: 120,
	category: "Shopping",
	date: new Date("2026-01-15"),
};

describe("matchRuleConditions", () => {
	it("ANDs flat conditions for backward compatibility", () => {
		assert.equal(
			matchRuleConditions(tx, {
				conditions: [
					condition({
						field: "DESCRIPTION",
						operator: "CONTAINS",
						valueText: "Amazon",
					}),
					condition({
						field: "AMOUNT",
						operator: "GREATER_THAN",
						valueNumber: 100,
					}),
				],
			}),
			true,
		);

		assert.equal(
			matchRuleConditions(tx, {
				conditions: [
					condition({
						field: "DESCRIPTION",
						operator: "CONTAINS",
						valueText: "Amazon",
					}),
					condition({
						field: "AMOUNT",
						operator: "GREATER_THAN",
						valueNumber: 200,
					}),
				],
			}),
			false,
		);
	});

	it("supports (A AND B) OR (C AND D)", () => {
		assert.equal(
			matchRuleConditions(tx, {
				match: "ANY",
				conditionGroups: [
					{
						match: "ALL",
						conditions: [
							condition({
								field: "DESCRIPTION",
								operator: "CONTAINS",
								valueText: "Amazon",
							}),
							condition({
								field: "AMOUNT",
								operator: "GREATER_THAN",
								valueNumber: 100,
							}),
						],
					},
					{
						match: "ALL",
						conditions: [
							condition({
								field: "DESCRIPTION",
								operator: "CONTAINS",
								valueText: "Walmart",
							}),
							condition({
								field: "AMOUNT",
								operator: "GREATER_THAN",
								valueNumber: 50,
							}),
						],
					},
				],
			}),
			true,
		);
	});

	it("supports (A OR B) AND C", () => {
		assert.equal(
			matchRuleConditions(tx, {
				match: "ALL",
				conditionGroups: [
					{
						match: "ANY",
						conditions: [
							condition({
								field: "DESCRIPTION",
								operator: "CONTAINS",
								valueText: "Amazon",
							}),
							condition({
								field: "DESCRIPTION",
								operator: "CONTAINS",
								valueText: "Walmart",
							}),
						],
					},
					{
						match: "ALL",
						conditions: [
							condition({
								field: "AMOUNT",
								operator: "GREATER_THAN",
								valueNumber: 100,
							}),
						],
					},
				],
			}),
			true,
		);
	});
});
