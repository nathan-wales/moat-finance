import SwiftUI

struct IncomeInsightsTabView: View {
    @ObservedObject var viewModel: IncomeInsightsViewModel
    let period: InsightsPeriod

    @StateObject private var transactionsViewModel = TransactionsViewModel()
    @State private var activeTransactionSheet: TransactionSheet?

    var body: some View {
        Group {
            switch viewModel.state {
            case .idle, .loading:
                LoadingView("Loading income...")
            case .loaded, .refreshing:
                loadedContent
            case .error(let error):
                ErrorStateView(error: error) {
                    Task { await viewModel.refresh(period: period) }
                }
            }
        }
        .sheet(item: $activeTransactionSheet) { sheet in
            switch sheet {
            case .edit(let transaction):
                TransactionDetailSheet(
                    transaction: transaction,
                    allHashtags: transactionsViewModel.hashtags,
                    allTransactions: transactionsViewModel.transactions,
                    onSave: { description, amount, category, type, hashtags in
                        let prompt = try await transactionsViewModel.save(
                            transaction: transaction,
                            description: description,
                            amount: amount,
                            category: category,
                            type: type,
                            hashtags: hashtags
                        )
                        activeTransactionSheet = prompt.map(TransactionSheet.rulePrompt)
                    },
                    onSplit: { description, originalAmount, splitAmount, category, splitCategory, type, hashtags in
                        try await transactionsViewModel.split(
                            transaction: transaction,
                            description: description,
                            originalAmount: originalAmount,
                            splitAmount: splitAmount,
                            type: type,
                            originalCategoryName: category,
                            splitCategoryName: splitCategory,
                            hashtags: hashtags
                        )
                        activeTransactionSheet = nil
                    },
                    onUnsplit: {
                        try await transactionsViewModel.unsplit(transaction)
                        activeTransactionSheet = nil
                    },
                    onHide: {
                        let prompt = try await transactionsViewModel.hide(transaction)
                        activeTransactionSheet = prompt.map(TransactionSheet.rulePrompt)
                    },
                    onUnhide: {
                        try await transactionsViewModel.unhide(transaction)
                        activeTransactionSheet = nil
                    },
                    onPrepareRuleEditor: {
                        try await transactionsViewModel.prepareSwipeRuleEditor(for: transaction)
                    },
                    onSaveRule: { prompt, draft, applyToHistorical in
                        try await transactionsViewModel.applyRulePrompt(
                            prompt,
                            draft: draft,
                            applyToHistorical: applyToHistorical
                        )
                    },
                    onFetchRulePreview: { prompt, draft in
                        try await transactionsViewModel.previewRulePrompt(prompt, draft: draft)
                    },
                    onResolveManageRuleTitle: {
                        await transactionsViewModel.resolveManageRuleTitle(for: transaction)
                    },
                    onShowMoreCommunityTips: { searchQuery in
                        activeTransactionSheet = nil
                        AppNavigationCoordinator.shared.openCommunityTips(search: searchQuery)
                    }
                )
            case .rulePrompt(let prompt):
                TransactionRulePromptSheet(
                    prompt: prompt,
                    hashtags: transactionsViewModel.hashtags,
                    onDismiss: { activeTransactionSheet = nil },
                    onPrepareEditor: { try await transactionsViewModel.prepareRuleEditor(for: prompt) },
                    onSaveRule: { draft, applyToHistorical in
                        try await transactionsViewModel.applyRulePrompt(
                            prompt,
                            draft: draft,
                            applyToHistorical: applyToHistorical
                        )
                        activeTransactionSheet = nil
                    },
                    onFetchPreview: { draft in
                        try await transactionsViewModel.previewRulePrompt(prompt, draft: draft)
                    }
                )
            default:
                EmptyView()
            }
        }
    }

    private var loadedContent: some View {
        VStack(spacing: MoatTheme.Spacing.large) {
            IncomeSummarySection(
                data: viewModel.data,
                monthlyAverage: viewModel.monthlyAverage(for: period),
                showMonthlyAverage: !isInsightsWeekPeriod(period)
            )
            IncomeTrendSection(data: viewModel.data)
            IncomeSourcesSection(data: viewModel.data, period: period)
            RecurringVsOneTimeSection(data: viewModel.data)
            RecentIncomeSection(
                data: viewModel.data,
                onSelectTransaction: { row in
                    Task { await openTransaction(row) }
                }
            )
        }
        .padding(.horizontal, MoatTheme.Spacing.large)
    }

    private func openTransaction(_ row: RecentIncomeTransaction) async {
        if case .idle = transactionsViewModel.state {
            await transactionsViewModel.load()
        }

        guard let date = InsightsChartFormatting.parseDate(row.date) else { return }

        do {
            guard let transaction = try await transactionsViewModel.fetchTransaction(
                id: row.id,
                around: date
            ) else {
                return
            }
            activeTransactionSheet = .edit(transaction)
        } catch {
            AppLogger.error(
                "Failed to load transaction for income insights",
                metadata: ["operation": "insights.income.openTransaction"]
            )
        }
    }
}
