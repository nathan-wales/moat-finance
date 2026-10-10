import fs from "node:fs";
import path from "node:path";
import type { LocalAuditEntry } from "./types";

const AUDIT_FILE_NAME = "agent-audit.jsonl";
const MAX_AUDIT_LINES = 10_000;
const DEFAULT_PAGE_SIZE = 20;

export type ReadAuditLogInput = {
	limit?: number;
	cursor?: string;
	status?: LocalAuditEntry["status"];
	search?: string;
	tokenLabel?: string;
	/** Used when an entry has no stored tokenLabel. */
	tokenLabelsById?: Record<string, string>;
};

export type ReadAuditLogResult = {
	logs: LocalAuditEntry[];
	nextCursor: string | null;
};

/**
 * Appends one audit entry to the JSONL audit log.
 *
 * Entries never contain PII — no transaction descriptions, account numbers,
 * or token plaintext values.
 */
export function appendAuditEntry(
	userDataPath: string,
	entry: LocalAuditEntry,
): void {
	const filePath = path.join(userDataPath, AUDIT_FILE_NAME);
	const line = `${JSON.stringify(entry)}\n`;
	try {
		fs.appendFileSync(filePath, line, "utf-8");
	} catch {
		// Non-fatal — audit failures must never crash tool execution
	}
}

function resolveClientLabel(
	entry: LocalAuditEntry,
	tokenLabelsById: Record<string, string> | undefined,
): string {
	if (entry.tokenLabel) return entry.tokenLabel;
	return tokenLabelsById?.[entry.tokenId] ?? "";
}

function matchesAuditFilters(
	entry: LocalAuditEntry,
	input: ReadAuditLogInput,
): boolean {
	if (input.status && entry.status !== input.status) return false;

	const expectedLabel = input.tokenLabel?.trim().toLowerCase();
	if (expectedLabel) {
		const label = resolveClientLabel(
			entry,
			input.tokenLabelsById,
		).toLowerCase();
		if (label !== expectedLabel) return false;
	}

	const search = input.search?.trim().toLowerCase();
	if (!search) return true;

	const tool = entry.tool.toLowerCase();
	const label = resolveClientLabel(entry, input.tokenLabelsById).toLowerCase();
	return tool.includes(search) || label.includes(search);
}

function readAllAuditEntries(userDataPath: string): LocalAuditEntry[] {
	const filePath = path.join(userDataPath, AUDIT_FILE_NAME);
	if (!fs.existsSync(filePath)) return [];

	try {
		const lines = fs
			.readFileSync(filePath, "utf-8")
			.split("\n")
			.filter(Boolean);

		return lines
			.map((line) => {
				try {
					return JSON.parse(line) as LocalAuditEntry;
				} catch {
					return null;
				}
			})
			.filter((e): e is LocalAuditEntry => e !== null)
			.reverse();
	} catch {
		return [];
	}
}

/**
 * Reads audit entries with optional status/search filters and cursor pagination.
 * Newest entries first. Cursor is an ISO timestamp (`ts`); results are older than it.
 */
export function readAuditLog(
	userDataPath: string,
	input: ReadAuditLogInput = {},
): ReadAuditLogResult {
	const limit = Math.min(Math.max(input.limit ?? DEFAULT_PAGE_SIZE, 1), 100);
	const cursor = input.cursor?.trim() || undefined;

	const filtered = readAllAuditEntries(userDataPath).filter((entry) => {
		if (cursor && entry.ts >= cursor) return false;
		return matchesAuditFilters(entry, input);
	});

	const logs = filtered.slice(0, limit);
	const nextCursor =
		logs.length === limit ? (logs[logs.length - 1]?.ts ?? null) : null;

	return { logs, nextCursor };
}

/**
 * Rotates the audit log if it exceeds MAX_AUDIT_LINES to prevent unbounded growth.
 * Keeps the most recent entries.
 */
export function rotateAuditLogIfNeeded(userDataPath: string): void {
	const filePath = path.join(userDataPath, AUDIT_FILE_NAME);
	if (!fs.existsSync(filePath)) return;

	try {
		const lines = fs
			.readFileSync(filePath, "utf-8")
			.split("\n")
			.filter(Boolean);

		if (lines.length > MAX_AUDIT_LINES) {
			const kept = lines.slice(-MAX_AUDIT_LINES);
			fs.writeFileSync(filePath, `${kept.join("\n")}\n`, "utf-8");
		}
	} catch {
		// Non-fatal
	}
}
