import Foundation

actor DemoModeService {
    private let apiClient: APIClient
    private let defaults: UserDefaults

    init(apiClient: APIClient = .shared, defaults: UserDefaults = .standard) {
        self.apiClient = apiClient
        self.defaults = defaults
    }

    var storedSessionKey: String? {
        defaults.string(forKey: DemoModeDefaults.sessionKey)
    }

    func getStatus() async throws -> DemoModeStatus {
        try await apiClient.get(path: "/api/v1/demo/getDemoStatus", authenticated: false)
    }

    func enterDemoMode() async throws -> EnterDemoModeResponse {
        let response: EnterDemoModeResponse = try await apiClient.post(
            path: "/api/v1/demo/enterDemoMode",
            authenticated: false
        )
        defaults.set(response.sessionKey, forKey: DemoModeDefaults.sessionKey)
        defaults.set(response.expiresAt.timeIntervalSince1970, forKey: DemoModeDefaults.expiresAt)
        return response
    }

    func exitDemoMode() async throws {
        guard let sessionKey = storedSessionKey else {
            clearDemoSession()
            return
        }

        let _: DemoModeSuccessResponse = try await apiClient.post(
            path: "/api/v1/demo/exitDemoMode",
            body: .object(["sessionKey": .string(sessionKey)]),
            authenticated: false
        )
        clearDemoSession()
    }

    func resetDemoOverlay() async throws {
        guard let sessionKey = storedSessionKey else { throw DemoModeError.missingSession }
        let _: DemoModeSuccessResponse = try await apiClient.post(
            path: "/api/v1/demo/resetDemoOverlay",
            body: .object(["sessionKey": .string(sessionKey)]),
            authenticated: false
        )
    }

    func dismissNotice() async throws {
        guard let sessionKey = storedSessionKey else { throw DemoModeError.missingSession }
        let _: DemoModeSuccessResponse = try await apiClient.post(
            path: "/api/v1/demo/dismissDemoNotice",
            body: .object(["sessionKey": .string(sessionKey)]),
            authenticated: false
        )
    }

    func clearDemoSession() {
        defaults.removeObject(forKey: DemoModeDefaults.sessionKey)
        defaults.removeObject(forKey: DemoModeDefaults.expiresAt)
    }
}

enum DemoModeError: LocalizedError {
    case missingSession

    var errorDescription: String? {
        switch self {
        case .missingSession:
            return "Start demo mode first."
        }
    }
}