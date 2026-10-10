import Foundation

enum AmountInputFormatter {
    private static let groupingFormatter: NumberFormatter = {
        let formatter = NumberFormatter()
        formatter.numberStyle = .decimal
        formatter.locale = Locale(identifier: "en_US")
        formatter.usesGroupingSeparator = true
        formatter.groupingSeparator = ","
        formatter.decimalSeparator = "."
        formatter.minimumFractionDigits = 0
        formatter.maximumFractionDigits = 0
        return formatter
    }()

    static func parse(_ value: String) -> Double? {
        let sanitized = value
            .replacingOccurrences(of: "$", with: "")
            .replacingOccurrences(of: ",", with: "")
            .trimmingCharacters(in: .whitespacesAndNewlines)
        guard !sanitized.isEmpty else { return nil }
        return Double(sanitized)
    }

    static func format(_ value: Double, fractionDigits: Int = 0) -> String {
        let formatter = groupingFormatter.copy() as? NumberFormatter ?? NumberFormatter()
        formatter.minimumFractionDigits = fractionDigits
        formatter.maximumFractionDigits = fractionDigits
        return formatter.string(from: NSNumber(value: value)) ?? String(format: "%.\(fractionDigits)f", value)
    }

    static func formatTyping(_ value: String, fractionDigits: Int = 0) -> String {
        let trimmed = value.trimmingCharacters(in: .whitespacesAndNewlines)
        if trimmed.isEmpty {
            return ""
        }

        let withoutCurrency = trimmed.replacingOccurrences(of: "$", with: "")
        let allowed = withoutCurrency.filter { "0123456789.,".contains($0) }
        if allowed.isEmpty {
            return ""
        }

        let hasTrailingDecimal = fractionDigits > 0 && allowed.hasSuffix(".")
        let parts = allowed.split(separator: ".", omittingEmptySubsequences: false)
        let integerRaw = String(parts.first ?? "")
            .replacingOccurrences(of: ",", with: "")
            .filter(\.isNumber)

        if integerRaw.isEmpty && !hasTrailingDecimal && parts.count < 2 {
            return ""
        }

        let integerDigits = integerRaw.isEmpty ? "0" : integerRaw
        let groupedInteger: String = {
            guard let number = Double(integerDigits) else { return integerDigits }
            let formatter = groupingFormatter.copy() as? NumberFormatter ?? NumberFormatter()
            formatter.minimumFractionDigits = 0
            formatter.maximumFractionDigits = 0
            return formatter.string(from: NSNumber(value: number)) ?? integerDigits
        }()

        if fractionDigits == 0 {
            return groupedInteger == "0" && integerRaw.isEmpty ? "" : groupedInteger
        }

        if hasTrailingDecimal && parts.count == 1 {
            return "\(groupedInteger)."
        }

        guard parts.count > 1 else {
            return groupedInteger == "0" && integerRaw.isEmpty ? "" : groupedInteger
        }

        let fraction = String(parts[1])
            .replacingOccurrences(of: ",", with: "")
            .filter(\.isNumber)
        let limitedFraction = String(fraction.prefix(fractionDigits))

        if hasTrailingDecimal && limitedFraction.isEmpty {
            return "\(groupedInteger)."
        }

        if limitedFraction.isEmpty {
            return groupedInteger == "0" && integerRaw.isEmpty ? "" : groupedInteger
        }

        let displayInteger = integerRaw.isEmpty ? "0" : groupedInteger
        return "\(displayInteger).\(limitedFraction)"
    }
}
