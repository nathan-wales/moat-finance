import Foundation

let investmentAccountTypes: Set<String> = [
    "stocks",
    "roth ira",
    "ira",
    "brokerage",
    "401k",
    "401(k)",
    "roth 401(k)",
    "roth 401k",
    "hsa",
    "529",
    "roth_ira",
    "four01k",
    "investment",
    "mutual fund",
    "mutual_fund",
]

func isInvestmentAccount(type: String) -> Bool {
    investmentAccountTypes.contains(
        type.lowercased().trimmingCharacters(in: .whitespacesAndNewlines)
    )
}

func formatPercentInput(_ value: Double, maxFractionDigits: Int = 2) -> String {
    let scale = pow(10.0, Double(maxFractionDigits))
    let rounded = (value * scale).rounded() / scale
    let formatter = NumberFormatter()
    formatter.locale = Locale(identifier: "en_US")
    formatter.numberStyle = .decimal
    formatter.usesGroupingSeparator = false
    formatter.minimumFractionDigits = 0
    formatter.maximumFractionDigits = maxFractionDigits
    return formatter.string(from: NSNumber(value: rounded)) ?? String(format: "%g", rounded)
}

func formatPercent(_ value: Double) -> String {
    "\(formatPercentInput(value))%"
}

func formatDateString(_ value: String) -> String {
    let trimmed = value.trimmingCharacters(in: .whitespacesAndNewlines)
    if trimmed.isEmpty {
        return trimmed
    }

    if trimmed.range(of: #"^\d{4}-\d{2}-\d{2}$"#, options: .regularExpression) != nil {
        return trimmed
    }

    if let date = FinancialProfileFormatters.isoDateParser.date(from: trimmed) {
        return FinancialProfileFormatters.isoDateFormatter.string(from: date)
    }

    if let date = FinancialProfileFormatters.isoDateTimeParser.date(from: trimmed) {
        return FinancialProfileFormatters.isoDateFormatter.string(from: date)
    }

    if let date = FinancialProfileFormatters.displayDateParser.date(from: trimmed) {
        return FinancialProfileFormatters.isoDateFormatter.string(from: date)
    }

    return trimmed
}

func currentDateString() -> String {
    FinancialProfileFormatters.isoDateFormatter.string(from: Date())
}

private enum FinancialProfileFormatters {
    static let isoDateFormatter: DateFormatter = {
        let formatter = DateFormatter()
        formatter.calendar = Calendar(identifier: .gregorian)
        formatter.locale = Locale(identifier: "en_US_POSIX")
        formatter.timeZone = TimeZone(secondsFromGMT: 0)
        formatter.dateFormat = "yyyy-MM-dd"
        return formatter
    }()

    static let isoDateParser: ISO8601DateFormatter = {
        let formatter = ISO8601DateFormatter()
        formatter.formatOptions = [.withFullDate]
        return formatter
    }()

    static let isoDateTimeParser: ISO8601DateFormatter = {
        let formatter = ISO8601DateFormatter()
        formatter.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
        return formatter
    }()

    static let displayDateParser: DateFormatter = {
        let formatter = DateFormatter()
        formatter.dateStyle = .medium
        formatter.timeStyle = .none
        return formatter
    }()
}
