import Foundation

enum JSONValue: Codable, Equatable, Identifiable {
    case string(String)
    case number(Double)
    case bool(Bool)
    case object([String: JSONValue])
    case array([JSONValue])
    case null

    var id: String { displayValue }

    init(from decoder: Decoder) throws {
        let container = try decoder.singleValueContainer()

        if container.decodeNil() {
            self = .null
        } else if let value = try? container.decode(Bool.self) {
            self = .bool(value)
        } else if let value = try? container.decode(Double.self) {
            self = .number(value)
        } else if let value = try? container.decode(String.self) {
            self = .string(value)
        } else if let value = try? container.decode([String: JSONValue].self) {
            self = .object(value)
        } else if let value = try? container.decode([JSONValue].self) {
            self = .array(value)
        } else {
            throw DecodingError.dataCorruptedError(
                in: container,
                debugDescription: "Unsupported JSON value"
            )
        }
    }

    func encode(to encoder: Encoder) throws {
        var container = encoder.singleValueContainer()

        switch self {
        case .string(let value):
            try container.encode(value)
        case .number(let value):
            try container.encode(value)
        case .bool(let value):
            try container.encode(value)
        case .object(let value):
            try container.encode(value)
        case .array(let value):
            try container.encode(value)
        case .null:
            try container.encodeNil()
        }
    }

    var stringValue: String? {
        if case .string(let value) = self { return value }
        return nil
    }

    var numberValue: Double? {
        if case .number(let value) = self { return value }
        return nil
    }

    var boolValue: Bool? {
        if case .bool(let value) = self { return value }
        return nil
    }

    var objectValue: [String: JSONValue]? {
        if case .object(let value) = self { return value }
        return nil
    }

    var arrayValue: [JSONValue]? {
        if case .array(let value) = self { return value }
        return nil
    }

    var displayValue: String {
        switch self {
        case .string(let value):
            return value
        case .number(let value):
            return CurrencyFormatter.format(value)
        case .bool(let value):
            return value ? "Yes" : "No"
        case .object(let value):
            return value.preferredTitle ?? "Object"
        case .array(let value):
            return "\(value.count) items"
        case .null:
            return "-"
        }
    }
}

extension Dictionary where Key == String, Value == JSONValue {
    var preferredTitle: String? {
        for key in ["name", "title", "merchantName", "institutionName", "description", "categoryName", "type", "id"] {
            if let value = self[key]?.stringValue, !value.isEmpty {
                return value
            }
        }

        return nil
    }

    var preferredAmount: Double? {
        for key in ["amount", "monthlyGoal", "spent", "total", "currentBalance", "balance", "startingBalance", "value", "income", "expenses", "netGain"] {
            if let value = self[key]?.numberValue {
                return value
            }
        }

        return nil
    }

    var preferredSubtitle: String? {
        let candidates = ["date", "month", "account", "category", "status", "type", "isActive", "count"]
        let parts = candidates.compactMap { key -> String? in
            guard let value = self[key] else { return nil }
            let displayValue = value.displayValue
            return displayValue == "-" ? nil : displayValue
        }

        return parts.isEmpty ? nil : parts.joined(separator: " · ")
    }
}
