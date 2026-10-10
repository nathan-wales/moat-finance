import Foundation

actor TaxesService {
    private let apiClient: APIClient

    init(apiClient: APIClient = .shared) {
        self.apiClient = apiClient
    }

    func listYears() async throws -> TaxYearsResponse {
        try await apiClient.post(path: "/api/v1/taxes/listYears")
    }

    func getOverview(taxYear: Int) async throws -> TaxOverview {
        try await apiClient.post(
            path: "/api/v1/taxes/getOverview",
            body: TaxYearInput(taxYear: taxYear)
        )
    }

    func listDocuments(taxYear: Int) async throws -> [TaxDocument] {
        try await apiClient.post(
            path: "/api/v1/taxes/listDocuments",
            body: TaxYearInput(taxYear: taxYear)
        )
    }

    func listFacts(taxYear: Int) async throws -> [TaxFact] {
        try await apiClient.post(
            path: "/api/v1/taxes/listFacts",
            body: TaxYearInput(taxYear: taxYear)
        )
    }

    func getDocument(id: String) async throws -> TaxDocumentDetail {
        try await apiClient.post(
            path: "/api/v1/taxes/getDocument",
            body: TaxIdInput(id: id)
        )
    }

    func reprocessDocument(id: String) async throws -> TaxDocument {
        try await apiClient.post(
            path: "/api/v1/taxes/reprocessDocument",
            body: TaxIdInput(id: id)
        )
    }

    func confirmFact(id: String, confirmed: Bool) async throws -> TaxFact {
        try await apiClient.post(
            path: "/api/v1/taxes/confirmFact",
            body: TaxConfirmFactInput(id: id, confirmed: confirmed)
        )
    }
}
