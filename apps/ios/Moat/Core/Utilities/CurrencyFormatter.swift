import Foundation

/// Currency formatting utilities
enum CurrencyFormatter {
    
    private static let formatter: NumberFormatter = {
        let formatter = NumberFormatter()
        formatter.numberStyle = .currency
        formatter.locale = Locale.current
        formatter.currencyCode = "USD"
        return formatter
    }()
    
    private static let compactFormatter: NumberFormatter = {
        let formatter = NumberFormatter()
        formatter.numberStyle = .currency
        formatter.locale = Locale.current
        formatter.currencyCode = "USD"
        formatter.maximumFractionDigits = 0
        return formatter
    }()
    
    /// Formats a number as currency (e.g., "$1,234.56")
    static func format(_ value: Double) -> String {
        formatter.string(from: NSNumber(value: value)) ?? "$0.00"
    }
    
    /// Formats a number as compact currency (e.g., "$1,235")
    static func formatCompact(_ value: Double) -> String {
        compactFormatter.string(from: NSNumber(value: value)) ?? "$0"
    }
    
    /// Formats a number as short currency (e.g., "$1.2K", "$1.5M")
    static func formatShort(_ value: Double) -> String {
        let absValue = abs(value)
        let sign = value < 0 ? "-" : ""
        
        switch absValue {
        case 1_000_000_000...:
            return "\(sign)$\(String(format: "%.1f", absValue / 1_000_000_000))B"
        case 1_000_000...:
            return "\(sign)$\(String(format: "%.1f", absValue / 1_000_000))M"
        case 1_000...:
            return "\(sign)$\(String(format: "%.1f", absValue / 1_000))K"
        default:
            return formatCompact(value)
        }
    }
}
