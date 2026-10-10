import type { FinancialProfileData } from "../types";

export interface FinancialProfileSectionProps {
	data: FinancialProfileData;
	onChange: (data: FinancialProfileData) => void | Promise<void>;
	isSaving: boolean;
	isLoading?: boolean;
}

export type InsuranceStorageMode = "cloud" | "localPrivate";

export interface InsuranceIntakeCapabilities {
	assistedIntakeAvailable: boolean;
}
