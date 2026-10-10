import Foundation

private struct InsightsPeriodRequest: Encodable {
    let period: String
}

actor InsightsService {
    private let apiClient: APIClient

    init(apiClient: APIClient = .shared) {
        self.apiClient = apiClient
    }

    func getIncomeInsights(period: InsightsPeriod) async throws -> IncomeInsightsData {
        try await apiClient.post(
            path: "/api/v1/insights/getIncomeInsights",
            body: InsightsPeriodRequest(period: period.rawValue)
        )
    }

    func getNetIncomeInsights(period: InsightsPeriod) async throws -> NetIncomeInsightsData {
        try await apiClient.post(
            path: "/api/v1/insights/getNetIncomeInsights",
            body: InsightsPeriodRequest(period: period.rawValue)
        )
    }
}
