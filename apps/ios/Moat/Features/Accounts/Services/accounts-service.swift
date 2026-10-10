import Foundation

actor AccountsService {
    private let apiClient: APIClient

    init(apiClient: APIClient = .shared) {
        self.apiClient = apiClient
    }

    func load() async throws -> AccountsLoadResult {
        let institutions: [PlaidInstitution] = try await apiClient.get(path: "/api/v1/plaid/getConnectedInstitutions")
        return AccountsLoadResult(institutions: institutions)
    }

    func createLinkToken() async throws -> PlaidLinkTokenResponse {
        try await apiClient.post(path: "/api/v1/plaid/createLinkToken")
    }

    func createReconnectToken(itemId: String) async throws -> PlaidLinkTokenResponse {
        try await apiClient.post(
            path: "/api/v1/plaid/createReconnectToken",
            body: .object(["itemId": .string(itemId)])
        )
    }

    func exchangePublicToken(
        publicToken: String,
        metadata: PlaidLinkMetadata?,
        institutionName: String? = nil
    ) async throws -> PlaidExchangeResult {
        var body: [String: JSONValue] = ["publicToken": .string(publicToken)]

        if let institution = metadata?.institutionPayload {
            body["metadata"] = .object(["institution": .object(institution)])
        } else if let institutionName = institutionName?.trimmingCharacters(in: .whitespacesAndNewlines),
                  !institutionName.isEmpty {
            body["metadata"] = .object([
                "institution": .object(["name": .string(institutionName)])
            ])
        }

        return try await apiClient.post(
            path: "/api/v1/plaid/exchangePublicToken",
            body: .object(body)
        )
    }

    func syncAll() async throws {
        let _: EmptyResponse = try await apiClient.post(path: "/api/v1/plaid/syncAll")
    }

    func syncItem(itemId: String) async throws {
        let _: EmptyResponse = try await apiClient.post(
            path: "/api/v1/plaid/syncItem",
            body: .object(["itemId": .string(itemId)])
        )
    }

    func reconnectItem(itemId: String) async throws {
        let _: EmptyResponse = try await apiClient.post(
            path: "/api/v1/plaid/reconnectItem",
            body: .object(["itemId": .string(itemId)])
        )
    }

    func disconnectItem(itemId: String) async throws {
        let _: EmptyResponse = try await apiClient.post(
            path: "/api/v1/plaid/disconnectItem",
            body: .object(["itemId": .string(itemId)])
        )
    }

    func setAccountHidden(accountId: String, hidden: Bool) async throws {
        let _: JSONValue = try await apiClient.post(
            path: "/api/v1/plaid/setAccountHidden",
            body: .object([
                "accountId": .string(accountId),
                "hidden": .bool(hidden)
            ])
        )
    }

    func setAccountSyncEnabled(accountId: String, syncEnabled: Bool) async throws {
        let _: JSONValue = try await apiClient.post(
            path: "/api/v1/plaid/setAccountSyncEnabled",
            body: .object([
                "accountId": .string(accountId),
                "syncEnabled": .bool(syncEnabled)
            ])
        )
    }
}

private extension PlaidLinkMetadata {
    var institutionPayload: [String: JSONValue]? {
        var payload: [String: JSONValue] = [:]

        if let institutionName = institutionName.nilIfBlank {
            payload["name"] = .string(institutionName)
        }
        if let institutionId = institutionId.nilIfBlank {
            payload["institution_id"] = .string(institutionId)
        }

        return payload.isEmpty ? nil : payload
    }
}

private extension Optional where Wrapped == String {
    var nilIfBlank: String? {
        guard let value = self?.trimmingCharacters(in: .whitespacesAndNewlines), !value.isEmpty else {
            return nil
        }

        return value
    }
}
