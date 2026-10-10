import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
	HOUSEHOLD_INVITE_SUBJECT,
	renderHouseholdInviteEmail,
} from "./send-household-invite-email";

describe("renderHouseholdInviteEmail", () => {
	it("renders welcome-style chrome around the invite", () => {
		const result = renderHouseholdInviteEmail({
			inviteeName: "Tyler 2",
			ownerName: "Tyler Smith",
			inviteUrl: "https://app.moatfinance.ai/household/accept?token=abc123",
			expiresAt: new Date("2026-10-02T18:10:00.000Z"),
		});

		assert.equal(result.subject, HOUSEHOLD_INVITE_SUBJECT);
		assert.match(result.html, /background:#EEF0F3/);
		assert.match(result.html, /max-width:600px/);
		assert.match(result.html, /border-radius:12px/);
		assert.match(
			result.html,
			/src="https:\/\/moatfinance\.ai\/public\/moat-finance-full-logo\.png"/,
		);
		assert.match(result.html, /alt="Moat Finance"/);
		assert.match(result.html, /You're invited to Moat Household/);
		assert.match(result.html, /Hi Tyler 2,/);
		assert.match(result.html, /Tyler Smith invited you/);
		assert.match(result.html, /Accept household invite/);
		assert.match(result.html, /background:#0F2744/);
		assert.match(
			result.html,
			/href="https:\/\/app\.moatfinance\.ai\/household\/accept\?token=abc123"/,
		);
		assert.match(result.html, /support@moatfinance\.ai/);
		assert.match(result.text, /^Hi Tyler 2,/);
		assert.match(
			result.text,
			/Accept invite: https:\/\/app\.moatfinance\.ai\/household\/accept\?token=abc123/,
		);
	});

	it("escapes HTML in names and the invite link", () => {
		const result = renderHouseholdInviteEmail({
			inviteeName: "Ada<script>",
			ownerName: 'Sam" onclick="alert(1)',
			inviteUrl: 'https://app.moatfinance.ai/household/accept?token=a"b<c',
			expiresAt: new Date("2026-10-02T18:10:00.000Z"),
		});

		assert.match(result.html, /Hi Ada&lt;script&gt;,/);
		assert.match(result.html, /Sam&quot; onclick=&quot;alert\(1\)/);
		assert.match(result.html, /token=a&quot;b&lt;c/);
		assert.doesNotMatch(result.html, /<script>/);
	});
});
