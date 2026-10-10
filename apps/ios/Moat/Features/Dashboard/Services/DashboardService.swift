import Foundation

/// Service for fetching dashboard data
actor DashboardService {

    private let apiClient: APIClient

    init(apiClient: APIClient = .shared) {
        self.apiClient = apiClient
    }

    /// Fetches net worth history for the specified number of months
    func fetchNetWorthHistory(months: Int = 24) async throws -> [NetWorthPoint] {
        let request = BalanceSnapshotHistoryRequest(months: months)

        let response: BalanceSnapshotHistoryResponse = try await apiClient.post(
            endpoint: .balanceSnapshotHistory,
            body: request,
            authenticated: true
        )

        return response.historical.map { point in
            NetWorthPoint(month: point.month, total: point.total)
        }
    }

    /// Fetches monthly income/expense/net aggregates for the specified window.
    func fetchMonthlyAggregates(months: Int = 12) async throws -> MonthlyAggregateResponse {
        try await apiClient.post(
            path: "/api/v1/transaction/getMonthlyAggregates",
            body: .object(["months": .number(Double(months))])
        )
    }

    /// Fetches 12-month average income, expenses, and net gain.
    func fetchSummaryMetrics() async throws -> SummaryMetricsResponse {
        try await apiClient.get(path: "/api/v1/transaction/getSummaryMetrics")
    }

    /// Fetches portfolio allocation snapshot grouped by asset type.
    func fetchPortfolioAllocation() async throws -> [DashboardPortfolioAllocationSection] {
        let response: PortfolioAllocationResponse = try await apiClient.get(
            path: "/api/v1/investment/getPortfolioAllocation"
        )
        return response.sections
    }

    func fetchLayout() async throws -> DashboardLayout {
        try await apiClient.get(path: "/api/v1/dashboard/getLayout")
    }

    func updateLayout(widgets: [DashboardWidgetInstance]) async throws -> DashboardLayout {
        try await apiClient.post(
            path: "/api/v1/dashboard/updateLayout",
            body: .object([
                "widgets": .array(widgets.map(\.requestBody))
            ])
        )
    }

    func addWidget(type: String) async throws -> DashboardWidgetInstance {
        try await apiClient.post(
            path: "/api/v1/dashboard/addWidget",
            body: .object(["widgetType": .string(type)])
        )
    }

    func removeWidget(id: String) async throws {
        let _: EmptyResponse = try await apiClient.post(
            path: "/api/v1/dashboard/removeWidget",
            body: .object(["id": .string(id)])
        )
    }

    func resetLayout() async throws -> DashboardLayout {
        try await apiClient.post(path: "/api/v1/dashboard/resetToDefault")
    }

    func fetchSpendingBreakdown(months: Int = 1) async throws -> [SpendingCategoryBreakdown] {
        try await apiClient.post(
            path: "/api/v1/spending/getCategoryBreakdown",
            body: .object(["months": .number(Double(max(1, min(months, 12))))])
        )
    }

    func fetchRecentTransactions(limit: Int = 5) async throws -> [TransactionItem] {
        let response: TransactionListResponse = try await apiClient.post(
            path: "/api/v1/transaction/getAll",
            body: .object([
                "limit": .number(Double(max(1, min(limit, 20)))),
                "cursor": .number(0),
                "sortField": .string("date"),
                "sortDir": .string("desc")
            ])
        )
        return response.items
    }
}
