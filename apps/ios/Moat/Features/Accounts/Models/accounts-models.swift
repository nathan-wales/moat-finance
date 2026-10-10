import Foundation

struct PlaidInstitution: Decodable, Identifiable, Equatable {
    let id: String
    let plaidItemId: String
    let institutionId: String?
    let institutionName: String
    let requiresReconnect: Bool
    let lastErrorCode: String?
    let lastErrorMessage: String?
    let lastSyncAt: Date?
    let lastSuccessfulSyncAt: Date?
    let syncPaused: Bool?
    let syncAccessStatus: String?
    let createdAt: Date?
    let accounts: [PlaidAccount]

    var balance: Double {
        accounts.reduce(0) { total, account in
            total + (account.currentBalance ?? account.availableBalance ?? 0)
        }
    }

    var activeAccounts: [PlaidAccount] {
        accounts.filter { $0.isActive }
    }
}

struct PlaidAccount: Decodable, Identifiable, Equatable {
    let id: String
    let plaidAccountId: String?
    let name: String
    let officialName: String?
    let mask: String?
    let type: String
    let subtype: String?
    let currentBalance: Double?
    let availableBalance: Double?
    let currency: String?
    let monthlyContribution: Double?
    let annualReturnRate: Double?
    let notes: String?
    let isActive: Bool
    let investmentHidden: Bool?
    let accountHidden: Bool?
    let syncEnabled: Bool?
    let lastBalanceSyncAt: Date?

    var displayName: String { officialName ?? name }
    var isSyncEnabled: Bool { syncEnabled ?? true }
    var displayType: String {
        [type, subtype].compactMap { value in
            guard let value, !value.isEmpty else { return nil }
            return value.replacingOccurrences(of: "_", with: " ").capitalized
        }.joined(separator: " - ")
    }
}

struct AccountsLoadResult {
    let institutions: [PlaidInstitution]
}

struct PlaidLinkTokenResponse: Decodable, Equatable {
    let linkToken: String
    let expiration: String?

    private enum CodingKeys: String, CodingKey {
        case linkToken = "link_token"
        case expiration
    }
}

struct PlaidLinkMetadata: Equatable {
    let institutionName: String?
    let institutionId: String?
}

struct PlaidExchangeResult: Decodable, Equatable {
    let plaidItemId: String
    let plaidItemDbId: String
    let institutionName: String
    let accountCount: Int
    let addedCount: Int
    let modifiedCount: Int
    let removedCount: Int
}

struct PlaidLinkCompletion: Equatable {
    let publicToken: String
    let metadata: PlaidLinkMetadata?
}

struct AccountsActionMessage: Identifiable, Equatable {
    let id = UUID()
    let title: String
    let message: String
}
