import Foundation

struct SpendingCategoryBreakdown: Decodable, Identifiable, Equatable {
    let category: String
    let total: Double
    let monthlyAvg: Double
    let percentage: Double
    let percentOfTop: Double
    let parentCategory: CategoryParent?

    var id: String { category }
}

struct SpendingTrendResponse: Decodable, Equatable {
    let months: [SpendingTrendMonth]
    let categories: [String]

    private enum CodingKeys: String, CodingKey {
        case months
        case categories
    }
}

struct SpendingTrendMonth: Decodable, Identifiable, Equatable {
    let month: String
    let categoryTotals: [String: Double]

    var id: String { month }
    var total: Double { categoryTotals.values.reduce(0, +) }

    init(month: String, categoryTotals: [String: Double]) {
        self.month = month
        self.categoryTotals = categoryTotals
    }

    init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: DynamicCodingKey.self)
        let month = try container.decode(String.self, forKey: DynamicCodingKey(stringValue: "month"))
        var totals: [String: Double] = [:]

        for key in container.allKeys where key.stringValue != "month" {
            totals[key.stringValue] = try container.decode(Double.self, forKey: key)
        }

        self.month = month
        self.categoryTotals = totals
    }
}

struct RecurringExpense: Decodable, Identifiable, Equatable {
    let description: String
    let monthlyAmount: Double
    let occurrences: Int

    var id: String { description }
}

struct SpendingAnomaly: Decodable, Identifiable, Equatable {
    let category: String
    let currentAmount: Double
    let averageAmount: Double
    let ratio: Double

    var id: String { category }
    var increasePercent: Double { max(0, (ratio - 1) * 100) }
}

struct SpendingLoadResult {
    let breakdown: [SpendingCategoryBreakdown]
    let trends: SpendingTrendResponse
    let recurring: [RecurringExpense]
    let anomalies: [SpendingAnomaly]
}

private struct DynamicCodingKey: CodingKey {
    let stringValue: String
    let intValue: Int?

    init(stringValue: String) {
        self.stringValue = stringValue
        self.intValue = nil
    }

    init?(intValue: Int) {
        self.stringValue = String(intValue)
        self.intValue = intValue
    }
}