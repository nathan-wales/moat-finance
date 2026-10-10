import type { FinancialProfile, UpdateFinancialProfileInput } from "../types";

export interface FinancialProfileRepository {
	get(input: { userId: string }): Promise<FinancialProfile | null>;

	upsert(input: { userId: string } & UpdateFinancialProfileInput): Promise<FinancialProfile>;
}
