import Foundation

actor AIAccessService {
    private let apiClient: APIClient

    init(apiClient: APIClient = .shared) {
        self.apiClient = apiClient
    }

    func listPersonalAccessTokens() async throws -> [McpPersonalAccessToken] {
        let response: McpPersonalAccessTokenListResponse = try await apiClient.get(
            path: "/api/v1/mcp/listPersonalAccessTokens"
        )
        return response.tokens
    }

    func createPersonalAccessToken(
        name: String,
        clientName: String?,
        scopes: [String],
        expiresInDays: Int?
    ) async throws -> CreatedMcpPersonalAccessToken {
        var fields: [String: JSONValue] = [
            "name": .string(name),
            "scopes": .array(scopes.map(JSONValue.string)),
        ]
        if let clientName, !clientName.isEmpty {
            fields["clientName"] = .string(clientName)
        }
        if let expiresInDays {
            fields["expiresInDays"] = .number(Double(expiresInDays))
        } else {
            fields["expiresInDays"] = .null
        }

        let response: CreatedMcpPersonalAccessTokenResponse = try await apiClient.post(
            path: "/api/v1/mcp/createPersonalAccessToken",
            body: .object(fields)
        )
        return response.token
    }

    func revokePersonalAccessToken(tokenId: String) async throws {
        let _: AIAccessSuccessResponse = try await apiClient.post(
            path: "/api/v1/mcp/revokePersonalAccessToken",
            body: .object(["tokenId": .string(tokenId)])
        )
    }

    func listOAuthConnections() async throws -> [McpOAuthClientConnection] {
        let response: McpOAuthConnectionListResponse = try await apiClient.get(
            path: "/api/v1/mcp/listOAuthConnections"
        )
        return response.connections
    }

    func revokeOAuthConnection(oauthClientIds: [String]) async throws {
        let _: AIAccessSuccessResponse = try await apiClient.post(
            path: "/api/v1/mcp/revokeOAuthConnection",
            body: .object([
                "oauthClientIds": .array(oauthClientIds.map(JSONValue.string)),
            ])
        )
    }

    func listMcpLogs(
        cursor: String? = nil,
        limit: Int = 30,
        status: String? = nil,
        authType: String? = nil,
        search: String? = nil
    ) async throws -> McpLogListResponse {
        var query: [String: String] = ["limit": String(limit)]
        if let cursor, !cursor.isEmpty { query["cursor"] = cursor }
        if let status, !status.isEmpty { query["status"] = status }
        if let authType, !authType.isEmpty { query["authType"] = authType }
        if let search, !search.isEmpty { query["search"] = search }

        return try await apiClient.get(
            path: "/api/v1/mcp/listMcpLogs",
            query: query
        )
    }

    func hasAnyConnection() async throws -> Bool {
        async let tokens = listPersonalAccessTokens()
        async let connections = listOAuthConnections()
        let (tokenRows, connectionRows) = try await (tokens, connections)
        return tokenRows.contains { $0.status == .active }
            || connectionRows.contains { $0.status == .active }
    }
}
