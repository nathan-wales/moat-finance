import Foundation

@MainActor
final class AIAccessViewModel: ObservableObject {
    enum PageState {
        case idle
        case loading
        case loaded
        case refreshing
        case error(Error)
    }

    @Published private(set) var pageState: PageState = .idle
    @Published private(set) var oauthState: AIAccessSectionLoadState = .idle
    @Published private(set) var tokensState: AIAccessSectionLoadState = .idle
    @Published private(set) var logsState: AIAccessSectionLoadState = .idle

    @Published private(set) var oauthConnections: [McpOAuthClientConnection] = []
    @Published private(set) var tokens: [McpPersonalAccessToken] = []
    @Published private(set) var logs: [McpLogEntry] = []
    @Published private(set) var logsNextCursor: String?
    @Published private(set) var isLoadingMoreLogs = false

    @Published var logFilters = McpLogFilters()
    @Published var logSearchDraft = ""
    @Published private(set) var actionMessage: AIAccessActionMessage?
    @Published private(set) var createTokenError: String?
    @Published private(set) var disconnectingConnectionId: String?
    @Published private(set) var revokingTokenId: String?
    @Published private(set) var isCreatingToken = false

    private let service: AIAccessService
    private let connectionStore: AIAccessConnectionStore

    init(
        service: AIAccessService = AIAccessService(),
        connectionStore: AIAccessConnectionStore? = nil
    ) {
        self.service = service
        self.connectionStore = connectionStore ?? .shared
    }

    func load() async {
        guard case .idle = pageState else { return }
        pageState = .loading
        await reloadAll(markPageLoaded: true, showSectionLoading: true)
    }

    func refresh() async {
        pageState = .refreshing
        await reloadAll(markPageLoaded: true, showSectionLoading: false)
    }

    func clearActionMessage() {
        actionMessage = nil
    }

    func clearCreateTokenError() {
        createTokenError = nil
    }

    func disconnectOAuth(_ connection: McpOAuthClientConnection) async {
        disconnectingConnectionId = connection.id
        defer { disconnectingConnectionId = nil }

        do {
            try await service.revokeOAuthConnection(oauthClientIds: connection.oauthClientIds)
            Analytics.capture(
                "mcp_oauth_connection_revoked",
                properties: [
                    "surface": "ios",
                    "client_profile": connection.clientProfile
                ]
            )
            oauthConnections.removeAll { $0.id == connection.id }
            syncConnectionStore()
            actionMessage = AIAccessActionMessage(
                title: "Connection disconnected",
                message: "The OAuth client was disconnected."
            )
        } catch {
            actionMessage = AIAccessActionMessage(
                title: "Failed to disconnect",
                message: error.localizedDescription
            )
        }
    }

    func revokeToken(_ token: McpPersonalAccessToken) async {
        revokingTokenId = token.id
        defer { revokingTokenId = nil }

        do {
            try await service.revokePersonalAccessToken(tokenId: token.id)
            Analytics.capture("mcp_pat_revoked", properties: ["surface": "ios"])
            tokens.removeAll { $0.id == token.id }
            syncConnectionStore()
            actionMessage = AIAccessActionMessage(
                title: "Token revoked",
                message: "The personal access token was revoked."
            )
        } catch {
            actionMessage = AIAccessActionMessage(
                title: "Failed to revoke token",
                message: error.localizedDescription
            )
        }
    }

    func createToken(
        name: String,
        clientName: String,
        scopes: [McpScope],
        expiration: McpTokenExpirationOption
    ) async -> CreatedMcpPersonalAccessToken? {
        let trimmedName = name.trimmingCharacters(in: .whitespacesAndNewlines)
        let trimmedClient = clientName.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !trimmedName.isEmpty, !scopes.isEmpty else { return nil }

        isCreatingToken = true
        createTokenError = nil
        defer { isCreatingToken = false }

        let hasWriteScope = scopes.contains { $0.rawValue.contains(":write") }
        Analytics.capture(
            "mcp_pat_create_started",
            properties: [
                "surface": "ios",
                "scope_count": scopes.count,
                "has_expiration": expiration.expiresInDays != nil,
                "has_write_scope": hasWriteScope
            ]
        )

        do {
            let created = try await service.createPersonalAccessToken(
                name: trimmedName,
                clientName: trimmedClient.isEmpty ? nil : trimmedClient,
                scopes: scopes.map(\.rawValue),
                expiresInDays: expiration.expiresInDays
            )
            var createdProps: [String: Any] = [
                "surface": "ios",
                "scope_count": scopes.count,
                "has_expiration": expiration.expiresInDays != nil,
                "has_write_scope": hasWriteScope
            ]
            if let expiresInDays = expiration.expiresInDays {
                createdProps["expires_in_days"] = expiresInDays
            }
            Analytics.capture("mcp_pat_created", properties: createdProps)
            await reloadTokens()
            syncConnectionStore()
            MoatDataRefresh.notifySetupGuideChanged()
            return created
        } catch {
            createTokenError = error.localizedDescription
            return nil
        }
    }

    func commitLogSearch() {
        let search = logSearchDraft.trimmingCharacters(in: .whitespacesAndNewlines)
        guard logFilters.search != search else { return }
        logFilters.search = search
        Task { await reloadLogs(reset: true) }
    }

    func setLogStatusFilter(_ value: String) {
        guard logFilters.status != value else { return }
        logFilters.status = value
        Task { await reloadLogs(reset: true) }
    }

    func setLogAuthTypeFilter(_ value: String) {
        guard logFilters.authType != value else { return }
        logFilters.authType = value
        Task { await reloadLogs(reset: true) }
    }

    func loadMoreLogs() async {
        guard let cursor = logsNextCursor, !isLoadingMoreLogs else { return }
        isLoadingMoreLogs = true
        defer { isLoadingMoreLogs = false }

        do {
            let response = try await service.listMcpLogs(
                cursor: cursor,
                limit: 30,
                status: logFilters.status.nilIfEmpty,
                authType: logFilters.authType.nilIfEmpty,
                search: logFilters.search.nilIfEmpty
            )
            logs.append(contentsOf: response.logs)
            logsNextCursor = response.nextCursor
        } catch {
            actionMessage = AIAccessActionMessage(
                title: "Failed to load logs",
                message: error.localizedDescription
            )
        }
    }

    private func reloadAll(markPageLoaded: Bool, showSectionLoading: Bool = true) async {
        await reloadOAuth(showLoading: showSectionLoading)
        await reloadTokens(showLoading: showSectionLoading)
        await reloadLogs(reset: true, showLoading: showSectionLoading)

        if Task.isCancelled {
            if case .refreshing = pageState {
                pageState = .loaded
            }
            return
        }

        if markPageLoaded {
            if case .error = oauthState, case .error = tokensState, case .error = logsState {
                pageState = .error(
                    APIError.serverError("Failed to load AI access.")
                )
            } else {
                pageState = .loaded
            }
        }
        syncConnectionStore()
    }

    private func reloadOAuth(showLoading: Bool = true) async {
        if showLoading {
            oauthState = .loading
        }
        do {
            oauthConnections = try await service.listOAuthConnections()
            oauthState = .loaded
        } catch {
            if error.isCancellation { return }
            oauthState = .error("Failed to load connections.")
            AppLogger.warn(
                "Failed to load OAuth connections",
                metadata: ["error": error.localizedDescription]
            )
        }
    }

    private func reloadTokens(showLoading: Bool = true) async {
        if showLoading {
            tokensState = .loading
        }
        do {
            tokens = try await service.listPersonalAccessTokens()
            tokensState = .loaded
        } catch {
            if error.isCancellation { return }
            tokensState = .error("Failed to load tokens.")
            AppLogger.warn(
                "Failed to load personal access tokens",
                metadata: ["error": error.localizedDescription]
            )
        }
    }

    private func reloadLogs(reset: Bool, showLoading: Bool = true) async {
        if reset {
            logsNextCursor = nil
            if showLoading {
                logsState = .loading
                logs = []
            }
        }

        do {
            let response = try await service.listMcpLogs(
                limit: 30,
                status: logFilters.status.nilIfEmpty,
                authType: logFilters.authType.nilIfEmpty,
                search: logFilters.search.nilIfEmpty
            )
            logs = response.logs
            logsNextCursor = response.nextCursor
            logsState = .loaded
        } catch {
            if error.isCancellation { return }
            logsState = .error("Failed to load logs.")
            AppLogger.warn(
                "Failed to load MCP logs",
                metadata: ["error": error.localizedDescription]
            )
        }
    }

    private func syncConnectionStore() {
        connectionStore.apply(oauthConnections: oauthConnections, tokens: tokens)
    }
}

private extension String {
    var nilIfEmpty: String? {
        isEmpty ? nil : self
    }
}
