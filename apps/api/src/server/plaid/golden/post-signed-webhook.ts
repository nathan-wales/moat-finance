import { EventEmitter } from "node:events";
import type { NextApiRequest, NextApiResponse } from "next";
import handler from "../../../../pages/api/webhook/plaid";

function createRequest(rawBody: string, verification: string): NextApiRequest {
	const req = new EventEmitter() as EventEmitter & {
		method: string;
		headers: Record<string, string>;
		destroy: () => void;
	};
	req.method = "POST";
	req.headers = {
		"plaid-verification": verification,
		"content-type": "application/json",
	};
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

export async function postSignedPlaidWebhook(input: {
	rawBody: string;
	verification: string;
}): Promise<{ statusCode: number; body: unknown }> {
	const req = createRequest(input.rawBody, input.verification);
	const res = createResponse();
	await handler(req, res);
	return { statusCode: res.statusCode, body: res.body };
}
