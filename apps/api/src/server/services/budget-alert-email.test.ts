import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
	buildBudgetAlertTransactionsUrl,
	renderBudgetAlertEmail,
	renderBudgetAlertsDigestEmail,
} from "./budget-alert-email";

describe("buildBudgetAlertTransactionsUrl", () => {
	it("filters the category by highest spend in the alert month", () => {
		const url = buildBudgetAlertTransactionsUrl({
			categoryName: "Groceries",
			from: "2026-09-01",
			to: "2026-09-30",
		});
		assert.match(url, /app\.moatfinance\.ai\/transactions\?/);
		assert.match(url, /category=Groceries/);
		assert.match(url, /type=expense/);
		assert.match(url, /sort=amount-desc/);
		assert.match(url, /from=2026-09-01/);
		assert.match(url, /to=2026-09-30/);
	});
});

describe("renderBudgetAlertEmail", () => {
	it("uses over-budget copy, a progress badge, and a budget opt-out link", () => {
		const email = renderBudgetAlertEmail({
			categoryName: "Dining",
			spent: 520,
			monthlyGoal: 400,
			threshold: 100,
			purchases: [
				{ label: "Sushi Place", amount: 86.4 },
				{ label: "Tacos", amount: 42 },
			],
			periodFrom: "2026-09-01",
			periodTo: "2026-09-30",
		});
		assert.equal(email.subject, "Dining is over budget");
		assert.match(email.html, /Budget alert/);
		assert.match(email.html, />100%</);
		assert.match(email.html, /Sushi Place/);
		assert.match(email.html, /\$86\.40/);
		assert.match(email.html, /See these on Transactions/);
		assert.match(email.html, /sort=amount-desc/);
		assert.match(email.html, /Don't want this alert/);
		assert.match(email.html, /app\.moatfinance\.ai\/budget/);
		assert.match(email.text, /Review your budget/);
		assert.match(email.text, /Don't want this alert/);
	});

	it("uses a 75% badge and lists the largest purchases", () => {
		const email = renderBudgetAlertEmail({
			categoryName: "Groceries",
			spent: 160,
			monthlyGoal: 200,
			threshold: 75,
			percentOfMonthElapsed: 40,
			purchases: [
				{ label: "Costco", amount: 64.12 },
				{ label: "Whole Foods", amount: 38.5 },
			],
			periodFrom: "2026-09-01",
			periodTo: "2026-09-30",
		});
		assert.equal(email.subject, "Groceries reached 75% of its budget");
		assert.match(email.html, />75%</);
		assert.match(email.html, /Costco/);
		assert.match(email.html, /Whole Foods/);
		assert.match(email.html, /category=Groceries/);
		assert.match(email.text, /Top purchases/);
		assert.match(email.text, /Costco: \$64\.12/);
	});
});

describe("renderBudgetAlertsDigestEmail", () => {
	it("stacks sections with a separator and one opt-out", () => {
		const email = renderBudgetAlertsDigestEmail({
			sections: [
				{
					categoryName: "Dining",
					spent: 520,
					monthlyGoal: 400,
					threshold: 100,
					purchases: [{ label: "Sushi Place", amount: 86.4 }],
					periodFrom: "2026-09-01",
					periodTo: "2026-09-30",
				},
				{
					categoryName: "Groceries",
					spent: 160,
					monthlyGoal: 200,
					threshold: 75,
					percentOfMonthElapsed: 40,
					purchases: [{ label: "Costco", amount: 64.12 }],
					periodFrom: "2026-09-01",
					periodTo: "2026-09-30",
				},
			],
		});
		assert.equal(email.subject, "2 budget alerts");
		assert.match(email.html, /Budget alerts/);
		assert.match(email.html, /Dining is over budget/);
		assert.match(email.html, /Groceries reached 75% of its budget/);
		assert.match(email.html, /Sushi Place/);
		assert.match(email.html, /Costco/);
		assert.match(email.html, /border-top:1px solid #E5E7EB/);
		assert.equal(email.html.match(/Don't want this alert/g)?.length, 1);
		assert.equal(email.html.match(/Review budget/g)?.length, 1);
		assert.match(email.text, /---/);
		assert.match(email.text, /Dining is over budget/);
		assert.match(email.text, /Groceries reached 75% of its budget/);
		assert.match(email.text, /Don't want this alert/);
	});
});
