import {
	type ParsedTaxDocument,
	TAX_DOCUMENT_PARSE_CLIENT_TIMEOUT_MS,
	type TaxDocumentParser,
} from "@moat/domain";
import { resolveCloudAccessToken } from "../lib/cloud-auth";

const DEFAULT_MOAT_API_URL = "https://api.moatfinance.ai";

function getApiBaseUrl(): string {
	const configured = process.env.MOAT_API_URL?.trim();
	const base = configured || DEFAULT_MOAT_API_URL;
	return base.replace(/\/$/, "");
}

export class MoatApiDoclingParser implements TaxDocumentParser {
	readonly provider = "docling";
	readonly version = "cloud";

	async parseDocument(input: {
		bytes: Uint8Array;
		mimeType: string;
		filename: string;
	}): Promise<ParsedTaxDocument> {
		const url = `${getApiBaseUrl()}/api/v1/taxes/parseDocument`;
		const accessToken = await resolveCloudAccessToken();
		let response: Response;
		try {
			response = await fetch(url, {
				method: "POST",
				headers: {
					Authorization: `Bearer ${accessToken}`,
					"Content-Type": "application/json",
				},
				body: JSON.stringify({
					filename: input.filename,
					mimeType: input.mimeType,
					data: Buffer.from(input.bytes).toString("base64"),
				}),
				signal: AbortSignal.timeout(TAX_DOCUMENT_PARSE_CLIENT_TIMEOUT_MS),
			});
		} catch (error) {
			if (error instanceof Error && error.name === "TimeoutError") {
				const timeout = new Error(
					`Tax document parser timed out after ${TAX_DOCUMENT_PARSE_CLIENT_TIMEOUT_MS}ms`,
				);
				timeout.name = "TimeoutError";
				throw timeout;
			}
			throw error;
		}
		const payload = (await response.json().catch(() => null)) as {
			data?: ParsedTaxDocument;
			error?: { message?: string };
		} | null;
		if (!response.ok) {
			throw new Error(payload?.error?.message ?? "Tax document parser failed");
		}
		const parsed = payload?.data;
		if (!parsed || typeof parsed.text !== "string") {
			throw new Error("Tax document parser returned an invalid response");
		}
		return parsed;
	}
}
