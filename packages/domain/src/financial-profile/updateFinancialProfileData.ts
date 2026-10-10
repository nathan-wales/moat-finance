import type { FinancialProfileData } from "@moat/contracts";
import type { AppContext } from "../context";
import { stripTaxProfileRecommendations } from "./apply-tax-profile-defaults";
import { pruneMissingManualInvestmentsFromProfile } from "./strip-manual-investment-from-profile";

export async function updateFinancialProfileData(
	ctx: AppContext,
	data: FinancialProfileData,
): Promise<FinancialProfileData> {
	if (!ctx.repositories.financialProfileData) {
		throw new Error("FinancialProfileData repository not available");
	}

	const canonicalInvestments = ctx.repositories.investments
		? await ctx.repositories.investments.list({ userId: ctx.userId })
		: [];
	const pruned = pruneMissingManualInvestmentsFromProfile(
		stripTaxProfileRecommendations(data),
		new Set(canonicalInvestments.map((investment) => investment.id)),
	);

	return ctx.repositories.financialProfileData.upsert({
		userId: ctx.userId,
		data: pruned,
	});
}
