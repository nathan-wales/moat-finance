import Foundation

actor FinancialConnectionsService {
    private let apiClient: APIClient

    init(apiClient: APIClient = .shared) {
        self.apiClient = apiClient
    }

    func searchInstitutions(query: String, limit: Int = 10) async throws -> [InstitutionSearchResult] {
        try await apiClient.get(
            path: "/api/v1/institutions/search",
            query: [
                "q": query,
                "limit": String(limit),
            ]
        )
    }

    func createLinkSession(
        canonicalInstitutionId: String,
        products: [String] = ["transactions"],
        provider: FinancialDataProvider? = nil
    ) async throws -> FinancialConnectionLinkSession {
        try await apiClient.post(
            path: "/api/v1/financialConnections/createLinkSession",
            body: CreateLinkSessionRequest(
                canonicalInstitutionId: canonicalInstitutionId,
                products: products,
                provider: provider
            )
        )
    }
}
