import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { DUMP_ACCOUNT_FIELDS, DUMP_TRANSACTION_FIELDS } from "./dump-contract";
import { expectedInitialState } from "./expected-initial-state";
import { expectedState } from "./expected-state";
import {
	DISABLED_ACCOUNT_SKIPPED_TX_ID,
	GOLDEN_ACCOUNT_IDS,
	GOLDEN_LEDGER,
	GOLDEN_PAGE_SIZE,
	USER_CATEGORY_OVERRIDES_AFTER_INITIAL,
} from "./ledger";
import { dayOffset, LEDGER_TODAY, PINNED_LEDGER_TODAY } from "./ledger-today";
import { RECONNECT_LEDGER } from "./reconnect-ledger";
import { sortNormalizedState } from "./sort";
import type { NormalizedTransaction } from "./types";

function tx(
	state: { transactions: NormalizedTransaction[] },
	id: string,
): NormalizedTransaction {
	const row = state.transactions.find(
		(item) => item.providerTransactionId === id,
	);
	assert.ok(row, `missing transaction ${id}`);
	return row;
}

describe("LEDGER_TODAY offsets", () => {
	it("pins a stable default date", () => {
		assert.equal(PINNED_LEDGER_TODAY, "2026-09-09");
		assert.equal(LEDGER_TODAY, PINNED_LEDGER_TODAY);
		assert.equal(dayOffset(0), "2026-09-09");
		assert.equal(dayOffset(-3), "2026-09-06");
		assert.equal(dayOffset(-5), "2026-09-04");
	});
});

describe("Golden Ledger pages", () => {
	it("splits initial and historical rows into pages of about 10", () => {
		assert.ok(GOLDEN_LEDGER.initialAdded.length > GOLDEN_PAGE_SIZE);
		assert.ok(GOLDEN_LEDGER.initialPages.length >= 2);
		assert.ok(
			GOLDEN_LEDGER.initialPages.every(
				(page) => page.length <= GOLDEN_PAGE_SIZE,
			),
		);
		assert.ok(GOLDEN_LEDGER.historicalPages.length >= 1);
		assert.equal(
			GOLDEN_LEDGER.historicalAdded.some(
				(item) => item.transaction_id === DISABLED_ACCOUNT_SKIPPED_TX_ID,
			),
			true,
		);
	});
});

describe("expected-initial-state", () => {
	it("seeds Costco as Shopping via the Costco rule", () => {
		assert.equal(tx(expectedInitialState, "gtx-costco").category, "Shopping");
	});

	it("keeps two same-amount Starbucks rows", () => {
		assert.equal(tx(expectedInitialState, "gtx-starbucks-a").amount, 6.75);
		assert.equal(tx(expectedInitialState, "gtx-starbucks-b").amount, 6.75);
		assert.equal(
			tx(expectedInitialState, "gtx-starbucks-a").date,
			dayOffset(-1),
		);
		assert.equal(
			tx(expectedInitialState, "gtx-starbucks-b").date,
			dayOffset(-1),
		);
	});

	it("pairs 4-day and exactly-5-day transfers and leaves 6-day visible", () => {
		const fourDay = tx(expectedInitialState, "gtx-xfer-4d-checking");
		const fiveDay = tx(expectedInitialState, "gtx-xfer-5d-checking");
		const sixDay = tx(expectedInitialState, "gtx-xfer-6d-checking");
		assert.equal(fourDay.hidden, true);
		assert.equal(fourDay.autoHiddenAsTransfer, true);
		assert.equal(fiveDay.hidden, true);
		assert.equal(sixDay.hidden, false);
		assert.equal(sixDay.autoHiddenAsTransfer, false);
		assert.equal(sixDay.category, "Transfer");
	});

	it("pairs same-day checking-to-savings and credit-card payment legs", () => {
		const savingsXfer = tx(expectedInitialState, "gtx-xfer-1k-checking");
		const cardPay = tx(expectedInitialState, "gtx-ccpay-checking");
		assert.equal(savingsXfer.hidden, true);
		assert.equal(
			savingsXfer.transferPairKey,
			"gtx-xfer-1k-checking|gtx-xfer-1k-savings",
		);
		assert.equal(cardPay.category, "Credit card payment");
		assert.equal(cardPay.hidden, true);
		assert.equal(
			cardPay.transferPairKey,
			"gtx-ccpay-checking|gtx-ccpay-credit",
		);
	});

	it("does not pair a pending transfer leg", () => {
		assert.equal(
			tx(expectedInitialState, "gtx-pending-xfer-checking").pending,
			true,
		);
		assert.equal(
			tx(expectedInitialState, "gtx-pending-xfer-checking").transferPairKey,
			null,
		);
		assert.equal(
			tx(expectedInitialState, "gtx-pending-xfer-savings").transferPairKey,
			null,
		);
	});

	it("stops pairing when a Costco rule recategorizes a Transfer leg", () => {
		assert.equal(
			tx(expectedInitialState, "gtx-costco-xfer-checking").category,
			"Shopping",
		);
		assert.equal(
			tx(expectedInitialState, "gtx-costco-xfer-checking").transferPairKey,
			null,
		);
		assert.equal(
			tx(expectedInitialState, "gtx-costco-xfer-savings").category,
			"Transfer",
		);
		assert.equal(
			tx(expectedInitialState, "gtx-costco-xfer-savings").transferPairKey,
			null,
		);
	});

	it("still has disabledChecking enabled and its ATM fee", () => {
		const account = expectedInitialState.accounts.find(
			(row) => row.providerAccountId === GOLDEN_ACCOUNT_IDS.disabledChecking,
		);
		assert.ok(account);
		assert.equal(account.syncEnabled, true);
		assert.equal(tx(expectedInitialState, "gtx-disabled-atm").removed, false);
	});
});

describe("expected-state", () => {
	it("does not include the later disabledChecking transaction", () => {
		assert.equal(
			expectedState.transactions.some(
				(row) => row.providerTransactionId === DISABLED_ACCOUNT_SKIPPED_TX_ID,
			),
			false,
		);
		const account = expectedState.accounts.find(
			(row) => row.providerAccountId === GOLDEN_ACCOUNT_IDS.disabledChecking,
		);
		assert.ok(account);
		assert.equal(account.syncEnabled, false);
	});

	it("preserves a user-set category through a later Plaid modified event", () => {
		assert.equal(
			USER_CATEGORY_OVERRIDES_AFTER_INITIAL[0]?.providerTransactionId,
			"gtx-bookstore",
		);
		assert.equal(
			tx(expectedInitialState, "gtx-bookstore").category,
			"Eating Out",
		);
		assert.equal(tx(expectedState, "gtx-bookstore").category, "Entertainment");
	});

	it("remaps Uncategorized when a later modified event has a PFC", () => {
		assert.equal(
			tx(expectedInitialState, "gtx-unknown").category,
			"Uncategorized",
		);
		assert.equal(tx(expectedState, "gtx-unknown").category, "Groceries");
	});

	it("applies pending-to-posted, amount modified, and removed rows", () => {
		assert.equal(
			tx(expectedInitialState, "gtx-pending-merchant").pending,
			true,
		);
		assert.equal(tx(expectedState, "gtx-pending-merchant").pending, false);
		assert.equal(tx(expectedInitialState, "gtx-uber").amount, 18);
		assert.equal(tx(expectedState, "gtx-uber").amount, 19.5);
		assert.equal(tx(expectedInitialState, "gtx-removed-sub").removed, false);
		assert.equal(tx(expectedState, "gtx-removed-sub").removed, true);
	});

	it("sorts dump arrays deterministically", () => {
		assert.deepEqual(expectedState, sortNormalizedState(expectedState));
		assert.deepEqual(
			expectedInitialState,
			sortNormalizedState(expectedInitialState),
		);
	});

	it("computes net worth from enabled accounts only", () => {
		assert.equal(expectedState.aggregates.netWorth, 52650);
		assert.equal(expectedInitialState.aggregates.netWorth, 52900);
	});

	it("locks spending, income, and transfer aggregates", () => {
		assert.deepEqual(expectedInitialState.aggregates, {
			spending: 610.42,
			income: 0,
			transfers: 3800,
			netWorth: 52900,
		});
		assert.deepEqual(expectedState.aggregates, {
			spending: 2624.65,
			income: 3512.5,
			transfers: 4550,
			netWorth: 52650,
		});
	});

	it("applies the Costco rule to historical Costco and keeps salary as income", () => {
		assert.equal(tx(expectedState, "gtx-hist-costco").category, "Shopping");
		assert.equal(tx(expectedState, "gtx-hist-salary").type, "INCOME");
		assert.equal(tx(expectedState, "gtx-hist-salary").amount, 3500);
		assert.equal(tx(expectedState, "gtx-hist-xfer-checking").hidden, true);
	});
});

describe("dump contract", () => {
	it("lists the fields that both platforms must dump", () => {
		assert.ok(DUMP_ACCOUNT_FIELDS.includes("syncEnabled"));
		assert.ok(DUMP_ACCOUNT_FIELDS.includes("hidden"));
		assert.ok(DUMP_TRANSACTION_FIELDS.includes("transferPairKey"));
		assert.ok(DUMP_TRANSACTION_FIELDS.includes("autoHiddenAsTransfer"));
	});
});

describe("reconnect fixture", () => {
	it("covers revoke-then-relink fingerprints and a live-sibling extra account", () => {
		assert.equal(RECONNECT_LEDGER.itemA.accounts[0]?.mask, "1234");
		assert.equal(RECONNECT_LEDGER.itemB.accounts[0]?.mask, "1234");
		assert.notEqual(
			RECONNECT_LEDGER.itemA.accounts[0]?.account_id,
			RECONNECT_LEDGER.itemB.accounts[0]?.account_id,
		);
		assert.ok(RECONNECT_LEDGER.itemB.overlapTransactions.length > 0);
		assert.ok(RECONNECT_LEDGER.itemB.newerTransactions.length > 0);
		assert.equal(RECONNECT_LEDGER.variationBAccounts.length, 3);
	});
});
