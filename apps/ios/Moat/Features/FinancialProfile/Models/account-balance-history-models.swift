import Foundation

struct AccountBalanceHistoryPoint: Identifiable, Equatable, Decodable {
    let date: String
    let balance: Double

    var id: String { date }

    var parsedDate: Date {
        DateFormatterProvider.parseYearMonthDay(date) ?? Date()
    }
}

struct AccountBalanceHistoryResponse: Decodable {
    let currentBalance: Double
    let points: [AccountBalanceHistoryPoint]
}

enum AccountHistoryRange: String, CaseIterable, Identifiable {
    case oneDay = "1D"
    case oneWeek = "1W"
    case oneMonth = "1M"
    case threeMonths = "3M"
    case ytd = "YTD"
    case oneYear = "1Y"
    case all = "ALL"

    var id: String { rawValue }

    var label: String {
        switch self {
        case .oneDay: return "Today"
        case .oneWeek: return "Past week"
        case .oneMonth: return "Past month"
        case .threeMonths: return "Past 3 months"
        case .ytd: return "Year to date"
        case .oneYear: return "Past year"
        case .all: return "All time"
        }
    }
}

enum AccountHistoryMath {
    static func filter(
        points: [AccountBalanceHistoryPoint],
        range: AccountHistoryRange,
        now: Date = Date()
    ) -> [AccountBalanceHistoryPoint] {
        let sorted = points.sorted { $0.date < $1.date }
        guard !sorted.isEmpty else { return [] }

        if range == .oneDay {
            if sorted.count == 1 { return sorted }
            return Array(sorted.suffix(2))
        }

        guard let start = rangeStart(range, now: now) else {
            return sorted
        }
        let startIso = DateFormatterProvider.yearMonthDay(start)
        let inRange = sorted.filter { $0.date >= startIso }
        if !inRange.isEmpty { return inRange }
        return Array(sorted.suffix(1))
    }

    static func chartPoints(
        points: [AccountBalanceHistoryPoint],
        range: AccountHistoryRange,
        now: Date = Date()
    ) -> [AccountBalanceHistoryPoint] {
        let filtered = filter(points: points, range: range, now: now)
        let series = range == .oneDay ? filtered : dailySeries(points: filtered)
        return linePoints(from: series)
    }

    static func delta(points: [AccountBalanceHistoryPoint]) -> (absolute: Double, percent: Double) {
        guard let first = points.first, let last = points.last else {
            return (0, 0)
        }
        let absolute = last.balance - first.balance
        let percent = first.balance == 0 ? 0 : (absolute / abs(first.balance)) * 100
        return (absolute, percent)
    }

    static func xDomain(points: [AccountBalanceHistoryPoint]) -> ClosedRange<Date> {
        guard let first = points.first, let last = points.last else {
            let now = Date()
            return now.addingTimeInterval(-86_400)...now
        }

        let start = first.parsedDate
        let end = last.parsedDate
        if start < end { return start...end }
        return start.addingTimeInterval(-86_400)...end
    }

    static func yDomain(points: [AccountBalanceHistoryPoint]) -> ClosedRange<Double> {
        FinancialChartSelection.paddedDomain(
            values: points.map(\.balance),
            includeZero: false
        )
    }

    private static func dailySeries(
        points: [AccountBalanceHistoryPoint]
    ) -> [AccountBalanceHistoryPoint] {
        guard let first = points.first, let last = points.last else { return [] }
        if points.count == 1 { return points }

        var balanceByDate: [String: Double] = [:]
        for point in points {
            balanceByDate[point.date] = point.balance
        }

        var cursor = utcCalendar.startOfDay(for: first.parsedDate)
        let end = utcCalendar.startOfDay(for: last.parsedDate)
        var series: [AccountBalanceHistoryPoint] = []
        var lastBalance = first.balance

        while cursor <= end {
            let iso = DateFormatterProvider.yearMonthDay(cursor)
            if let balance = balanceByDate[iso] {
                lastBalance = balance
            }
            series.append(AccountBalanceHistoryPoint(date: iso, balance: lastBalance))
            guard let next = utcCalendar.date(byAdding: .day, value: 1, to: cursor) else { break }
            cursor = next
        }

        return series
    }

    private static func linePoints(
        from points: [AccountBalanceHistoryPoint]
    ) -> [AccountBalanceHistoryPoint] {
        guard let point = points.first else { return [] }
        if points.count >= 2 { return points }

        let previous = utcCalendar.date(byAdding: .day, value: -1, to: point.parsedDate)
            ?? point.parsedDate.addingTimeInterval(-86_400)
        return [
            AccountBalanceHistoryPoint(
                date: DateFormatterProvider.yearMonthDay(previous),
                balance: point.balance
            ),
            point,
        ]
    }

    private static func rangeStart(_ range: AccountHistoryRange, now: Date) -> Date? {
        let today = utcCalendar.startOfDay(for: now)
        switch range {
        case .oneDay:
            return utcCalendar.date(byAdding: .day, value: -1, to: today)
        case .oneWeek:
            return utcCalendar.date(byAdding: .day, value: -7, to: today)
        case .oneMonth:
            return utcCalendar.date(byAdding: .day, value: -30, to: today)
        case .threeMonths:
            return utcCalendar.date(byAdding: .day, value: -90, to: today)
        case .ytd:
            return utcCalendar.date(from: DateComponents(
                year: utcCalendar.component(.year, from: today),
                month: 1,
                day: 1
            ))
        case .oneYear:
            return utcCalendar.date(byAdding: .day, value: -365, to: today)
        case .all:
            return nil
        }
    }

    private static let utcCalendar: Calendar = {
        var calendar = Calendar(identifier: .gregorian)
        calendar.timeZone = TimeZone(secondsFromGMT: 0)!
        return calendar
    }()
}
