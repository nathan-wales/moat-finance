import Foundation

actor CommunityTipsService {
    private let apiClient: APIClient

    init(apiClient: APIClient = .shared) {
        self.apiClient = apiClient
    }

    func listFeed(sort: CommunityTipFeedSort = .recommended, query: String? = nil, cursor: String? = nil) async throws -> CommunityTipFeedResponse {
        let body = ListCommunityTipsRequest(
            sort: sort.rawValue,
            query: query,
            cursor: cursor,
            limit: nil
        )
        return try await apiClient.post(path: "/api/v1/communityTip/list", body: body)
    }

    func listMine() async throws -> [CommunityTipOwnerDetail] {
        try await apiClient.get(path: "/api/v1/communityTip/listMine")
    }

    func get(tipId: String) async throws -> CommunityTipPublicDetail {
        try await apiClient.post(path: "/api/v1/communityTip/get", body: TipIdRequest(tipId: tipId))
    }

    func create(_ request: CreateCommunityTipRequest) async throws -> CommunityTipOwnerDetail {
        try await apiClient.post(path: "/api/v1/communityTip/create", body: request)
    }

    func update(_ request: UpdateCommunityTipRequest) async throws -> CommunityTipOwnerDetail {
        try await apiClient.post(path: "/api/v1/communityTip/update", body: request)
    }

    func delete(tipId: String) async throws {
        let _: EmptyResponse = try await apiClient.post(
            path: "/api/v1/communityTip/delete",
            body: TipIdRequest(tipId: tipId)
        )
    }

    func like(tipId: String) async throws -> CommunityTipPublicSummary {
        try await apiClient.post(path: "/api/v1/communityTip/like", body: TipIdRequest(tipId: tipId))
    }

    func unlike(tipId: String) async throws -> CommunityTipPublicSummary {
        try await apiClient.post(path: "/api/v1/communityTip/unlike", body: TipIdRequest(tipId: tipId))
    }

    func listForTransaction(transactionId: String, limit: Int? = nil) async throws -> [CommunityTipTransactionRecommendation] {
        let body = ListForTransactionRequest(transactionId: transactionId, limit: limit)
        return try await apiClient.post(path: "/api/v1/communityTip/listForTransaction", body: body)
    }

    func getSettings() async throws -> CommunityTipSettings {
        try await apiClient.get(path: "/api/v1/communityTip/getSettings")
    }

    func setSettings(showCommunityTipsOnTransactions: Bool) async throws -> CommunityTipSettings {
        let body = SetCommunityTipSettingsRequest(showCommunityTipsOnTransactions: showCommunityTipsOnTransactions)
        return try await apiClient.post(path: "/api/v1/communityTip/setSettings", body: body)
    }
}
