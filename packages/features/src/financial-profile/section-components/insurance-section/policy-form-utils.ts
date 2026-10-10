import {
	createInsuranceDetailsForType,
	type InsuranceCoverage,
	type InsuranceCoveredAsset,
	type InsuranceParty,
	type InsurancePolicy,
	type InsurancePolicyType,
	type InsurancePolicyV2,
	type InsuranceStorageScope,
	type InsuranceTypedDetails,
	normalizeInsurancePolicy,
} from "@moat/contracts";

export type PolicyFormValues = {
	id: string;
	type: InsurancePolicyType;
	providerName: string;
	policyName: string;
	policyNickname: string;
	status: InsurancePolicyV2["status"];
	effectiveStartDate: string;
	effectiveEndDate: string;
	renewalDate: string;
	premiumAmount: string;
	premiumCadence: NonNullable<InsurancePolicyV2["premiumCadence"]>;
	primaryCoverageLimit: string;
	deductibleAmount: string;
	copayAmount: string;
	coinsurancePercent: string;
	maxBenefitAmount: string;
	linkedAssetLabel: string;
	coveredPersonLabel: string;
	detailA: string;
	detailB: string;
	detailC: string;
	detailD: string;
	flagA: boolean;
	flagB: boolean;
	source: InsurancePolicyV2["source"];
	storageScope: InsurancePolicyV2["storageScope"];
	documents: NonNullable<InsurancePolicyV2["documents"]>;
	createdAt?: string;
};

export function createEmptyPolicyFormValues(
	id: string,
	storageScope: InsuranceStorageScope = "cloud",
): PolicyFormValues {
	return {
		id,
		type: "other",
		providerName: "",
		policyName: "New policy",
		policyNickname: "",
		status: "active",
		effectiveStartDate: "",
		effectiveEndDate: "",
		renewalDate: "",
		premiumAmount: "",
		premiumCadence: "monthly",
		primaryCoverageLimit: "",
		deductibleAmount: "",
		copayAmount: "",
		coinsurancePercent: "",
		maxBenefitAmount: "",
		linkedAssetLabel: "",
		coveredPersonLabel: "",
		detailA: "",
		detailB: "",
		detailC: "",
		detailD: "",
		flagA: false,
		flagB: false,
		source: "manual",
		storageScope,
		documents: [],
	};
}

export function policyToFormValues(policy: InsurancePolicy): PolicyFormValues {
	const normalizedPolicy = normalizeInsurancePolicy(policy);
	const primaryCoverage = normalizedPolicy.coverages[0];
	const primaryParty = normalizedPolicy.parties[0];
	const primaryAsset = normalizedPolicy.assets[0];
	const values: PolicyFormValues = {
		...createEmptyPolicyFormValues(normalizedPolicy.id),
		type: normalizedPolicy.type,
		providerName: normalizedPolicy.providerName,
		policyName: normalizedPolicy.policyName,
		policyNickname: normalizedPolicy.policyNickname ?? "",
		status: normalizedPolicy.status,
		effectiveStartDate: normalizedPolicy.effectiveStartDate ?? "",
		effectiveEndDate: normalizedPolicy.effectiveEndDate ?? "",
		renewalDate: normalizedPolicy.renewalDate ?? "",
		premiumAmount: formatFormNumber(normalizedPolicy.premiumAmount),
		premiumCadence: normalizedPolicy.premiumCadence ?? "monthly",
		primaryCoverageLimit: formatFormNumber(primaryCoverage?.limitAmount),
		deductibleAmount: formatFormNumber(primaryCoverage?.deductibleAmount),
		copayAmount: formatFormNumber(primaryCoverage?.copayAmount),
		coinsurancePercent: formatFormNumber(primaryCoverage?.coinsurancePercent),
		maxBenefitAmount: formatFormNumber(primaryCoverage?.maxBenefitAmount),
		linkedAssetLabel: primaryAsset?.label ?? "",
		coveredPersonLabel: primaryParty?.displayName ?? "",
		source: normalizedPolicy.source,
		storageScope: normalizedPolicy.storageScope,
		documents: normalizedPolicy.documents ?? [],
		createdAt: normalizedPolicy.createdAt,
	};

	return applyDetailsToValues(values, normalizedPolicy.details);
}

export function formValuesToPolicy(
	values: PolicyFormValues,
): InsurancePolicyV2 {
	const coverages = buildCoverages(values);
	const parties = buildParties(values);
	const assets = buildAssets(values);
	const missingFields = [
		values.providerName.trim() ? undefined : "providerName",
		values.policyName.trim() ? undefined : "policyName",
		values.premiumAmount.trim() ? undefined : "premiumAmount",
		coverages.length > 0 ? undefined : "coverages",
	].filter((field): field is string => Boolean(field));

	return {
		schemaVersion: 2,
		id: values.id,
		type: values.type,
		providerName: values.providerName.trim(),
		policyName: values.policyName.trim() || "New policy",
		policyNickname: optionalString(values.policyNickname),
		status: values.status,
		effectiveStartDate: optionalString(values.effectiveStartDate),
		effectiveEndDate: optionalString(values.effectiveEndDate),
		renewalDate: optionalString(values.renewalDate),
		premiumAmount: optionalNumber(values.premiumAmount),
		premiumCadence: values.premiumCadence,
		source: values.source,
		storageScope: values.storageScope,
		sensitivityTier: values.type === "life" ? "moderate" : "low",
		coverages,
		parties,
		assets,
		documents: values.documents,
		details: buildDetails(values),
		review: {
			completeness: missingFields.length === 0 ? "complete" : "partial",
			missingFields,
			nextReviewDate: optionalString(values.renewalDate),
		},
		createdAt: values.createdAt,
		updatedAt: new Date().toISOString(),
	};
}

function buildCoverages(values: PolicyFormValues): InsuranceCoverage[] {
	const limitAmount = optionalNumber(values.primaryCoverageLimit);
	const deductibleAmount = optionalNumber(values.deductibleAmount);
	const copayAmount = optionalNumber(values.copayAmount);
	const coinsurancePercent = optionalNumber(values.coinsurancePercent);
	const maxBenefitAmount = optionalNumber(values.maxBenefitAmount);

	if (
		limitAmount === undefined &&
		deductibleAmount === undefined &&
		copayAmount === undefined &&
		coinsurancePercent === undefined &&
		maxBenefitAmount === undefined
	) {
		return [];
	}

	return [
		{
			id: `${values.id}-primary-coverage`,
			coverageType: "primary",
			label: "Primary coverage",
			limitAmount,
			deductibleAmount,
			copayAmount,
			coinsurancePercent,
			maxBenefitAmount,
			sensitivityTier: "low",
		},
	];
}

function buildParties(values: PolicyFormValues): InsuranceParty[] {
	const displayName = optionalString(values.coveredPersonLabel);
	if (!displayName) return [];
	return [
		{
			id: `${values.id}-covered-person`,
			role: values.type === "auto" ? "listedDriver" : "coveredPerson",
			displayName,
			sensitivityTier: "moderate",
		},
	];
}

function buildAssets(values: PolicyFormValues): InsuranceCoveredAsset[] {
	const label = optionalString(values.linkedAssetLabel);
	if (!label) return [];
	return [
		{
			id: `${values.id}-linked-asset`,
			label,
			assetType: assetTypeForPolicyType(values.type),
			sensitivityTier: "low",
		},
	];
}

function buildDetails(values: PolicyFormValues): InsuranceTypedDetails {
	switch (values.type) {
		case "auto":
			return {
				type: "auto",
				bodilyInjuryLiability: optionalString(values.detailA),
				propertyDamageLiability: optionalString(values.detailB),
				collisionDeductible: optionalNumber(values.detailC),
				comprehensiveDeductible: optionalNumber(values.detailD),
				rentalReimbursement: values.flagA,
				roadsideAssistance: values.flagB,
			};
		case "health":
			return {
				type: "health",
				planType: optionalString(values.detailA),
				networkType: optionalString(values.detailB),
				individualOutOfPocketMax: optionalNumber(values.detailC),
				rxDeductible: optionalNumber(values.detailD),
				pcpRequired: values.flagA,
				hsaEligible: values.flagB,
			};
		case "dental":
			return {
				type: "dental",
				annualMaximum: optionalNumber(values.detailA),
				deductible: optionalNumber(values.detailB),
				preventiveCoverage: optionalString(values.detailC),
				majorCoverage: optionalString(values.detailD),
				orthodontiaCovered: values.flagA,
			};
		case "vision":
			return {
				type: "vision",
				examFrequency: optionalString(values.detailA),
				frameAllowance: optionalNumber(values.detailB),
				contactLensAllowance: optionalNumber(values.detailC),
				lensCoverage: optionalString(values.detailD),
			};
		case "life":
			return {
				type: "life",
				policyKind: optionalString(values.detailA),
				deathBenefit: optionalNumber(values.detailB),
				termExpiry: optionalString(values.detailC),
				cashValueBalance: optionalNumber(values.detailD),
			};
		case "disability":
			return {
				type: "disability",
				disabilityType: disabilityTypeValue(values.detailA),
				monthlyBenefit: optionalNumber(values.detailB),
				eliminationPeriod: optionalString(values.detailC),
				benefitDuration: optionalString(values.detailD),
				employerSponsored: values.flagA,
			};
		case "homeowners":
		case "renters":
			return {
				type: values.type,
				dwellingLimit: optionalNumber(values.detailA),
				personalPropertyLimit: optionalNumber(values.detailB),
				liabilityLimit: optionalNumber(values.detailC),
				deductible: optionalNumber(values.detailD),
				replacementCost: values.flagA,
			};
		case "longTermCare":
			return {
				type: "longTermCare",
				dailyBenefit: optionalNumber(values.detailA),
				monthlyBenefit: optionalNumber(values.detailB),
				benefitPool: optionalNumber(values.detailC),
				inflationProtection: optionalString(values.detailD),
				taxQualified: values.flagA,
			};
		case "umbrella":
			return {
				type: "umbrella",
				liabilityLimit: optionalNumber(values.detailA),
				retainedLimit: optionalNumber(values.detailB),
			};
		case "boat":
			return {
				type: "boat",
				hullCoverage: optionalNumber(values.detailA),
				liabilityLimit: optionalNumber(values.detailB),
			};
		case "other":
			return { type: "other", summary: optionalString(values.detailA) };
		default:
			return createInsuranceDetailsForType(values.type);
	}
}

function applyDetailsToValues(
	values: PolicyFormValues,
	details: InsuranceTypedDetails,
): PolicyFormValues {
	switch (details.type) {
		case "auto":
			return {
				...values,
				detailA: details.bodilyInjuryLiability ?? "",
				detailB: details.propertyDamageLiability ?? "",
				detailC: formatFormNumber(details.collisionDeductible),
				detailD: formatFormNumber(details.comprehensiveDeductible),
				flagA: details.rentalReimbursement ?? false,
				flagB: details.roadsideAssistance ?? false,
			};
		case "health":
			return {
				...values,
				detailA: details.planType ?? "",
				detailB: details.networkType ?? "",
				detailC: formatFormNumber(details.individualOutOfPocketMax),
				detailD: formatFormNumber(details.rxDeductible),
				flagA: details.pcpRequired ?? false,
				flagB: details.hsaEligible ?? false,
			};
		case "dental":
			return {
				...values,
				detailA: formatFormNumber(details.annualMaximum),
				detailB: formatFormNumber(details.deductible),
				detailC: details.preventiveCoverage ?? "",
				detailD: details.majorCoverage ?? "",
				flagA: details.orthodontiaCovered ?? false,
			};
		case "vision":
			return {
				...values,
				detailA: details.examFrequency ?? "",
				detailB: formatFormNumber(details.frameAllowance),
				detailC: formatFormNumber(details.contactLensAllowance),
				detailD: details.lensCoverage ?? "",
			};
		case "life":
			return {
				...values,
				detailA: details.policyKind ?? "",
				detailB: formatFormNumber(details.deathBenefit),
				detailC: details.termExpiry ?? "",
				detailD: formatFormNumber(details.cashValueBalance),
			};
		case "disability":
			return {
				...values,
				detailA: details.disabilityType ?? "",
				detailB: formatFormNumber(details.monthlyBenefit),
				detailC: details.eliminationPeriod ?? "",
				detailD: details.benefitDuration ?? "",
				flagA: details.employerSponsored ?? false,
			};
		case "homeowners":
		case "renters":
			return {
				...values,
				detailA: formatFormNumber(details.dwellingLimit),
				detailB: formatFormNumber(details.personalPropertyLimit),
				detailC: formatFormNumber(details.liabilityLimit),
				detailD: formatFormNumber(details.deductible),
				flagA: details.replacementCost ?? false,
			};
		case "longTermCare":
			return {
				...values,
				detailA: formatFormNumber(details.dailyBenefit),
				detailB: formatFormNumber(details.monthlyBenefit),
				detailC: formatFormNumber(details.benefitPool),
				detailD: details.inflationProtection ?? "",
				flagA: details.taxQualified ?? false,
			};
		case "umbrella":
			return {
				...values,
				detailA: formatFormNumber(details.liabilityLimit),
				detailB: formatFormNumber(details.retainedLimit),
			};
		case "boat":
			return {
				...values,
				detailA: formatFormNumber(details.hullCoverage),
				detailB: formatFormNumber(details.liabilityLimit),
			};
		case "other":
			return { ...values, detailA: details.summary ?? "" };
	}
}

function assetTypeForPolicyType(
	type: InsurancePolicyType,
): InsuranceCoveredAsset["assetType"] {
	if (type === "auto") return "vehicle";
	if (type === "boat") return "boat";
	if (type === "homeowners") return "home";
	if (type === "renters") return "home";
	return "other";
}

function disabilityTypeValue(value: string) {
	if (value === "shortTerm" || value === "longTerm") return value;
	return value ? "unknown" : undefined;
}

function optionalString(value: string) {
	const nextValue = value.trim();
	return nextValue.length > 0 ? nextValue : undefined;
}

function optionalNumber(value: string) {
	const nextValue = Number(value.replace(/,/g, ""));
	return value.trim() !== "" && Number.isFinite(nextValue)
		? nextValue
		: undefined;
}

function formatFormNumber(value?: number) {
	return value === undefined ? "" : String(value);
}
