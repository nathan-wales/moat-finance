import Foundation

enum FinancialChartFormatting {
    static func currency(_ value: Double) -> String {
        CurrencyFormatter.formatCompact(value)
    }

    static func compactCurrency(_ value: Double) -> String {
        CurrencyFormatter.formatShort(value)
    }

    static func signedCurrency(_ value: Double) -> String {
        if value > 0 {
            return "+\(CurrencyFormatter.formatCompact(value))"
        }
        if value < 0 {
            return "-\(CurrencyFormatter.formatCompact(abs(value)))"
        }
        return CurrencyFormatter.formatCompact(0)
    }

    static func percent(_ value: Double?) -> String {
        guard let value else { return "—" }
        return "\(Int(value.rounded()))%"
    }

    static func ratioPercent(_ value: Double?) -> String {
        guard let value else { return "—" }
        return percent(value * 100)
    }

    static func month(_ date: Date) -> String {
        DateFormatterProvider.shortMonth(date)
    }

    static func monthYear(_ date: Date) -> String {
        DateFormatterProvider.monthYear(date)
    }
}
