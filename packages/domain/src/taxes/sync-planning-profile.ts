import type {
	FinancialProfileData,
	TaxFact,
	TaxProfile,
} from "@moat/contracts";
import type { AppContext } from "../context";

export type PlanningTaxPatch = Partial<
	Pick<TaxProfile, "filingStatus" | "selfEmployedIncome" | "rentalIncome">
>;

const FILING_STATUSES: TaxProfile["filingStatus"][] = [
	"Single",
	"Married filing jointly",
	"Married filing separately",
	"Head of household",
];

export function parsePlanningFilingStatus(
	value: unknown,
): TaxProfile["filingStatus"] | null {
	const raw = String(value ?? "").trim();
	const exact = FILING_STATUSES.find((status) => status === raw);
	if (exact) return exact;
	const lower = raw.toLowerCase();
	if (lower.includes("head of household")) return "Head of household";
	if (lower.includes("separat")) return "Married filing separately";
	if (lower.includes("joint") || lower.includes("married")) {
		return "Married filing jointly";
	}
	if (lower.includes("single")) return "Single";
	return null;
}

export function planningPatchFromFact(
	fact: Pick<TaxFact, "type" | "category" | "value">,
): PlanningTaxPatch | null {
	if (
		fact.type === "prior.filing_status" ||
		fact.type === "identity.filing_status"
	) {
		const filingStatus = parsePlanningFilingStatus(fact.value);
		return filingStatus ? { filingStatus } : null;
	}
	if (
		fact.type.startsWith("1099nec.") ||
		fact.type.startsWith("1099misc.") ||
		fact.type.startsWith("1099k.") ||
		fact.type.startsWith("k1.")
	) {
		return { selfEmployedIncome: true };
	}
	if (
		fact.category === "real_estate" &&
		fact.type !== "candidate.expected_1098"
	) {
		return { rentalIncome: true };
	}
	return null;
}

export function applyPlanningSeedToProfile(
	data: FinancialProfileData,
	patch: PlanningTaxPatch,
): FinancialProfileData | null {
	const tax = data.taxProfile;
	const next = { ...tax };
	let changed = false;
	if (patch.filingStatus && patch.filingStatus !== tax.filingStatus) {
		next.filingStatus = patch.filingStatus;
		changed = true;
	}
	if (patch.selfEmployedIncome === true && !tax.selfEmployedIncome) {
		next.selfEmployedIncome = true;
		changed = true;
	}
	if (patch.rentalIncome === true && !tax.rentalIncome) {
		next.rentalIncome = true;
		changed = true;
	}
	if (!changed) return null;
	next.lastUpdated = new Date().toISOString().slice(0, 10);
	return { ...data, taxProfile: next };
}

export async function syncPlanningTaxProfileFromFact(
	ctx: AppContext,
	fact: Pick<TaxFact, "type" | "category" | "value">,
): Promise<boolean> {
	const patch = planningPatchFromFact(fact);
	const repo = ctx.repositories.financialProfileData;
	if (!patch || !repo) return false;
	const current = await repo.get({ userId: ctx.userId });
	if (!current) return false;
	const next = applyPlanningSeedToProfile(current, patch);
	if (!next) return false;
	await repo.upsert({ userId: ctx.userId, data: next });
	return true;
}
