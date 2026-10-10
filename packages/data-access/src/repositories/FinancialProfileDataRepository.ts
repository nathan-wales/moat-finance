import type { FinancialProfileData } from "@moat/contracts";

export interface FinancialProfileDataRepository {
	get(input: { userId: string }): Promise<FinancialProfileData | null>;
	upsert(input: {
		userId: string;
		data: FinancialProfileData;
	}): Promise<FinancialProfileData>;
}
