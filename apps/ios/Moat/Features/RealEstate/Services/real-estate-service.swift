import Foundation

actor RealEstateService {
    private let apiClient: APIClient

    init(apiClient: APIClient = .shared) {
        self.apiClient = apiClient
    }

    func list() async throws -> [RealEstateProperty] {
        try await apiClient.get(path: "/api/v1/realEstate/list")
    }

    func create(values: RealEstateFormValues) async throws {
        let _: JSONValue = try await apiClient.post(
            path: "/api/v1/realEstate/create",
            body: .object(mapFormValuesToCreateBody(values))
        )
    }

    func update(id: String, values: RealEstateFormValues) async throws {
        let _: JSONValue = try await apiClient.post(
            path: "/api/v1/realEstate/update",
            body: .object(mapFormValuesToUpdateBody(id: id, values: values))
        )
    }

    func delete(id: String) async throws {
        let _: JSONValue = try await apiClient.post(
            path: "/api/v1/realEstate/delete",
            body: .object(["id": .string(id)])
        )
    }

    func loadProjection(
        propertyId: String,
        scenario: RealEstateForecastScenario?,
        years: Int = 5
    ) async throws -> RealEstateProjection {
        var body: [String: JSONValue] = [
            "id": .string(propertyId),
            "years": .number(Double(years)),
        ]
        if let scenario {
            body["scenario"] = .string(scenario.rawValue)
        }

        return try await apiClient.post(
            path: "/api/v1/realEstate/getProjection",
            body: .object(body)
        )
    }
}
