import SwiftUI

struct AppShellView: View {
    @ObservedObject private var navigation = AppNavigationCoordinator.shared
    @ObservedObject private var connectionStore = AIAccessConnectionStore.shared
    @AppStorage(DemoModeDefaults.sessionKey) private var demoSessionKey = ""
    @StateObject private var demoModeViewModel = DemoModeViewModel()
    @SwiftUI.Environment(\.scenePhase) private var scenePhase

    private var isDemoMode: Bool {
        !demoSessionKey.isEmpty
    }

    var body: some View {
        TabView(selection: $navigation.selectedTab) {
            DashboardView()
                .tabItem {
                    Label(AppTab.home.title, systemImage: AppTab.home.systemImage)
                }
                .tag(AppTab.home)

            NavigationStack {
                FinancialProfileView()
            }
            .tabItem {
                Label(AppTab.profile.title, systemImage: AppTab.profile.systemImage)
            }
            .tag(AppTab.profile)

            NavigationStack {
                InsightsView()
            }
            .tabItem {
                Label(AppTab.insights.title, systemImage: AppTab.insights.systemImage)
            }
            .tag(AppTab.insights)

            NavigationStack {
                TransactionsView()
            }
            .tabItem {
                Label(AppTab.transactions.title, systemImage: AppTab.transactions.systemImage)
            }
            .tag(AppTab.transactions)

            MoreMenuView()
                .tabItem {
                    Label(AppTab.more.title, systemImage: AppTab.more.systemImage)
                }
                .tag(AppTab.more)
        }
        .safeAreaInset(edge: .top, spacing: 0) {
            VStack(spacing: 0) {
                if isDemoMode {
                    DemoModeBanner(viewModel: demoModeViewModel)
                } else if connectionStore.shouldShowBanner {
                    AIAccessConnectBanner(
                        onConnect: { navigation.openAIAccess() },
                        onDismiss: { connectionStore.dismissBanner() }
                    )
                }
            }
        }
        .sheet(item: demoModeActionMessageBinding) { message in
            DemoModeActionSheet(message: message) {
                demoModeViewModel.clearActionMessage()
            }
        }
        .ignoresSafeArea(.keyboard, edges: .bottom)
        .overlay(alignment: .bottom) {
            HStack {
                Spacer(minLength: 0)
                SetupGuideCard()
            }
        }
        .task {
            MileageTracker.shared.prepareForLaunch()
            if MileageTracker.shared.hasUnfinishedTrip {
                AppNavigationCoordinator.shared.openMileage()
            }
            await refreshConnectionIfNeeded()
            await syncAppleWalletIfStale()
        }
        .onChange(of: demoSessionKey) { _ in
            Task { await refreshConnectionIfNeeded() }
        }
        .onChange(of: scenePhase) { phase in
            if phase != .active {
                MileageTracker.shared.persistNow()
            }
            guard phase == .active else { return }
            Task { await refreshConnectionIfNeeded() }
            Task { await syncAppleWalletIfStale() }
        }
    }

    private func refreshConnectionIfNeeded() async {
        guard !isDemoMode else { return }
        await connectionStore.refresh()
    }

    private func syncAppleWalletIfStale() async {
        await AppleWalletAutoSyncCoordinator.shared.syncIfStale(isDemoMode: isDemoMode)
    }

    private var demoModeActionMessageBinding: Binding<DemoModeActionMessage?> {
        Binding(
            get: { demoModeViewModel.actionMessage },
            set: { value in
                if value == nil { demoModeViewModel.clearActionMessage() }
            }
        )
    }
}

#Preview {
    AppShellView()
}
