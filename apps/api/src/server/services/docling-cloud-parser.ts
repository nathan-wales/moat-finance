import {
	emptyParsedTaxDocument,
	type ParsedTaxDocument,
	type TaxDocumentParser,
} from "@moat/domain";
import { logger } from "../../lib/logger";
import { getIdentityTokenForAudience } from "../lib/google-identity";

const LOCAL_HOSTS = new Set(["localhost", "127.0.0.1", "::1"]);

export class DoclingCloudParser implements TaxDocumentParser {
	readonly provider = "docling";
	readonly version: string;

	constructor(
		private parserUrl: string,
		private options: {
			allowInsecureLocal?: boolean;
			parserVersion?: string;
		} = {},
	) {
		this.version = options.parserVersion ?? "cloud";
	}

	async parseDocument(input: {
		bytes: Uint8Array;
		mimeType: string;
		filename: string;
	}): Promise<ParsedTaxDocument> {
		const url = `${this.parserUrl.replace(/\/$/, "")}/v1/parse`;
		const headers: Record<string, string> = {
			"content-type": input.mimeType,
			"x-moat-mime-type": input.mimeType,
		};
		if (!this.isInsecureLocal()) {
			headers.authorization = `Bearer ${await getIdentityTokenForAudience(this.parserUrl.replace(/\/$/, ""))}`;
		}

		const started = Date.now();
		const parserHost = this.parserHost(url);
		await this.assertDoclingHealth({
			parserHost,
			authorization: headers.authorization,
		});
		let response: Response;
		try {
			response = await fetch(url, {
				method: "POST",
				headers,
				body: Buffer.from(input.bytes),
			});
		} catch (error) {
			logger.warn("docling_parse_unreachable", {
				feature: "tax-parse",
				operation: "DoclingCloudParser.parseDocument",
				parserHost,
				errorName: error instanceof Error ? error.name : "unknown",
			});
			throw error;
		}
		if (!response.ok) {
			logger.warn("docling_parse_http_failed", {
				feature: "tax-parse",
				operation: "DoclingCloudParser.parseDocument",
				status: response.status,
				durationMs: Date.now() - started,
				parserHost,
			});
			throw new Error("Tax document parser failed");
		}
		const payload = (await response.json()) as ParsedTaxDocument;
		if (!payload || typeof payload.text !== "string") {
			return emptyParsedTaxDocument({
				parserName: this.provider,
				parserVersion: this.version,
			});
		}
		logger.info("docling_parse_completed", {
			feature: "tax-parse",
			operation: "DoclingCloudParser.parseDocument",
			durationMs: Date.now() - started,
			pageCount: payload.pageCount ?? payload.pages.length,
			parserVersion: payload.parserVersion ?? this.version,
		});
		return payload;
	}

	private isInsecureLocal(): boolean {
		if (!this.options.allowInsecureLocal) return false;
		try {
			const host = new URL(this.parserUrl).hostname;
			return LOCAL_HOSTS.has(host);
		} catch {
			return false;
		}
	}

	private parserHost(url: string): string {
		try {
			const parsedUrl = new URL(url);
			return `${parsedUrl.hostname}:${parsedUrl.port || (parsedUrl.protocol === "https:" ? "443" : "80")}`;
		} catch {
			return "invalid-url";
		}
	}

	private async assertDoclingHealth(input: {
		parserHost: string;
		authorization?: string;
	}): Promise<void> {
		const healthUrl = `${this.parserUrl.replace(/\/$/, "")}/health`;
		const headers: Record<string, string> = {};
		if (input.authorization) {
			headers.authorization = input.authorization;
		}
		let response: Response;
		try {
			response = await fetch(healthUrl, { method: "GET", headers });
		} catch (error) {
			logger.warn("docling_health_unreachable", {
				feature: "tax-parse",
				operation: "DoclingCloudParser.assertDoclingHealth",
				parserHost: input.parserHost,
				errorName: error instanceof Error ? error.name : "unknown",
			});
			throw new Error("Tax document parser unreachable");
		}
		const payload = (await response.json().catch(() => null)) as {
			parser?: unknown;
		} | null;
		const isDocling =
			response.ok && payload !== null && payload.parser === "docling";
		if (!isDocling) {
			logger.warn("docling_health_mismatch", {
				feature: "tax-parse",
				operation: "DoclingCloudParser.assertDoclingHealth",
				parserHost: input.parserHost,
				status: response.status,
			});
			throw new Error("Tax document parser is not running");
		}
	}
}
