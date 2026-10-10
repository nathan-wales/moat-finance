import Foundation

actor SpendingService {
    private let apiClient: APIClient

    init(apiClient: APIClient = .shared) {
        self.apiClient = apiClient
    }

    func load(period: InsightsPeriod) async throws -> SpendingLoadResult {
        let body: JSONValue
        if let dateRange = insightsDateRange(for: period) {
            body = .object([
                "startDate": .string(dateRange.startDate),
                "endDate": .string(dateRange.endDate)
            ])
        } else {
            let boundedMonths = max(1, min(24, insightsPeriodToMonths(period)))
            body = .object(["months": .number(Double(boundedMonths))])
        }

        async let breakdown: [SpendingCategoryBreakdown] = apiClient.post(
            path: "/api/v1/spending/getCategoryBreakdown",
            body: body
        )
        async let trends: SpendingTrendResponse = apiClient.post(
            path: "/api/v1/spending/getCategoryTrends",
            body: body
        )
        async let recurring: [RecurringExpense] = apiClient.get(path: "/api/v1/spending/getRecurringExpenses")
        async let anomalies: [SpendingAnomaly] = apiClient.get(path: "/api/v1/spending/getAnomalies")

        return try await SpendingLoadResult(
            breakdown: breakdown,
            trends: trends,
            recurring: recurring,
            anomalies: anomalies
        )
    }
}