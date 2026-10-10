import Foundation

/// Runs an Apple Wallet sync when the app comes to the foreground and the connected accounts have
/// gone stale. FinanceKit is device-local, so a server cron cannot refresh it the way the Plaid
/// jobs do — the phone has to initiate every sync.
@MainActor
final class AppleWalletAutoSyncCoordinator {
    static let shared = AppleWalletAutoSyncCoordinator()

    /// Mirrors the API's scheduled balance-sync staleness window so Apple Wallet and Plaid accounts
    /// go stale on the same clock.
    static let staleThreshold: TimeInterval = 12 * 60 * 60
    /// Floor between attempts, so a failing sync cannot re-run on every foreground.
    static let minimumAttemptInterval: TimeInterval = 30 * 60

    private static let lastAttemptKey = "moat:apple-wallet-auto-sync-last-attempt"

    private let financeKitService: any AppleFinanceKitServing
    private let apiService: AppleWalletAPIService
    private let syncService: AppleFinanceKitSyncService
    private let defaults: UserDefaults
    private let currentDate: () -> Date

    private var isSyncing = false

    init(
        financeKitService: (any AppleFinanceKitServing)? = nil,
        apiService: AppleWalletAPIService = AppleWalletAPIService(),
        syncService: AppleFinanceKitSyncService? = nil,
        defaults: UserDefaults = .standard,
        currentDate: @escaping () -> Date = Date.init
    ) {
        let resolvedFinanceKitService = financeKitService ?? AppleFinanceKitServiceFactory.makeService()
        self.financeKitService = resolvedFinanceKitService
        self.apiService = apiService
        self.syncService = syncService ?? AppleFinanceKitSyncService(
            financeKitService: resolvedFinanceKitService,
            apiService: apiService
        )
        self.defaults = defaults
        self.currentDate = currentDate
    }

    func syncIfStale(isDemoMode: Bool) async {
        guard !isDemoMode, !isSyncing, AppleFinanceKitAvailability.isSupportedOSVersion else {
            return
        }
        guard hasPassedAttemptInterval else { return }
        // On-device check, so users who never granted access cost nothing.
        guard await financeKitService.isAuthorized() else { return }

        guard let status = await loadStatus(), status.connected else { return }
        guard isStale(lastSyncedAt: status.lastSyncedAt) else { return }

        isSyncing = true
        recordAttempt()
        defer { isSyncing = false }

        do {
            let result = try await syncService.resyncConnectedAccounts()
            Analytics.capture(
                "apple_wallet_auto_sync_completed",
                properties: [
                    "importedTransactions": result.importedTransactions,
                    "updatedTransactions": result.updatedTransactions,
                    "removedTransactions": result.removedTransactions,
                    "failedAccountCount": result.failedAccounts.count
                ]
            )
            if result.importedTransactions > 0 || result.removedTransactions > 0 {
                MoatDataRefresh.notifyTransactionsChanged()
            }
        } catch {
            // Auto sync is invisible to the user; the manual Sync action stays the loud path.
            FinanceKitDiagnostics.logError(
                "Apple Wallet auto sync failed",
                operation: "apple_wallet_auto_sync_failed",
                error: error
            )
        }
    }

    private func loadStatus() async -> AppleWalletStatusResponse? {
        do {
            return try await apiService.getStatus()
        } catch {
            AppLogger.warn(
                "Apple Wallet auto sync status check failed",
                metadata: [
                    "operation": "apple_wallet.auto_sync.status",
                    "error": error.localizedDescription
                ]
            )
            return nil
        }
    }

    private func isStale(lastSyncedAt: Date?) -> Bool {
        guard let lastSyncedAt else { return true }
        return currentDate().timeIntervalSince(lastSyncedAt) >= Self.staleThreshold
    }

    private var hasPassedAttemptInterval: Bool {
        let lastAttempt = defaults.double(forKey: Self.lastAttemptKey)
        guard lastAttempt > 0 else { return true }

        let elapsed = currentDate().timeIntervalSince(Date(timeIntervalSince1970: lastAttempt))
        // A clock moved backwards should unblock rather than lock syncing out indefinitely.
        return elapsed < 0 || elapsed >= Self.minimumAttemptInterval
    }

    private func recordAttempt() {
        defaults.set(currentDate().timeIntervalSince1970, forKey: Self.lastAttemptKey)
    }
}
