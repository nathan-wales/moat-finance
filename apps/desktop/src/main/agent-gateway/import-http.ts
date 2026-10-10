import type { IncomingMessage, ServerResponse } from "node:http";
import { DetectColumnsInputSchema } from "@moat/contracts";
import {
	autoDetectColumns,
	commitTransactionImport,
	previewTransactionImport,
	TransactionImportError,
} from "@moat/domain";
import {
	commitTransactionImportInputSchema,
	previewTransactionImportInputSchema,
} from "@moat/mcp-contracts";
import type { AppRuntime } from "@moat/runtime";
import { readCsvFromFilePath } from "../lib/read-import-csv-file";
import { applyRulesAndPairImportedTransactions } from "../services/import-post-process";
import { appendAuditEntry } from "./audit-log";
import type { LocalAgentContext } from "./types";

export type { GatewayAuthResult, GatewayRoute } from "./gateway-routes";
export {
	authorizeGatewayWrite,
	getBearerToken,
	matchGatewayRoute,
	normalizeGatewayPath,
} from "./gateway-routes";

export const IMPORT_MAX_BODY_BYTES = 2 * 1024 * 1024;

export function sendJson(
	res: ServerResponse,
	status: number,
	body: object,
): void {
	const payload = JSON.stringify(body);
	res.writeHead(status, {
		"Content-Type": "application/json",
		"Content-Length": Buffer.byteLength(payload),
	});
	res.end(payload);
}

export function readJsonBody(
	req: IncomingMessage,
	maxBytes: number,
): Promise<unknown> {
	return new Promise((resolve, reject) => {
		const chunks: Buffer[] = [];
		let total = 0;
		req.on("data", (chunk: Buffer) => {
			total += chunk.length;
			if (total > maxBytes) {
				reject(new Error("Payload too large"));
				req.destroy();
				return;
			}
			chunks.push(chunk);
		});
		req.on("end", () => {
			try {
				const raw = Buffer.concat(chunks).toString("utf-8");
				resolve(raw ? JSON.parse(raw) : {});
			} catch (error) {
				reject(error);
			}
		});
		req.on("error", reject);
	});
}

function formatSampleRow(row: {
	date: Date;
	amount: number;
	type: "INCOME" | "EXPENSE";
	description: string;
	category?: string;
}) {
	return {
		date: row.date.toISOString().slice(0, 10),
		amount: row.amount,
		type: row.type,
		description: row.description,
		...(row.category ? { category: row.category } : {}),
	};
}

async function parseImportBody(req: IncomingMessage): Promise<unknown> {
	return readJsonBody(req, IMPORT_MAX_BODY_BYTES);
}

function isZodLikeError(error: unknown): error is { issues: unknown[] } {
	return Boolean(
		error &&
			typeof error === "object" &&
			"issues" in error &&
			Array.isArray((error as { issues: unknown }).issues),
	);
}

function importErrorStatus(error: unknown): {
	status: number;
	body: Record<string, unknown>;
} {
	if (error instanceof TransactionImportError) {
		return { status: 400, body: { error: error.message, code: error.code } };
	}
	if (isZodLikeError(error)) {
		return {
			status: 400,
			body: { error: "Invalid import payload", issues: error.issues.length },
		};
	}
	if (error instanceof Error && error.message === "Payload too large") {
		return { status: 413, body: { error: "Payload too large" } };
	}
	if (error instanceof SyntaxError) {
		return { status: 400, body: { error: "Invalid JSON" } };
	}
	return {
		status: 500,
		body: { error: "Import request failed" },
	};
}

export async function handleImportHttpRequest(input: {
	route: "import-preview" | "import-commit" | "import-detect";
	req: IncomingMessage;
	res: ServerResponse;
	agentContext: LocalAgentContext;
	appRuntime: AppRuntime;
	userDataPath: string;
}): Promise<void> {
	const start = Date.now();
	const toolName =
		input.route === "import-preview"
			? "POST /import/transactions/preview"
			: input.route === "import-commit"
				? "POST /import/transactions"
				: "POST /import/columns/detect";

	try {
		const body = await parseImportBody(input.req);

		if (input.route === "import-detect") {
			const parsed = DetectColumnsInputSchema.parse(body);
			sendJson(input.res, 200, {
				mapping: autoDetectColumns(parsed.headers),
			});
		} else if (input.route === "import-preview") {
			const parsed = previewTransactionImportInputSchema.parse(body);
			const csvText = parsed.filePath
				? await readCsvFromFilePath(parsed.filePath)
				: parsed.csvText;
			const preview = await previewTransactionImport(input.appRuntime, {
				accountId: parsed.accountId,
				rows: parsed.rows,
				csvText,
				mapping: parsed.mapping,
				templateId: parsed.templateId,
				headers: parsed.headers,
				rawRows: parsed.rawRows,
			});
			sendJson(input.res, 200, {
				schemaVersion: "2026-05-04",
				kind: "transactions.import_preview",
				newCount: preview.newCount,
				duplicateCount: preview.duplicateCount,
				invalidCount: preview.invalidCount,
				headers: preview.headers,
				sample: preview.sample.map(formatSampleRow),
				categoryColumnMapped: preview.categoryColumnMapped,
				uncategorizedWarning: preview.uncategorizedWarning,
			});
		} else {
			const parsed = commitTransactionImportInputSchema.parse(body);
			const csvText = parsed.filePath
				? await readCsvFromFilePath(parsed.filePath)
				: parsed.csvText;
			const result = await commitTransactionImport(input.appRuntime, {
				accountId: parsed.accountId,
				rows: parsed.rows,
				csvText,
				mapping: parsed.mapping,
				templateId: parsed.templateId,
				headers: parsed.headers,
				rawRows: parsed.rawRows,
				confirmedNewCount: parsed.confirmedNewCount,
			});
			if (result.status === "confirmation_mismatch") {
				sendJson(input.res, 409, {
					schemaVersion: "2026-05-04",
					kind: "transactions.import_refused",
					importStatus: "confirmation_mismatch",
					actualNewCount: result.actualNewCount,
					duplicateCount: result.duplicateCount,
					invalidCount: result.invalidCount,
				});
			} else {
				await applyRulesAndPairImportedTransactions(
					input.appRuntime,
					result.transactionIds,
				);
				sendJson(input.res, 200, {
					schemaVersion: "2026-05-04",
					kind: "transactions.import_applied",
					importStatus: "applied",
					imported: result.imported,
					skipped: result.skipped,
					newCount: result.newCount,
					duplicateCount: result.duplicateCount,
					invalidCount: result.invalidCount,
				});
			}
		}

		appendAuditEntry(input.userDataPath, {
			ts: new Date().toISOString(),
			tokenId: input.agentContext.tokenId,
			tokenLabel: input.agentContext.label,
			tool: toolName,
			scopes: input.agentContext.scopes,
			status: "success",
			durationMs: Date.now() - start,
		});
	} catch (error) {
		const mapped = importErrorStatus(error);
		if (!input.res.headersSent) {
			sendJson(input.res, mapped.status, mapped.body);
		}
		appendAuditEntry(input.userDataPath, {
			ts: new Date().toISOString(),
			tokenId: input.agentContext.tokenId,
			tokenLabel: input.agentContext.label,
			tool: toolName,
			scopes: input.agentContext.scopes,
			status: mapped.status === 403 ? "denied" : "error",
			durationMs: Date.now() - start,
			errorCode:
				error instanceof TransactionImportError
					? error.code
					: mapped.status === 400
						? "INVALID_IMPORT"
						: "IMPORT_ERROR",
		});
	}
}
