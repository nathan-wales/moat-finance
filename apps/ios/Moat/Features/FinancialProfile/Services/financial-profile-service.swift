import Foundation

actor FinancialProfileService {
    private let apiClient: APIClient
    private let accountsService: AccountsService
    private let appleWalletService: AppleWalletAPIService

    init(
        apiClient: APIClient = .shared,
        accountsService: AccountsService = AccountsService(),
        appleWalletService: AppleWalletAPIService = AppleWalletAPIService()
    ) {
        self.apiClient = apiClient
        self.accountsService = accountsService
        self.appleWalletService = appleWalletService
    }

    func loadProfile() async throws -> FinancialProfileData {
        try await apiClient.get(path: "/api/v1/financialProfile/get")
    }

    func saveProfile(_ data: FinancialProfileData) async throws -> FinancialProfileData {
        try await apiClient.post(
            path: "/api/v1/financialProfile/update",
            body: FinancialProfileUpdateBody(data: data)
        )
    }

    func loadInstitutions() async throws -> [PlaidInstitution] {
        let result = try await accountsService.load()
        return result.institutions
    }

    func createLinkToken() async throws -> PlaidLinkTokenResponse {
        try await accountsService.createLinkToken()
    }

    func createReconnectToken(itemId: String) async throws -> PlaidLinkTokenResponse {
        try await accountsService.createReconnectToken(itemId: itemId)
    }

    func exchangePublicToken(
        publicToken: String,
        metadata: PlaidLinkMetadata?
    ) async throws -> PlaidExchangeResult {
        try await accountsService.exchangePublicToken(
            publicToken: publicToken,
            metadata: metadata
        )
    }

    func syncAll() async throws {
        try await accountsService.syncAll()
    }

    func syncItem(itemId: String) async throws {
        try await accountsService.syncItem(itemId: itemId)
    }

    func reconnectItem(itemId: String) async throws {
        try await accountsService.reconnectItem(itemId: itemId)
    }

    func disconnectItem(itemId: String) async throws {
        try await accountsService.disconnectItem(itemId: itemId)
    }

    func setAccountHidden(accountId: String, hidden: Bool) async throws {
        try await accountsService.setAccountHidden(accountId: accountId, hidden: hidden)
    }

    func setAccountSyncEnabled(accountId: String, syncEnabled: Bool) async throws {
        try await accountsService.setAccountSyncEnabled(accountId: accountId, syncEnabled: syncEnabled)
    }

    func disconnectAppleWallet() async throws {
        try await appleWalletService.disconnect()
    }
}

private struct FinancialProfileUpdateBody: Encodable {
    let data: FinancialProfileData
}
