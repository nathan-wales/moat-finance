import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { HeuristicTaxDocumentParser } from "@moat/domain";
import { DoclingCloudParser } from "./docling-cloud-parser";
import {
	createTaxDocumentParser,
	isAsyncTaxParseEnabled,
} from "./taxes-parser";

describe("createTaxDocumentParser", () => {
	it("uses Docling when DOCLING_PARSER_URL is set", () => {
		const parser = createTaxDocumentParser({
			DOCLING_PARSER_URL: "https://moat-docling-tax-parser.example",
		});
		assert.equal(parser instanceof DoclingCloudParser, true);
		assert.equal(parser.provider, "docling");
	});

	it("does not use a third-party parser when Docling is unset", () => {
		const parser = createTaxDocumentParser({});
		assert.equal(parser instanceof HeuristicTaxDocumentParser, true);
		assert.equal(parser.provider, "heuristic");
	});

	it("still uses the heuristic parser in production when Docling is unset", () => {
		const parser = createTaxDocumentParser({ NODE_ENV: "production" });
		assert.equal(parser instanceof HeuristicTaxDocumentParser, true);
		assert.equal(parser.provider, "heuristic");
	});

	it("enables async parse only in production with a parser URL", () => {
		assert.equal(
			isAsyncTaxParseEnabled({
				NODE_ENV: "production",
				DOCLING_PARSER_URL: "https://example",
			}),
			true,
		);
		assert.equal(
			isAsyncTaxParseEnabled({
				NODE_ENV: "development",
				DOCLING_PARSER_URL: "https://example",
			}),
			false,
		);
	});

	it("enables async parse in development when TAX_PARSE_ASYNC is true", () => {
		assert.equal(
			isAsyncTaxParseEnabled({
				NODE_ENV: "development",
				DOCLING_PARSER_URL: "https://example",
				TAX_PARSE_ASYNC: "true",
			}),
			true,
		);
		assert.equal(
			isAsyncTaxParseEnabled({
				NODE_ENV: "production",
				DOCLING_PARSER_URL: "https://example",
				TAX_PARSE_ASYNC: "false",
			}),
			false,
		);
	});
});

describe("DoclingCloudParser", () => {
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
			const parser = new DoclingCloudParser("http://127.0.0.1:18081", {
				allowInsecureLocal: true,
			});
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
