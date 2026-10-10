import Foundation

actor AppleFinanceKitSyncService {
    /// Matches API write chunking headroom; keeps each HTTP request under serverless time limits.
    static let bulkImportRequestChunkSize = 500

    private let financeKitService: any AppleFinanceKitServing
    private let apiService: AppleWalletAPIService
    private let historyTokenStore: any AppleFinanceKitHistoryTokenStoring

    init(
        financeKitService: (any AppleFinanceKitServing)? = nil,
        apiService: AppleWalletAPIService = AppleWalletAPIService(),
        historyTokenStore: (any AppleFinanceKitHistoryTokenStoring)? = nil
    ) {
        self.financeKitService = financeKitService ?? AppleFinanceKitServiceFactory.makeService()
        self.apiService = apiService
        self.historyTokenStore = historyTokenStore ?? AppleFinanceKitHistoryTokenStore.shared
    }

    func syncSelectedAccounts(_ selectedAccounts: [ExternalAccountDTO]) async throws -> AppleWalletSyncResult {
        guard !selectedAccounts.isEmpty else {
            throw AppleFinanceKitServiceError.noEligibleAccounts
        }

        let balances = try await financeKitService.fetchBalances(for: selectedAccounts)
        try await apiService.upsertAccounts(selectedAccounts, balances: balances)

        var importedTransactions = 0
        var updatedTransactions = 0
        var removedTransactions = 0
        var failedAccounts: [String] = []

        for account in selectedAccounts {
            do {
                let counts = try await syncTransactions(for: account)
                importedTransactions += counts.importedCount
                updatedTransactions += counts.updatedCount
                removedTransactions += counts.removedCount
            } catch {
                failedAccounts.append(account.displayName)
            }
        }

        if failedAccounts.count == selectedAccounts.count {
            throw AppleFinanceKitServiceError.transactionFetchFailed
        }

        return AppleWalletSyncResult(
            importedAccounts: selectedAccounts.count - failedAccounts.count,
            importedTransactions: importedTransactions,
            updatedTransactions: updatedTransactions,
            removedTransactions: removedTransactions,
            failedAccounts: failedAccounts
        )
    }

    func resyncConnectedAccounts() async throws -> AppleWalletSyncResult {
        let status = try await apiService.getStatus()
        let activeAccounts = Self.activeAccounts(from: status)

        guard !activeAccounts.isEmpty else {
            throw AppleFinanceKitServiceError.notConnected
        }

        return try await syncSelectedAccounts(activeAccounts)
    }

    static func activeAccounts(from status: AppleWalletStatusResponse) -> [ExternalAccountDTO] {
        status.accounts
            .filter { $0.status == "ACTIVE" }
            .map { account in
                ExternalAccountDTO(
                    source: AppleWalletIntegrationSource.financeKit,
                    externalAccountId: account.externalAccountId,
                    displayName: account.displayName,
                    institutionName: account.institutionName,
                    accountType: account.accountType,
                    accountSubtype: account.accountSubtype,
                    currency: account.currency
                )
            }
    }

    /// Prefers FinanceKit's change stream so a routine sync only uploads what moved. Falls back to
    /// the bounded lookback snapshot on the first sync or when a stored token is no longer valid.
    private func syncTransactions(for account: ExternalAccountDTO) async throws -> ImportCounts {
        if let storedToken = historyTokenStore.token(forExternalAccountId: account.externalAccountId) {
            do {
                return try await importChanges(for: account, since: storedToken)
            } catch AppleFinanceKitServiceError.historyTokenInvalid {
                historyTokenStore.clearToken(forExternalAccountId: account.externalAccountId)
                FinanceKitDiagnostics.logSnapshot(
                    operation: "apple_wallet_history_token_reset",
                    level: .warning
                )
            }
        }

        return try await importSnapshot(for: account)
    }

    private func importChanges(
        for account: ExternalAccountDTO,
        since historyToken: Data
    ) async throws -> ImportCounts {
        let changes = try await financeKitService.fetchTransactionChanges(
            for: account,
            since: historyToken
        )

        let counts = try await bulkImport(
            externalAccountId: account.externalAccountId,
            transactions: changes.upserted,
            deletedExternalTransactionIds: changes.deletedExternalTransactionIds
        )

        if let newToken = changes.newHistoryToken {
            historyTokenStore.save(newToken, forExternalAccountId: account.externalAccountId)
        }

        return counts
    }

    private func importSnapshot(for account: ExternalAccountDTO) async throws -> ImportCounts {
        let transactions = try await financeKitService.fetchTransactions(
            for: [account],
            since: Self.lookbackStartDate()
        )
        let counts = try await bulkImport(
            externalAccountId: account.externalAccountId,
            transactions: transactions,
            deletedExternalTransactionIds: []
        )

        let seedToken = try? await financeKitService.latestHistoryToken(for: account)
        if let seedToken {
            historyTokenStore.save(seedToken, forExternalAccountId: account.externalAccountId)
        }

        return counts
    }

    private func bulkImport(
        externalAccountId: String,
        transactions: [ExternalTransactionDTO],
        deletedExternalTransactionIds: [String]
    ) async throws -> ImportCounts {
        var counts = ImportCounts()
        let chunks = chunkArray(transactions, size: Self.bulkImportRequestChunkSize)

        if chunks.isEmpty {
            // Still posts once so deletions land and `lastSyncedAt` advances on a no-op sync.
            let response = try await apiService.bulkImportTransactions(
                externalAccountId: externalAccountId,
                transactions: [],
                deletedExternalTransactionIds: deletedExternalTransactionIds
            )
            counts.add(response)
            return counts
        }

        for (index, chunk) in chunks.enumerated() {
            // Deletions ride the first request only; they are not chunk-scoped.
            let response = try await apiService.bulkImportTransactions(
                externalAccountId: externalAccountId,
                transactions: chunk,
                deletedExternalTransactionIds: index == 0 ? deletedExternalTransactionIds : []
            )
            counts.add(response)
        }

        return counts
    }

    private func chunkArray<T>(_ array: [T], size: Int) -> [[T]] {
        guard size > 0, !array.isEmpty else { return [] }

        var chunks: [[T]] = []
        var index = 0
        while index < array.count {
            let end = min(index + size, array.count)
            chunks.append(Array(array[index..<end]))
            index = end
        }
        return chunks
    }

    private static func lookbackStartDate() -> Date {
        Calendar.current.date(byAdding: .day, value: -365, to: Date()) ?? Date()
    }
}

private struct ImportCounts {
    var importedCount = 0
    var updatedCount = 0
    var removedCount = 0

    mutating func add(_ response: AppleWalletBulkImportResponse) {
        importedCount += response.importedCount
        updatedCount += response.updatedCount
        removedCount += response.removedCount ?? 0
    }
}
