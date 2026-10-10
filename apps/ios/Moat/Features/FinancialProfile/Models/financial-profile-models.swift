import Foundation

func newId(_ prefix: String) -> String {
    "\(prefix)-\(UUID().uuidString.lowercased())"
}

private func todayDateString() -> String {
    let formatter = DateFormatter()
    formatter.dateFormat = "yyyy-MM-dd"
    formatter.locale = Locale(identifier: "en_US_POSIX")
    formatter.timeZone = TimeZone(secondsFromGMT: 0)
    return formatter.string(from: Date())
}

// MARK: - Financial Profile Record

struct FinancialProfileRecord: Codable, Equatable, Identifiable {
    let id: String
    let householdType: String
    let location: String
    let lifeStage: String
    let employmentType: String
    let planningHorizon: String
    let riskTolerance: String
    let dependentsCount: Int
    let housingStatus: String
    let lastUpdated: String
    let source: String
}

// MARK: - Profile Account

struct ProfileAccount: Codable, Equatable, Identifiable {
    let id: String
    let name: String
    let institution: String
    let type: String
    let balance: Double
    let connectionStatus: String
    let lastSynced: String
    var syncIsStale: Bool?
    var includedInNetWorth: Bool
    var hidden: Bool?
    var plaidItemId: String?
    var notes: String?
}

// MARK: - Income Source

struct IncomeSource: Codable, Equatable, Identifiable {
    let id: String
    let name: String
    let type: String
    let amount: Double
    let frequency: String
    let growthAssumption: String
    var startDate: String?
    var endDate: String?
    let includeInForecast: Bool
}

// MARK: - Profile Asset

struct ProfileAsset: Codable, Equatable, Identifiable {
    let id: String
    let name: String
    let type: String
    let estimatedValue: Double
    var linkedLiability: String?
    var linkedInsurance: String?
    let includeInNetWorth: Bool
    let includeInForecast: Bool
}

// MARK: - Profile Liability

struct ProfileLiability: Codable, Equatable, Identifiable {
    let id: String
    let name: String
    let type: String
    let balance: Double
    let interestRate: Double
    let monthlyPayment: Double
    var linkedAsset: String?
    var payoffDate: String?
    var loanStartDate: String?
    var loanTermYears: Int?
    var autoUpdateBalance: Bool?
    var lastBalanceAmortizedAt: String?
    var nextBalanceAmortizationDueAt: String?
    let includeInNetWorth: Bool
    let includeInForecast: Bool
}

// MARK: - Profile Investment

struct ProfileInvestment: Codable, Equatable, Identifiable {
    let id: String
    let name: String
    let type: String
    let currentValue: Double
    let monthlyContribution: Double
    let expectedReturn: Double
    var accountLink: String?
    let includeInForecast: Bool
    var autoUpdateBalance: Bool?
    var notes: String?
}

// MARK: - Insurance (Legacy)

struct LegacyInsurancePolicy: Codable, Equatable, Identifiable {
    let id: String
    let name: String
    let type: String
    let provider: String
    let premium: Double
    let frequency: String
    var coverageAmount: Double?
    var linkedAsset: String?
    var renewalDate: String?
}

// MARK: - Insurance (V2 Sub-types)

enum InsurancePolicyType: String, Codable, CaseIterable {
    case auto
    case health
    case dental
    case vision
    case life
    case disability
    case homeowners
    case renters
    case longTermCare
    case umbrella
    case boat
    case other
}

enum InsuranceSensitivityTier: String, Codable, CaseIterable {
    case low
    case moderate
    case highLocalOnly
    case forbidden
}

enum InsuranceStorageScope: String, Codable, CaseIterable {
    case cloud
    case localPrivate
}

struct InsuranceCoverage: Codable, Equatable, Identifiable {
    let id: String
    let coverageType: String
    let label: String
    var limitAmount: Double?
    var deductibleAmount: Double?
    var copayAmount: Double?
    var coinsurancePercent: Double?
    var maxBenefitAmount: Double?
    var appliesTo: String?
    var notes: String?
    let sensitivityTier: InsuranceSensitivityTier
}

struct InsuranceParty: Codable, Equatable, Identifiable {
    let id: String
    let role: String
    var displayName: String?
    var percentage: Double?
    var relationship: String?
    let sensitivityTier: String
}

struct InsuranceCoveredAsset: Codable, Equatable, Identifiable {
    let id: String
    var linkedAssetId: String?
    let label: String
    let assetType: String
    var summary: String?
    let sensitivityTier: String
}

struct InsuranceDocumentReference: Codable, Equatable, Identifiable {
    let id: String
    let documentName: String
    let documentType: String
    let storageScope: InsuranceStorageScope
    let redactionStatus: String
    let retainedOriginal: Bool
    let localOnly: Bool
    var extractedAt: String?
    var extractionConfidence: Double?
}

struct InsuranceReviewState: Codable, Equatable {
    var lastReviewedAt: String?
    var nextReviewDate: String?
    let completeness: String
    let missingFields: [String]
}

struct InsuranceTypedDetails: Codable, Equatable {
    let type: String
    var bodilyInjuryLiability: String?
    var propertyDamageLiability: String?
    var uninsuredMotorist: String?
    var collisionDeductible: Double?
    var comprehensiveDeductible: Double?
    var medicalPaymentsOrPip: String?
    var rentalReimbursement: Bool?
    var roadsideAssistance: Bool?
    var lienholderLabel: String?
    var planType: String?
    var coverageTier: String?
    var networkType: String?
    var individualDeductible: Double?
    var familyDeductible: Double?
    var individualOutOfPocketMax: Double?
    var familyOutOfPocketMax: Double?
    var rxDeductible: Double?
    var pcpRequired: Bool?
    var referralRequired: Bool?
    var hsaEligible: Bool?
    var annualMaximum: Double?
    var deductible: Double?
    var preventiveCoverage: String?
    var basicCoverage: String?
    var majorCoverage: String?
    var orthodontiaCovered: Bool?
    var orthodontiaLifetimeMax: Double?
    var network: String?
    var examFrequency: String?
    var frameAllowance: Double?
    var contactLensAllowance: Double?
    var lensCoverage: String?
    var lasikDiscount: String?
    var policyKind: String?
    var insuredPersonLabel: String?
    var ownerLabel: String?
    var deathBenefit: Double?
    var termExpiry: String?
    var cashValueBalance: Double?
    var riders: String?
    var policyLoans: Double?
    var disabilityType: String?
    var monthlyBenefit: Double?
    var incomeReplacementPercent: Double?
    var eliminationPeriod: String?
    var benefitDuration: String?
    var colaRider: Bool?
    var employerSponsored: Bool?
    var renewability: String?
    var dwellingLimit: Double?
    var otherStructuresLimit: Double?
    var personalPropertyLimit: Double?
    var lossOfUseLimit: Double?
    var liabilityLimit: Double?
    var medicalPaymentsLimit: Double?
    var replacementCost: Bool?
    var endorsements: String?
    var mortgageeLabel: String?
    var dailyBenefit: Double?
    var benefitPool: Double?
    var inflationProtection: String?
    var taxQualified: Bool?
    var retainedLimit: Double?
    var hullCoverage: Double?
    var summary: String?
}

struct InsurancePolicyV2: Codable, Equatable, Identifiable {
    let schemaVersion: Int
    let id: String
    let type: InsurancePolicyType
    let providerName: String
    let policyName: String
    var policyNickname: String?
    let status: String
    var effectiveStartDate: String?
    var effectiveEndDate: String?
    var renewalDate: String?
    var premiumAmount: Double?
    var premiumCadence: String?
    let source: String
    let storageScope: InsuranceStorageScope
    let sensitivityTier: InsuranceSensitivityTier
    let coverages: [InsuranceCoverage]
    let parties: [InsuranceParty]
    let assets: [InsuranceCoveredAsset]
    var documents: [InsuranceDocumentReference]?
    let details: InsuranceTypedDetails
    let review: InsuranceReviewState
    var createdAt: String?
    var updatedAt: String?
}

// MARK: - Insurance Policy (Legacy + V2)

enum InsurancePolicy: Codable, Equatable, Identifiable {
    case legacy(LegacyInsurancePolicy)
    case v2(InsurancePolicyV2)

    var id: String {
        switch self {
        case .legacy(let policy): policy.id
        case .v2(let policy): policy.id
        }
    }

    init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: SchemaVersionKey.self)
        if try container.decodeIfPresent(Int.self, forKey: .schemaVersion) == 2 {
            self = .v2(try InsurancePolicyV2(from: decoder))
        } else {
            self = .legacy(try LegacyInsurancePolicy(from: decoder))
        }
    }

    func encode(to encoder: Encoder) throws {
        switch self {
        case .legacy(let policy):
            try policy.encode(to: encoder)
        case .v2(let policy):
            try policy.encode(to: encoder)
        }
    }

    private enum SchemaVersionKey: String, CodingKey {
        case schemaVersion
    }
}

// MARK: - Tax Profile

struct TaxProfile: Codable, Equatable {
    let filingStatus: String
    let taxYear: Int
    let estimatedFederalTaxBracket: String
    let estimatedStateTaxRate: String
    let totalAnnualIncome: Double
    let taxableIncomeEstimate: Double
    let deductionStrategy: String
    let selfEmployedIncome: Bool
    let rentalIncome: Bool
    let lastUpdated: String
}

// MARK: - Forecast Assumptions

struct ForecastAssumptions: Codable, Equatable {
    let inflationRate: Double
    let incomeGrowthRate: Double
    let expenseGrowthRate: Double
    let investmentReturnRate: Double
    let realEstateAppreciationRate: Double
    let defaultCashYield: Double
    var retirementAge: Int?
    let forecastStyle: String
    let lastUpdated: String
}

// MARK: - Planning Note

struct PlanningNote: Codable, Equatable, Identifiable {
    let id: String
    let title: String
    let body: String
    var tag: String?
    let lastUpdated: String
}

// MARK: - Financial Profile Data

struct FinancialProfileData: Codable, Equatable {
    var profile: FinancialProfileRecord
    var accounts: [ProfileAccount]
    var incomeSources: [IncomeSource]
    var assets: [ProfileAsset]
    var liabilities: [ProfileLiability]
    var investments: [ProfileInvestment]
    var insurancePolicies: [InsurancePolicy]
    var taxProfile: TaxProfile
    var forecastAssumptions: ForecastAssumptions
    var planningNotes: [PlanningNote]

    static var empty: FinancialProfileData {
        let today = todayDateString()
        let year = Calendar.current.component(.year, from: Date())
        return FinancialProfileData(
            profile: FinancialProfileRecord(
                id: "profile",
                householdType: "Individual",
                location: "",
                lifeStage: "Other",
                employmentType: "Other",
                planningHorizon: "10 years",
                riskTolerance: "Balanced",
                dependentsCount: 0,
                housingStatus: "Other",
                lastUpdated: today,
                source: "Manual"
            ),
            accounts: [],
            incomeSources: [],
            assets: [],
            liabilities: [],
            investments: [],
            insurancePolicies: [],
            taxProfile: TaxProfile(
                filingStatus: "Single",
                taxYear: year,
                estimatedFederalTaxBracket: "",
                estimatedStateTaxRate: "",
                totalAnnualIncome: 0,
                taxableIncomeEstimate: 0,
                deductionStrategy: "Standard",
                selfEmployedIncome: false,
                rentalIncome: false,
                lastUpdated: today
            ),
            forecastAssumptions: ForecastAssumptions(
                inflationRate: 3,
                incomeGrowthRate: 3,
                expenseGrowthRate: 3,
                investmentReturnRate: 7,
                realEstateAppreciationRate: 3,
                defaultCashYield: 4,
                retirementAge: 65,
                forecastStyle: "Balanced",
                lastUpdated: today
            ),
            planningNotes: []
        )
    }

    static var loadingPlaceholder: FinancialProfileData {
        let year = Calendar.current.component(.year, from: Date())
        return FinancialProfileData(
            profile: FinancialProfileRecord(
                id: "loading-profile",
                householdType: "Individual",
                location: "",
                lifeStage: "Other",
                employmentType: "Other",
                planningHorizon: "10 years",
                riskTolerance: "Balanced",
                dependentsCount: 0,
                housingStatus: "Other",
                lastUpdated: "",
                source: "Manual"
            ),
            accounts: [],
            incomeSources: [],
            assets: [],
            liabilities: [],
            investments: [],
            insurancePolicies: [],
            taxProfile: TaxProfile(
                filingStatus: "Single",
                taxYear: year,
                estimatedFederalTaxBracket: "",
                estimatedStateTaxRate: "",
                totalAnnualIncome: 0,
                taxableIncomeEstimate: 0,
                deductionStrategy: "Standard",
                selfEmployedIncome: false,
                rentalIncome: false,
                lastUpdated: ""
            ),
            forecastAssumptions: ForecastAssumptions(
                inflationRate: 3,
                incomeGrowthRate: 3,
                expenseGrowthRate: 3,
                investmentReturnRate: 7,
                realEstateAppreciationRate: 3,
                defaultCashYield: 4.5,
                retirementAge: nil,
                forecastStyle: "Balanced",
                lastUpdated: ""
            ),
            planningNotes: []
        )
    }
}

// MARK: - Action Message

struct FinancialProfileActionMessage: Identifiable, Equatable {
    let id = UUID()
    let title: String
    let message: String
}

// MARK: - Insurance Policy Helpers

private let insurancePolicyTypeLabels: [InsurancePolicyType: String] = [
    .auto: "Auto",
    .health: "Health",
    .dental: "Dental",
    .vision: "Vision",
    .life: "Life",
    .disability: "Disability",
    .homeowners: "Homeowners",
    .renters: "Renters",
    .longTermCare: "Long-term care",
    .umbrella: "Umbrella",
    .boat: "Boat",
    .other: "Other",
]

private let legacyInsuranceTypeLabels: [String: String] = [
    "Health": "Health",
    "Dental": "Dental",
    "Vision": "Vision",
    "Auto": "Auto",
    "Home": "Homeowners",
    "Renters": "Renters",
    "Life": "Life",
    "Disability": "Disability",
    "Umbrella": "Umbrella",
    "Boat": "Boat",
    "Other": "Other",
]

extension InsurancePolicy {
    var displayName: String {
        switch self {
        case .legacy(let policy): policy.name
        case .v2(let policy): policy.policyNickname ?? policy.policyName
        }
    }

    var provider: String {
        switch self {
        case .legacy(let policy): policy.provider
        case .v2(let policy): policy.providerName
        }
    }

    var typeLabel: String {
        switch self {
        case .legacy(let policy):
            legacyInsuranceTypeLabels[policy.type] ?? policy.type
        case .v2(let policy):
            insurancePolicyTypeLabels[policy.type] ?? policy.type.rawValue
        }
    }

    var premium: Double? {
        switch self {
        case .legacy(let policy): policy.premium
        case .v2(let policy): policy.premiumAmount
        }
    }

    var primaryCoverage: Double? {
        switch self {
        case .legacy(let policy): policy.coverageAmount
        case .v2(let policy):
            policy.coverages.first(where: { $0.limitAmount != nil })?.limitAmount
        }
    }
}

