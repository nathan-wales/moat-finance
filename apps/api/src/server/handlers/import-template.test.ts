import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { ApiContext } from "../api-context";
import { importTemplate } from "./import-template";

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

describe("import template handlers", () => {
	it("list returns 401 when unauthenticated", async () => {
		await assert.rejects(
			() => importTemplate.list(apiContext(), {}),
			(error: Error & { status?: number }) => error.status === 401,
		);
	});

	it("create returns 401 in demo mode", async () => {
		await assert.rejects(
			() =>
				importTemplate.create(
					apiContext({
						isDemoMode: true,
						session: { user: { id: "user-1" } } as ApiContext["session"],
						userId: "user-1",
						actorUserId: "user-1",
					}),
					{
						name: "Chase",
						mapping: {
							date: "Date",
							description: "Memo",
							amount: "Amount",
						},
					},
				),
			(error: Error & { status?: number }) => error.status === 401,
		);
	});
});
