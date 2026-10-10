import Foundation

@MainActor
final class SpendingInsightsViewModel: ObservableObject {
    enum ViewState {
        case idle
        case loading
        case loaded
        case refreshing
        case error(Error)
    }

    @Published private(set) var state: ViewState = .idle
    @Published private(set) var breakdown: [SpendingCategoryBreakdown] = []
    @Published private(set) var trends = SpendingTrendResponse(months: [], categories: [])
    @Published private(set) var recurring: [RecurringExpense] = []
    @Published private(set) var anomalies: [SpendingAnomaly] = []

    private let service: SpendingService
    private var loadedPeriod: InsightsPeriod?
    private var hasLoaded = false

    init(service: SpendingService = SpendingService()) {
        self.service = service
    }

    var totalSpend: Double {
        breakdown.reduce(0) { total, row in total + row.total }
    }

    func monthlyAverage(for period: InsightsPeriod) -> Double {
        let months = insightsPeriodToMonths(period)
        guard months > 0 else { return 0 }
        return totalSpend / Double(months)
    }

    var topCategory: SpendingCategoryBreakdown? {
        breakdown.first
    }

    var recurringExpensesTotal: Double {
        recurring.reduce(0) { $0 + $1.monthlyAmount }
    }

    func loadIfNeeded(period: InsightsPeriod) async {
        if hasLoaded, loadedPeriod == period {
            return
        }
        await reload(period: period, showLoading: !hasLoaded)
    }

    func refresh(period: InsightsPeriod) async {
        await reload(period: period, showLoading: false, showRefreshing: true)
    }

    func updatePeriod(_ period: InsightsPeriod) async {
        await reload(period: period, showLoading: false)
    }

    private func reload(period: InsightsPeriod, showLoading: Bool, showRefreshing: Bool = true) async {
        if showLoading {
            state = .loading
        } else if showRefreshing {
            state = .refreshing
        }

        do {
            let result = try await service.load(period: period)
            breakdown = result.breakdown
            trends = result.trends
            recurring = result.recurring
            anomalies = result.anomalies
            loadedPeriod = period
            hasLoaded = true
            state = .loaded
        } catch {
            if error.isCancellation {
                if case .refreshing = state {
                    state = .loaded
                }
                return
            }
            AppLogger.error("Failed to load spending insights", metadata: ["operation": "insights.spending.load"])
            state = .error(error)
        }
    }
}
