import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
	renderVaultRecoveryCodeEmail,
	VAULT_RECOVERY_SUBJECT,
} from "./send-vault-recovery-code-email";

describe("renderVaultRecoveryCodeEmail", () => {
	it("renders weekly-style chrome around the recovery code", () => {
		const result = renderVaultRecoveryCodeEmail({ code: "975910" });

		assert.equal(result.subject, VAULT_RECOVERY_SUBJECT);
		assert.match(result.html, /background:#EEF0F3/);
		assert.match(result.html, /max-width:600px/);
		assert.match(result.html, /border-radius:12px/);
		assert.match(result.html, />MOAT</);
		assert.match(result.html, /Recovery code/);
		assert.match(result.html, /background:#F7F8FA/);
		assert.match(result.html, />975910</);
		assert.match(result.html, /This code expires in 10 minutes/);
		assert.match(result.html, /support@moatfinance\.ai/);
		assert.match(result.text, /Recovery code: 975910/);
		assert.match(result.text, /This code expires in 10 minutes/);
	});

	it("escapes HTML in the recovery code", () => {
		const result = renderVaultRecoveryCodeEmail({
			code: "<script>alert(1)</script>",
		});

		assert.match(result.html, /&lt;script&gt;alert\(1\)&lt;\/script&gt;/);
		assert.doesNotMatch(result.html, /<script>/);
	});
});
