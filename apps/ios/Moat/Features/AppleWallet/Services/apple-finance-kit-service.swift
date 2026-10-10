import Foundation

#if canImport(FinanceKit)
import FinanceKit
#endif

enum AppleFinanceKitAvailability {
    static var isSupportedOSVersion: Bool {
        if #available(iOS 17.4, *) {
            return true
        }
        return false
    }
}

protocol AppleFinanceKitServing {
    func currentPhase() async -> AppleWalletConnectPhase
    func isAuthorized() async -> Bool
    func requestAuthorization() async throws
    func fetchEligibleAccounts() async throws -> [ExternalAccountDTO]
    func fetchBalances(for accounts: [ExternalAccountDTO]) async throws -> [ExternalBalanceDTO]
    func fetchTransactions(
        for accounts: [ExternalAccountDTO],
        since: Date
    ) async throws -> [ExternalTransactionDTO]
    func fetchTransactionChanges(
        for account: ExternalAccountDTO,
        since historyToken: Data?
    ) async throws -> AppleWalletTransactionChangeSet
    func latestHistoryToken(for account: ExternalAccountDTO) async throws -> Data?
}

@available(iOS 17.4, *)
actor AppleFinanceKitService: AppleFinanceKitServing {
    static let shared = AppleFinanceKitService()

    private var store: FinanceStore {
        FinanceStore.shared
    }
    private let lookbackDays = 365

    func currentPhase() async -> AppleWalletConnectPhase {
        FinanceKitDiagnostics.logSnapshot(operation: "financekit_current_phase_start")
        do {
            let status = try await store.authorizationStatus()
            FinanceKitDiagnostics.logSnapshot(
                operation: "financekit_current_phase_success",
                extra: ["authorizationStatus": String(describing: status)]
            )
            switch status {
            case .authorized:
                return .notStarted
            case .denied:
                return .permissionDenied
            case .notDetermined:
                return .notStarted
            @unknown default:
                return .notAvailable
            }
        } catch {
            FinanceKitDiagnostics.logError(
                "FinanceKit authorization status failed",
                operation: "financekit_current_phase_failed",
                error: error
            )
            return .notAvailable
        }
    }

    func isAuthorized() async -> Bool {
        do {
            return try await store.authorizationStatus() == .authorized
        } catch {
            return false
        }
    }

    func requestAuthorization() async throws {
        FinanceKitDiagnostics.logSnapshot(operation: "financekit_request_authorization_start")
        let status = try await store.authorizationStatus()
        if status == .denied {
            throw AppleFinanceKitServiceError.permissionDenied
        }

        let finalStatus: AuthorizationStatus
        do {
            finalStatus = try await store.requestAuthorization()
        } catch {
            FinanceKitDiagnostics.logError(
                "FinanceKit requestAuthorization failed",
                operation: "financekit_request_authorization_failed",
                error: error,
                extra: ["initialStatus": String(describing: status)]
            )
            let updatedStatus = try await store.authorizationStatus()
            if updatedStatus == .denied {
                throw AppleFinanceKitServiceError.permissionDenied
            }
            throw AppleFinanceKitServiceError.financeKitUnavailable
        }

        switch finalStatus {
        case .authorized:
            FinanceKitDiagnostics.logSnapshot(
                operation: "financekit_request_authorization_success",
                extra: ["finalStatus": String(describing: finalStatus)]
            )
            return
        case .denied:
            throw AppleFinanceKitServiceError.permissionDenied
        default:
            throw AppleFinanceKitServiceError.financeKitUnavailable
        }
    }

    func fetchEligibleAccounts() async throws -> [ExternalAccountDTO] {
        FinanceKitDiagnostics.logSnapshot(operation: "financekit_fetch_accounts_start")
        let status = try await store.authorizationStatus()
        guard status == .authorized else {
            throw status == .denied
                ? AppleFinanceKitServiceError.permissionDenied
                : AppleFinanceKitServiceError.permissionRevoked
        }

        do {
            let accounts = try await store.accounts(query: AccountQuery())
            let normalized = accounts.map(normalizeAccount)
            FinanceKitDiagnostics.logSnapshot(
                operation: "financekit_fetch_accounts_success",
                extra: ["accountCount": normalized.count]
            )
            if normalized.isEmpty {
                throw AppleFinanceKitServiceError.noEligibleAccounts
            }
            return normalized
        } catch let error as AppleFinanceKitServiceError {
            throw error
        } catch {
            FinanceKitDiagnostics.logError(
                "FinanceKit account fetch failed",
                operation: "financekit_fetch_accounts_failed",
                error: error
            )
            throw AppleFinanceKitServiceError.accountFetchFailed
        }
    }

    func fetchBalances(for accounts: [ExternalAccountDTO]) async throws -> [ExternalBalanceDTO] {
        var balances: [ExternalBalanceDTO] = []

        for account in accounts {
            guard let accountUUID = UUID(uuidString: account.externalAccountId) else {
                continue
            }

            let accountId = accountUUID
            let query = AccountBalanceQuery(
                sortDescriptors: [SortDescriptor(\AccountBalance.id, order: .reverse)],
                predicate: #Predicate<AccountBalance> { balance in
                    balance.accountID == accountId
                },
                limit: 1
            )

            let accountBalances = try await store.accountBalances(query: query)
            guard let latestBalance = accountBalances.first else {
                balances.append(
                    AppleFinanceKitNormalizer.normalizeBalance(
                        externalAccountId: account.externalAccountId,
                        currentBalance: nil,
                        availableBalance: nil,
                        currency: account.currency
                    )
                )
                continue
            }

            let extracted = extractedBalances(from: latestBalance)
            balances.append(
                AppleFinanceKitNormalizer.normalizeBalance(
                    externalAccountId: account.externalAccountId,
                    currentBalance: extracted.current,
                    availableBalance: extracted.available,
                    currency: latestBalance.currencyCode
                )
            )
        }

        return balances
    }

    func fetchTransactions(
        for accounts: [ExternalAccountDTO],
        since: Date
    ) async throws -> [ExternalTransactionDTO] {
        var allTransactions: [ExternalTransactionDTO] = []

        for account in accounts {
            guard let accountUUID = UUID(uuidString: account.externalAccountId) else {
                continue
            }

            let accountId = accountUUID
            let query = TransactionQuery(
                sortDescriptors: [SortDescriptor(\Transaction.transactionDate, order: .forward)],
                predicate: #Predicate<Transaction> { transaction in
                    transaction.accountID == accountId && transaction.transactionDate >= since
                }
            )

            do {
                let transactions = try await store.transactions(query: query)
                allTransactions.append(contentsOf: transactions.map { transaction in
                    normalizeTransaction(transaction, accountId: account.externalAccountId)
                })
            } catch {
                throw AppleFinanceKitServiceError.transactionFetchFailed
            }
        }

        return allTransactions
    }

    func fetchTransactionChanges(
        for account: ExternalAccountDTO,
        since historyToken: Data?
    ) async throws -> AppleWalletTransactionChangeSet {
        guard let accountUUID = UUID(uuidString: account.externalAccountId) else {
            throw AppleFinanceKitServiceError.transactionFetchFailed
        }

        let decodedToken = historyToken.flatMap(Self.decodeHistoryToken)
        if historyToken != nil, decodedToken == nil {
            throw AppleFinanceKitServiceError.historyTokenInvalid
        }

        var upserted: [ExternalTransactionDTO] = []
        var deletedIds: [String] = []
        var latestToken: Data? = historyToken

        do {
            let history = store.transactionHistory(
                forAccountID: accountUUID,
                since: decodedToken,
                isMonitoring: false
            )

            for try await change in history {
                for transaction in change.inserted {
                    upserted.append(normalizeTransaction(transaction, accountId: account.externalAccountId))
                }
                for transaction in change.updated {
                    upserted.append(normalizeTransaction(transaction, accountId: account.externalAccountId))
                }
                deletedIds.append(contentsOf: change.deleted.map(\.uuidString))
                latestToken = Self.encodeHistoryToken(change.newToken) ?? latestToken
            }
        } catch {
            FinanceKitDiagnostics.logError(
                "FinanceKit transaction history failed",
                operation: "financekit_transaction_history_failed",
                error: error,
                extra: ["hadStoredToken": historyToken != nil]
            )
            throw AppleFinanceKitServiceError.historyTokenInvalid
        }

        return AppleWalletTransactionChangeSet(
            upserted: upserted,
            deletedExternalTransactionIds: deletedIds,
            newHistoryToken: latestToken
        )
    }

    /// Drains the full change stream discarding rows, so a snapshot-based first sync can still
    /// hand the next sync a resume point. On-device only — no network or API cost.
    func latestHistoryToken(for account: ExternalAccountDTO) async throws -> Data? {
        guard let accountUUID = UUID(uuidString: account.externalAccountId) else {
            return nil
        }

        var latestToken: Data?
        let history = store.transactionHistory(
            forAccountID: accountUUID,
            since: nil,
            isMonitoring: false
        )

        for try await change in history {
            latestToken = Self.encodeHistoryToken(change.newToken) ?? latestToken
        }

        return latestToken
    }

    func defaultLookbackDate() -> Date {
        Calendar.current.date(byAdding: .day, value: -lookbackDays, to: Date()) ?? Date()
    }

    private static func encodeHistoryToken(_ token: FinanceStore.HistoryToken) -> Data? {
        try? JSONEncoder().encode(token)
    }

    private static func decodeHistoryToken(_ data: Data) -> FinanceStore.HistoryToken? {
        try? JSONDecoder().decode(FinanceStore.HistoryToken.self, from: data)
    }

    private func normalizeAccount(_ account: Account) -> ExternalAccountDTO {
        switch account {
        case .asset(let assetAccount):
            return AppleFinanceKitNormalizer.normalizeAccount(
                externalAccountId: assetAccount.id.uuidString,
                displayName: assetAccount.displayName,
                accountType: AppleFinanceKitNormalizer.mapAccountType(isLiability: false),
                accountSubtype: AppleFinanceKitNormalizer.mapAccountSubtype(
                    isLiability: false,
                    accountDescription: assetAccount.accountDescription
                ),
                currency: assetAccount.currencyCode
            )
        case .liability(let liabilityAccount):
            return AppleFinanceKitNormalizer.normalizeAccount(
                externalAccountId: liabilityAccount.id.uuidString,
                displayName: liabilityAccount.displayName,
                accountType: AppleFinanceKitNormalizer.mapAccountType(isLiability: true),
                accountSubtype: AppleFinanceKitNormalizer.mapAccountSubtype(
                    isLiability: true,
                    accountDescription: liabilityAccount.accountDescription
                ),
                currency: liabilityAccount.currencyCode
            )
        @unknown default:
            return AppleFinanceKitNormalizer.normalizeAccount(
                externalAccountId: UUID().uuidString,
                displayName: "Apple Wallet Account",
                accountType: "other",
                accountSubtype: nil,
                currency: "USD"
            )
        }
    }

    private func normalizeTransaction(_ transaction: Transaction, accountId: String) -> ExternalTransactionDTO {
        let isCredit = transaction.creditDebitIndicator == .credit
        let signedAmount = AppleFinanceKitNormalizer.signedAmount(
            amount: transaction.transactionAmount.amount,
            isCredit: isCredit
        )

        let transactionDate = transaction.transactionDate

        return AppleFinanceKitNormalizer.normalizeTransaction(
            externalTransactionId: transaction.id.uuidString,
            externalAccountId: accountId,
            transactionDate: transactionDate,
            authorizedDate: transaction.postedDate,
            signedAmount: signedAmount,
            currency: transaction.transactionAmount.currencyCode,
            merchantName: transaction.merchantName,
            description: transaction.transactionDescription,
            pending: transaction.status == .pending,
            rawCategory: transaction.merchantCategoryCode.map(String.init),
            pendingTransactionId: nil,
            transactionType: String(describing: transaction.transactionType),
            foreignCurrencyCode: transaction.foreignCurrencyAmount?.currencyCode,
            creditDebitIndicator: isCredit ? "credit" : "debit"
        )
    }

    private func extractedBalances(from accountBalance: AccountBalance) -> (current: Double?, available: Double?) {
        var current = optionalBalanceAmount(from: accountBalance.booked)
        var available = optionalBalanceAmount(from: accountBalance.available)

        switch accountBalance.currentBalance {
        case .available(let balance):
            if available == nil {
                available = balanceAmount(from: balance)
            }
        case .booked(let balance):
            if current == nil {
                current = balanceAmount(from: balance)
            }
        case .availableAndBooked(let availableBalance, let bookedBalance):
            if available == nil {
                available = balanceAmount(from: availableBalance)
            }
            if current == nil {
                current = balanceAmount(from: bookedBalance)
            }
        @unknown default:
            break
        }

        return (current, available)
    }

    private func balanceAmount(from balance: Balance) -> Double {
        let absolute = NSDecimalNumber(decimal: balance.amount.amount).doubleValue
        return balance.creditDebitIndicator == .debit ? -absolute : absolute
    }

    private func optionalBalanceAmount(from balance: Balance?) -> Double? {
        balance.map(balanceAmount)
    }
}

enum AppleFinanceKitServiceFactory {
    static func makeService() -> any AppleFinanceKitServing {
        if #available(iOS 17.4, *) {
            return AppleFinanceKitService.shared
        }

        return UnsupportedAppleFinanceKitService()
    }
}

struct UnsupportedAppleFinanceKitService: AppleFinanceKitServing {
    func currentPhase() async -> AppleWalletConnectPhase { .unsupported }

    func isAuthorized() async -> Bool { false }

    func requestAuthorization() async throws {
        throw AppleFinanceKitServiceError.unsupportedIOSVersion
    }

    func fetchEligibleAccounts() async throws -> [ExternalAccountDTO] {
        throw AppleFinanceKitServiceError.unsupportedIOSVersion
    }

    func fetchBalances(for accounts: [ExternalAccountDTO]) async throws -> [ExternalBalanceDTO] {
        throw AppleFinanceKitServiceError.unsupportedIOSVersion
    }

    func fetchTransactions(
        for accounts: [ExternalAccountDTO],
        since: Date
    ) async throws -> [ExternalTransactionDTO] {
        throw AppleFinanceKitServiceError.unsupportedIOSVersion
    }

    func fetchTransactionChanges(
        for account: ExternalAccountDTO,
        since historyToken: Data?
    ) async throws -> AppleWalletTransactionChangeSet {
        throw AppleFinanceKitServiceError.unsupportedIOSVersion
    }

    func latestHistoryToken(for account: ExternalAccountDTO) async throws -> Data? {
        throw AppleFinanceKitServiceError.unsupportedIOSVersion
    }
}
