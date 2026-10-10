import Foundation

enum AppleWalletIntegrationSource {
    static let financeKit = "APPLE_FINANCEKIT"
}

enum AppleWalletConnectPhase: Equatable {
    case unsupported
    case notAvailable
    case notStarted
    case explaining
    case requestingPermission
    case permissionDenied
    case permissionRevoked
    case noEligibleAccounts
    case selectingAccounts
    case syncing
    case partialFailure(String)
    case success
    case failure(String)
}

struct ExternalAccountDTO: Equatable, Identifiable {
    let source: String
    let externalAccountId: String
    let displayName: String
    let institutionName: String
    let accountType: String
    let accountSubtype: String?
    let currency: String

    var id: String { externalAccountId }
}

struct ExternalBalanceDTO: Equatable {
    let source: String
    let externalAccountId: String
    let currentBalance: Double?
    let availableBalance: Double?
    let currency: String
    let asOf: String
}

struct ExternalTransactionDTO: Equatable, Identifiable {
    let source: String
    let externalTransactionId: String
    let externalAccountId: String
    let date: String
    let authorizedDate: String?
    let amount: Double
    let currency: String
    let merchantName: String?
    let description: String
    let pending: Bool
    let category: String?
    let rawCategory: String?
    let pendingTransactionId: String?
    let transactionType: String?
    let foreignCurrencyCode: String?
    let creditDebitIndicator: String?

    var id: String { externalTransactionId }
}

/// Result of a FinanceKit change-stream read. `newHistoryToken` is the opaque, serialized
/// resume point to hand back on the next sync.
struct AppleWalletTransactionChangeSet: Equatable {
    let upserted: [ExternalTransactionDTO]
    let deletedExternalTransactionIds: [String]
    let newHistoryToken: Data?
}

struct AppleWalletAccountUpsertRequest: Encodable {
    let source: String
    let externalAccountId: String
    let displayName: String
    let institutionName: String
    let accountType: String
    let accountSubtype: String?
    let currency: String
    let currentBalance: Double?
    let availableBalance: Double?
    let lastSyncedAt: String?
}

struct AppleWalletUpsertAccountsRequest: Encodable {
    let accounts: [AppleWalletAccountUpsertRequest]
}

struct AppleWalletTransactionImportRequest: Encodable {
    let source: String
    let externalAccountId: String
    let transactions: [AppleWalletTransactionPayload]
    let deletedExternalTransactionIds: [String]?
}

struct AppleWalletTransactionPayload: Encodable {
    let externalTransactionId: String
    let date: String
    let authorizedDate: String?
    let amount: Double
    let currency: String
    let merchantName: String?
    let description: String
    let pending: Bool
    let category: String?
    let rawCategory: String?
    let pendingTransactionId: String?
    let transactionType: String?
    let foreignCurrencyCode: String?
    let creditDebitIndicator: String?
}

struct AppleWalletStatusResponse: Decodable, Equatable {
    let connected: Bool
    let institutionName: String
    let lastSyncedAt: Date?
    let accounts: [AppleWalletConnectedAccount]
}

struct AppleWalletConnectedAccount: Decodable, Identifiable, Equatable {
    let id: String
    let externalAccountId: String
    let displayName: String
    let institutionName: String
    let accountType: String
    let accountSubtype: String?
    let currency: String
    let currentBalance: Double?
    let availableBalance: Double?
    let status: String
    let accountHidden: Bool
    let lastSyncedAt: Date?
}

struct AppleWalletUpsertAccountsResponse: Decodable {
    let accountCount: Int
}

struct AppleWalletBulkImportResponse: Decodable {
    let importedCount: Int
    let updatedCount: Int
    let totalCount: Int
    /// Optional so a newer app build still decodes a response from an API that predates deletions.
    let removedCount: Int?
}

struct AppleWalletSyncResult: Equatable {
    let importedAccounts: Int
    let importedTransactions: Int
    let updatedTransactions: Int
    let removedTransactions: Int
    let failedAccounts: [String]
}

struct AppleWalletActionMessage: Identifiable, Equatable {
    let id = UUID()
    let title: String
    let message: String
}

enum AppleFinanceKitServiceError: LocalizedError, Equatable {
    case unsupportedIOSVersion
    case financeKitUnavailable
    case permissionDenied
    case permissionRevoked
    case noEligibleAccounts
    case accountFetchFailed
    case balanceFetchFailed
    case transactionFetchFailed
    case historyTokenInvalid
    case notConnected
    case cancelled

    var errorDescription: String? {
        switch self {
        case .unsupportedIOSVersion:
            return "Apple Wallet sync requires iOS 17.4 or later."
        case .financeKitUnavailable:
            return "FinanceKit is unavailable on this device."
        case .permissionDenied:
            return "Apple Wallet access was denied."
        case .permissionRevoked:
            return "Apple Wallet access was revoked. Reconnect to continue syncing."
        case .noEligibleAccounts:
            return "No eligible Apple Wallet accounts were found."
        case .accountFetchFailed:
            return "Unable to load Apple Wallet accounts."
        case .balanceFetchFailed:
            return "Unable to load Apple Wallet balances."
        case .transactionFetchFailed:
            return "Unable to load Apple Wallet transactions."
        case .historyTokenInvalid:
            return "Apple Wallet change history expired. A full sync is required."
        case .notConnected:
            return "No Apple Wallet accounts are connected."
        case .cancelled:
            return "Apple Wallet connection was cancelled."
        }
    }
}
