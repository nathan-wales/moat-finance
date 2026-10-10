import Foundation

actor PromptsService {
    private let apiClient: APIClient

    init(apiClient: APIClient = .shared) {
        self.apiClient = apiClient
    }

    func listCategories() async throws -> [PromptCategory] {
        try await apiClient.get(path: "/api/v1/prompt/listCategories")
    }

    func listMyPrompts() async throws -> [UserPromptSummary] {
        try await apiClient.get(path: "/api/v1/prompt/listMine")
    }

    func getPrompt(id: String) async throws -> UserPromptDetail {
        try await apiClient.post(
            path: "/api/v1/prompt/get",
            body: PromptIdRequest(promptId: id)
        )
    }

    func createPrompt(_ request: CreateUserPromptRequest) async throws -> UserPromptDetail {
        try await apiClient.post(path: "/api/v1/prompt/create", body: request)
    }

    func updatePrompt(_ request: UpdateUserPromptRequest) async throws -> UserPromptDetail {
        try await apiClient.post(path: "/api/v1/prompt/update", body: request)
    }

    func submitPrompt(id: String) async throws -> UserPromptDetail {
        try await apiClient.post(
            path: "/api/v1/prompt/submit",
            body: PromptIdRequest(promptId: id)
        )
    }

    func deletePrompt(id: String) async throws {
        let _: EmptyResponse = try await apiClient.post(
            path: "/api/v1/prompt/delete",
            body: PromptIdRequest(promptId: id)
        )
    }

    func listCommunityPrompts() async throws -> [CommunityPromptSummary] {
        try await apiClient.get(path: "/api/v1/prompt/listCommunity")
    }

    func getCommunityPrompt(id: String) async throws -> CommunityPromptDetail {
        try await apiClient.post(
            path: "/api/v1/prompt/getCommunity",
            body: PromptIdRequest(promptId: id)
        )
    }

    func saveCommunityPromptToLibrary(id: String) async throws -> UserPromptDetail {
        try await apiClient.post(
            path: "/api/v1/prompt/saveToLibrary",
            body: PromptIdRequest(promptId: id)
        )
    }

    func generateDraft(_ request: GeneratePromptDraftRequest) async throws -> GeneratePromptDraftResponse {
        try await apiClient.post(path: "/api/v1/prompt/generateDraft", body: request)
    }

    func hasAiConnection() async throws -> Bool {
        let status: AiConnectionStatus = try await apiClient.get(path: "/api/v1/prompt/hasAiConnection")
        return status.connected
    }

    func listPins(source: PromptLibrarySource? = nil) async throws -> [PromptPinSummary] {
        if let source {
            return try await apiClient.get(
                path: "/api/v1/prompt/listPins",
                query: ["source": source.rawValue]
            )
        }
        return try await apiClient.get(path: "/api/v1/prompt/listPins")
    }

    func togglePin(source: PromptLibrarySource, promptId: String) async throws -> TogglePromptPinResponse {
        try await apiClient.post(
            path: "/api/v1/prompt/togglePin",
            body: TogglePromptPinRequest(source: source, promptId: promptId)
        )
    }

    func listLaunchCounts(source: PromptLibrarySource? = nil) async throws -> [PromptLaunchCountSummary] {
        if let source {
            return try await apiClient.get(
                path: "/api/v1/prompt/listLaunchCounts",
                query: ["source": source.rawValue]
            )
        }
        return try await apiClient.get(path: "/api/v1/prompt/listLaunchCounts")
    }

    func recordLaunch(source: PromptLibrarySource, promptId: String) async throws -> RecordPromptLaunchResponse {
        try await apiClient.post(
            path: "/api/v1/prompt/recordLaunch",
            body: RecordPromptLaunchRequest(source: source, promptId: promptId)
        )
    }
}
