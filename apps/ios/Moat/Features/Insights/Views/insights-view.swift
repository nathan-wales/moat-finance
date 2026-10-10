import SwiftUI

struct InsightsView: View {
    var initialTab: InsightsTab?
    var initialPeriod: InsightsPeriod?

    @AppStorage(InsightsStorageKey.selectedTab) private var storedTab = InsightsTab.netIncome.rawValue
    @AppStorage(InsightsStorageKey.selectedPeriod) private var storedPeriod = InsightsPeriod.default.rawValue

    @StateObject private var spendingViewModel = SpendingInsightsViewModel()
    @StateObject private var incomeViewModel = IncomeInsightsViewModel()
    @StateObject private var netIncomeViewModel = NetIncomeInsightsViewModel()

    @State private var didApplyInitialNavigation = false

    private var selectedTab: Binding<InsightsTab> {
        Binding(
            get: { parseInsightsTab(storedTab) },
            set: { storedTab = $0.rawValue }
        )
    }

    private var selectedPeriod: Binding<InsightsPeriod> {
        Binding(
            get: { parseInsightsPeriod(storedPeriod) },
            set: { storedPeriod = $0.rawValue }
        )
    }

    private var headerTitle: String {
        if initialTab != nil {
            return selectedTab.wrappedValue.title
        }
        return "Insights"
    }

    var body: some View {
        ScrollView {
            VStack(spacing: MoatTheme.Spacing.large) {
                InsightsHeader(
                    title: headerTitle,
                    selectedPeriod: selectedPeriod
                )

                LazyVStack(spacing: MoatTheme.Spacing.large, pinnedViews: [.sectionHeaders]) {
                    Section {
                        tabContent
                        InsightsChartRequestCtas(tab: selectedTab.wrappedValue)
                            .padding(.horizontal, MoatTheme.Spacing.large)
                            .padding(.top, MoatTheme.Spacing.medium)
                    } header: {
                        InsightsPinnedTabHeader(selectedTab: selectedTab)
                    }
                }
            }
            .padding(.bottom, 112)
        }
        .moatPageBackground()
        .overlay(alignment: .top) {
            InsightsTopFade()
                .allowsHitTesting(false)
        }
        .navigationTitle("")
        .navigationBarTitleDisplayMode(.inline)
        .onAppear {
            Analytics.capture(
                "insights_viewed",
                properties: ["period": selectedPeriod.wrappedValue.rawValue]
            )
        }
        .toolbarBackground(MoatTheme.ColorToken.appBackground, for: .navigationBar)
        .toolbarBackground(.visible, for: .navigationBar)
        .refreshable {
            await refreshActiveTab()
        }
        .task(id: InsightsLoadIdentity(tab: selectedTab.wrappedValue, period: selectedPeriod.wrappedValue)) {
            applyInitialNavigationIfNeeded()
            await loadActiveTab()
        }
    }

    @ViewBuilder
    private var tabContent: some View {
        switch selectedTab.wrappedValue {
        case .spending:
            SpendingInsightsTabView(
                viewModel: spendingViewModel,
                period: selectedPeriod.wrappedValue
            )
        case .income:
            IncomeInsightsTabView(
                viewModel: incomeViewModel,
                period: selectedPeriod.wrappedValue
            )
        case .netIncome:
            NetIncomeInsightsTabView(
                viewModel: netIncomeViewModel,
                period: selectedPeriod.wrappedValue
            )
        }
    }

    private func applyInitialNavigationIfNeeded() {
        guard !didApplyInitialNavigation else { return }
        didApplyInitialNavigation = true
        if let initialTab {
            storedTab = initialTab.rawValue
        }
        if let initialPeriod {
            storedPeriod = initialPeriod.rawValue
        }
    }

    private func loadActiveTab() async {
        switch selectedTab.wrappedValue {
        case .spending:
            await spendingViewModel.loadIfNeeded(period: selectedPeriod.wrappedValue)
        case .income:
            await incomeViewModel.loadIfNeeded(period: selectedPeriod.wrappedValue)
        case .netIncome:
            await netIncomeViewModel.loadIfNeeded(period: selectedPeriod.wrappedValue)
        }
    }

    private func refreshActiveTab() async {
        switch selectedTab.wrappedValue {
        case .spending:
            await spendingViewModel.refresh(period: selectedPeriod.wrappedValue)
        case .income:
            await incomeViewModel.refresh(period: selectedPeriod.wrappedValue)
        case .netIncome:
            await netIncomeViewModel.refresh(period: selectedPeriod.wrappedValue)
        }
    }
}

private struct InsightsLoadIdentity: Hashable {
    let tab: InsightsTab
    let period: InsightsPeriod
}

private struct InsightsHeader: View {
    let title: String
    @Binding var selectedPeriod: InsightsPeriod

    var body: some View {
        HStack(alignment: .center) {
            Text(title)
                .font(.largeTitle.weight(.bold))
                .foregroundStyle(MoatTheme.ColorToken.textPrimary)
                .lineLimit(1)
                .minimumScaleFactor(0.8)

            Spacer(minLength: MoatTheme.Spacing.large)

            InsightsPeriodPicker(selectedPeriod: $selectedPeriod)
        }
        .padding(.horizontal, MoatTheme.Spacing.large)
        .padding(.top, MoatTheme.Spacing.xLarge)
    }
}

private struct InsightsPinnedTabHeader: View {
    @Binding var selectedTab: InsightsTab

    var body: some View {
        InsightsTabPicker(selectedTab: $selectedTab)
            .padding(.horizontal, MoatTheme.Spacing.large)
            .padding(.top, MoatTheme.Spacing.small)
            .padding(.bottom, MoatTheme.Spacing.medium)
            .background {
                MoatTheme.ColorToken.appBackground
                    .ignoresSafeArea(edges: .top)
            }
            .overlay(alignment: .bottom) {
                LinearGradient(
                    colors: [
                        MoatTheme.ColorToken.appBackground,
                        MoatTheme.ColorToken.appBackground.opacity(0)
                    ],
                    startPoint: .top,
                    endPoint: .bottom
                )
                .frame(height: MoatTheme.Spacing.large)
                .offset(y: MoatTheme.Spacing.large)
                .allowsHitTesting(false)
            }
    }
}

private struct InsightsTopFade: View {
    var body: some View {
        LinearGradient(
            colors: [
                MoatTheme.ColorToken.appBackground,
                MoatTheme.ColorToken.appBackground.opacity(0)
            ],
            startPoint: .top,
            endPoint: .bottom
        )
        .frame(height: 72)
        .ignoresSafeArea(edges: .top)
    }
}

#Preview {
    NavigationStack {
        InsightsView()
    }
}
