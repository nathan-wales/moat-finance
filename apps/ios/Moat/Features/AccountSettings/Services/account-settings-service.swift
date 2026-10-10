import Foundation

actor AccountSettingsService {
    private let apiClient: APIClient

    init(apiClient: APIClient = .shared) {
        self.apiClient = apiClient
    }

    func load() async throws -> AccountSettingsSnapshot {
        try await AccountSettingsSnapshot(twoFactorStatus: getTwoFactorStatus())
    }

    func updateProfile(name: String) async throws -> ProfileUpdateResponse {
        try await apiClient.post(
            path: "/api/v1/account/updateProfile",
            body: .object(["name": .string(name)])
        )
    }

    func exportData() async throws -> JSONValue {
        try await apiClient.get(path: "/api/v1/account/exportData")
    }

    func deleteAccount(email: String) async throws {
        let _: EmptyResponse = try await apiClient.post(
            path: "/api/v1/account/deleteAccount",
            body: .object([
                "email": .string(email),
                "confirmation": .bool(true)
            ])
        )
    }

    func getTwoFactorStatus() async throws -> TwoFactorStatus {
        try await apiClient.get(path: "/api/v1/twoFactor/getStatus")
    }

    func generateTwoFactorSecret() async throws -> TwoFactorSecretResponse {
        try await apiClient.post(path: "/api/v1/twoFactor/generateSecret")
    }

    func enableTwoFactor(secret: String, token: String) async throws -> TwoFactorEnableResponse {
        try await apiClient.post(
            path: "/api/v1/twoFactor/enable",
            body: .object([
                "secret": .string(secret),
                "token": .string(token)
            ])
        )
    }

    func disableTwoFactor(password: String) async throws {
        let _: EmptyResponse = try await apiClient.post(
            path: "/api/v1/twoFactor/disable",
            body: .object(["password": .string(password)])
        )
    }
}