import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { isPlaidInvestmentsProductUnavailable } from "./errors";

function plaidHttpError(errorCode: string) {
	return {
		response: {
			data: {
				error_code: errorCode,
				error_message: "product is not available",
			},
		},
	};
}

describe("isPlaidInvestmentsProductUnavailable", () => {
	it("matches Plaid product-unavailable codes", () => {
		assert.equal(
			isPlaidInvestmentsProductUnavailable(plaidHttpError("INVALID_PRODUCT")),
			true,
		);
		assert.equal(
			isPlaidInvestmentsProductUnavailable(
				plaidHttpError("ADDITIONAL_CONSENT_REQUIRED"),
			),
			true,
		);
		assert.equal(
			isPlaidInvestmentsProductUnavailable(
				plaidHttpError("PRODUCT_NOT_ENABLED"),
			),
			true,
		);
		assert.equal(
			isPlaidInvestmentsProductUnavailable(
				plaidHttpError("ITEM_LOGIN_REQUIRED"),
			),
			false,
		);
	});

	it("matches codes embedded in Error messages", () => {
		assert.equal(
			isPlaidInvestmentsProductUnavailable(
				new Error("Plaid API error: INVALID_PRODUCT"),
			),
			true,
		);
	});

	it("lets a structured error code override the message text", () => {
		const reconnectError = {
			...plaidHttpError("ITEM_LOGIN_REQUIRED"),
			message: "PRODUCT_NOT_ENABLED",
		};
		assert.equal(isPlaidInvestmentsProductUnavailable(reconnectError), false);
	});
});
