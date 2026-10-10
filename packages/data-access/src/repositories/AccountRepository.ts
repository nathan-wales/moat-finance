import type { AccountSummary, UpsertAccountInput } from "../types";

export interface AccountRepository {
	listForSummary(input: { userId: string }): Promise<AccountSummary[]>;

	listAll(input: { userId: string }): Promise<AccountSummary[]>;

	upsert(input: { userId: string } & UpsertAccountInput): Promise<AccountSummary>;
}
