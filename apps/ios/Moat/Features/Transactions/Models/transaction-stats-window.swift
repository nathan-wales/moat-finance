import Foundation

enum TransactionStatsWindow {
    static let defaultLookbackDays = 30

    static func defaultStartDate(now: Date = Date(), calendar: Calendar = .current) -> Date {
        let raw = calendar.date(byAdding: .day, value: -defaultLookbackDays, to: now) ?? now
        return calendar.startOfDay(for: raw)
    }

    static func summaryFilters(
        from listFilters: TransactionFilterState,
        lookbackStart: Date
    ) -> TransactionFilterState {
        var filters = listFilters
        filters.cursor = 0
        guard !listFilters.hasExplicitDateFilter else { return filters }
        filters.startDate = lookbackStart
        return filters
    }

    static func expandedLookbackStart(
        current: Date,
        oldestVisibleDate: Date?,
        hasExplicitDateFilter: Bool,
        calendar: Calendar = .current
    ) -> Date? {
        guard !hasExplicitDateFilter, let oldestVisibleDate else { return nil }
        let candidate = calendar.startOfDay(for: oldestVisibleDate)
        guard candidate < current else { return nil }
        return candidate
    }
}
