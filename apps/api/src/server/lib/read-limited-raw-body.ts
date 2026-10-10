import type { IncomingMessage } from "node:http";

const DEFAULT_MAX_BYTES = 1024 * 1024;

export class RawBodyTooLargeError extends Error {
	constructor(readonly maxBytes: number) {
		super(`Request body exceeds ${maxBytes} bytes`);
		this.name = "RawBodyTooLargeError";
	}
}

export function readLimitedRawBody(
	req: IncomingMessage,
	maxBytes = DEFAULT_MAX_BYTES,
): Promise<string> {
	return new Promise((resolve, reject) => {
		let body = "";
		let byteLength = 0;
		let tooLarge = false;

		req.on("data", (chunk: Buffer) => {
			if (tooLarge) return;
			byteLength += chunk.byteLength;
			if (byteLength > maxBytes) {
				tooLarge = true;
				reject(new RawBodyTooLargeError(maxBytes));
				req.destroy();
				return;
			}
			body += chunk.toString("utf8");
		});

		req.on("end", () => {
			if (!tooLarge) resolve(body);
		});
		req.on("error", reject);
	});
}
