import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { groupRankedRoutes, rankRoutes } from "./route-command-menu-rank";

const planner = {
	id: "retirement",
	label: "Retirement planner",
	group: "Wealth Management",
	keywords: ["retirement", "retire", "planner"],
};

const risk = {
	id: "retirement-plan-risk",
	label: "Risk",
	group: "Retirement",
	parentLabel: "Retirement planner",
	keywords: ["monte carlo", "stress test"],
};

const plan = {
	id: "retirement-plan",
	label: "Scenario builder",
	group: "Retirement",
	parentLabel: "Retirement planner",
	keywords: ["retirement plan"],
};

const overviewSection = {
	id: "retirement-plan-net-worth",
	label: "Overview",
	group: "Retirement",
	parentLabel: "Retirement planner",
	keywords: ["net worth", "overview", "projection"],
};

describe("rankRoutes", () => {
	it("ranks a title match ahead of sub-routes for the same query", () => {
		const ranked = rankRoutes(
			[risk, plan, overviewSection, planner],
			"retirement",
		);
		assert.equal(ranked[0]?.id, "retirement");
		assert.ok(ranked.some((route) => route.id === "retirement-plan-risk"));
	});

	it("still ranks an exact label match first", () => {
		const ranked = rankRoutes([planner, plan, risk], "risk");
		assert.equal(ranked[0]?.id, "retirement-plan-risk");
	});

	it("prefers a parent page over children when scores tie", () => {
		const ranked = rankRoutes(
			[
				{ id: "child", label: "Budget", parentLabel: "Budget" },
				{ id: "parent", label: "Budget" },
			],
			"budget",
		);
		assert.equal(ranked[0]?.id, "parent");
	});
});

describe("groupRankedRoutes", () => {
	it("keeps groups in the order of their best match", () => {
		const ranked = rankRoutes([risk, planner, plan], "retirement");
		const groups = groupRankedRoutes(ranked);
		assert.equal(groups[0]?.group, "Wealth Management");
		assert.equal(groups[0]?.routes[0]?.id, "retirement");
		assert.equal(groups[1]?.group, "Retirement");
	});
});
