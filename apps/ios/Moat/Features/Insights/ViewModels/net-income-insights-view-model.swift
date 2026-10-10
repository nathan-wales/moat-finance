import Foundation

@MainActor
final class NetIncomeInsightsViewModel: ObservableObject {
    enum ViewState {
        case idle
        case loading
        case loaded
        case refreshing
        case error(Error)
    }

    @Published private(set) var state: ViewState = .idle
    @Published private(set) var data: NetIncomeInsightsData?

    private let service: InsightsService
    private var loadedPeriod: InsightsPeriod?
    private var hasLoaded = false

    init(service: InsightsService = InsightsService()) {
        self.service = service
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
            data = try await service.getNetIncomeInsights(period: period)
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
            AppLogger.error("Failed to load net income insights", metadata: ["operation": "insights.netIncome.load"])
            state = .error(error)
        }
    }
}
