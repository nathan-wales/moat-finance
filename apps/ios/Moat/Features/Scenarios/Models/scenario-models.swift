import Foundation

enum ScenarioType: String, Codable, CaseIterable, Identifiable {
    case conservative = "CONSERVATIVE"
    case standard = "STANDARD"
    case aggressive = "AGGRESSIVE"
    case custom = "CUSTOM"

    var id: String { rawValue }

    var displayName: String {
        switch self {
        case .conservative:
            return "Conservative"
        case .standard:
            return "Standard"
        case .aggressive:
            return "Aggressive"
        case .custom:
            return "Custom"
        }
    }
}

enum ScenarioPreset: String, CaseIterable, Identifiable {
    case conservative
    case standard
    case aggressive

    var id: String { rawValue }

    var title: String {
        switch self {
        case .conservative: "Conservative"
        case .standard: "Standard"
        case .aggressive: "Aggressive"
        }
    }

    var scenarioType: ScenarioType {
        switch self {
        case .conservative: .conservative
        case .standard: .standard
        case .aggressive: .aggressive
        }
    }

    var investmentReturn: Double {
        switch self {
        case .conservative: 0.04
        case .standard: 0.07
        case .aggressive: 0.1
        }
    }

    var inflationRate: Double {
        switch self {
        case .conservative: 0.04
        case .standard: 0.03
        case .aggressive: 0.025
        }
    }

    var salaryGrowth: Double {
        switch self {
        case .conservative: 0.01
        case .standard: 0.03
        case .aggressive: 0.05
        }
    }

    var contributionChange: Double {
        switch self {
        case .conservative: 0
        case .standard: 0.02
        case .aggressive: 0.05
        }
    }

    var expenseGrowth: Double {
        switch self {
        case .conservative: 0.04
        case .standard: 0.03
        case .aggressive: 0.025
        }
    }
}

struct ForecastScenario: Decodable, Identifiable, Equatable {
    let id: String
    let userId: String?
    let name: String
    let type: ScenarioType
    let investmentReturn: Double
    let inflationRate: Double
    let salaryGrowth: Double
    let contributionChange: Double
    let expenseGrowth: Double
    let isActive: Bool
    let createdAt: Date?
    let updatedAt: Date?
}

struct EditableScenarioDraft: Identifiable, Equatable {
    var id: String
    var sourceId: String?
    var name: String
    var type: ScenarioType
    var investmentReturn: Double
    var inflationRate: Double
    var salaryGrowth: Double
    var contributionChange: Double
    var expenseGrowth: Double

    init(scenario: ForecastScenario? = nil) {
        id = scenario?.id ?? UUID().uuidString
        sourceId = scenario?.id
        name = scenario?.name ?? "Custom scenario"
        type = scenario?.type ?? .custom
        investmentReturn = scenario?.investmentReturn ?? 0.07
        inflationRate = scenario?.inflationRate ?? 0.03
        salaryGrowth = scenario?.salaryGrowth ?? 0.03
        contributionChange = scenario?.contributionChange ?? 0
        expenseGrowth = scenario?.expenseGrowth ?? 0.03
    }

    mutating func applyPreset(_ preset: ScenarioPreset) {
        name = preset.title
        type = preset.scenarioType
        investmentReturn = preset.investmentReturn
        inflationRate = preset.inflationRate
        salaryGrowth = preset.salaryGrowth
        contributionChange = preset.contributionChange
        expenseGrowth = preset.expenseGrowth
    }
}

struct ScenarioActionMessage: Identifiable, Equatable {
    let id = UUID()
    let title: String
    let message: String
}

struct SeedScenariosResponse: Decodable, Equatable {
    let seeded: Bool
}

struct ScenarioSuccessResponse: Decodable, Equatable {
    let success: Bool
}

// MARK: - What If

enum WhatIfItemType: String, Codable, CaseIterable, Identifiable {
    case income = "income"
    case expense = "expense"
    case savings = "savings"
    case debt = "debt"

    var id: String { rawValue }

    var displayName: String {
        switch self {
        case .income: "Income"
        case .expense: "Expense"
        case .savings: "Savings"
        case .debt: "Debt"
        }
    }

    var systemImage: String {
        switch self {
        case .income: "arrow.down"
        case .expense: "arrow.up"
        case .savings: "banknote.fill"
        case .debt: "creditcard.fill"
        }
    }
}

enum WhatIfCategoryIcon {
    static func systemImage(for category: String?) -> String {
        let normalized = category?.lowercased() ?? ""
        if normalized.contains("rent") || normalized.contains("mortgage") || normalized.contains("housing") { return "house.fill" }
        if normalized.contains("food") || normalized.contains("grocery") || normalized.contains("restaurant") { return "fork.knife" }
        if normalized.contains("transport") || normalized.contains("gas") || normalized.contains("auto") { return "car.fill" }
        if normalized.contains("health") || normalized.contains("medical") { return "cross.case.fill" }
        if normalized.contains("travel") { return "airplane" }
        if normalized.contains("subscription") || normalized.contains("entertainment") { return "play.rectangle.fill" }
        if normalized.contains("paycheck") || normalized.contains("salary") || normalized.contains("income") { return "briefcase.fill" }
        if normalized.contains("debt") || normalized.contains("loan") || normalized.contains("credit") { return "creditcard.fill" }
        if normalized.contains("saving") || normalized.contains("investment") { return "banknote.fill" }
        return "folder.fill"
    }
}

struct WhatIfBaselineItem: Decodable, Identifiable, Equatable {
    let id: String
    let name: String
    let type: WhatIfItemType
    let monthlyAmount: Double
    let category: String?
    let isBaseline: Bool
}

struct WhatIfBaseline: Decodable, Equatable {
    let baselineItems: [WhatIfBaselineItem]
    let baselineIncome: Double
    let baselineExpenses: Double
    let baselineSavings: Double
    let baselineDebt: Double

    var baselineNet: Double { baselineIncome - baselineExpenses - baselineSavings - baselineDebt }
}

/// User-adjustable override for a baseline line item (or a new item).
struct WhatIfAdjustment: Identifiable, Equatable {
    let id: String
    var name: String
    var type: WhatIfItemType
    var monthlyAmount: Double
    /// True when this adjustment is appended on top of the baseline (e.g. a new income source the user is testing).
    let isCustom: Bool
    /// True when a baseline item is locally removed from the what-if scenario.
    var isRemoved: Bool = false
}

extension Double {
    var scenarioPercentDisplay: String {
        Self.scenarioPercentFormatter.string(from: NSNumber(value: self)) ?? "0%"
    }

    private static let scenarioPercentFormatter: NumberFormatter = {
        let formatter = NumberFormatter()
        formatter.numberStyle = .percent
        formatter.minimumFractionDigits = 0
        formatter.maximumFractionDigits = 1
        return formatter
    }()
}