import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
	activeMcpOAuthAccessTokenWhere,
	isActiveMcpOAuthAccessToken,
	mcpOAuthConnectionExpiresAt,
} from "./oauth-connection";

const now = new Date("2026-09-16T18:00:00.000Z");
const hourAgo = new Date("2026-09-16T17:00:00.000Z");
const hourFromNow = new Date("2026-09-16T19:00:00.000Z");
const monthFromNow = new Date("2026-10-16T18:00:00.000Z");

describe("mcpOAuthConnectionExpiresAt", () => {
	it("uses the refresh token expiry when present", () => {
		assert.equal(
			mcpOAuthConnectionExpiresAt({
				expiresAt: hourAgo,
				refreshTokenExpiresAt: monthFromNow,
			}).getTime(),
			monthFromNow.getTime(),
		);
	});

	it("falls back to the access token expiry when there is no refresh token", () => {
		assert.equal(
			mcpOAuthConnectionExpiresAt({
				expiresAt: hourFromNow,
				refreshTokenExpiresAt: null,
			}).getTime(),
			hourFromNow.getTime(),
		);
	});
});

describe("isActiveMcpOAuthAccessToken", () => {
	it("treats a revoked token as disconnected", () => {
		assert.equal(
			isActiveMcpOAuthAccessToken(
				{
					revokedAt: now,
					expiresAt: hourFromNow,
					refreshTokenExpiresAt: monthFromNow,
				},
				now,
			),
			false,
		);
	});

	it("stays connected after the access token expires if the refresh token is valid", () => {
		assert.equal(
			isActiveMcpOAuthAccessToken(
				{
					revokedAt: null,
					expiresAt: hourAgo,
					refreshTokenExpiresAt: monthFromNow,
				},
				now,
			),
			true,
		);
	});

	it("treats an expired refresh token as disconnected", () => {
		assert.equal(
			isActiveMcpOAuthAccessToken(
				{
					revokedAt: null,
					expiresAt: hourAgo,
					refreshTokenExpiresAt: hourAgo,
				},
				now,
			),
			false,
		);
	});

	it("uses access token expiry when there is no refresh token", () => {
		assert.equal(
			isActiveMcpOAuthAccessToken(
				{
					revokedAt: null,
					expiresAt: hourFromNow,
					refreshTokenExpiresAt: null,
				},
				now,
			),
			true,
		);
		assert.equal(
			isActiveMcpOAuthAccessToken(
				{
					revokedAt: null,
					expiresAt: hourAgo,
					refreshTokenExpiresAt: null,
				},
				now,
			),
			false,
		);
	});
});

describe("activeMcpOAuthAccessTokenWhere", () => {
	it("matches unrevoked tokens with a live refresh token or access token", () => {
		assert.deepEqual(activeMcpOAuthAccessTokenWhere("user-1", now), {
			userId: "user-1",
			revokedAt: null,
			OR: [
				{ refreshTokenExpiresAt: { gt: now } },
				{
					AND: [{ refreshTokenExpiresAt: null }, { expiresAt: { gt: now } }],
				},
			],
		});
	});
});
