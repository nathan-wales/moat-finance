import Foundation

actor ScenariosService {
    private let apiClient: APIClient

    init(apiClient: APIClient = .shared) {
        self.apiClient = apiClient
    }

    func load() async throws -> [ForecastScenario] {
        try await apiClient.get(path: "/api/v1/scenario/getAll")
    }

    func create(_ draft: EditableScenarioDraft) async throws -> ForecastScenario {
        try await apiClient.post(
            path: "/api/v1/scenario/create",
            body: draft.requestBody(includeType: true)
        )
    }

    func update(_ draft: EditableScenarioDraft) async throws -> ForecastScenario {
        guard let sourceId = draft.sourceId else { throw ScenarioValidationError.missingScenario }
        var body = draft.requestBody(includeType: false).objectValue ?? [:]
        body["id"] = .string(sourceId)

        return try await apiClient.post(
            path: "/api/v1/scenario/update",
            body: .object(body)
        )
    }

    func delete(id: String) async throws -> ForecastScenario {
        try await apiClient.post(
            path: "/api/v1/scenario/delete",
            body: .object(["id": .string(id)])
        )
    }

    func setActive(id: String?) async throws {
        let _: ScenarioSuccessResponse = try await apiClient.post(
            path: "/api/v1/scenario/setActive",
            body: .object(["id": id.map(JSONValue.string) ?? .null])
        )
    }

    func seedDefaults() async throws -> SeedScenariosResponse {
        try await apiClient.post(path: "/api/v1/scenario/seedDefaults")
    }

    func loadWhatIfBaseline(months: Int = 3) async throws -> WhatIfBaseline {
        try await apiClient.get(
            path: "/api/v1/budget/getWhatIfBaseline",
            query: ["months": String(months)]
        )
    }
}

private extension EditableScenarioDraft {
    func requestBody(includeType: Bool) -> JSONValue {
        var body: [String: JSONValue] = [
            "name": .string(name.trimmingCharacters(in: .whitespacesAndNewlines)),
            "investmentReturn": .number(investmentReturn),
            "inflationRate": .number(inflationRate),
            "salaryGrowth": .number(salaryGrowth),
            "contributionChange": .number(contributionChange),
            "expenseGrowth": .number(expenseGrowth)
        ]

        if includeType {
            body["type"] = .string(type.rawValue)
        }

        return .object(body)
    }
}

enum ScenarioValidationError: LocalizedError {
    case emptyName
    case missingScenario

    var errorDescription: String? {
        switch self {
        case .emptyName:
            return "Enter a scenario name."
        case .missingScenario:
            return "Choose a scenario first."
        }
    }
}