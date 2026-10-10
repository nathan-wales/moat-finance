import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
	getTransactionsNavSelection,
	isTransactionsNavChildActive,
} from "./transactions-nav-paths";

describe("getTransactionsNavSelection", () => {
	it("selects transactions only on the exact transactions path", () => {
		assert.equal(getTransactionsNavSelection("/transactions"), "transactions");
		assert.equal(getTransactionsNavSelection("/transactions/import"), "import");
		assert.equal(getTransactionsNavSelection("/overview"), null);
	});

	it("selects rules and import from their routes", () => {
		assert.equal(getTransactionsNavSelection("/rules"), "rules");
		assert.equal(getTransactionsNavSelection("/rules/edit"), "rules");
		assert.equal(getTransactionsNavSelection("/import"), "import");
		assert.equal(
			getTransactionsNavSelection("/transactions/import/review"),
			"import",
		);
	});
});

describe("isTransactionsNavChildActive", () => {
	it("is inactive on transactions so the group does not auto-open", () => {
		assert.equal(isTransactionsNavChildActive("transactions"), false);
		assert.equal(isTransactionsNavChildActive(null), false);
	});

	it("is active on rules and import so visiting those pages can open it", () => {
		assert.equal(isTransactionsNavChildActive("rules"), true);
		assert.equal(isTransactionsNavChildActive("import"), true);
	});
});
