import Foundation

actor AppleWalletAPIService {
    private let apiClient: APIClient

    init(apiClient: APIClient = .shared) {
        self.apiClient = apiClient
    }

    func getStatus() async throws -> AppleWalletStatusResponse {
        try await apiClient.get(path: "/api/v1/appleFinancekit/getStatus")
    }

    func upsertAccounts(_ accounts: [ExternalAccountDTO], balances: [ExternalBalanceDTO]) async throws {
        let now = ISO8601DateFormatter().string(from: Date())
        let balanceByAccountId = Dictionary(uniqueKeysWithValues: balances.map { ($0.externalAccountId, $0) })

        let payload = AppleWalletUpsertAccountsRequest(
            accounts: accounts.map { account in
                let balance = balanceByAccountId[account.externalAccountId]
                return AppleWalletAccountUpsertRequest(
                    source: account.source,
                    externalAccountId: account.externalAccountId,
                    displayName: account.displayName,
                    institutionName: account.institutionName,
                    accountType: account.accountType,
                    accountSubtype: account.accountSubtype,
                    currency: account.currency,
                    currentBalance: balance?.currentBalance,
                    availableBalance: balance?.availableBalance,
                    lastSyncedAt: balance?.asOf ?? now
                )
            }
        )

        let _: AppleWalletUpsertAccountsResponse = try await apiClient.post(
            path: "/api/v1/appleFinancekit/upsertAccounts",
            body: payload
        )
    }

    func bulkImportTransactions(
        externalAccountId: String,
        transactions: [ExternalTransactionDTO],
        deletedExternalTransactionIds: [String] = []
    ) async throws -> AppleWalletBulkImportResponse {
        let payload = AppleWalletTransactionImportRequest(
            source: AppleWalletIntegrationSource.financeKit,
            externalAccountId: externalAccountId,
            transactions: transactions.map { transaction in
                AppleWalletTransactionPayload(
                    externalTransactionId: transaction.externalTransactionId,
                    date: transaction.date,
                    authorizedDate: transaction.authorizedDate,
                    amount: transaction.amount,
                    currency: transaction.currency,
                    merchantName: transaction.merchantName,
                    description: transaction.description,
                    pending: transaction.pending,
                    category: transaction.category,
                    rawCategory: transaction.rawCategory,
                    pendingTransactionId: transaction.pendingTransactionId,
                    transactionType: transaction.transactionType,
                    foreignCurrencyCode: transaction.foreignCurrencyCode,
                    creditDebitIndicator: transaction.creditDebitIndicator
                )
            },
            deletedExternalTransactionIds: deletedExternalTransactionIds.isEmpty
                ? nil
                : deletedExternalTransactionIds
        )

        return try await apiClient.post(
            path: "/api/v1/appleFinancekit/bulkImportTransactions",
            body: payload
        )
    }

    func disconnect(externalAccountId: String? = nil, deleteImportedTransactions: Bool = false) async throws {
        var body: [String: JSONValue] = [
            "deleteImportedTransactions": .bool(deleteImportedTransactions)
        ]

        if let externalAccountId {
            body["externalAccountId"] = .string(externalAccountId)
        }

        let _: EmptyResponse = try await apiClient.post(
            path: "/api/v1/appleFinancekit/disconnect",
            body: .object(body)
        )
    }
}
