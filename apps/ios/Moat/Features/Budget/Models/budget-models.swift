import Foundation
import SwiftUI

enum BudgetStatus: String, Decodable {
    case onTrack = "on-track"
    case closeToBudget = "close-to-budget"
    case overspending
    case noSpend = "no-spend"
    case unknown

    var title: String {
        switch self {
        case .onTrack: "On Track"
        case .closeToBudget: "Close to Budget"
        case .overspending: "Overspending"
        case .noSpend: "No Spend"
        case .unknown: "Unknown"
        }
    }

    var color: Color {
        switch self {
        case .onTrack: MoatTheme.ColorToken.positive
        case .closeToBudget: MoatTheme.ColorToken.warning
        case .overspending: MoatTheme.ColorToken.destructive
        case .noSpend, .unknown: MoatTheme.ColorToken.textSecondary
        }
    }
}

struct BudgetReportingPeriod: Decodable, Equatable {
    let dayOfMonth: Int
    let daysInMonth: Int
    let startDate: String
    let endDate: String
    let isDemoSnapshot: Bool

    var startDateValue: Date? {
        Self.parseDateOnly(startDate)
    }

    var endDateValue: Date? {
        Self.parseDateOnly(endDate)
    }

    private static func parseDateOnly(_ string: String) -> Date? {
        let formatter = DateFormatter()
        formatter.calendar = Calendar(identifier: .gregorian)
        formatter.locale = Locale(identifier: "en_US_POSIX")
        formatter.timeZone = TimeZone.current
        formatter.dateFormat = "yyyy-MM-dd"
        return formatter.date(from: string)
    }
}

struct BudgetPageData: Decodable, Equatable {
    let totalBudget: Double
    let actualSpent: Double
    let expectedByNow: Double
    let remaining: Double
    let status: BudgetStatus
    let statusMessage: String
    let progressPercent: Double
    let dayOfMonth: Int
    let daysInMonth: Int
    let categories: [CategoryBudgetRow]
    let reportingPeriod: BudgetReportingPeriod
}

struct CategoryBudgetRow: Decodable, Identifiable, Equatable {
    let categoryId: String
    let categoryName: String
    let monthlyGoal: Double?
    let spentThisMonth: Double
    let status: BudgetStatus
    let expectedSpendToDate: Double
    let parentCategory: CategoryParent?

    var id: String { categoryId }
}

struct BudgetDisplayRow: Identifiable, Equatable {
    let id: String
    let name: String
    let spentThisMonth: Double
    let monthlyGoal: Double?
    let status: BudgetStatus
    let categoryNames: [String]
    let canEditBudget: Bool
    let sourceCategory: CategoryBudgetRow?
}

func computeBudgetStatus(spent: Double, totalBudget: Double, hasGoal: Bool) -> BudgetStatus {
    if spent == 0 { return .noSpend }
    if !hasGoal { return .unknown }
    let ratio = spent / totalBudget
    if ratio <= 0.8 { return .onTrack }
    if ratio <= 1.0 { return .closeToBudget }
    return .overspending
}

func rollupBudgetByParent(rows: [CategoryBudgetRow]) -> [BudgetDisplayRow] {
    var groups: [CategoryParent: (spent: Double, goalSum: Double, hasGoal: Bool, categories: [String])] = [:]
    for parent in CategoryParent.allCases {
        groups[parent] = (0, 0, false, [])
    }
    for row in rows {
        guard let parent = row.parentCategory else { continue }
        var group = groups[parent] ?? (0, 0, false, [])
        group.spent += row.spentThisMonth
        if let monthlyGoal = row.monthlyGoal {
            group.hasGoal = true
            group.goalSum += monthlyGoal
        }
        group.categories.append(row.categoryName)
        groups[parent] = group
    }
    return CategoryParent.allCases.map { parent in
        let group = groups[parent] ?? (0, 0, false, [])
        let monthlyGoal: Double? = group.hasGoal ? group.goalSum : nil
        return BudgetDisplayRow(
            id: parent.rawValue,
            name: parent.title,
            spentThisMonth: group.spent,
            monthlyGoal: monthlyGoal,
            status: computeBudgetStatus(
                spent: group.spent,
                totalBudget: monthlyGoal ?? 0,
                hasGoal: monthlyGoal != nil
            ),
            categoryNames: group.categories,
            canEditBudget: false,
            sourceCategory: nil
        )
    }
}

struct BudgetEditingCategory: Identifiable, Equatable {
    let categoryId: String
    let categoryName: String
    let monthlyGoal: Double?

    var id: String { categoryId }
}

struct CategoryBudgetDetail: Decodable, Identifiable, Equatable {
    let categoryId: String
    let categoryName: String
    let monthlyGoal: Double?
    let spentThisMonth: Double
    let lastMonthSpend: Double
    let sixMonthAverage: Double
    let suggestedBudget: Double
    let monthlyTrend: [MonthlySpend]

    var id: String { categoryId }
}

struct MonthlySpend: Decodable, Identifiable, Equatable {
    let month: String
    let amount: Double

    var id: String { month }
    var dateValue: Date { DateFormatterProvider.parseYearMonth(month) ?? Date() }
}
