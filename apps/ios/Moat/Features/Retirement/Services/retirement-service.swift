import Foundation

actor RetirementService {
    private let apiClient: APIClient

    init(apiClient: APIClient = .shared) {
        self.apiClient = apiClient
    }

    func getPlanOverview() async throws -> RetirementPlanOverview {
        try await apiClient.get(path: "/api/v1/retirement/getPlanOverview")
    }

    func projectScenario(
        levers: [RetirementLeverInput],
        scenarioId: String?
    ) async throws -> RetirementProjectionResponse {
        var body: [String: JSONValue] = [
            "levers": .array(levers.map { $0.jsonObject() }),
            "includeBaseline": .bool(true)
        ]
        if let scenarioId {
            body["scenarioId"] = .string(scenarioId)
        }
        return try await apiClient.post(
            path: "/api/v1/retirement/projectScenario",
            body: .object(body)
        )
    }

    func runStressTests(
        levers: [RetirementLeverInput],
        scenarioId: String?
    ) async throws -> RetirementStressTestsResponse {
        var body: [String: JSONValue] = [
            "levers": .array(levers.map { $0.jsonObject() })
        ]
        if let scenarioId {
            body["scenarioId"] = .string(scenarioId)
        }
        return try await apiClient.post(
            path: "/api/v1/retirement/runStressTests",
            body: .object(body)
        )
    }

    func listScenarios() async throws -> [RetirementScenario] {
        try await apiClient.get(path: "/api/v1/retirement/listScenarios")
    }

    func createScenario(name: String, levers: [RetirementLeverInput]) async throws -> RetirementScenario {
        try await apiClient.post(
            path: "/api/v1/retirement/createScenario",
            body: RetirementCreateScenarioRequest(name: name, levers: levers)
        )
    }

    func deleteScenario(id: String) async throws {
        let _: EmptyResponse = try await apiClient.post(
            path: "/api/v1/retirement/deleteScenario",
            body: .object(["id": .string(id)])
        )
    }
}
