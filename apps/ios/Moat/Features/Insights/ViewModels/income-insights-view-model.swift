import Foundation
import Combine

@MainActor
final class IncomeInsightsViewModel: ObservableObject {
    enum ViewState {
        case idle
        case loading
        case loaded
        case refreshing
        case error(Error)
    }

    @Published private(set) var state: ViewState = .idle
    @Published private(set) var data: IncomeInsightsData?

    private let service: InsightsService
    private var loadedPeriod: InsightsPeriod?
    private var hasLoaded = false
    private var cancellables = Set<AnyCancellable>()

    init(service: InsightsService = InsightsService()) {
        self.service = service

        NotificationCenter.default.publisher(for: MoatDataRefresh.transactionsDidChange)
            .receive(on: RunLoop.main)
            .sink { [weak self] _ in
                guard let self, let loadedPeriod else { return }
                Task { await self.refresh(period: loadedPeriod) }
            }
            .store(in: &cancellables)
    }

    func monthlyAverage(for period: InsightsPeriod) -> Double {
        let months = insightsPeriodToMonths(period)
        guard months > 0 else { return 0 }
        return (data?.totalIncome ?? 0) / Double(months)
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
            data = try await service.getIncomeInsights(period: period)
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
            AppLogger.error("Failed to load income insights", metadata: ["operation": "insights.income.load"])
            state = .error(error)
        }
    }
}
