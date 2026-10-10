import Foundation
import Combine

/// View model for the dashboard screen
@MainActor
final class DashboardViewModel: ObservableObject {
    
    // MARK: - Published State
    
    @Published private(set) var state: DashboardState = .idle
    @Published private(set) var summary: DashboardSummary?
    @Published private(set) var layout: DashboardLayout = .empty
    @Published private(set) var spendingBreakdown: [SpendingCategoryBreakdown] = []
    @Published private(set) var recentTransactions: [TransactionItem] = []
    @Published private(set) var isLayoutLoading = false
    @Published private(set) var isMutatingLayout = false
    @Published var layoutMessage: DashboardLayoutMessage?
    
    // MARK: - Dependencies
    
    private let dashboardService: DashboardService
    private let authManager: AuthManager
    private var cancellables = Set<AnyCancellable>()
    
    // MARK: - Initialization
    
    init(
        dashboardService: DashboardService? = nil,
        authManager: AuthManager? = nil
    ) {
        self.dashboardService = dashboardService ?? DashboardService()
        self.authManager = authManager ?? AuthManager.shared

        NotificationCenter.default.publisher(for: MoatDataRefresh.dashboardDidChange)
            .receive(on: RunLoop.main)
            .sink { [weak self] _ in
                guard let self else { return }
                Task { await self.refreshIfLoaded() }
            }
            .store(in: &cancellables)
    }
    
    // MARK: - Data Loading
    
    func load() async {
        guard case .idle = state else { return }
        await loadData(showLoading: true)
    }

    func loadData(showLoading: Bool = true, showRefreshing: Bool = false) async {
        let previousState = state
        if showLoading {
            state = .loading
        } else if showRefreshing {
            state = .refreshing
        }
        
        do {
            async let netWorthTask = dashboardService.fetchNetWorthHistory(months: 24)
            async let aggregatesTask = dashboardService.fetchMonthlyAggregates(months: 12)
            async let metricsTask = dashboardService.fetchSummaryMetrics()
            async let allocationTask = dashboardService.fetchPortfolioAllocation()
            async let layoutTask = dashboardService.fetchLayout()
            async let spendingTask = dashboardService.fetchSpendingBreakdown(months: 1)
            async let recentTransactionsTask = dashboardService.fetchRecentTransactions(limit: 5)

            let dataPoints = try await netWorthTask

            // Allow secondary metrics to fail gracefully — net worth is the source of truth.
            let aggregates: MonthlyAggregateResponse? = try? await aggregatesTask
            let metrics: SummaryMetricsResponse? = try? await metricsTask
            let allocation: [DashboardPortfolioAllocationSection] = (try? await allocationTask) ?? []
            layout = (try? await layoutTask) ?? .empty
            spendingBreakdown = (try? await spendingTask) ?? []
            recentTransactions = (try? await recentTransactionsTask) ?? []

            if dataPoints.isEmpty && (aggregates?.months.isEmpty ?? true) {
                state = .empty
            } else {
                summary = DashboardSummary.make(
                    dataPoints: dataPoints,
                    monthlyAggregates: aggregates?.months ?? [],
                    metrics: metrics,
                    allocation: allocation
                )
                state = .loaded
            }
        } catch let error as APIError where error.isUnauthorized {
            await authManager.signOut(reason: "dashboard_unauthorized")
        } catch {
            if error.isCancellation {
                if case .loading = state {
                    state = .idle
                } else if case .refreshing = state {
                    state = previousState == .empty ? .empty : .loaded
                }
                return
            }
            state = .error(error)
        }
    }
    
    // MARK: - Actions
    
    func signOut() async {
        await authManager.signOut(reason: "dashboard_user_requested")
    }
    
    func refresh() async {
        await loadData(showLoading: false, showRefreshing: true)
    }

    func refreshIfLoaded() async {
        switch state {
        case .loaded, .empty, .refreshing:
            await loadData(showLoading: false, showRefreshing: true)
        default:
            break
        }
    }

    var visibleWidgets: [DashboardWidgetInstance] {
        layout.visibleWidgets
    }

    func updateWidgetOrder(_ orderedWidgets: [DashboardWidgetInstance]) async {
        guard !orderedWidgets.isEmpty else { return }

        var nextOrder = 0
        var updatedWidgets: [DashboardWidgetInstance] = []
        let orderedIds = Set(orderedWidgets.map(\.id))

        for widget in orderedWidgets {
            updatedWidgets.append(widget.updated(order: nextOrder, isVisible: true))
            nextOrder += 1
        }

        for widget in layout.widgets.sorted(by: { $0.order < $1.order }) where !orderedIds.contains(widget.id) {
            updatedWidgets.append(widget.updated(order: nextOrder))
            nextOrder += 1
        }

        await persistLayout(updatedWidgets, successTitle: "Dashboard reordered", successMessage: "Your widget order was saved.")
    }

    func addWidget(type: String) async {
        guard !isMutatingLayout else { return }

        let definition = DashboardWidgetDefinition.definition(for: type)
        if definition.singleton && layout.containsSingleton(type: type) {
            layoutMessage = DashboardLayoutMessage(title: "Already added", message: "\(definition.title) is already on your dashboard.")
            return
        }

        isMutatingLayout = true
        defer { isMutatingLayout = false }

        do {
            let widget = try await dashboardService.addWidget(type: type)
            layout.widgets.append(widget)
            layoutMessage = DashboardLayoutMessage(title: "Widget added", message: definition.title)
        } catch {
            AppLogger.error("Dashboard widget add failed", metadata: ["widgetType": type])
            layoutMessage = DashboardLayoutMessage(title: "Could not add widget", message: error.localizedDescription)
        }
    }

    func removeWidget(_ widget: DashboardWidgetInstance) async {
        guard !isMutatingLayout else { return }

        isMutatingLayout = true
        defer { isMutatingLayout = false }

        do {
            try await dashboardService.removeWidget(id: widget.id)
            layout.widgets.removeAll { $0.id == widget.id }
            let definition = DashboardWidgetDefinition.definition(for: widget.widgetType)
            layoutMessage = DashboardLayoutMessage(title: "Widget removed", message: definition.title)
        } catch {
            AppLogger.error("Dashboard widget removal failed", metadata: ["widgetType": widget.widgetType])
            layoutMessage = DashboardLayoutMessage(title: "Could not remove widget", message: error.localizedDescription)
        }
    }

    func resetLayout() async {
        guard !isMutatingLayout else { return }

        isMutatingLayout = true
        defer { isMutatingLayout = false }

        do {
            layout = try await dashboardService.resetLayout()
            layoutMessage = DashboardLayoutMessage(title: "Dashboard reset", message: "Default widgets are back in place.")
        } catch {
            AppLogger.error("Dashboard layout reset failed")
            layoutMessage = DashboardLayoutMessage(title: "Could not reset dashboard", message: error.localizedDescription)
        }
    }
    
    // MARK: - User Info
    
    var userEmail: String? {
        authManager.session?.email
    }

    var userName: String? {
        authManager.session?.name
    }

    func forecastedBalancePoints(years: Int = 1) -> [ForecastedBalancePoint] {
        guard let summary else { return [] }
        return Self.makeForecastedBalancePoints(from: summary, years: years)
    }

    static func makeForecastedBalancePoints(from summary: DashboardSummary, years: Int) -> [ForecastedBalancePoint] {
        let historical = summary.dataPoints.suffix(3).map {
            ForecastedBalancePoint(month: $0.month, value: $0.total, isForecast: false)
        }

        guard let current = summary.dataPoints.last else { return historical }

        let calendar = Calendar(identifier: .gregorian)
        let annualReturnRate = 0.07
        let monthlyReturnRate = pow(1 + annualReturnRate, 1.0 / 12.0) - 1
        var projectedValue = current.total
        let forecastMonths = years * 12

        let forecast = (1...forecastMonths).compactMap { offset -> ForecastedBalancePoint? in
            guard let date = calendar.date(byAdding: .month, value: offset, to: current.date) else { return nil }
            projectedValue *= 1 + monthlyReturnRate
            return ForecastedBalancePoint(
                month: DateFormatterProvider.yearMonth(date),
                value: projectedValue,
                isForecast: true
            )
        }

        return historical + forecast
    }

    private func persistLayout(_ widgets: [DashboardWidgetInstance], successTitle: String, successMessage: String) async {
        guard !isMutatingLayout else { return }

        let previousLayout = layout
        layout = DashboardLayout(widgets: widgets)
        isMutatingLayout = true
        defer { isMutatingLayout = false }

        do {
            layout = try await dashboardService.updateLayout(widgets: widgets)
            layoutMessage = DashboardLayoutMessage(title: successTitle, message: successMessage)
        } catch {
            layout = previousLayout
            AppLogger.error("Dashboard layout update failed")
            layoutMessage = DashboardLayoutMessage(title: "Could not update dashboard", message: error.localizedDescription)
        }
    }
}

// MARK: - Dashboard State

enum DashboardState: Equatable {
    case idle
    case loading
    case loaded
    case refreshing
    case empty
    case error(Error)
    
    static func == (lhs: DashboardState, rhs: DashboardState) -> Bool {
        switch (lhs, rhs) {
        case (.idle, .idle): return true
        case (.loading, .loading): return true
        case (.loaded, .loaded): return true
        case (.refreshing, .refreshing): return true
        case (.empty, .empty): return true
        case (.error, .error): return true
        default: return false
        }
    }
}

struct DashboardLayoutMessage: Identifiable, Equatable {
    let id = UUID()
    let title: String
    let message: String
}
