import Foundation

actor FeedbackService {
    private let apiClient: APIClient

    init(apiClient: APIClient = .shared) {
        self.apiClient = apiClient
    }

    func createFeedback(_ request: CreateFeedbackRequest) async throws -> CreateFeedbackResponse {
        try await apiClient.post(
            path: "/api/v1/feedback/create",
            body: request
        )
    }
}
