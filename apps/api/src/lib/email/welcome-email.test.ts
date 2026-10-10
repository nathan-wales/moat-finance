import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
	extractWelcomeFirstName,
	renderWelcomeEmail,
	WELCOME_EMAIL_SUBJECT,
} from "./welcome-email";

describe("renderWelcomeEmail", () => {
	it("renders a named greeting and weekly-style chrome", () => {
		const result = renderWelcomeEmail({ name: "Tyler Smith" });

		assert.equal(result.subject, WELCOME_EMAIL_SUBJECT);
		assert.match(result.html, /background:#EEF0F3/);
		assert.match(result.html, /max-width:600px/);
		assert.match(
			result.html,
			/src="https:\/\/moatfinance\.ai\/public\/moat-finance-full-logo\.png"/,
		);
		assert.match(result.html, /alt="Moat Finance"/);
		assert.match(result.html, /align="center"/);
		assert.match(result.html, /text-align:center/);
		assert.match(result.html, /Welcome to Moat Finance/);
		assert.match(result.html, /Hi Tyler,/);
		assert.match(result.html, /Open Moat Finance →/);
		assert.match(result.html, /https:\/\/app\.moatfinance\.ai/);
		assert.match(result.html, /Tyler<\/p>/);
		assert.match(result.html, /Founder, Moat Finance/);
		assert.match(result.text, /^Hi Tyler,/);
		assert.match(
			result.text,
			/Open Moat Finance: https:\/\/app\.moatfinance\.ai/,
		);
	});

	it("falls back to a nameless greeting", () => {
		const result = renderWelcomeEmail({ name: null });

		assert.match(result.html, />Hi,</);
		assert.doesNotMatch(result.html, /Hi null/);
		assert.match(result.text, /^Hi,/);
	});

	it("escapes HTML in the first name", () => {
		const result = renderWelcomeEmail({ name: "Ada<script>alert(1)</script>" });

		assert.match(
			result.html,
			/Hi Ada&lt;script&gt;alert\(1\)&lt;\/script&gt;,/,
		);
		assert.doesNotMatch(result.html, /<script>/);
	});

	it("covers the six signup capabilities and omits extra product surface area", () => {
		const result = renderWelcomeEmail({ name: "Ada" });

		assert.match(result.html, /Connect your financial accounts/);
		assert.match(result.html, /Understand your spending and cash flow/);
		assert.match(result.html, /Track your complete net worth/);
		assert.match(result.html, /Plan for retirement/);
		assert.match(result.html, /Organize taxes and insurance/);
		assert.match(result.html, /Give your AI assistant real financial context/);
		assert.match(result.html, /Can I afford to buy a house next year\?/);
		assert.match(result.html, /And your data stays under your control/);
		assert.match(result.html, /Your first 30 days are free/);
		assert.doesNotMatch(result.html, /Automate your financial organization/);
		assert.doesNotMatch(result.html, /Set goals and look ahead/);
	});

	it("uses local-first copy for desktop signups", () => {
		const result = renderWelcomeEmail({ name: "Ada", variant: "desktop" });

		assert.match(
			result.html,
			/Thanks for creating a Moat Finance Local account/,
		);
		assert.match(result.html, /Your data already stays on this computer/);
		assert.match(result.html, /No one at Moat can see that data/);
		assert.match(result.html, /permissioned access to locally on this machine/);
		assert.match(result.html, /local MCP gateway on this computer/);
		assert.match(result.html, /in Moat Finance Local/);
		assert.doesNotMatch(result.html, /Open Moat Finance →/);
		assert.doesNotMatch(result.html, /If you want even more control/);
		assert.match(result.text, /Your data already stays on this computer/);
		assert.doesNotMatch(result.text, /Open Moat Finance:/);
	});
});

describe("extractWelcomeFirstName", () => {
	it("returns the first token", () => {
		assert.equal(extractWelcomeFirstName("Tyler Smith"), "Tyler");
		assert.equal(extractWelcomeFirstName("  Ada  "), "Ada");
		assert.equal(extractWelcomeFirstName(null), null);
		assert.equal(extractWelcomeFirstName("   "), null);
	});
});
