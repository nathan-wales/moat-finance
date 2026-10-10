import Foundation

actor NotificationRulesService {
    private let apiClient: APIClient

    init(apiClient: APIClient = .shared) {
        self.apiClient = apiClient
    }

    func listRules() async throws -> [NotificationRule] {
        let response: NotificationRuleListResponse = try await apiClient.get(
            path: "/api/v1/notificationRule/list"
        )
        return response.rules
    }

    func listInbox() async throws -> [NotificationInboxItem] {
        let response: NotificationInboxResponse = try await apiClient.post(
            path: "/api/v1/notificationInbox/list",
            body: .object(["limit": .number(50)])
        )
        return response.items
    }

    func getPreferences() async throws -> NotificationPreferences {
        let response: NotificationPreferencesResponse = try await apiClient.get(
            path: "/api/v1/notificationRule/getPreferences"
        )
        return response.preferences
    }

    func updatePreferences(_ body: [String: JSONValue]) async throws -> NotificationPreferences {
        let response: NotificationPreferencesResponse = try await apiClient.post(
            path: "/api/v1/notificationRule/updatePreferences",
            body: .object(body)
        )
        return response.preferences
    }

    func listSuggestions() async throws -> [NotificationSuggestion] {
        let response: NotificationSuggestionListResponse = try await apiClient.get(
            path: "/api/v1/notificationRule/listSuggestions"
        )
        return response.suggestions
    }

    func dismissSuggestion(id: String) async throws {
        let _: EmptyResponse = try await apiClient.post(
            path: "/api/v1/notificationRule/dismissSuggestion",
            body: .object(["id": .string(id)])
        )
    }

    func pause(id: String, paused: Bool) async throws {
        let _: EmptyResponse = try await apiClient.post(
            path: "/api/v1/notificationRule/pause",
            body: .object([
                "id": .string(id),
                "paused": .bool(paused),
            ])
        )
    }

    func markRead(id: String) async throws {
        let _: EmptyResponse = try await apiClient.post(
            path: "/api/v1/notificationRule/markRead",
            body: .object(["id": .string(id)])
        )
    }

    func resolve(
        id: String,
        status: String,
        snoozedUntilIso: String? = nil,
        action: String? = nil
    ) async throws {
        var body: [String: JSONValue] = [
            "id": .string(id),
            "status": .string(status),
        ]
        if let snoozedUntilIso {
            body["snoozedUntilIso"] = .string(snoozedUntilIso)
        }
        if let action {
            body["action"] = .string(action)
        }
        let _: EmptyResponse = try await apiClient.post(
            path: "/api/v1/notificationRule/resolve",
            body: .object(body)
        )
    }

    func registerPushToken(_ token: String, appVersion: String?) async throws {
        var body: [String: JSONValue] = [
            "token": .string(token),
            "platform": .string("ios"),
        ]
        if let appVersion {
            body["appVersion"] = .string(appVersion)
        }
        let _: EmptyResponse = try await apiClient.post(
            path: "/api/v1/notificationRule/registerPushToken",
            body: .object(body)
        )
    }
}
