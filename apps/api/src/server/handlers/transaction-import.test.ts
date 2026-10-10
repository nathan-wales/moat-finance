import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
	commitTransactionImportInputSchema,
	previewTransactionImportInputSchema,
} from "@moat/contracts";
import type { ApiContext } from "../api-context";
import { previewTransactionImportForUser } from "../services/transaction-import.service";
import { transaction } from "./transaction";

function apiContext(overrides: Partial<ApiContext> = {}): ApiContext {
	return {
		session: null,
		jwtPayload: null,
		isDemoMode: false,
		userId: null,
		actorUserId: null,
		...overrides,
	} as ApiContext;
}

describe("transaction import handlers", () => {
	it("previewImport returns 401 when unauthenticated", async () => {
		await assert.rejects(
			() =>
				transaction.previewImport(apiContext(), {
					csvText: "Date,Amount,Description\n2026-01-01,12.50,Coffee",
					mapping: {
						date: "Date",
						amount: "Amount",
						description: "Description",
					},
				}),
			(error: Error & { status?: number }) => error.status === 401,
		);
	});

	it("commitImport returns 401 when unauthenticated", async () => {
		await assert.rejects(
			() =>
				transaction.commitImport(apiContext(), {
					csvText: "Date,Amount,Description\n2026-01-01,12.50,Coffee",
					mapping: {
						date: "Date",
						amount: "Amount",
						description: "Description",
					},
					confirmed: true,
					confirmedNewCount: 1,
				}),
			(error: Error & { status?: number }) => error.status === 401,
		);
	});

	it("previewImport returns 401 in demo mode even with a session", async () => {
		await assert.rejects(
			() =>
				transaction.previewImport(
					apiContext({
						isDemoMode: true,
						session: { user: { id: "user-1" } } as ApiContext["session"],
						userId: "user-1",
						actorUserId: "user-1",
					}),
					{
						csvText: "Date,Amount,Description\n2026-01-01,12.50,Coffee",
						mapping: {
							date: "Date",
							amount: "Amount",
							description: "Description",
						},
					},
				),
			(error: Error & { status?: number }) => error.status === 401,
		);
	});

	it("rejects more than 5,000 rows before the handler runs domain", () => {
		const rows = Array.from({ length: 5001 }, () => ({
			date: "2026-01-01",
			amount: 1,
		}));
		const parsed = previewTransactionImportInputSchema.safeParse({ rows });
		assert.equal(parsed.success, false);
	});

	it("commit input requires confirmed and confirmedNewCount", () => {
		const parsed = commitTransactionImportInputSchema.safeParse({
			rows: [{ date: "2026-01-01", amount: 1 }],
		});
		assert.equal(parsed.success, false);
	});

	it("rejects mixed source shapes", () => {
		const parsed = previewTransactionImportInputSchema.safeParse({
			rows: [{ date: "2026-01-01", amount: 1 }],
			csvText: "Date,Amount\n2026-01-01,1",
			mapping: { date: "Date", amount: "Amount" },
		});
		assert.equal(parsed.success, false);
	});

	it("accepts sampleOffset for preview paging", () => {
		const parsed = previewTransactionImportInputSchema.safeParse({
			rows: [{ date: "2026-01-01", amount: 1 }],
			sampleSize: 100,
			sampleOffset: 100,
		});
		assert.equal(parsed.success, true);
	});

	it("rejects filePath on preview schema mix with rows", () => {
		const parsed = previewTransactionImportInputSchema.safeParse({
			rows: [{ date: "2026-01-01", amount: 1 }],
			filePath: "/tmp/statement.csv",
		});
		assert.equal(parsed.success, false);
	});

	it("rejects filePath in the web import service", async () => {
		await assert.rejects(
			() =>
				previewTransactionImportForUser("user-1", {} as never, {
					filePath: "/tmp/statement.csv",
					mapping: { date: "Date", amount: "Amount" },
				}),
			(error: Error & { status?: number; code?: string }) =>
				error.status === 400 && error.code === "FILE_PATH_NOT_SUPPORTED",
		);
	});
});
