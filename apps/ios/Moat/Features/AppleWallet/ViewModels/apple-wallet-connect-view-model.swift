import Foundation

@MainActor
final class AppleWalletConnectViewModel: ObservableObject {
    @Published private(set) var phase: AppleWalletConnectPhase = .notStarted
    @Published private(set) var eligibleAccounts: [ExternalAccountDTO] = []
    @Published var selectedAccountIds: Set<String> = []
    @Published private(set) var connectedStatus: AppleWalletStatusResponse?
    @Published private(set) var actionMessage: AppleWalletActionMessage?
    @Published private(set) var isBusy = false

    private let financeKitService: any AppleFinanceKitServing
    private let syncService: AppleFinanceKitSyncService
    private let apiService: AppleWalletAPIService

    init(
        financeKitService: (any AppleFinanceKitServing)? = nil,
        syncService: AppleFinanceKitSyncService? = nil,
        apiService: AppleWalletAPIService? = nil
    ) {
        self.financeKitService = financeKitService ?? AppleFinanceKitServiceFactory.makeService()
        self.apiService = apiService ?? AppleWalletAPIService()
        self.syncService = syncService ?? AppleFinanceKitSyncService(
            financeKitService: self.financeKitService,
            apiService: self.apiService
        )
    }

    var canConnect: Bool {
        AppleFinanceKitAvailability.isSupportedOSVersion
    }

    var selectedAccounts: [ExternalAccountDTO] {
        eligibleAccounts.filter { selectedAccountIds.contains($0.externalAccountId) }
    }

    func prepare() async {
        FinanceKitDiagnostics.logSnapshot(operation: "apple_wallet_prepare_start")

        guard canConnect else {
            FinanceKitDiagnostics.logSnapshot(operation: "apple_wallet_prepare_unsupported")
            phase = .unsupported
            return
        }

        phase = await financeKitService.currentPhase()
        FinanceKitDiagnostics.logSnapshot(
            operation: "apple_wallet_prepare_phase_resolved",
            extra: ["phase": String(describing: phase)]
        )

        do {
            connectedStatus = try await apiService.getStatus()
            FinanceKitDiagnostics.logSnapshot(
                operation: "apple_wallet_prepare_status_loaded",
                extra: ["connected": connectedStatus?.connected ?? false]
            )
        } catch {
            FinanceKitDiagnostics.logError(
                "Apple Wallet status fetch failed",
                operation: "apple_wallet_prepare_status_failed",
                error: error
            )
            connectedStatus = nil
        }
    }

    func beginConnectFlow() {
        phase = .explaining
    }

    func requestPermissionAndLoadAccounts() async {
        FinanceKitDiagnostics.logSnapshot(operation: "apple_wallet_request_permission_start")
        isBusy = true
        phase = .requestingPermission
        defer { isBusy = false }

        do {
            try await financeKitService.requestAuthorization()
            let accounts = try await financeKitService.fetchEligibleAccounts()
            eligibleAccounts = accounts
            selectedAccountIds = Set(accounts.map(\.externalAccountId))
            phase = .selectingAccounts
            FinanceKitDiagnostics.logSnapshot(
                operation: "apple_wallet_request_permission_success",
                extra: ["eligibleAccountCount": accounts.count]
            )
        } catch let error as AppleFinanceKitServiceError {
            if case .permissionDenied = error {
                Analytics.capture("apple_wallet_permission_denied")
            }
            phase = mapServiceError(error)
            FinanceKitDiagnostics.logSnapshot(
                operation: "apple_wallet_request_permission_service_error",
                level: .warning,
                extra: ["serviceError": error.localizedDescription]
            )
        } catch {
            phase = .failure(error.localizedDescription)
            FinanceKitDiagnostics.logError(
                "Apple Wallet permission flow failed",
                operation: "apple_wallet_request_permission_failed",
                error: error
            )
        }
    }

    func toggleAccountSelection(_ accountId: String) {
        if selectedAccountIds.contains(accountId) {
            selectedAccountIds.remove(accountId)
        } else {
            selectedAccountIds.insert(accountId)
        }
    }

    func runInitialSync() async {
        let accounts = selectedAccounts
        guard !accounts.isEmpty else {
            phase = .failure("Select at least one Apple Wallet account to import.")
            return
        }

        isBusy = true
        phase = .syncing
        defer { isBusy = false }

        do {
            let result = try await syncService.syncSelectedAccounts(accounts)
            connectedStatus = try await apiService.getStatus()

            AppleFinanceKitBackgroundDelivery.enable()

            if result.failedAccounts.isEmpty {
                phase = .success
                Analytics.capture("apple_wallet_connect_completed")
                actionMessage = AppleWalletActionMessage(
                    title: "Apple Wallet connected",
                    message: "Imported \(result.importedTransactions) transactions across \(result.importedAccounts) account(s)."
                )
            } else {
                phase = .partialFailure(result.failedAccounts.joined(separator: ", "))
                Analytics.capture("apple_wallet_connect_completed")
                actionMessage = AppleWalletActionMessage(
                    title: "Partial sync completed",
                    message: "Some accounts failed to sync: \(result.failedAccounts.joined(separator: ", "))."
                )
            }
        } catch let error as AppleFinanceKitServiceError {
            if case .permissionDenied = error {
                Analytics.capture("apple_wallet_permission_denied")
            }
            phase = mapServiceError(error)
        } catch {
            phase = .failure(error.localizedDescription)
        }
    }

    func resyncConnectedAccounts() async {
        isBusy = true
        phase = .syncing
        defer { isBusy = false }

        do {
            let result = try await syncService.resyncConnectedAccounts()
            connectedStatus = try await apiService.getStatus()
            phase = result.failedAccounts.isEmpty ? .success : .partialFailure(result.failedAccounts.joined(separator: ", "))
            actionMessage = AppleWalletActionMessage(
                title: "Apple Wallet synced",
                message: Self.syncSummary(for: result)
            )
        } catch let error as AppleFinanceKitServiceError {
            phase = mapServiceError(error)
        } catch {
            phase = .failure(error.localizedDescription)
        }
    }

    func disconnect(deleteImportedTransactions: Bool = false) async {
        isBusy = true
        defer { isBusy = false }

        do {
            try await apiService.disconnect(deleteImportedTransactions: deleteImportedTransactions)
            AppleFinanceKitBackgroundDelivery.disable()
            connectedStatus = try await apiService.getStatus()
            eligibleAccounts = []
            selectedAccountIds = []
            phase = .notStarted
            actionMessage = AppleWalletActionMessage(
                title: "Apple Wallet disconnected",
                message: deleteImportedTransactions
                    ? "Future syncs are stopped and previously imported Apple Wallet transactions were deleted."
                    : "Future syncs are stopped. Previously imported transactions remain in Moat Finance."
            )
        } catch {
            actionMessage = AppleWalletActionMessage(
                title: "Disconnect failed",
                message: error.localizedDescription
            )
        }
    }

    func resetFlow() {
        phase = .notStarted
        eligibleAccounts = []
        selectedAccountIds = []
    }

    static func syncSummary(for result: AppleWalletSyncResult) -> String {
        var parts = [
            "Imported \(result.importedTransactions) new transactions",
            "updated \(result.updatedTransactions)"
        ]
        if result.removedTransactions > 0 {
            parts.append("removed \(result.removedTransactions)")
        }
        return "\(parts.joined(separator: ", "))."
    }

    private func mapServiceError(_ error: AppleFinanceKitServiceError) -> AppleWalletConnectPhase {
        switch error {
        case .unsupportedIOSVersion:
            return .unsupported
        case .financeKitUnavailable:
            return .notAvailable
        case .permissionDenied:
            return .permissionDenied
        case .permissionRevoked:
            return .permissionRevoked
        case .noEligibleAccounts:
            return .noEligibleAccounts
        case .accountFetchFailed:
            return .failure(error.localizedDescription)
        case .balanceFetchFailed, .transactionFetchFailed, .historyTokenInvalid:
            return .failure(error.localizedDescription)
        case .notConnected:
            return .notStarted
        case .cancelled:
            return .notStarted
        }
    }
}
