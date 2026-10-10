import { emptyParsedTaxDocument } from "./parsed-document";
import type { ParsedTaxDocument, TaxDocumentParser } from "./parser";

const LOCAL_HOSTS = new Set(["localhost", "127.0.0.1", "::1"]);
const DEFAULT_PARSER_URL = "http://127.0.0.1:18081";

export class DoclingLocalParser implements TaxDocumentParser {
	readonly provider = "docling";
	readonly version: string;

	constructor(
		private parserUrl = process.env.DOCLING_PARSER_URL?.trim() ||
			DEFAULT_PARSER_URL,
		options: { parserVersion?: string } = {},
	) {
		this.version = options.parserVersion ?? "local";
	}

	async parseDocument(input: {
		bytes: Uint8Array;
		mimeType: string;
		filename: string;
	}): Promise<ParsedTaxDocument> {
		const url = `${this.parserUrl.replace(/\/$/, "")}/v1/parse`;
		await this.assertDoclingHealth();
		const response = await fetch(url, {
			method: "POST",
			headers: {
				"content-type": input.mimeType,
				"x-moat-mime-type": input.mimeType,
			},
			body: Buffer.from(input.bytes),
		});
		if (!response.ok) {
			throw new Error("Tax document parser failed");
		}
		const payload = (await response.json()) as ParsedTaxDocument;
		if (!payload || typeof payload.text !== "string") {
			return emptyParsedTaxDocument({
				parserName: this.provider,
				parserVersion: this.version,
			});
		}
		return payload;
	}

	private async assertDoclingHealth(): Promise<void> {
		const healthUrl = `${this.parserUrl.replace(/\/$/, "")}/health`;
		let response: Response;
		try {
			response = await fetch(healthUrl, { method: "GET" });
		} catch {
			throw new Error("Tax document parser unreachable");
		}
		const payload = (await response.json().catch(() => null)) as {
			parser?: unknown;
		} | null;
		const isDocling =
			response.ok && payload !== null && payload.parser === "docling";
		if (!isDocling) {
			throw new Error("Tax document parser is not running");
		}
		if (!LOCAL_HOSTS.has(this.hostname())) {
			throw new Error("Local Docling parser must run on localhost");
		}
	}

	private hostname(): string {
		try {
			return new URL(this.parserUrl).hostname;
		} catch {
			return "";
		}
	}
}
