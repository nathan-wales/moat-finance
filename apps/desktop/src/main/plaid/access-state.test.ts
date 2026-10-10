import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
	isPlaidItemAccessLive,
	livePlaidAccessToken,
	plaidInstitutionKey,
	selectConnectedPlaidItems,
	selectVisiblePlaidItems,
} from "./access-state";

const token = Buffer.from("enc");

describe("isPlaidItemAccessLive", () => {
	it("requires both a token and no revoke stamp", () => {
		assert.equal(
			isPlaidItemAccessLive({
				accessRevokedAt: null,
				accessTokenEncrypted: token,
			}),
			true,
		);
		assert.equal(
			isPlaidItemAccessLive({
				accessRevokedAt: null,
				accessTokenEncrypted: null,
			}),
			false,
		);
		assert.equal(
			isPlaidItemAccessLive({
				accessRevokedAt: new Date(),
				accessTokenEncrypted: token,
			}),
			false,
		);
	});
});

describe("livePlaidAccessToken", () => {
	it("withholds the token of a revoked item", () => {
		assert.equal(
			livePlaidAccessToken({
				accessRevokedAt: new Date(),
				accessTokenEncrypted: token,
			}),
			null,
		);
		assert.equal(
			livePlaidAccessToken({
				accessRevokedAt: null,
				accessTokenEncrypted: token,
			}),
			token,
		);
	});
});

describe("plaidInstitutionKey", () => {
	it("prefers the institution id and namespaces it away from names", () => {
		assert.equal(
			plaidInstitutionKey({ institutionId: "ins_1", institutionName: "Chase" }),
			"id:ins_1",
		);
		assert.equal(
			plaidInstitutionKey({ institutionId: "  ", institutionName: " Chase " }),
			"name:chase",
		);
		assert.notEqual(
			plaidInstitutionKey({ institutionId: "chase", institutionName: "x" }),
			plaidInstitutionKey({ institutionName: "chase" }),
		);
	});
});

describe("selectVisiblePlaidItems", () => {
	it("hides a paused item once the same institution has a live one", () => {
		const visible = selectVisiblePlaidItems([
			{
				id: "paused-chase",
				institutionId: "ins_1",
				institutionName: "Chase",
				accessRevokedAt: new Date(),
				accessTokenEncrypted: null,
			},
			{
				id: "live-chase",
				institutionId: "ins_1",
				institutionName: "Chase",
				accessRevokedAt: null,
				accessTokenEncrypted: token,
			},
			{
				id: "paused-amex",
				institutionId: "ins_2",
				institutionName: "Amex",
				accessRevokedAt: new Date(),
				accessTokenEncrypted: null,
			},
		]);

		assert.deepEqual(
			visible.map((item) => item.id),
			["live-chase", "paused-amex"],
		);
	});

	it("hides user-disconnected items that have no active accounts", () => {
		const token = Buffer.from("enc");
		const connected = selectConnectedPlaidItems([
			{
				id: "paused-trial",
				institutionId: "ins_2",
				institutionName: "Amex",
				accessRevokedAt: new Date(),
				accessTokenEncrypted: null,
				accounts: [{ isActive: true }],
			},
			{
				id: "user-disconnected",
				institutionId: "ins_1",
				institutionName: "Chase",
				accessRevokedAt: new Date(),
				accessTokenEncrypted: null,
				accounts: [{ isActive: false }],
			},
			{
				id: "live",
				institutionId: "ins_3",
				institutionName: "Ally",
				accessRevokedAt: null,
				accessTokenEncrypted: token,
				accounts: [{ isActive: true }],
			},
		]);

		assert.deepEqual(
			connected.map((item) => item.id),
			["paused-trial", "live"],
		);
	});
});
