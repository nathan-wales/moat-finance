import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
	chanceOfSuccessBarClass,
	heroFundingCopy,
	howThisWorksIntro,
	howThisWorksSections,
	planStrengthLabel,
} from "./health-hero-copy";

describe("heroFundingCopy", () => {
	it("states funding through longevity when the path holds", () => {
		assert.equal(
			heroFundingCopy({
				firstShortfallAge: null,
				fundedThroughLongevity: true,
				longevityAge: 95,
			}),
			"Your plan is projected to fund your lifestyle through age 95.",
		);
	});

	it("names the shortfall age on the average path", () => {
		assert.equal(
			heroFundingCopy({
				firstShortfallAge: 81,
				fundedThroughLongevity: false,
				longevityAge: 95,
			}),
			"On the average path, funds run short around age 81.",
		);
	});
});

describe("planStrengthLabel", () => {
	it("calls 95% on-track excellent", () => {
		assert.equal(
			planStrengthLabel({
				confidence: 0.95,
				confidenceTarget: 0.85,
				fundedThroughLongevity: true,
				kind: "on_track",
			}),
			"Excellent plan strength",
		);
	});

	it("calls a result that meets the target but not 90% strong", () => {
		assert.equal(
			planStrengthLabel({
				confidence: 0.86,
				confidenceTarget: 0.85,
				fundedThroughLongevity: true,
				kind: "on_track",
			}),
			"Strong plan strength",
		);
	});

	it("calls a below-target funded plan sensitive", () => {
		assert.equal(
			planStrengthLabel({
				confidence: 0.71,
				confidenceTarget: 0.85,
				fundedThroughLongevity: true,
				kind: "likely_sensitive",
			}),
			"Sensitive plan strength",
		);
	});

	it("prefers needs-funding when the average path falls short", () => {
		assert.equal(
			planStrengthLabel({
				confidence: 0.95,
				confidenceTarget: 0.85,
				fundedThroughLongevity: false,
				kind: "short",
			}),
			"Plan needs more funding",
		);
	});

	it("waits on Monte Carlo before labeling strength", () => {
		assert.equal(
			planStrengthLabel({
				confidence: null,
				confidenceTarget: 0.85,
				fundedThroughLongevity: true,
				kind: "on_track",
			}),
			"Calculating plan strength",
		);
	});
});

describe("howThisWorksSections", () => {
	it("restates success in trial counts", () => {
		const sections = howThisWorksSections({
			confidence: 0.95,
			confidenceTarget: 0.85,
			longevityAge: 95,
			planMonthly: 13_000,
			safeMonthly: 17_000,
			trials: 1_000,
		});
		const chance = sections.find(
			(section) => section.title === "Chance of success",
		);
		assert.ok(chance);
		assert.match(chance.body, /1,000 market paths/);
		assert.match(chance.body, /950 of those paths worked/);
		assert.match(howThisWorksIntro(1_000), /1,000 simulated market paths/);
	});

	it("names the monthly spending headroom", () => {
		const sections = howThisWorksSections({
			confidence: 0.95,
			confidenceTarget: 0.85,
			longevityAge: 95,
			planMonthly: 13_000,
			safeMonthly: 17_000,
			trials: 1_000,
		});
		const spending = sections.find(
			(section) => section.title === "Plan spending vs safe spending",
		);
		assert.ok(spending);
		assert.match(spending.body, /\$4,000 more each month/);
	});
});

describe("chanceOfSuccessBarClass", () => {
	it("uses red below 70%", () => {
		assert.deepEqual(chanceOfSuccessBarClass(0), {
			className: "bg-red-500/20",
			indicatorClassName: "bg-red-500",
		});
		assert.equal(
			chanceOfSuccessBarClass(0.69).indicatorClassName,
			"bg-red-500",
		);
	});

	it("uses yellow from 70% up to 80%", () => {
		assert.equal(
			chanceOfSuccessBarClass(0.7).indicatorClassName,
			"bg-amber-500",
		);
		assert.equal(
			chanceOfSuccessBarClass(0.79).indicatorClassName,
			"bg-amber-500",
		);
	});

	it("uses green at 80% and above", () => {
		assert.equal(
			chanceOfSuccessBarClass(0.8).indicatorClassName,
			"bg-green-500",
		);
		assert.equal(chanceOfSuccessBarClass(1).indicatorClassName, "bg-green-500");
	});
});
