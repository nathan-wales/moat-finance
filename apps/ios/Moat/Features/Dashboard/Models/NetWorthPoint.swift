import Foundation

/// A single data point for the net worth chart
struct NetWorthPoint: Identifiable, Equatable {
    let id: String
    let month: String
    let date: Date
    let total: Double
    
    init(month: String, total: Double) {
        self.id = month
        self.month = month
        self.date = DateFormatterProvider.parseYearMonth(month) ?? Date()
        self.total = total
    }
}

// MARK: - API Response

struct BalanceSnapshotHistoryResponse: Decodable {
    let historical: [BalanceSnapshotPoint]
    let forecast: [BalanceSnapshotPoint]

    private enum CodingKeys: String, CodingKey {
        case historical
        case forecast
    }

    init(historical: [BalanceSnapshotPoint], forecast: [BalanceSnapshotPoint] = []) {
        self.historical = historical
        self.forecast = forecast
    }

    init(from decoder: Decoder) throws {
        if let points = try? [BalanceSnapshotPoint](from: decoder) {
            self.init(historical: points)
            return
        }

        let container = try decoder.container(keyedBy: CodingKeys.self)
        let historical = try container.decode([BalanceSnapshotPoint].self, forKey: .historical)
        let forecast = try container.decodeIfPresent([BalanceSnapshotPoint].self, forKey: .forecast) ?? []
        self.init(historical: historical, forecast: forecast)
    }
}

struct BalanceSnapshotPoint: Decodable {
    let month: String
    let total: Double
    let isForecast: Bool?
}

// MARK: - Request

struct BalanceSnapshotHistoryRequest: Encodable {
    let months: Int
}
