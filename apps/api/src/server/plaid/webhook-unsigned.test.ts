import assert from "node:assert/strict";
import { EventEmitter } from "node:events";
import { describe, it } from "node:test";
import type { NextApiRequest, NextApiResponse } from "next";
import handler from "../../../pages/api/webhook/plaid";

function createRequest(rawBody: string): NextApiRequest {
	const req = new EventEmitter() as EventEmitter & {
		method: string;
		headers: Record<string, string>;
		destroy: () => void;
	};
	req.method = "POST";
	req.headers = {};
	req.destroy = () => undefined;
	queueMicrotask(() => {
		req.emit("data", Buffer.from(rawBody));
		req.emit("end");
	});
	return req as unknown as NextApiRequest;
}

function createResponse(): NextApiResponse & {
	statusCode: number;
	body: unknown;
} {
	const res = {
		statusCode: 0,
		body: null as unknown,
		status(code: number) {
			res.statusCode = code;
			return res;
		},
		json(payload: unknown) {
			res.body = payload;
			return res;
		},
		end() {
			return res;
		},
	};
	return res as unknown as NextApiResponse & {
		statusCode: number;
		body: unknown;
	};
}

describe("Plaid webhook signature", () => {
	it("rejects an unsigned POST with 401", async () => {
		const req = createRequest(
			JSON.stringify({
				webhook_type: "TRANSACTIONS",
				webhook_code: "HISTORICAL_UPDATE",
				item_id: "golden-item-id",
			}),
		);
		const res = createResponse();
		await handler(req, res);
		assert.equal(res.statusCode, 401);
		assert.deepEqual(res.body, { error: "Invalid webhook signature" });
	});
});
