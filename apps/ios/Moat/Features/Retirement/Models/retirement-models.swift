import Foundation

struct RetirementHeadline: Decodable, Equatable {
    let headline: String
    let supporting: String
}

struct RetirementMissingInput: Decodable, Identifiable, Equatable {
    let id: String
    let actionLabel: String
    let actionHref: String
}

struct RetirementProjectionSummary: Decodable, Equatable {
    let targetRetirementAge: Double
    let retirementAgeUsed: Double
    let earliestSustainableAge: Double?
    let longevityAge: Double?
    let confidence: Double?
    let safeMonthlySpending: Double?
    let expectedMonthlySpending: Double
    let assetsAtRetirement: Double
    let netWorthAtRetirement: Double?
    let assetsAtRetirementTodayDollars: Double?
    let netWorthAtRetirementTodayDollars: Double?
    let legacyAtLongevity: Double
    let legacyAtLongevityTodayDollars: Double?
    let fundedThroughLongevity: Bool
    let monthlyShortfallAtTarget: Double
}

struct RetirementProjectionYear: Decodable, Identifiable, Equatable {
    var id: Int { year }
    let year: Int
    let age: Int
    let netWorth: Double
    let netWorthTodayDollars: Double?
    let liquidAssets: Double?
    let liquidAssetsTodayDollars: Double?
    let taxesPaid: Double?
    let spendableIncome: Double?
    let livingExpenses: Double?
    let isRetired: Bool?
}

struct RetirementProjection: Decodable, Equatable {
    let summary: RetirementProjectionSummary
    let years: [RetirementProjectionYear]
}

struct RetirementPlanOverview: Decodable, Equatable {
    let headline: RetirementHeadline
    let projection: RetirementProjection
    let suggestedLevers: [RetirementSuggestedLever]
    let missingInputs: [RetirementMissingInput]
}

struct RetirementProjectionResponse: Decodable, Equatable {
    let projection: RetirementProjection
    let baseline: RetirementProjection?
}

struct RetirementStressTestResult: Decodable, Identifiable, Equatable {
    let id: String
    let label: String
    let confidence: Double
    let confidenceDelta: Double
    let isBaseline: Bool
}

struct RetirementVulnerability: Decodable, Equatable {
    let testId: String
    let label: String
    let narrative: String
}

struct RetirementStressTestsResponse: Decodable, Equatable {
    let results: [RetirementStressTestResult]
    let biggestVulnerability: RetirementVulnerability?
}

enum RetirementTab: String, CaseIterable, Identifiable {
    case plan
    case whatIf = "what-if"
    case scenarios
    case risk

    var id: String { rawValue }

    var title: String {
        switch self {
        case .plan: return "Plan"
        case .whatIf: return "What If"
        case .scenarios: return "Scenarios"
        case .risk: return "Risk"
        }
    }
}

enum RetirementCurrency {
    static func money(_ value: Double) -> String {
        CurrencyFormatter.formatCompact(value)
    }

    static func monthly(_ value: Double?) -> String {
        guard let value else { return "—" }
        return "\(CurrencyFormatter.formatCompact(value))/mo"
    }

    static func percent(_ value: Double?) -> String {
        guard let value else { return "—" }
        return "\(Int((value * 100).rounded()))%"
    }

    static func age(_ value: Double?) -> String {
        guard let value else { return "—" }
        return "Age \(Int(value.rounded()))"
    }
}
