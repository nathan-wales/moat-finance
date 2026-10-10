import Foundation

actor OnboardingService {
    private let apiClient: APIClient

    init(apiClient: APIClient = .shared) {
        self.apiClient = apiClient
    }

    func shouldShowOnboarding() async throws -> Bool {
        let data = try await loadSavedData()
        return !data.hasCompletedInitialOnboarding
    }

    func loadSavedData() async throws -> OnboardingData {
        try await apiClient.get(path: "/api/v1/onboarding/getOnboardingData")
    }

    func saveGoals(_ goals: [String]) async throws {
        let _: OnboardingSuccessResponse = try await apiClient.post(
            path: "/api/v1/onboarding/saveOnboardingGoals",
            body: .object(["goals": .array(goals.map(JSONValue.string))])
        )
    }

    func saveProfile(currentAge: Int?, retirementAge: Int?) async throws {
        var body: [String: JSONValue] = [:]
        if let currentAge {
            body["currentAge"] = .number(Double(currentAge))
        }
        if let retirementAge {
            body["retirementAge"] = .number(Double(retirementAge))
        }

        let _: OnboardingSuccessResponse = try await apiClient.post(
            path: "/api/v1/onboarding/saveOnboardingProfile",
            body: .object(body)
        )
    }

    func saveReferral(source: String?, other: String?) async throws {
        var body: [String: JSONValue] = [:]
        if let source = source.nilIfBlank {
            body["referralSource"] = .string(source)
        }
        if let other = other.nilIfBlank {
            body["referralSourceOther"] = .string(other)
        }

        let _: OnboardingSuccessResponse = try await apiClient.post(
            path: "/api/v1/onboarding/saveOnboardingReferral",
            body: .object(body)
        )
    }

    func complete(
        goals: [String],
        plaidConnected: Bool,
        currentAge: Int?,
        retirementAge: Int?,
        invests: Bool,
        referralSource: String?,
        referralSourceOther: String?
    ) async throws {
        var body: [String: JSONValue] = [
            "goals": .array(goals.map(JSONValue.string)),
            "plaidConnected": .bool(plaidConnected),
            "invests": .bool(invests)
        ]

        if let currentAge {
            body["currentAge"] = .number(Double(currentAge))
        }
        if let retirementAge {
            body["retirementAge"] = .number(Double(retirementAge))
        }
        if let referralSource = referralSource.nilIfBlank {
            body["referralSource"] = .string(referralSource)
        }
        if let referralSourceOther = referralSourceOther.nilIfBlank {
            body["referralSourceOther"] = .string(referralSourceOther)
        }

        let _: OnboardingSuccessResponse = try await apiClient.post(
            path: "/api/v1/onboarding/completeInitialOnboarding",
            body: .object(body)
        )
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