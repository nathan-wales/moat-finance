import Foundation

struct IncomeVsSpendingPoint: Decodable, Identifiable, Equatable {
    let date: String
    let income: Double
    let spending: Double

    var id: String { date }
}

struct NetIncomeTrendPoint: Decodable, Identifiable, Equatable {
    let date: String
    let netIncome: Double

    var id: String { date }
}

struct SavingsRateTrendPoint: Decodable, Identifiable, Equatable {
    let date: String
    let savingsRate: Double?

    var id: String { date }
}

struct NetIncomeSpendingBreakdownRow: Decodable, Identifiable, Equatable {
    let category: String
    let amount: Double
    let parentCategory: CategoryParent?

    var id: String { category }
}

struct NetIncomeInsightsData: Decodable, Equatable {
    let totalIncome: Double
    let totalSpending: Double
    let netIncome: Double
    let savingsRate: Double?
    let incomeVsSpending: [IncomeVsSpendingPoint]
    let netIncomeTrend: [NetIncomeTrendPoint]
    let savingsRateTrend: [SavingsRateTrendPoint]
    let spendingBreakdown: [NetIncomeSpendingBreakdownRow]
}
