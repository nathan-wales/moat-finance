import Foundation

@MainActor
final class OnboardingViewModel: ObservableObject {
    enum ViewState {
        case idle
        case loading
        case loaded
        case saving
        case error(Error)
    }

    @Published private(set) var state: ViewState = .idle
    @Published var currentStep: OnboardingStep = .goals
    @Published var goals: [String] = []
    @Published var currentAge: String = ""
    @Published var retirementAge: String = ""
    @Published var invests = false
    @Published var referralSource: String?
    @Published var referralSourceOther: String = ""
    @Published private(set) var connectedInstitutions: [OnboardingConnectedInstitution] = []
    @Published private(set) var allocationSections: [DashboardPortfolioAllocationSection] = []
    @Published private(set) var isLoadingAllocation = false
    @Published private(set) var isLoadingInstitutions = false
    @Published private(set) var completed = false

    @Published private(set) var actionMessage: OnboardingActionMessage?

    private let service: OnboardingService
    private let accountsService: AccountsService
    private let appleWalletService: AppleWalletAPIService
    private let dashboardService: DashboardService
    private let profileService: FinancialProfileService
    private let linkCoordinator: PlaidLinkCoordinator
    private var allocationPollingTask: Task<Void, Never>?
    @Published private(set) var profileData: FinancialProfileData = .empty

    init(
        service: OnboardingService = OnboardingService(),
        accountsService: AccountsService = AccountsService(),
        appleWalletService: AppleWalletAPIService = AppleWalletAPIService(),
        dashboardService: DashboardService = DashboardService(),
        profileService: FinancialProfileService = FinancialProfileService(),
        linkCoordinator: PlaidLinkCoordinator? = nil
    ) {
        self.service = service
        self.accountsService = accountsService
        self.appleWalletService = appleWalletService
        self.dashboardService = dashboardService
        self.profileService = profileService
        self.linkCoordinator = linkCoordinator ?? PlaidLinkCoordinator()
    }

    var canContinue: Bool {
        switch currentStep {
        case .goals:
            !goals.isEmpty
        case .profile:
            true
        case .referral:
            referralSource != nil
        case .finish:
            true
        }
    }

    var isBusy: Bool {
        if case .loading = state { return true }
        if case .saving = state { return true }
        return false
    }

    var totalAllocationValue: Double {
        allocationSections.reduce(0) { $0 + $1.value }
    }

    var hasAllocationData: Bool {
        !allocationSections.isEmpty && totalAllocationValue > 0
    }

    func load() async {
        guard case .idle = state else { return }
        state = .loading

        do {
            let data = try await service.loadSavedData()
            goals = data.goals
            currentAge = data.currentAge.map(String.init) ?? ""
            retirementAge = data.retirementAge.map(String.init) ?? ""
            referralSource = data.referralSource
            referralSourceOther = data.referralSourceOther ?? ""
            state = .loaded
        } catch {
            state = .error(error)
        }
    }

    func toggleGoal(_ goal: OnboardingGoalOption) {
        if goals.contains(goal.id) {
            goals.removeAll { $0 == goal.id }
        } else {
            goals.append(goal.id)
        }
    }

    func goBack() {
        guard let previous = OnboardingStep(rawValue: currentStep.rawValue - 1) else { return }
        currentStep = previous
    }

    func goNext() async {
        guard canContinue else { return }

        do {
            state = .saving
            try await persistCurrentStep()

            if let next = OnboardingStep(rawValue: currentStep.rawValue + 1) {
                currentStep = next
                state = .loaded
            } else {
                try await complete()
            }
        } catch {
            state = .error(error)
        }
    }

    func skipToFinish() {
        Analytics.capture(
            "onboarding_skipped",
            properties: [
                "platform": "ios",
                "stepAtSkip": currentStep.rawValue
            ]
        )
        currentStep = .finish
    }

    func onProfileStepAppeared() async {
        await loadConnectAccountsData()
    }

    func loadConnectAccountsData() async {
        Analytics.capture(
            "onboarding_connect_accounts_viewed",
            properties: ["platform": "ios"]
        )
        Analytics.capture(
            "onboarding_allocation_viewed",
            properties: [
                "hasAllocation": hasAllocationData,
                "institutionCount": connectedInstitutions.count
            ]
        )
        async let institutions: Void = fetchInstitutions()
        async let allocation: Void = fetchAllocation()
        async let profile: Void = fetchProfileData()
        _ = await (institutions, allocation, profile)
    }

    /// Opens native Plaid Link. Do not present `ConnectInstitutionSheet` until
    /// MX and Finicity integration needs the multi-provider interstitial again.
    func connectWithLink() async {
        state = .saving
        defer {
            if case .saving = state {
                state = .loaded
            }
        }

        do {
            let linkToken = try await accountsService.createLinkToken()
            let completion = try await linkCoordinator.open(linkToken: linkToken.linkToken)
            let result = try await accountsService.exchangePublicToken(
                publicToken: completion.publicToken,
                metadata: completion.metadata
            )
            PostConnectTransactionPolling.shared.start(plaidItemDbId: result.plaidItemDbId)
            await refreshAfterConnection()
        } catch {
            if error as? PlaidLinkError == .cancelled {
                return
            }

            if case PlaidLinkError.linkExited(let message) = error {
                actionMessage = OnboardingActionMessage(
                    title: "Bank connection closed",
                    message: "Plaid Link did not complete. If your bank opened an OAuth page, return to Moat from the browser or banking app to finish the connection. \(message)"
                )
                return
            }

            actionMessage = OnboardingActionMessage(
                title: "Bank connection failed",
                message: error.localizedDescription
            )
        }
    }

    func clearActionMessage() {
        actionMessage = nil
    }

    func refreshAfterConnection() async {
        Analytics.capture(
            "onboarding_institution_connected",
            properties: ["institutionCount": connectedInstitutions.count + 1]
        )
        Analytics.capture(
            "onboarding_account_connected",
            properties: ["accountCount": 1]
        )
        await fetchInstitutions()
        await fetchAllocation()
        startAllocationPolling()
    }

    func startAllocationPolling() {
        allocationPollingTask?.cancel()
        allocationPollingTask = Task {
            let maxAttempts = 10
            let interval: UInt64 = 3_000_000_000

            for attempt in 0..<maxAttempts {
                if Task.isCancelled { return }
                if hasAllocationData { return }

                if attempt > 0 {
                    try? await Task.sleep(nanoseconds: interval)
                }

                if Task.isCancelled { return }
                await fetchAllocation()

                if hasAllocationData { return }
            }
        }
    }

    func complete() async throws {
        state = .saving
        try await service.complete(
            goals: goals,
            plaidConnected: !connectedInstitutions.isEmpty,
            currentAge: parsedCurrentAge,
            retirementAge: parsedRetirementAge,
            invests: invests,
            referralSource: referralSource,
            referralSourceOther: referralSourceOther
        )
        Analytics.capture(
            "onboarding_completed",
            properties: [
                "platform": "ios",
                "stepCount": OnboardingStep.allCases.count
            ]
        )
        completed = true
        state = .loaded
    }

    func retryAfterError() {
        state = .idle
        Task { await load() }
    }

    private func persistCurrentStep() async throws {
        switch currentStep {
        case .goals:
            try await service.saveGoals(goals)
        case .profile:
            break
        case .referral:
            try await service.saveReferral(source: referralSource, other: referralSourceOther)
        case .finish:
            try await complete()
        }
    }

    private func fetchInstitutions() async {
        isLoadingInstitutions = true
        defer { isLoadingInstitutions = false }

        async let plaidInstitutions = fetchPlaidInstitutions()
        async let appleWalletInstitution = fetchAppleWalletInstitution()

        let plaid = await plaidInstitutions
        let appleWallet = await appleWalletInstitution

        var institutions = plaid
        if let appleWallet {
            institutions.insert(appleWallet, at: 0)
        }
        connectedInstitutions = institutions
    }

    private func fetchPlaidInstitutions() async -> [OnboardingConnectedInstitution] {
        do {
            let result = try await accountsService.load()
            return result.institutions.map { institution in
                OnboardingConnectedInstitution(
                    id: institution.id,
                    institutionName: institution.institutionName,
                    accountCount: institution.activeAccounts.count
                )
            }
        } catch {
            AppLogger.warn(
                "Failed to load connected institutions during onboarding",
                metadata: ["operation": "onboarding.connectAccounts"]
            )
            return []
        }
    }

    private func fetchAppleWalletInstitution() async -> OnboardingConnectedInstitution? {
        do {
            let status = try await appleWalletService.getStatus()
            guard status.connected else { return nil }

            let visibleAccounts = status.accounts.filter { account in
                account.status == "ACTIVE" && !account.accountHidden
            }
            let accountCount = visibleAccounts.isEmpty
                ? status.accounts.filter { $0.status == "ACTIVE" }.count
                : visibleAccounts.count

            return OnboardingConnectedInstitution(
                id: "apple-wallet",
                institutionName: status.institutionName,
                accountCount: max(accountCount, 1)
            )
        } catch {
            AppLogger.warn(
                "Failed to load Apple Wallet status during onboarding",
                metadata: ["operation": "onboarding.appleWallet"]
            )
            return nil
        }
    }

    private func fetchAllocation() async {
        isLoadingAllocation = true
        defer { isLoadingAllocation = false }

        do {
            let sections = try await dashboardService.fetchPortfolioAllocation()
            allocationSections = sections
                .filter { $0.value > 0 }
                .sorted { $0.value > $1.value }
        } catch {
            AppLogger.warn("Failed to load portfolio allocation during onboarding", metadata: ["operation": "onboarding.allocation"])
        }
    }

    private func fetchProfileData() async {
        do {
            profileData = try await profileService.loadProfile()
        } catch {
            AppLogger.warn("Failed to load profile data during onboarding", metadata: ["operation": "onboarding.profile"])
        }
    }

    private var parsedCurrentAge: Int? {
        Int(currentAge.trimmingCharacters(in: .whitespacesAndNewlines))
    }

    private var parsedRetirementAge: Int? {
        Int(retirementAge.trimmingCharacters(in: .whitespacesAndNewlines))
    }
}

struct OnboardingActionMessage: Identifiable, Equatable {
    let id = UUID()
    let title: String
    let message: String
}
