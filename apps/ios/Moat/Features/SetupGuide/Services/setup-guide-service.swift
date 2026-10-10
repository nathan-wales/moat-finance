import Foundation

actor SetupGuideService {
    private let apiClient: APIClient
    private let onboardingService: OnboardingService

    init(
        apiClient: APIClient = .shared,
        onboardingService: OnboardingService = OnboardingService()
    ) {
        self.apiClient = apiClient
        self.onboardingService = onboardingService
    }

    func getState() async throws -> SetupGuideState {
        try await apiClient.get(path: "/api/v1/setupGuide/get")
    }

    func completeStep(_ stepId: String) async throws -> SetupGuideState {
        try await apiClient.post(
            path: "/api/v1/setupGuide/completeStep",
            body: .object(["stepId": .string(stepId)])
        )
    }

    func dismiss() async throws -> SetupGuideState {
        try await apiClient.post(path: "/api/v1/setupGuide/dismiss")
    }

    func saveGoals(_ goals: [String]) async throws -> SetupGuideState {
        try await onboardingService.saveGoals(goals)
        return try await getState()
    }
}
