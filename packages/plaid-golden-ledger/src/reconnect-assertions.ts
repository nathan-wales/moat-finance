import assert from "node:assert/strict";
import type { NormalizedFinancialState } from "./types";
import {
	RECONNECT_ACCOUNT_IDS_A,
	RECONNECT_ACCOUNT_IDS_B,
	RECONNECT_LEDGER,
} from "./reconnect-ledger";

export function assertReconnectVariationAState(
	state: NormalizedFinancialState,
	reconnectOverlapSkipped?: number,
): void {
	const checking = state.accounts.filter(
		(account) => account.mask === "1234" && account.subtype === "checking",
	);
	const credit = state.accounts.filter(
		(account) => account.mask === "5678" && account.type === "credit",
	);
	assert.equal(checking.length, 1, "reconnect A must not clone checking");
	assert.equal(credit.length, 1, "reconnect A must not clone credit");
	assert.equal(
		checking[0]?.providerAccountId,
		RECONNECT_ACCOUNT_IDS_B.checking,
	);
	assert.equal(credit[0]?.providerAccountId, RECONNECT_ACCOUNT_IDS_B.credit);
	assert.equal(
		state.accounts.some(
			(account) => account.providerAccountId === RECONNECT_ACCOUNT_IDS_A.checking,
		),
		false,
	);

	assert.ok(
		state.transactions.some(
			(tx) => tx.providerTransactionId === "reconnect-a-costco-old",
		),
		"original Item A history must stay attached",
	);
	assert.equal(
		state.transactions.some(
			(tx) => tx.providerTransactionId === "reconnect-b-costco-old",
		),
		false,
		"overlap rows from Item B must be skipped",
	);
	assert.equal(
		state.transactions.some(
			(tx) => tx.providerTransactionId === "reconnect-b-groceries-old",
		),
		false,
	);
	assert.ok(
		state.transactions.some(
			(tx) => tx.providerTransactionId === "reconnect-b-costco-new",
		),
		"post-watermark Item B activity must be imported",
	);
	if (reconnectOverlapSkipped !== undefined) {
		assert.ok(
			reconnectOverlapSkipped > 0,
			"reconnect overlap skip count must be visible in the audit",
		);
	}
}

export function assertReconnectVariationBState(
	state: NormalizedFinancialState,
): void {
	const checking = state.accounts.filter(
		(account) => account.mask === "1234" && account.subtype === "checking",
	);
	assert.equal(checking.length, 1, "live sibling must not clone checking");
	assert.equal(
		checking[0]?.providerAccountId,
		RECONNECT_ACCOUNT_IDS_A.checking,
	);
	assert.ok(
		state.accounts.some(
			(account) =>
				account.providerAccountId === RECONNECT_ACCOUNT_IDS_B.savings,
		),
		"variation B must add the new savings account",
	);
	assert.equal(state.accounts.length, 3);
	assert.ok(
		RECONNECT_LEDGER.itemA.transactions.every((tx) =>
			state.transactions.some(
				(row) => row.providerTransactionId === tx.transaction_id,
			),
		),
	);
}
