import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
	getLatestOfficialHsaLimits,
	getLatestOfficialIraLimits,
	getLatestOfficialWorkplaceLimits,
} from "@moat/domain/federal-rules";
import {
	CATCH_UP_AGE,
	HSA_CATCH_UP_AGE,
	MEDICARE_AGE,
	PRE_MEDICARE_MONTHLY_PREMIUM,
} from "@moat/domain/retirement-constants";
import { formatExactMoney } from "../format";
import {
	employerAmountHelpText,
	PLAN_SETTINGS_HELP,
	planSettingsContributionHelp,
} from "./plan-settings-help";

describe("PLAN_SETTINGS_HELP", () => {
	it("includes the latest official 401(k) employee limit and catch-up age", () => {
		const workplace = getLatestOfficialWorkplaceLimits();
		assert.ok(
			PLAN_SETTINGS_HELP.employerPlanMode.includes(String(workplace.taxYear)),
		);
		assert.ok(
			PLAN_SETTINGS_HELP.employerPlanMode.includes(
				formatExactMoney(workplace.employeeDeferral),
			),
		);
		assert.ok(
			PLAN_SETTINGS_HELP.employerPlanMode.includes(String(CATCH_UP_AGE)),
		);
	});

	it("includes IRA and HSA statutory limits from the registry", () => {
		const ira = getLatestOfficialIraLimits();
		const hsa = getLatestOfficialHsaLimits();
		assert.ok(
			PLAN_SETTINGS_HELP.iraMode.includes(formatExactMoney(ira.contribution)),
		);
		assert.ok(
			PLAN_SETTINGS_HELP.hsaMode.includes(formatExactMoney(hsa.selfOnly)),
		);
		assert.ok(
			PLAN_SETTINGS_HELP.hsaMode.includes(formatExactMoney(hsa.family)),
		);
		assert.ok(PLAN_SETTINGS_HELP.hsaMode.includes(String(HSA_CATCH_UP_AGE)));
		assert.match(PLAN_SETTINGS_HELP.hsaMode, /pre-tax or tax-deductible/);
	});

	it("builds contribution help for an explicit tax year without dollar literals in source", () => {
		const help = planSettingsContributionHelp(2026);
		const workplace = getLatestOfficialWorkplaceLimits();
		assert.ok(
			help.employerPlanMode.includes(
				formatExactMoney(workplace.employeeDeferral),
			),
		);
	});

	it("describes the typical two-tier employer match", () => {
		assert.match(PLAN_SETTINGS_HELP.matchFirst, /100%/);
		assert.match(PLAN_SETTINGS_HELP.matchFirst, /first 3%/);
		assert.match(PLAN_SETTINGS_HELP.matchNext, /50%/);
		assert.match(PLAN_SETTINGS_HELP.matchNext, /next 2%/);
	});

	it("includes typical Medicare age and pre-Medicare premium", () => {
		assert.ok(PLAN_SETTINGS_HELP.medicareAge.includes(String(MEDICARE_AGE)));
		assert.ok(
			PLAN_SETTINGS_HELP.preMedicare.includes(
				formatExactMoney(PRE_MEDICARE_MONTHLY_PREMIUM),
			),
		);
	});
});

describe("employerAmountHelpText", () => {
	it("uses the percent copy when the mode is percent of salary", () => {
		assert.equal(
			employerAmountHelpText("percentOfSalary"),
			PLAN_SETTINGS_HELP.employerPercentOfSalary,
		);
	});

	it("uses the dollar copy when the mode is a fixed annual amount", () => {
		assert.equal(
			employerAmountHelpText("fixedAnnual"),
			PLAN_SETTINGS_HELP.employerAnnualAmount,
		);
	});
});
