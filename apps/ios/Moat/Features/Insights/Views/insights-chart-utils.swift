import SwiftUI

enum InsightsChartFormatting {
    private static let dayParser: DateFormatter = {
        let formatter = DateFormatter()
        formatter.calendar = Calendar(identifier: .gregorian)
        formatter.locale = Locale(identifier: "en_US_POSIX")
        formatter.timeZone = TimeZone(secondsFromGMT: 0)
        formatter.dateFormat = "yyyy-MM-dd"
        return formatter
    }()

    private static let shortDayFormatter: DateFormatter = {
        let formatter = DateFormatter()
        formatter.locale = Locale(identifier: "en_US")
        formatter.dateFormat = "MMM d"
        return formatter
    }()

    private static let isoFormatterWithFractionalSeconds: ISO8601DateFormatter = {
        let formatter = ISO8601DateFormatter()
        formatter.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
        return formatter
    }()

    private static let isoFormatter: ISO8601DateFormatter = {
        let formatter = ISO8601DateFormatter()
        formatter.formatOptions = [.withInternetDateTime]
        return formatter
    }()

    static func formatChartLabel(_ date: String) -> String {
        if date.range(of: #"^\d{4}-\d{2}-\d{2}$"#, options: .regularExpression) != nil {
            guard let parsed = dayParser.date(from: date) else { return date }
            return shortDayFormatter.string(from: parsed)
        }

        if date.range(of: #"^\d{4}-\d{2}$"#, options: .regularExpression) != nil {
            let parts = date.split(separator: "-")
            guard parts.count == 2,
                  let year = Int(parts[0]),
                  let second = Int(parts[1]) else {
                return date
            }

            if second > 12 {
                return "Week \(second), '\(String(format: "%02d", year % 100))"
            }

            return DateFormatterProvider.formatYearMonth(date)
        }

        return date
    }

    static func parseChartDate(_ dateString: String) -> Date? {
        if let date = DateFormatterProvider.parseYearMonth(dateString) {
            return date
        }
        return dayParser.date(from: dateString)
    }

    static func formatSignedCurrency(_ value: Double) -> String {
        if value > 0 {
            return "+\(CurrencyFormatter.formatCompact(value))"
        }
        if value < 0 {
            return "-\(CurrencyFormatter.formatCompact(abs(value)))"
        }
        return CurrencyFormatter.formatCompact(0)
    }

    static func formatPercent(_ value: Double?) -> String {
        guard let value else { return "—" }
        return "\(Int((value * 100).rounded()))%"
    }

    static func formatShortDate(_ dateString: String) -> String {
        if let date = isoFormatterWithFractionalSeconds.date(from: dateString) {
            return DateFormatterProvider.fullDate(date)
        }

        if let date = isoFormatter.date(from: dateString) {
            return DateFormatterProvider.fullDate(date)
        }

        if let date = dayParser.date(from: dateString) {
            return DateFormatterProvider.fullDate(date)
        }

        return dateString
    }

    static func parseDate(_ dateString: String) -> Date? {
        if let date = isoFormatterWithFractionalSeconds.date(from: dateString) {
            return date
        }

        if let date = isoFormatter.date(from: dateString) {
            return date
        }

        return dayParser.date(from: dateString)
    }
}

struct InsightChartPoint: Identifiable, Equatable {
    let id: String
    let date: Date
    let label: String
    let value: Double
    let secondaryValue: Double?

    init?(id: String, dateString: String, value: Double, secondaryValue: Double? = nil) {
        guard let date = InsightsChartFormatting.parseChartDate(dateString) else { return nil }
        self.id = id
        self.date = date
        self.label = InsightsChartFormatting.formatChartLabel(dateString)
        self.value = value
        self.secondaryValue = secondaryValue
    }
}

func insightsEmptyText(_ title: String) -> some View {
    Text(title)
        .font(.subheadline)
        .foregroundStyle(.secondary)
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding(MoatTheme.Spacing.large)
        .background(MoatTheme.ColorToken.surface)
        .clipShape(RoundedRectangle(cornerRadius: MoatTheme.Radius.medium, style: .continuous))
}
