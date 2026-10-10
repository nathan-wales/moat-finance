import Foundation

enum InsightsTab: String, CaseIterable, Identifiable {
    case netIncome
    case income
    case spending

    var id: String { rawValue }

    var title: String {
        switch self {
        case .netIncome: "Net Income"
        case .income: "Income"
        case .spending: "Spending"
        }
    }
}

enum InsightsPeriod: String, CaseIterable, Identifiable {
    case thisWeek = "this-week"
    case lastWeek = "last-week"
    case thisMonth = "this-month"
    case lastMonth = "last-month"
    case oneMonth = "1m"
    case twoMonths = "2m"
    case threeMonths = "3m"
    case sixMonths = "6m"
    case twelveMonths = "12m"

    var id: String { rawValue }

    var label: String {
        switch self {
        case .thisWeek: "This week"
        case .lastWeek: "Last week"
        case .thisMonth: "This month"
        case .lastMonth: "Last month"
        case .oneMonth: "1M"
        case .twoMonths: "2M"
        case .threeMonths: "3M"
        case .sixMonths: "6M"
        case .twelveMonths: "12M"
        }
    }

    static let `default`: InsightsPeriod = .threeMonths

    static let cashFlowOptions: [InsightsPeriod] = [
        .thisMonth,
        .lastMonth,
        .twoMonths,
        .threeMonths,
        .sixMonths,
        .twelveMonths,
    ]
}

func insightsPeriodToMonths(_ period: InsightsPeriod) -> Int {
    switch period {
    case .thisWeek, .lastWeek, .thisMonth, .lastMonth, .oneMonth: 1
    case .twoMonths: 2
    case .threeMonths: 3
    case .sixMonths: 6
    case .twelveMonths: 12
    }
}

func isInsightsWeekPeriod(_ period: InsightsPeriod) -> Bool {
    switch period {
    case .thisWeek, .lastWeek: true
    case .thisMonth, .lastMonth, .oneMonth, .twoMonths, .threeMonths, .sixMonths, .twelveMonths:
        false
    }
}

func showsInsightsMonthlyAverage(_ period: InsightsPeriod) -> Bool {
    !isInsightsWeekPeriod(period) && insightsPeriodToMonths(period) >= 2
}

func showsInsightsMonthlyTrend(_ period: InsightsPeriod) -> Bool {
    switch period {
    case .thisWeek, .lastWeek, .thisMonth, .lastMonth:
        return false
    case .oneMonth, .twoMonths, .threeMonths, .sixMonths, .twelveMonths:
        return true
    }
}

func parseInsightsTab(_ value: String?) -> InsightsTab {
    guard let value, let tab = InsightsTab(rawValue: value) else {
        return .netIncome
    }
    return tab
}

func parseInsightsPeriod(_ value: String?) -> InsightsPeriod {
    guard let value, let period = InsightsPeriod(rawValue: value) else {
        return .default
    }
    return period
}

struct InsightsDateRange {
    let startDate: String
    let endDate: String
}

func insightsDateRange(for period: InsightsPeriod, now: Date = Date()) -> InsightsDateRange? {
    switch period {
    case .thisMonth, .oneMonth, .twoMonths, .threeMonths, .sixMonths, .twelveMonths:
        return nil
    case .lastMonth, .thisWeek, .lastWeek:
        let range = resolveInsightsTransactionDateRange(for: period, now: now)

        let formatter = DateFormatter()
        formatter.calendar = Calendar(identifier: .gregorian)
        formatter.locale = Locale(identifier: "en_US_POSIX")
        formatter.timeZone = .current
        formatter.dateFormat = "yyyy-MM-dd"

        return InsightsDateRange(
            startDate: formatter.string(from: range.startDate),
            endDate: formatter.string(from: range.endDate)
        )
    }
}

func resolveInsightsTransactionDateRange(
    for period: InsightsPeriod,
    now: Date = Date()
) -> (startDate: Date, endDate: Date) {
    var calendar = Calendar(identifier: .gregorian)
    calendar.timeZone = .current
    calendar.firstWeekday = 2

    switch period {
    case .thisWeek:
        let startDate = calendar.dateInterval(of: .weekOfYear, for: now)?.start ?? now
        return (startDate, now)

    case .lastWeek:
        guard
            let thisWeekStart = calendar.dateInterval(of: .weekOfYear, for: now)?.start,
            let lastWeekStart = calendar.date(byAdding: .day, value: -7, to: thisWeekStart),
            let lastWeekEnd = calendar.date(byAdding: .day, value: 6, to: lastWeekStart)
        else {
            return (now, now)
        }
        return (lastWeekStart, lastWeekEnd)

    case .lastMonth:
        guard
            let previousMonth = calendar.date(byAdding: .month, value: -1, to: now),
            let startDate = calendar.date(from: calendar.dateComponents([.year, .month], from: previousMonth)),
            let endDate = calendar.date(byAdding: DateComponents(month: 1, day: -1), to: startDate)
        else {
            return (now, now)
        }
        return (startDate, endDate)

    case .thisMonth, .oneMonth, .twoMonths, .threeMonths, .sixMonths, .twelveMonths:
        let months = insightsPeriodToMonths(period)
        let startMonth = calendar.date(byAdding: .month, value: -(months - 1), to: now) ?? now
        let startDate = calendar.date(from: calendar.dateComponents([.year, .month], from: startMonth)) ?? now
        return (startDate, now)
    }
}

func transactionFilters(
    category: String,
    type: TransactionKind = .expense,
    period: InsightsPeriod
) -> TransactionFilterState {
    let range = resolveInsightsTransactionDateRange(for: period)
    return TransactionFilterState(
        category: category,
        type: type,
        startDate: range.startDate,
        endDate: range.endDate
    )
}

func transactionFilters(
    categories: [String],
    type: TransactionKind = .expense,
    period: InsightsPeriod
) -> TransactionFilterState {
    let range = resolveInsightsTransactionDateRange(for: period)
    if categories.count == 1, let category = categories.first {
        return TransactionFilterState(
            category: category,
            type: type,
            startDate: range.startDate,
            endDate: range.endDate
        )
    }
    return TransactionFilterState(
        categories: categories,
        type: type,
        startDate: range.startDate,
        endDate: range.endDate
    )
}

func transactionFilters(
    search: String,
    type: TransactionKind = .income,
    period: InsightsPeriod
) -> TransactionFilterState {
    let range = resolveInsightsTransactionDateRange(for: period)
    return TransactionFilterState(
        search: search,
        type: type,
        startDate: range.startDate,
        endDate: range.endDate
    )
}

enum InsightsStorageKey {
    static let selectedTab = "insights.selectedTab"
    static let selectedPeriod = "insights.selectedPeriod"
}

func filterMonthlyAggregates(
    _ months: [MonthlyAggregate],
    period: InsightsPeriod,
    now: Date = Date()
) -> [MonthlyAggregate] {
    let sorted = months.sorted { $0.date < $1.date }
    var calendar = Calendar(identifier: .gregorian)
    calendar.timeZone = .current

    switch period {
    case .thisWeek, .lastWeek:
        return []
    case .thisMonth:
        return sorted.filter {
            calendar.isDate($0.date, equalTo: now, toGranularity: .month)
        }
    case .lastMonth:
        guard let previousMonth = calendar.date(byAdding: .month, value: -1, to: now) else {
            return []
        }
        return sorted.filter {
            calendar.isDate($0.date, equalTo: previousMonth, toGranularity: .month)
        }
    case .oneMonth:
        return Array(sorted.suffix(1))
    case .twoMonths:
        return Array(sorted.suffix(2))
    case .threeMonths:
        return Array(sorted.suffix(3))
    case .sixMonths:
        return Array(sorted.suffix(6))
    case .twelveMonths:
        return Array(sorted.suffix(12))
    }
}
