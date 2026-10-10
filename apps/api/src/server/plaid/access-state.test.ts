import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
	collectLiveInstitutionKeys,
	isPlaidItemAccessLive,
	livePlaidAccessToken,
	selectConnectedPlaidItems,
	selectVisiblePlaidItems,
	shouldDisplayPlaidItem,
} from "./access-state";

describe("plaid access-state", () => {
	it("treats token-present items without accessRevokedAt as live", () => {
		assert.equal(
			isPlaidItemAccessLive({
				accessTokenEncrypted: "enc",
				accessRevokedAt: null,
			}),
			true,
		);
		assert.equal(
			livePlaidAccessToken({
				accessTokenEncrypted: "enc",
				accessRevokedAt: null,
			}),
			"enc",
		);
	});

	it("treats revoked or tokenless items as not live", () => {
		assert.equal(
			isPlaidItemAccessLive({
				accessTokenEncrypted: "enc",
				accessRevokedAt: new Date(),
			}),
			false,
		);
		assert.equal(
			isPlaidItemAccessLive({
				accessTokenEncrypted: null,
				accessRevokedAt: null,
			}),
			false,
		);
		assert.equal(
			livePlaidAccessToken({
				accessTokenEncrypted: null,
				accessRevokedAt: null,
			}),
			null,
		);
	});

	it("hides revoked items when a live sibling exists for the same institution", () => {
		const items = [
			{
				id: "live",
				institutionId: "ins_1",
				institutionName: "Chase",
				accessTokenEncrypted: "enc",
				accessRevokedAt: null,
			},
			{
				id: "revoked",
				institutionId: "ins_1",
				institutionName: "Chase",
				accessTokenEncrypted: null,
				accessRevokedAt: new Date(),
			},
			{
				id: "paused-other",
				institutionId: "ins_2",
				institutionName: "Amex",
				accessTokenEncrypted: null,
				accessRevokedAt: new Date(),
			},
		];

		const visible = selectVisiblePlaidItems(items);
		assert.deepEqual(
			visible.map((item) => item.id),
			["live", "paused-other"],
		);

		const liveKeys = collectLiveInstitutionKeys(items);
		const revokedChase = items.find((item) => item.id === "revoked");
		const pausedOther = items.find((item) => item.id === "paused-other");
		assert.ok(revokedChase);
		assert.ok(pausedOther);
		assert.equal(shouldDisplayPlaidItem(revokedChase, liveKeys), false);
		assert.equal(shouldDisplayPlaidItem(pausedOther, liveKeys), true);
	});

	it("hides user-disconnected items that have no active accounts", () => {
		const connected = selectConnectedPlaidItems([
			{
				id: "paused-trial",
				institutionId: "ins_2",
				institutionName: "Amex",
				accessTokenEncrypted: null,
				accessRevokedAt: new Date(),
				plaidAccounts: [{ isActive: true }],
			},
			{
				id: "user-disconnected",
				institutionId: "ins_1",
				institutionName: "Chase",
				accessTokenEncrypted: null,
				accessRevokedAt: new Date(),
				plaidAccounts: [{ isActive: false }],
			},
			{
				id: "live",
				institutionId: "ins_3",
				institutionName: "Ally",
				accessTokenEncrypted: "enc",
				accessRevokedAt: null,
				plaidAccounts: [{ isActive: true }],
			},
		]);

		assert.deepEqual(
			connected.map((item) => item.id),
			["paused-trial", "live"],
		);
	});
});
