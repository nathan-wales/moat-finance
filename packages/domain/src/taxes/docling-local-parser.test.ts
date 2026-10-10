import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { DoclingLocalParser } from "./docling-local-parser";

describe("DoclingLocalParser", () => {
	it("does not post the document when /health is not Docling", async () => {
		const posted: string[] = [];
		const originalFetch = globalThis.fetch;
		globalThis.fetch = (async (
			input: RequestInfo | URL,
			init?: RequestInit,
		) => {
			const url = String(input);
			posted.push(`${init?.method ?? "GET"} ${url}`);
			if (url.endsWith("/health")) {
				return new Response(JSON.stringify({ code: 5, message: "Not Found" }), {
					status: 404,
					headers: { "content-type": "application/json" },
				});
			}
			return new Response("should-not-post", { status: 500 });
		}) as typeof fetch;
		try {
			const parser = new DoclingLocalParser("http://127.0.0.1:18081");
			await assert.rejects(
				() =>
					parser.parseDocument({
						bytes: new Uint8Array([1, 2, 3]),
						mimeType: "application/pdf",
						filename: "w2.pdf",
					}),
				/Tax document parser is not running/,
			);
			assert.deepEqual(posted, ["GET http://127.0.0.1:18081/health"]);
		} finally {
			globalThis.fetch = originalFetch;
		}
	});
});
