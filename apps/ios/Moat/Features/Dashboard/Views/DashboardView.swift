import SwiftUI

/// Main dashboard screen showing net worth and summary
struct DashboardView: View {
    
    @StateObject private var viewModel = DashboardViewModel()
    @StateObject private var transactionsViewModel = TransactionsViewModel()
    @State private var isCustomizeSheetPresented = false
    @State private var isFeedbackSheetPresented = false
    @State private var activeTransactionSheet: TransactionSheet?
    @AppStorage(MoatAppearance.storageKey) private var appearanceRawValue = MoatAppearance.system.rawValue
    
    var body: some View {
        NavigationStack {
            ZStack {
                switch viewModel.state {
                case .idle, .loading:
                    DashboardLoadingSkeleton()
                        .transition(.opacity)

                case .loaded, .refreshing:
                    if let summary = viewModel.summary {
                        loadedContent(summary: summary)
                            .transition(.opacity)
                    } else {
                        emptyContent
                            .transition(.opacity)
                    }

                case .empty:
                    emptyContent
                        .transition(.opacity)

                case .error(let error):
                    ErrorStateView(error: error) {
                        Task { await viewModel.refresh() }
                    }
                    .transition(.opacity)
                }
            }
            .animation(.easeInOut(duration: 0.4), value: dashboardContentKey)
            .navigationTitle("")
            .navigationBarTitleDisplayMode(.inline)
            .onAppear {
                Analytics.capture("dashboard_viewed", properties: ["platform": "ios"])
            }
            .toolbar {
                ToolbarItem(placement: .topBarTrailing) {
                    Button {
                        isCustomizeSheetPresented = true
                    } label: {
                        Image(systemName: "slider.horizontal.3")
                    }
                }

                ToolbarItem(placement: .topBarTrailing) {
                    Menu {
                        if let email = viewModel.userEmail {
                            Text(email)
                        }

                        Divider()

                        Picker(selection: $appearanceRawValue) {
                            ForEach(MoatAppearance.allCases) { appearance in
                                Label(appearance.title, systemImage: appearance.systemImage)
                                    .tag(appearance.rawValue)
                            }
                        } label: {
                            Label("Appearance", systemImage: "sun.max")
                        }
                        .pickerStyle(.menu)

                        Button {
                            isFeedbackSheetPresented = true
                        } label: {
                            Label("Send Feedback", systemImage: "bubble.left.and.bubble.right")
                        }

                        Divider()

                        Button {
                            Task { await viewModel.signOut() }
                        } label: {
                            Label("Sign Out", systemImage: "rectangle.portrait.and.arrow.right")
                        }
                    } label: {
                        Image(systemName: "person")
                            .font(.title3)
                    }
                }
            }
            .sheet(isPresented: $isCustomizeSheetPresented) {
                DashboardCustomizeSheet(viewModel: viewModel)
            }
            .sheet(isPresented: $isFeedbackSheetPresented) {
                FeedbackSheet(route: "dashboard")
            }
            .sheet(item: $activeTransactionSheet) { sheet in
                switch sheet {
                case .edit(let transaction):
                    TransactionDetailSheet(
                        transaction: transaction,
                        allHashtags: transactionsViewModel.hashtags,
                        allTransactions: viewModel.recentTransactions,
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
                case .filters(_), .bulkActions:
                    EmptyView()
                }
            }
            .alert(item: $viewModel.layoutMessage) { message in
                Alert(
                    title: Text(message.title),
                    message: Text(message.message),
                    dismissButton: .default(Text("OK"))
                )
            }
            .navigationDestination(for: AppDestination.self) { destination in
                AppDestinationView(destination: destination)
            }
        }
        .task {
            await viewModel.load()
        }
    }

    private var dashboardContentKey: String {
        switch viewModel.state {
        case .idle, .loading: return "loading"
        case .loaded, .refreshing: return "loaded"
        case .empty: return "empty"
        case .error: return "error"
        }
    }
    
    // MARK: - Loaded Content
    
    private func loadedContent(summary: DashboardSummary) -> some View {
        ScrollView {
            VStack(spacing: 20) {
                DashboardGreetingHeader(
                    name: viewModel.userName,
                    email: viewModel.userEmail
                )

                SummaryCardView(summary: summary)

                if viewModel.visibleWidgets.isEmpty {
                    EmptyDashboardWidgetsCard {
                        isCustomizeSheetPresented = true
                    }
                } else {
                    ForEach(viewModel.visibleWidgets) { widget in
                        DashboardWidgetCard(
                            widget: widget,
                            summary: summary,
                            spendingBreakdown: viewModel.spendingBreakdown,
                            recentTransactions: viewModel.recentTransactions,
                            onSelectRecentTransaction: { transaction in
                                Task {
                                    if case .idle = transactionsViewModel.state {
                                        await transactionsViewModel.load()
                                    }
                                    activeTransactionSheet = .edit(transaction)
                                }
                            }
                        )
                    }
                }
            }
            .padding()
        }
        .moatPageBackground()
        .refreshable { await viewModel.refresh() }
    }
    
    // MARK: - Empty Content
    
    private var emptyContent: some View {
        ScrollView {
            VStack(spacing: MoatTheme.Spacing.xLarge) {
                DashboardGreetingHeader(
                    name: viewModel.userName,
                    email: viewModel.userEmail
                )

                Image(systemName: "chart.line.uptrend.xyaxis")
                    .font(.system(size: 44, weight: .light))
                    .foregroundStyle(MoatTheme.ColorToken.textTertiary)

                VStack(spacing: MoatTheme.Spacing.small) {
                    Text("No data yet")
                        .font(.title3.weight(.semibold))
                        .foregroundStyle(MoatTheme.ColorToken.textPrimary)

                    Text("Connect an account to start tracking your net worth and spending trends.")
                        .font(.subheadline)
                        .foregroundStyle(MoatTheme.ColorToken.textSecondary)
                        .multilineTextAlignment(.center)
                        .padding(.horizontal, MoatTheme.Spacing.xxLarge)
                }

                Button("Refresh") {
                    Task { await viewModel.refresh() }
                }
                .buttonStyle(.moatSecondary)
                .frame(maxWidth: 180)
            }
            .frame(maxWidth: .infinity)
            .padding(.top, 120)
            .padding(.bottom, 112)
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity)
        .moatPageBackground()
        .refreshable { await viewModel.refresh() }
    }
}

// MARK: - Preview

#Preview {
    DashboardView()
}

// MARK: - Subviews

private struct DashboardWidgetCard: View {
    let widget: DashboardWidgetInstance
    let summary: DashboardSummary
    let spendingBreakdown: [SpendingCategoryBreakdown]
    let recentTransactions: [TransactionItem]
    let onSelectRecentTransaction: (TransactionItem) -> Void

    private var definition: DashboardWidgetDefinition {
        DashboardWidgetDefinition.definition(for: widget.widgetType)
    }

    var body: some View {
        switch widget.widgetType {
        case "net-worth-chart":
            DashboardShell(definition: definition) {
                NetWorthChartView(dataPoints: summary.dataPoints)
            }
        case "monthly-cash-flow":
            MonthlyCashFlowWidgetView(months: summary.monthlyAggregates)
        case "spending-by-category":
            DashboardShell(definition: definition, insightsInitialTab: .spending) {
                SpendingByCategoryDashboardContent(rows: spendingBreakdown)
            }
        case "recent-transactions":
            DashboardShell(definition: definition, linkDestination: .transactions) {
                RecentTransactionsDashboardContent(
                    transactions: recentTransactions,
                    onSelect: onSelectRecentTransaction
                )
            }
        case "forecasted-balance":
            ForecastedNetWorthWidgetView(summary: summary)
        case "portfolio-allocation":
            if summary.allocationSections.isEmpty {
                DashboardShell(definition: definition) {
                    DashboardEmptyWidgetText("No allocation data yet")
                }
            } else {
                PortfolioAllocationChartView(
                    sections: summary.allocationSections,
                    total: summary.totalAllocationValue
                )
            }
        case "summary-metrics":
            DashboardMetricsCard(summary: summary)
        default:
            DashboardUnsupportedWidgetCard(definition: definition)
        }
    }
}

private struct MonthlyCashFlowWidgetView: View {
    let months: [MonthlyAggregate]

    @State private var selectedPeriod: InsightsPeriod = .twelveMonths

    private var filteredMonths: [MonthlyAggregate] {
        filterMonthlyAggregates(months, period: selectedPeriod)
    }

    var body: some View {
        MoatCard {
            VStack(alignment: .leading, spacing: MoatTheme.Spacing.large) {
                HStack(alignment: .center, spacing: MoatTheme.Spacing.small) {
                    Text("Monthly Cash Flow")
                        .font(.subheadline.weight(.semibold))
                        .foregroundStyle(MoatTheme.ColorToken.textPrimary)

                    Spacer(minLength: MoatTheme.Spacing.small)

                    InsightsPeriodPicker(
                        selectedPeriod: $selectedPeriod,
                        periods: InsightsPeriod.cashFlowOptions
                    )

                    NavigationLink {
                        InsightsView(initialTab: .netIncome, initialPeriod: selectedPeriod)
                    } label: {
                        Image(systemName: "arrow.up.right")
                            .font(.subheadline.weight(.semibold))
                            .foregroundStyle(MoatTheme.ColorToken.textSecondary)
                    }
                    .buttonStyle(.plain)
                    .accessibilityLabel("Open Net Income insights")
                }

                if months.isEmpty {
                    DashboardEmptyWidgetText("No cash flow data yet")
                } else if filteredMonths.isEmpty {
                    DashboardEmptyWidgetText("No cash flow data for this period")
                } else {
                    MonthlyNetGainsChartView(months: filteredMonths)
                }
            }
            .frame(maxWidth: .infinity, alignment: .leading)
        }
    }
}

private struct ForecastedNetWorthWidgetView: View {
    let summary: DashboardSummary

    @State private var forecastYears = 1

    private var points: [ForecastedBalancePoint] {
        DashboardViewModel.makeForecastedBalancePoints(from: summary, years: forecastYears)
    }

    private var forecastedNetWorth: Double {
        points.last(where: \.isForecast)?.value ?? summary.currentNetWorth
    }

    var body: some View {
        MoatCard {
            VStack(alignment: .leading, spacing: MoatTheme.Spacing.large) {
                VStack(alignment: .leading, spacing: MoatTheme.Spacing.xSmall) {
                    HStack(alignment: .firstTextBaseline) {
                        Text("Forecasted Net Worth")
                            .font(.subheadline.weight(.semibold))
                            .foregroundStyle(MoatTheme.ColorToken.textPrimary)

                        Spacer(minLength: MoatTheme.Spacing.small)

                        ForecastHorizonPicker(selectedYears: $forecastYears)
                    }

                    if !points.isEmpty {
                        HStack(spacing: 4) {
                            Text(CurrencyFormatter.formatCompact(summary.currentNetWorth))
                                .font(.subheadline.weight(.semibold))
                                .foregroundStyle(MoatTheme.ColorToken.textPrimary)

                            Text("→")
                                .font(.caption)
                                .foregroundStyle(MoatTheme.ColorToken.textTertiary)

                            Text(CurrencyFormatter.formatCompact(forecastedNetWorth))
                                .font(.subheadline.weight(.semibold))
                                .foregroundStyle(MoatTheme.ColorToken.positive)

                            Text("in \(forecastYears)y")
                                .font(.caption)
                                .foregroundStyle(MoatTheme.ColorToken.textSecondary)
                        }
                        .monospacedDigit()
                    }
                }

                if points.isEmpty {
                    DashboardEmptyWidgetText("No forecast data yet")
                } else {
                    ForecastedBalanceChartView(points: points, forecastYears: forecastYears)
                }
            }
            .frame(maxWidth: .infinity, alignment: .leading)
        }
    }
}

private struct DashboardShell<Content: View>: View {
    let definition: DashboardWidgetDefinition
    let linkDestination: AppDestination?
    let insightsInitialTab: InsightsTab?
    private let content: Content

    init(
        definition: DashboardWidgetDefinition,
        linkDestination: AppDestination? = nil,
        insightsInitialTab: InsightsTab? = nil,
        @ViewBuilder content: () -> Content
    ) {
        self.definition = definition
        self.linkDestination = linkDestination
        self.insightsInitialTab = insightsInitialTab
        self.content = content()
    }

    var body: some View {
        MoatCard {
            VStack(alignment: .leading, spacing: MoatTheme.Spacing.large) {
                HStack(alignment: .firstTextBaseline) {
                    Text(definition.title)
                        .font(.subheadline.weight(.semibold))
                        .foregroundStyle(MoatTheme.ColorToken.textPrimary)

                    Spacer(minLength: MoatTheme.Spacing.small)

                    if let insightsInitialTab {
                        NavigationLink {
                            InsightsView(initialTab: insightsInitialTab)
                        } label: {
                            Image(systemName: "arrow.up.right")
                                .font(.subheadline.weight(.semibold))
                                .foregroundStyle(MoatTheme.ColorToken.textSecondary)
                        }
                        .buttonStyle(.plain)
                        .accessibilityLabel("Open \(definition.title)")
                    } else if let linkDestination {
                        NavigationLink(value: linkDestination) {
                            Image(systemName: "arrow.up.right")
                                .font(.subheadline.weight(.semibold))
                                .foregroundStyle(MoatTheme.ColorToken.textSecondary)
                        }
                        .buttonStyle(.plain)
                        .accessibilityLabel("Open \(definition.title)")
                    }
                }

                content
            }
            .frame(maxWidth: .infinity, alignment: .leading)
        }
    }
}

private struct EmptyDashboardWidgetsCard: View {
    let onCustomize: () -> Void

    var body: some View {
        MoatCard {
            VStack(alignment: .leading, spacing: MoatTheme.Spacing.medium) {
                Label("No widgets shown", systemImage: "rectangle.stack.badge.plus")
                    .font(.headline)
                Text("Choose the widgets you want on your home dashboard.")
                    .font(.subheadline)
                    .foregroundStyle(.secondary)
                Button("Customize", action: onCustomize)
                    .buttonStyle(.moatSecondary)
                    .frame(maxWidth: 180)
            }
            .frame(maxWidth: .infinity, alignment: .leading)
        }
    }
}

private struct DashboardUnsupportedWidgetCard: View {
    let definition: DashboardWidgetDefinition

    var body: some View {
        DashboardShell(definition: definition) {
            DashboardEmptyWidgetText("This widget is not available on iOS yet.")
        }
    }
}

private struct DashboardEmptyWidgetText: View {
    let text: String

    init(_ text: String) {
        self.text = text
    }

    var body: some View {
        Text(text)
            .font(.subheadline)
            .foregroundStyle(.secondary)
            .frame(maxWidth: .infinity, minHeight: 96)
    }
}

private struct SpendingByCategoryDashboardContent: View {
    let rows: [SpendingCategoryBreakdown]

    private var visibleRows: [SpendingCategoryBreakdown] {
        Array(rows.prefix(6))
    }

    var body: some View {
        if visibleRows.isEmpty {
            DashboardEmptyWidgetText("No spending data available")
        } else {
            VStack(spacing: MoatTheme.Spacing.small) {
                ForEach(visibleRows) { row in
                    VStack(alignment: .leading, spacing: 5) {
                        HStack {
                            Text(row.category)
                                .font(.subheadline.weight(.semibold))
                                .lineLimit(1)
                            Spacer()
                            Text(CurrencyFormatter.formatCompact(row.total))
                                .font(.subheadline.monospacedDigit())
                        }

                        GeometryReader { proxy in
                            ZStack(alignment: .leading) {
                                Capsule().fill(MoatTheme.ColorToken.chartMuted)
                                Capsule()
                                    .fill(MoatTheme.ColorToken.chartPrimary)
                                    .frame(width: proxy.size.width * min(1, row.percentOfTop / 100))
                            }
                        }
                        .frame(height: 5)
                    }
                    .padding(.vertical, MoatTheme.Spacing.xSmall)
                }
            }
        }
    }
}

private struct RecentTransactionsDashboardContent: View {
    let transactions: [TransactionItem]
    let onSelect: (TransactionItem) -> Void

    var body: some View {
        if transactions.isEmpty {
            DashboardEmptyWidgetText("No recent transactions")
        } else {
            VStack(spacing: MoatTheme.Spacing.small) {
                ForEach(transactions) { transaction in
                    Button {
                        onSelect(transaction)
                    } label: {
                        HStack(spacing: MoatTheme.Spacing.small) {
                            VStack(alignment: .leading, spacing: 2) {
                                Text(transaction.displayTitle)
                                    .font(.subheadline.weight(.semibold))
                                    .lineLimit(1)
                                Text(transaction.displayCategory)
                                    .font(.caption)
                                    .foregroundStyle(.secondary)
                                    .lineLimit(1)
                            }

                            Spacer()

                            Text(CurrencyFormatter.formatCompact(transaction.signedAmount))
                                .font(.subheadline.monospacedDigit().weight(.semibold))
                                .foregroundStyle(
                                    transaction.signedAmount >= 0
                                        ? MoatTheme.ColorToken.positive
                                        : MoatTheme.ColorToken.textPrimary
                                )
                        }
                        .padding(.vertical, 4)
                        .contentShape(Rectangle())
                    }
                    .buttonStyle(.plain)
                }
            }
        }
    }
}

private struct DashboardMetricsCard: View {
    let summary: DashboardSummary

    var body: some View {
        MoatCard {
            VStack(alignment: .leading, spacing: 12) {
                Text("12-month average")
                    .font(.subheadline)
                    .foregroundStyle(.secondary)

                LazyVGrid(columns: [GridItem(.flexible()), GridItem(.flexible()), GridItem(.flexible())], spacing: 12) {
                    DashboardMetric(
                        title: "Income",
                        value: summary.avgIncome,
                        systemImage: "arrow.down",
                        tint: MoatTheme.ColorToken.positive
                    )
                    DashboardMetric(
                        title: "Expenses",
                        value: summary.avgExpenses,
                        systemImage: "arrow.up",
                        tint: MoatTheme.ColorToken.destructive
                    )
                    DashboardMetric(
                        title: "Net gain",
                        value: summary.avgNetGain,
                        systemImage: "equal",
                        tint: summary.avgNetGain >= 0 ? MoatTheme.ColorToken.positive : MoatTheme.ColorToken.warning
                    )
                }
            }
            .frame(maxWidth: .infinity, alignment: .leading)
        }
    }
}

private struct DashboardGreetingHeader: View {
    let name: String?
    let email: String?

    private var greeting: String {
        let hour = Calendar.current.component(.hour, from: Date())
        let timeOfDay: String
        if hour < 12 {
            timeOfDay = "Good morning"
        } else if hour < 17 {
            timeOfDay = "Good afternoon"
        } else {
            timeOfDay = "Good evening"
        }

        guard let firstName = dashboardFirstName(name: name, email: email) else {
            return timeOfDay
        }
        return "\(timeOfDay), \(firstName)"
    }

    var body: some View {
        VStack(alignment: .leading, spacing: MoatTheme.Spacing.medium) {
            Text(greeting)
                .font(.title2.weight(.bold))
                .foregroundStyle(MoatTheme.ColorToken.textPrimary)
                .frame(maxWidth: .infinity, alignment: .leading)

            MoatFlowLayout(horizontalSpacing: 8, verticalSpacing: 8) {
                DashboardShortcutButton(
                    title: "Review recent transactions",
                    systemImage: "list.bullet.rectangle.portrait",
                    prominent: true
                ) {
                    AppNavigationCoordinator.shared.selectedTab = .transactions
                }
                DashboardShortcutButton(
                    title: "Manage your financial profile",
                    systemImage: "person.text.rectangle",
                    prominent: false
                ) {
                    AppNavigationCoordinator.shared.openFinancialProfile()
                }
                DashboardShortcutButton(
                    title: "Review budget",
                    systemImage: "chart.pie",
                    prominent: false
                ) {
                    AppNavigationCoordinator.shared.openDestination(.budget)
                }
                DashboardShortcutButton(
                    title: "View monthly insights",
                    systemImage: "chart.bar.xaxis",
                    prominent: false
                ) {
                    AppNavigationCoordinator.shared.selectedTab = .insights
                }
            }
            .frame(maxWidth: .infinity, alignment: .leading)
        }
    }
}

private func dashboardFirstName(name: String?, email: String?) -> String? {
    let trimmedName = name?.trimmingCharacters(in: .whitespacesAndNewlines) ?? ""
    if let first = trimmedName.split(separator: " ").first, !first.isEmpty {
        return String(first)
    }

    let localPart = email?
        .split(separator: "@")
        .first
        .map(String.init)?
        .trimmingCharacters(in: .whitespacesAndNewlines) ?? ""
    guard !localPart.isEmpty else { return nil }
    let token = localPart
        .replacingOccurrences(of: ".", with: " ")
        .replacingOccurrences(of: "_", with: " ")
        .replacingOccurrences(of: "-", with: " ")
        .split(separator: " ")
        .first
    guard let token, !token.isEmpty else { return nil }
    return token.prefix(1).uppercased() + token.dropFirst()
}

private struct DashboardShortcutButton: View {
    let title: String
    let systemImage: String
    let prominent: Bool
    let action: () -> Void

    var body: some View {
        Button(action: action) {
            Label(title, systemImage: systemImage)
                .font(.subheadline.weight(.medium))
                .labelStyle(.titleAndIcon)
                .padding(.horizontal, 14)
                .padding(.vertical, 8)
                .foregroundStyle(prominent ? MoatTheme.ColorToken.inkInverse : MoatTheme.ColorToken.textPrimary)
                .background(prominent ? MoatTheme.ColorToken.accent : MoatTheme.ColorToken.mutedSurface)
                .clipShape(Capsule())
        }
        .buttonStyle(.plain)
    }
}

private struct DashboardMetric: View {
    let title: String
    let value: Double
    let systemImage: String
    let tint: Color

    var body: some View {
        VStack(alignment: .leading, spacing: 4) {
            Image(systemName: systemImage)
                .foregroundStyle(tint)
            Text(CurrencyFormatter.formatCompact(value))
                .font(.headline.monospacedDigit())
                .lineLimit(1)
                .minimumScaleFactor(0.7)
            Text(title)
                .font(.caption)
                .foregroundStyle(.secondary)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
    }
}
