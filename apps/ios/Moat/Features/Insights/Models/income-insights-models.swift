import Foundation

struct IncomePrimarySource: Decodable, Equatable {
    let name: String
    let amount: Double
}

struct IncomeTrendPoint: Decodable, Identifiable, Equatable {
    let date: String
    let amount: Double

    var id: String { date }
}

struct IncomeSourceRow: Decodable, Identifiable, Equatable {
    let source: String
    let amount: Double

    var id: String { source }
}

struct RecentIncomeTransaction: Decodable, Identifiable, Equatable {
    let id: String
    let date: String
    let name: String
    let amount: Double
    let accountName: String?
    let category: String?
}

struct IncomeInsightsData: Decodable, Equatable {
    let totalIncome: Double
    let primarySource: IncomePrimarySource?
    let recurringIncome: Double
    let oneTimeIncome: Double
    let incomeTrend: [IncomeTrendPoint]
    let incomeSources: [IncomeSourceRow]
    let recentIncomeTransactions: [RecentIncomeTransaction]
}
