import SwiftUI

struct NetIncomeInsightsTabView: View {
    @ObservedObject var viewModel: NetIncomeInsightsViewModel
    let period: InsightsPeriod

    var body: some View {
        Group {
            switch viewModel.state {
            case .idle, .loading:
                LoadingView("Loading net income...")
            case .loaded, .refreshing:
                loadedContent
            case .error(let error):
                ErrorStateView(error: error) {
                    Task { await viewModel.refresh(period: period) }
                }
            }
        }
    }

    private var loadedContent: some View {
        VStack(spacing: MoatTheme.Spacing.large) {
            NetIncomeSummarySection(data: viewModel.data)
            IncomeVsSpendingSection(data: viewModel.data)
            NetIncomeTrendSection(data: viewModel.data)
            SavingsRateSection(data: viewModel.data)
            WhereIncomeWentSection(data: viewModel.data, period: period)
        }
        .padding(.horizontal, MoatTheme.Spacing.large)
    }
}
