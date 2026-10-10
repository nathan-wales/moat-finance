import { z } from "zod";

// ─── Sub-types ────────────────────────────────────────────────────────────────

export interface FinancialProfileRecord {
	id: string;
	householdType: "Individual" | "Couple" | "Family";
	location: string;
	lifeStage: "Early career" | "Family" | "Pre-retirement" | "Retired" | "Other";
	employmentType:
		| "W-2"
		| "Freelancer"
		| "Business owner"
		| "Retired"
		| "Student"
		| "Other";
	planningHorizon: "1 year" | "5 years" | "10 years" | "20+ years";
	riskTolerance: "Conservative" | "Balanced" | "Aggressive";
	dependentsCount: number;
	housingStatus: "Homeowner" | "Renter" | "Other";
	lastUpdated: string;
	source: "Manual" | "Synced";
}

export interface ProfileAccount {
	id: string;
	name: string;
	institution: string;
	type: string;
	balance: number;
	connectionStatus: "Synced" | "Manual";
	lastSynced: string;
	syncIsStale?: boolean;
	includedInNetWorth: boolean;
	hidden?: boolean;
	plaidItemId?: string;
	notes?: string;
	nameOverride?: string;
}

export interface IncomeSource {
	id: string;
	name: string;
	type: string;
	amount: number;
	frequency: "Monthly" | "Annual" | "Quarterly" | "One-time";
	growthAssumption: string;
	startDate?: string;
	endDate?: string;
	includeInForecast: boolean;
}

export interface ProfileAsset {
	id: string;
	name: string;
	type:
		| "Real estate"
		| "Vehicle"
		| "Boat"
		| "Business"
		| "Personal property"
		| "Collectible"
		| "Cash-like asset"
		| "Other";
	estimatedValue: number;
	linkedLiability?: string;
	linkedInsurance?: string;
	includeInNetWorth: boolean;
	includeInForecast: boolean;
}

export interface ProfileLiability {
	id: string;
	name: string;
	type: string;
	balance: number;
	interestRate: number;
	monthlyPayment: number;
	linkedAsset?: string;
	payoffDate?: string;
	loanStartDate?: string;
	loanTermYears?: number;
	autoUpdateBalance?: boolean;
	lastBalanceAmortizedAt?: string;
	nextBalanceAmortizationDueAt?: string;
	includeInNetWorth: boolean;
	includeInForecast: boolean;
}

export interface ProfileInvestment {
	id: string;
	name: string;
	type: string;
	currentValue: number;
	monthlyContribution: number;
	expectedReturn: number;
	accountLink?: string;
	includeInForecast: boolean;
	autoUpdateBalance?: boolean;
	notes?: string;
	forecastInputsUserEdited?: boolean;
}

export interface LegacyInsurancePolicy {
	id: string;
	name: string;
	type:
		| "Health"
		| "Dental"
		| "Vision"
		| "Auto"
		| "Home"
		| "Renters"
		| "Life"
		| "Disability"
		| "Umbrella"
		| "Boat"
		| "Other";
	provider: string;
	premium: number;
	frequency: "Monthly" | "Quarterly" | "Semiannual" | "Annual";
	coverageAmount?: number;
	linkedAsset?: string;
	renewalDate?: string;
}

export type InsurancePolicyType =
	| "auto"
	| "health"
	| "dental"
	| "vision"
	| "life"
	| "disability"
	| "homeowners"
	| "renters"
	| "longTermCare"
	| "umbrella"
	| "boat"
	| "other";

export type InsuranceSensitivityTier =
	| "low"
	| "moderate"
	| "highLocalOnly"
	| "forbidden";

export type InsuranceStorageScope = "cloud" | "localPrivate";

export interface InsuranceCoverage {
	id: string;
	coverageType: string;
	label: string;
	limitAmount?: number;
	deductibleAmount?: number;
	copayAmount?: number;
	coinsurancePercent?: number;
	maxBenefitAmount?: number;
	appliesTo?: string;
	notes?: string;
	sensitivityTier: InsuranceSensitivityTier;
}

export interface InsuranceParty {
	id: string;
	role:
		| "policyholder"
		| "coveredPerson"
		| "beneficiary"
		| "dependent"
		| "listedDriver"
		| "owner"
		| "mortgagee"
		| "lienholder"
		| "other";
	displayName?: string;
	percentage?: number;
	relationship?: string;
	sensitivityTier: Exclude<InsuranceSensitivityTier, "forbidden">;
}

export interface InsuranceCoveredAsset {
	id: string;
	linkedAssetId?: string;
	label: string;
	assetType:
		| "vehicle"
		| "home"
		| "rentalProperty"
		| "boat"
		| "valuable"
		| "other";
	summary?: string;
	sensitivityTier: "low" | "moderate";
}

export interface InsuranceDocumentReference {
	id: string;
	documentName: string;
	documentType:
		| "declarations"
		| "idCard"
		| "policy"
		| "bill"
		| "eob"
		| "claim"
		| "medicalRecord"
		| "other";
	storageScope: InsuranceStorageScope;
	redactionStatus: "notRequired" | "pending" | "redacted" | "blocked";
	retainedOriginal: boolean;
	localOnly: boolean;
	extractedAt?: string;
	extractionConfidence?: number;
}

export interface InsuranceReviewState {
	lastReviewedAt?: string;
	nextReviewDate?: string;
	completeness: "basic" | "partial" | "complete";
	missingFields: string[];
}

export type InsuranceTypedDetails =
	| {
			type: "auto";
			bodilyInjuryLiability?: string;
			propertyDamageLiability?: string;
			uninsuredMotorist?: string;
			collisionDeductible?: number;
			comprehensiveDeductible?: number;
			medicalPaymentsOrPip?: string;
			rentalReimbursement?: boolean;
			roadsideAssistance?: boolean;
			lienholderLabel?: string;
	  }
	| {
			type: "health";
			planType?: string;
			coverageTier?: string;
			networkType?: string;
			individualDeductible?: number;
			familyDeductible?: number;
			individualOutOfPocketMax?: number;
			familyOutOfPocketMax?: number;
			rxDeductible?: number;
			pcpRequired?: boolean;
			referralRequired?: boolean;
			hsaEligible?: boolean;
	  }
	| {
			type: "dental";
			annualMaximum?: number;
			deductible?: number;
			preventiveCoverage?: string;
			basicCoverage?: string;
			majorCoverage?: string;
			orthodontiaCovered?: boolean;
			orthodontiaLifetimeMax?: number;
			network?: string;
	  }
	| {
			type: "vision";
			examFrequency?: string;
			frameAllowance?: number;
			contactLensAllowance?: number;
			lensCoverage?: string;
			lasikDiscount?: string;
			network?: string;
	  }
	| {
			type: "life";
			policyKind?: string;
			insuredPersonLabel?: string;
			ownerLabel?: string;
			deathBenefit?: number;
			termExpiry?: string;
			cashValueBalance?: number;
			riders?: string;
			policyLoans?: number;
	  }
	| {
			type: "disability";
			disabilityType?: "shortTerm" | "longTerm" | "unknown";
			monthlyBenefit?: number;
			incomeReplacementPercent?: number;
			eliminationPeriod?: string;
			benefitDuration?: string;
			colaRider?: boolean;
			employerSponsored?: boolean;
			renewability?: string;
	  }
	| {
			type: "homeowners" | "renters";
			dwellingLimit?: number;
			otherStructuresLimit?: number;
			personalPropertyLimit?: number;
			lossOfUseLimit?: number;
			liabilityLimit?: number;
			medicalPaymentsLimit?: number;
			deductible?: number;
			replacementCost?: boolean;
			endorsements?: string;
			mortgageeLabel?: string;
	  }
	| {
			type: "longTermCare";
			dailyBenefit?: number;
			monthlyBenefit?: number;
			benefitPool?: number;
			eliminationPeriod?: string;
			benefitDuration?: string;
			inflationProtection?: string;
			taxQualified?: boolean;
	  }
	| { type: "umbrella"; liabilityLimit?: number; retainedLimit?: number }
	| { type: "boat"; hullCoverage?: number; liabilityLimit?: number }
	| { type: "other"; summary?: string };

export interface InsurancePolicyV2 {
	schemaVersion: 2;
	id: string;
	type: InsurancePolicyType;
	providerName: string;
	policyName: string;
	policyNickname?: string;
	status: "active" | "pending" | "cancelled" | "expired" | "unknown";
	effectiveStartDate?: string;
	effectiveEndDate?: string;
	renewalDate?: string;
	premiumAmount?: number;
	premiumCadence?:
		| "monthly"
		| "quarterly"
		| "semiannual"
		| "annual"
		| "oneTime"
		| "unknown";
	source: "manual" | "uploadExtracted" | "api" | "imported";
	storageScope: InsuranceStorageScope;
	sensitivityTier: InsuranceSensitivityTier;
	coverages: InsuranceCoverage[];
	parties: InsuranceParty[];
	assets: InsuranceCoveredAsset[];
	documents?: InsuranceDocumentReference[];
	details: InsuranceTypedDetails;
	review: InsuranceReviewState;
	createdAt?: string;
	updatedAt?: string;
}

export type InsurancePolicy = LegacyInsurancePolicy | InsurancePolicyV2;

export interface TaxProfile {
	filingStatus:
		| "Single"
		| "Married filing jointly"
		| "Married filing separately"
		| "Head of household";
	taxYear: number;
	estimatedFederalTaxBracket: string;
	estimatedStateTaxRate: string;
	totalAnnualIncome: number;
	taxableIncomeEstimate: number;
	deductionStrategy: "Standard" | "Itemized";
	selfEmployedIncome: boolean;
	rentalIncome: boolean;
	lastUpdated: string;
}

export interface TaxProfileRecommendations {
	taxYear: number;
	estimatedFederalTaxBracket: string;
	totalAnnualIncome: number;
	taxableIncomeEstimate: number;
	selfEmployedIncome: boolean;
	rentalIncome: boolean;
}

export interface ForecastAssumptions {
	inflationRate: number;
	incomeGrowthRate: number;
	expenseGrowthRate: number;
	investmentReturnRate: number;
	realEstateAppreciationRate: number;
	defaultCashYield: number;
	retirementAge?: number;
	forecastStyle: "Conservative" | "Balanced" | "Aggressive";
	lastUpdated: string;
}

export interface PlanningNote {
	id: string;
	title: string;
	body: string;
	tag?: string;
	lastUpdated: string;
}

export interface FinancialProfileData {
	profile: FinancialProfileRecord;
	accounts: ProfileAccount[];
	incomeSources: IncomeSource[];
	assets: ProfileAsset[];
	liabilities: ProfileLiability[];
	investments: ProfileInvestment[];
	insurancePolicies: InsurancePolicy[];
	taxProfile: TaxProfile;
	taxProfileRecommendations?: TaxProfileRecommendations;
	forecastAssumptions: ForecastAssumptions;
	planningNotes: PlanningNote[];
}

// ─── Zod Schemas ──────────────────────────────────────────────────────────────

export const FinancialProfileRecordSchema = z.object({
	id: z.string(),
	householdType: z.enum(["Individual", "Couple", "Family"]),
	location: z.string(),
	lifeStage: z.enum([
		"Early career",
		"Family",
		"Pre-retirement",
		"Retired",
		"Other",
	]),
	employmentType: z.enum([
		"W-2",
		"Freelancer",
		"Business owner",
		"Retired",
		"Student",
		"Other",
	]),
	planningHorizon: z.enum(["1 year", "5 years", "10 years", "20+ years"]),
	riskTolerance: z.enum(["Conservative", "Balanced", "Aggressive"]),
	dependentsCount: z.number(),
	housingStatus: z.enum(["Homeowner", "Renter", "Other"]),
	lastUpdated: z.string(),
	source: z.enum(["Manual", "Synced"]),
});

export const ProfileAccountSchema = z.object({
	id: z.string(),
	name: z.string(),
	institution: z.string(),
	type: z.string(),
	balance: z.number(),
	connectionStatus: z.enum(["Synced", "Manual"]),
	lastSynced: z.string(),
	syncIsStale: z.boolean().optional(),
	includedInNetWorth: z.boolean(),
	hidden: z.boolean().optional(),
	plaidItemId: z.string().optional(),
	notes: z.string().optional(),
	nameOverride: z.string().optional(),
});

export const IncomeSourceSchema = z.object({
	id: z.string(),
	name: z.string(),
	type: z.string(),
	amount: z.number(),
	frequency: z.enum(["Monthly", "Annual", "Quarterly", "One-time"]),
	growthAssumption: z.string(),
	startDate: z.string().optional(),
	endDate: z.string().optional(),
	includeInForecast: z.boolean(),
});

export const ProfileAssetSchema = z.object({
	id: z.string(),
	name: z.string(),
	type: z.enum([
		"Real estate",
		"Vehicle",
		"Boat",
		"Business",
		"Personal property",
		"Collectible",
		"Cash-like asset",
		"Other",
	]),
	estimatedValue: z.number(),
	linkedLiability: z.string().optional(),
	linkedInsurance: z.string().optional(),
	includeInNetWorth: z.boolean(),
	includeInForecast: z.boolean(),
});

export const ProfileLiabilitySchema = z.object({
	id: z.string(),
	name: z.string(),
	type: z.string(),
	balance: z.number(),
	interestRate: z.number(),
	monthlyPayment: z.number(),
	linkedAsset: z.string().optional(),
	payoffDate: z.string().optional(),
	loanStartDate: z.string().optional(),
	loanTermYears: z.number().optional(),
	autoUpdateBalance: z.boolean().optional(),
	lastBalanceAmortizedAt: z.string().optional(),
	nextBalanceAmortizationDueAt: z.string().optional(),
	includeInNetWorth: z.boolean().default(false),
	includeInForecast: z.boolean(),
});

export const ProfileInvestmentSchema = z.object({
	id: z.string(),
	name: z.string(),
	type: z.string(),
	currentValue: z.number(),
	monthlyContribution: z.number(),
	expectedReturn: z.number(),
	accountLink: z.string().optional(),
	includeInForecast: z.boolean(),
	autoUpdateBalance: z.boolean().optional(),
	notes: z.string().optional(),
	forecastInputsUserEdited: z.boolean().optional(),
});

export const LegacyInsurancePolicySchema = z.object({
	id: z.string(),
	name: z.string(),
	type: z.enum([
		"Health",
		"Dental",
		"Vision",
		"Auto",
		"Home",
		"Renters",
		"Life",
		"Disability",
		"Umbrella",
		"Boat",
		"Other",
	]),
	provider: z.string(),
	premium: z.number(),
	frequency: z.enum(["Monthly", "Quarterly", "Semiannual", "Annual"]),
	coverageAmount: z.number().optional(),
	linkedAsset: z.string().optional(),
	renewalDate: z.string().optional(),
});

export const InsurancePolicyTypeSchema = z.enum([
	"auto",
	"health",
	"dental",
	"vision",
	"life",
	"disability",
	"homeowners",
	"renters",
	"longTermCare",
	"umbrella",
	"boat",
	"other",
]);

export const InsuranceSensitivityTierSchema = z.enum([
	"low",
	"moderate",
	"highLocalOnly",
	"forbidden",
]);

export const InsuranceCoverageSchema = z.object({
	id: z.string(),
	coverageType: z.string(),
	label: z.string(),
	limitAmount: z.number().optional(),
	deductibleAmount: z.number().optional(),
	copayAmount: z.number().optional(),
	coinsurancePercent: z.number().optional(),
	maxBenefitAmount: z.number().optional(),
	appliesTo: z.string().optional(),
	notes: z.string().optional(),
	sensitivityTier: InsuranceSensitivityTierSchema,
});

export const InsurancePartySchema = z.object({
	id: z.string(),
	role: z.enum([
		"policyholder",
		"coveredPerson",
		"beneficiary",
		"dependent",
		"listedDriver",
		"owner",
		"mortgagee",
		"lienholder",
		"other",
	]),
	displayName: z.string().optional(),
	percentage: z.number().optional(),
	relationship: z.string().optional(),
	sensitivityTier: z.enum(["low", "moderate", "highLocalOnly"]),
});

export const InsuranceCoveredAssetSchema = z.object({
	id: z.string(),
	linkedAssetId: z.string().optional(),
	label: z.string(),
	assetType: z.enum([
		"vehicle",
		"home",
		"rentalProperty",
		"boat",
		"valuable",
		"other",
	]),
	summary: z.string().optional(),
	sensitivityTier: z.enum(["low", "moderate"]),
});

export const InsuranceDocumentReferenceSchema = z.object({
	id: z.string(),
	documentName: z.string(),
	documentType: z.enum([
		"declarations",
		"idCard",
		"policy",
		"bill",
		"eob",
		"claim",
		"medicalRecord",
		"other",
	]),
	storageScope: z.enum(["cloud", "localPrivate"]),
	redactionStatus: z.enum(["notRequired", "pending", "redacted", "blocked"]),
	retainedOriginal: z.boolean(),
	localOnly: z.boolean(),
	extractedAt: z.string().optional(),
	extractionConfidence: z.number().optional(),
});

export const InsuranceReviewStateSchema = z.object({
	lastReviewedAt: z.string().optional(),
	nextReviewDate: z.string().optional(),
	completeness: z.enum(["basic", "partial", "complete"]),
	missingFields: z.array(z.string()),
});

const AutoInsuranceDetailsSchema = z.object({
	type: z.literal("auto"),
	bodilyInjuryLiability: z.string().optional(),
	propertyDamageLiability: z.string().optional(),
	uninsuredMotorist: z.string().optional(),
	collisionDeductible: z.number().optional(),
	comprehensiveDeductible: z.number().optional(),
	medicalPaymentsOrPip: z.string().optional(),
	rentalReimbursement: z.boolean().optional(),
	roadsideAssistance: z.boolean().optional(),
	lienholderLabel: z.string().optional(),
});

const HealthInsuranceDetailsSchema = z.object({
	type: z.literal("health"),
	planType: z.string().optional(),
	coverageTier: z.string().optional(),
	networkType: z.string().optional(),
	individualDeductible: z.number().optional(),
	familyDeductible: z.number().optional(),
	individualOutOfPocketMax: z.number().optional(),
	familyOutOfPocketMax: z.number().optional(),
	rxDeductible: z.number().optional(),
	pcpRequired: z.boolean().optional(),
	referralRequired: z.boolean().optional(),
	hsaEligible: z.boolean().optional(),
});

const DentalInsuranceDetailsSchema = z.object({
	type: z.literal("dental"),
	annualMaximum: z.number().optional(),
	deductible: z.number().optional(),
	preventiveCoverage: z.string().optional(),
	basicCoverage: z.string().optional(),
	majorCoverage: z.string().optional(),
	orthodontiaCovered: z.boolean().optional(),
	orthodontiaLifetimeMax: z.number().optional(),
	network: z.string().optional(),
});

const VisionInsuranceDetailsSchema = z.object({
	type: z.literal("vision"),
	examFrequency: z.string().optional(),
	frameAllowance: z.number().optional(),
	contactLensAllowance: z.number().optional(),
	lensCoverage: z.string().optional(),
	lasikDiscount: z.string().optional(),
	network: z.string().optional(),
});

const LifeInsuranceDetailsSchema = z.object({
	type: z.literal("life"),
	policyKind: z.string().optional(),
	insuredPersonLabel: z.string().optional(),
	ownerLabel: z.string().optional(),
	deathBenefit: z.number().optional(),
	termExpiry: z.string().optional(),
	cashValueBalance: z.number().optional(),
	riders: z.string().optional(),
	policyLoans: z.number().optional(),
});

const DisabilityInsuranceDetailsSchema = z.object({
	type: z.literal("disability"),
	disabilityType: z.enum(["shortTerm", "longTerm", "unknown"]).optional(),
	monthlyBenefit: z.number().optional(),
	incomeReplacementPercent: z.number().optional(),
	eliminationPeriod: z.string().optional(),
	benefitDuration: z.string().optional(),
	colaRider: z.boolean().optional(),
	employerSponsored: z.boolean().optional(),
	renewability: z.string().optional(),
});

const PropertyInsuranceDetailsSchema = z.object({
	type: z.union([z.literal("homeowners"), z.literal("renters")]),
	dwellingLimit: z.number().optional(),
	otherStructuresLimit: z.number().optional(),
	personalPropertyLimit: z.number().optional(),
	lossOfUseLimit: z.number().optional(),
	liabilityLimit: z.number().optional(),
	medicalPaymentsLimit: z.number().optional(),
	deductible: z.number().optional(),
	replacementCost: z.boolean().optional(),
	endorsements: z.string().optional(),
	mortgageeLabel: z.string().optional(),
});

const LongTermCareInsuranceDetailsSchema = z.object({
	type: z.literal("longTermCare"),
	dailyBenefit: z.number().optional(),
	monthlyBenefit: z.number().optional(),
	benefitPool: z.number().optional(),
	eliminationPeriod: z.string().optional(),
	benefitDuration: z.string().optional(),
	inflationProtection: z.string().optional(),
	taxQualified: z.boolean().optional(),
});

const UmbrellaInsuranceDetailsSchema = z.object({
	type: z.literal("umbrella"),
	liabilityLimit: z.number().optional(),
	retainedLimit: z.number().optional(),
});

const BoatInsuranceDetailsSchema = z.object({
	type: z.literal("boat"),
	hullCoverage: z.number().optional(),
	liabilityLimit: z.number().optional(),
});

const OtherInsuranceDetailsSchema = z.object({
	type: z.literal("other"),
	summary: z.string().optional(),
});

export const InsuranceTypedDetailsSchema = z.union([
	AutoInsuranceDetailsSchema,
	HealthInsuranceDetailsSchema,
	DentalInsuranceDetailsSchema,
	VisionInsuranceDetailsSchema,
	LifeInsuranceDetailsSchema,
	DisabilityInsuranceDetailsSchema,
	PropertyInsuranceDetailsSchema,
	LongTermCareInsuranceDetailsSchema,
	UmbrellaInsuranceDetailsSchema,
	BoatInsuranceDetailsSchema,
	OtherInsuranceDetailsSchema,
]);

export const InsurancePolicyV2Schema = z.object({
	schemaVersion: z.literal(2),
	id: z.string(),
	type: InsurancePolicyTypeSchema,
	providerName: z.string(),
	policyName: z.string(),
	policyNickname: z.string().optional(),
	status: z.enum(["active", "pending", "cancelled", "expired", "unknown"]),
	effectiveStartDate: z.string().optional(),
	effectiveEndDate: z.string().optional(),
	renewalDate: z.string().optional(),
	premiumAmount: z.number().optional(),
	premiumCadence: z
		.enum([
			"monthly",
			"quarterly",
			"semiannual",
			"annual",
			"oneTime",
			"unknown",
		])
		.optional(),
	source: z.enum(["manual", "uploadExtracted", "api", "imported"]),
	storageScope: z.enum(["cloud", "localPrivate"]),
	sensitivityTier: InsuranceSensitivityTierSchema,
	coverages: z.array(InsuranceCoverageSchema),
	parties: z.array(InsurancePartySchema),
	assets: z.array(InsuranceCoveredAssetSchema),
	documents: z.array(InsuranceDocumentReferenceSchema).optional(),
	details: InsuranceTypedDetailsSchema,
	review: InsuranceReviewStateSchema,
	createdAt: z.string().optional(),
	updatedAt: z.string().optional(),
});

export const InsurancePolicySchema = z.union([
	InsurancePolicyV2Schema,
	LegacyInsurancePolicySchema,
]);

export const TaxProfileSchema = z.object({
	filingStatus: z.enum([
		"Single",
		"Married filing jointly",
		"Married filing separately",
		"Head of household",
	]),
	taxYear: z.number(),
	estimatedFederalTaxBracket: z.string(),
	estimatedStateTaxRate: z.string(),
	totalAnnualIncome: z.number(),
	taxableIncomeEstimate: z.number(),
	deductionStrategy: z.enum(["Standard", "Itemized"]),
	selfEmployedIncome: z.boolean(),
	rentalIncome: z.boolean(),
	lastUpdated: z.string(),
});

export const TaxProfileRecommendationsSchema = z.object({
	taxYear: z.number(),
	estimatedFederalTaxBracket: z.string(),
	totalAnnualIncome: z.number(),
	taxableIncomeEstimate: z.number(),
	selfEmployedIncome: z.boolean(),
	rentalIncome: z.boolean(),
});

export const ForecastAssumptionsSchema = z.object({
	inflationRate: z.number(),
	incomeGrowthRate: z.number(),
	expenseGrowthRate: z.number(),
	investmentReturnRate: z.number(),
	realEstateAppreciationRate: z.number(),
	defaultCashYield: z.number(),
	retirementAge: z.number().optional(),
	forecastStyle: z.enum(["Conservative", "Balanced", "Aggressive"]),
	lastUpdated: z.string(),
});

export const PlanningNoteSchema = z.object({
	id: z.string(),
	title: z.string(),
	body: z.string(),
	tag: z.string().optional(),
	lastUpdated: z.string(),
});

export const FinancialProfileDataSchema = z.object({
	profile: FinancialProfileRecordSchema,
	accounts: z.array(ProfileAccountSchema),
	incomeSources: z.array(IncomeSourceSchema),
	assets: z.array(ProfileAssetSchema),
	liabilities: z.array(ProfileLiabilitySchema),
	investments: z.array(ProfileInvestmentSchema),
	insurancePolicies: z.array(InsurancePolicySchema),
	taxProfile: TaxProfileSchema,
	taxProfileRecommendations: TaxProfileRecommendationsSchema.optional(),
	forecastAssumptions: ForecastAssumptionsSchema,
	planningNotes: z.array(PlanningNoteSchema),
});

export const insurancePolicyTypeLabels: Record<InsurancePolicyType, string> = {
	auto: "Auto",
	health: "Health",
	dental: "Dental",
	vision: "Vision",
	life: "Life",
	disability: "Disability",
	homeowners: "Homeowners",
	renters: "Renters",
	longTermCare: "Long-term care",
	umbrella: "Umbrella",
	boat: "Boat",
	other: "Other",
};

const premiumCadenceLabels: Record<
	NonNullable<InsurancePolicyV2["premiumCadence"]>,
	string
> = {
	monthly: "Monthly",
	quarterly: "Quarterly",
	semiannual: "Semiannual",
	annual: "Annual",
	oneTime: "One-time",
	unknown: "Unknown",
};

function isInsurancePolicyV2(
	policy: InsurancePolicy,
): policy is InsurancePolicyV2 {
	return "schemaVersion" in policy && policy.schemaVersion === 2;
}

export function legacyInsuranceTypeToV2(
	type: LegacyInsurancePolicy["type"],
): InsurancePolicyType {
	const map: Record<LegacyInsurancePolicy["type"], InsurancePolicyType> = {
		Auto: "auto",
		Boat: "boat",
		Dental: "dental",
		Disability: "disability",
		Health: "health",
		Home: "homeowners",
		Life: "life",
		Other: "other",
		Renters: "renters",
		Umbrella: "umbrella",
		Vision: "vision",
	};
	return map[type];
}

export function legacyPremiumCadenceToV2(
	frequency: LegacyInsurancePolicy["frequency"],
): NonNullable<InsurancePolicyV2["premiumCadence"]> {
	const map: Record<
		LegacyInsurancePolicy["frequency"],
		NonNullable<InsurancePolicyV2["premiumCadence"]>
	> = {
		Annual: "annual",
		Monthly: "monthly",
		Quarterly: "quarterly",
		Semiannual: "semiannual",
	};
	return map[frequency];
}

export function createInsuranceDetailsForType(
	type: InsurancePolicyType,
): InsuranceTypedDetails {
	return { type } as InsuranceTypedDetails;
}

export function normalizeInsurancePolicy(
	policy: InsurancePolicy,
): InsurancePolicyV2 {
	if (isInsurancePolicyV2(policy)) return policy;

	const type = legacyInsuranceTypeToV2(policy.type);
	const coverages: InsuranceCoverage[] =
		policy.coverageAmount !== undefined
			? [
					{
						id: `${policy.id}-primary-coverage`,
						coverageType: "primary",
						label: "Primary coverage",
						limitAmount: policy.coverageAmount,
						sensitivityTier: "low",
					},
				]
			: [];
	const assets: InsuranceCoveredAsset[] = policy.linkedAsset
		? [
				{
					id: `${policy.id}-linked-asset`,
					label: policy.linkedAsset,
					assetType:
						type === "auto" ? "vehicle" : type === "boat" ? "boat" : "other",
					sensitivityTier: "low",
				},
			]
		: [];

	return {
		schemaVersion: 2,
		id: policy.id,
		type,
		providerName: policy.provider,
		policyName: policy.name,
		status: "unknown",
		renewalDate: policy.renewalDate,
		premiumAmount: policy.premium,
		premiumCadence: legacyPremiumCadenceToV2(policy.frequency),
		source: "manual",
		storageScope: "cloud",
		sensitivityTier: "low",
		coverages,
		parties: [],
		assets,
		details: createInsuranceDetailsForType(type),
		review: {
			completeness: coverages.length > 0 ? "partial" : "basic",
			missingFields: [],
		},
	};
}

export function normalizeInsurancePolicies(
	policies: InsurancePolicy[],
): InsurancePolicyV2[] {
	return policies.map(normalizeInsurancePolicy);
}

export function getInsurancePolicyDisplayName(policy: InsurancePolicy) {
	return isInsurancePolicyV2(policy)
		? policy.policyNickname || policy.policyName
		: policy.name;
}

export function getInsurancePolicyProviderName(policy: InsurancePolicy) {
	return isInsurancePolicyV2(policy) ? policy.providerName : policy.provider;
}

export function getInsurancePolicyType(
	policy: InsurancePolicy,
): InsurancePolicyType {
	return isInsurancePolicyV2(policy)
		? policy.type
		: legacyInsuranceTypeToV2(policy.type);
}

export function getInsurancePolicyTypeLabel(policy: InsurancePolicy) {
	return insurancePolicyTypeLabels[getInsurancePolicyType(policy)];
}

export function getInsurancePolicyPremiumAmount(policy: InsurancePolicy) {
	return isInsurancePolicyV2(policy) ? policy.premiumAmount : policy.premium;
}

export function getInsurancePolicyPremiumCadenceLabel(policy: InsurancePolicy) {
	if (isInsurancePolicyV2(policy)) {
		return policy.premiumCadence
			? premiumCadenceLabels[policy.premiumCadence]
			: "Unknown";
	}
	return policy.frequency;
}

export function getInsurancePolicyPrimaryCoverageAmount(
	policy: InsurancePolicy,
) {
	if (!isInsurancePolicyV2(policy)) return policy.coverageAmount;
	return policy.coverages.find((coverage) => coverage.limitAmount !== undefined)
		?.limitAmount;
}

export function getInsurancePolicyLinkedAssetLabel(policy: InsurancePolicy) {
	if (!isInsurancePolicyV2(policy)) return policy.linkedAsset;
	return policy.assets.at(0)?.label;
}
