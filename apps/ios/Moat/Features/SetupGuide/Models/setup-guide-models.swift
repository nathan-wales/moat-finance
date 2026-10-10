import Foundation

struct SetupGuideState: Decodable, Equatable {
    let visible: Bool
    let dismissed: Bool
    let completedCount: Int
    let totalCount: Int
    let nextStepId: String?
    let nextStepTitle: String?
    let goals: [String]
    let steps: [SetupGuideStep]
}

struct SetupGuideStep: Decodable, Equatable, Identifiable {
    let id: String
    let title: String
    let description: String
    let href: String
    let completed: Bool
}

enum SetupGuideStepId: String {
    case reviewExpenses = "review_expenses"
    case reviewIncome = "review_income"
    case createRule = "create_rule"
    case connectAi = "connect_ai"
    case financialProfile = "financial_profile"
    case setBudget = "set_budget"
    case reviewRetirement = "review_retirement"
    case setAlert = "set_alert"

    var isVisitStep: Bool {
        switch self {
        case .reviewExpenses, .reviewIncome, .reviewRetirement:
            return true
        case .createRule, .connectAi, .financialProfile, .setBudget, .setAlert:
            return false
        }
    }
}

enum SetupGuideTransactionReview: Equatable {
    case expenses
    case income
}
