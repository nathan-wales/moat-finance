import Foundation

actor InvestmentsService {
    private let apiClient: APIClient
    private let accountsService: AccountsService
    private let realEstateService: RealEstateService

    private struct ManualInvestmentAPIRecord: Decodable {
        let id: String
    }

    init(
        apiClient: APIClient = .shared,
        accountsService: AccountsService = AccountsService(),
        realEstateService: RealEstateService = RealEstateService()
    ) {
        self.apiClient = apiClient
        self.accountsService = accountsService
        self.realEstateService = realEstateService
    }

    func load() async throws -> InvestmentsLoadResult {
        let scenarios: [ForecastScenario] = try await apiClient.get(path: "/api/v1/scenario/getAll")
        let activeScenario = scenarios.first(where: \.isActive)

        async let summary: InvestmentSummary = apiClient.post(
            path: "/api/v1/investment/getSummary",
            body: summaryRequestBody(activeScenario: activeScenario)
        )
        async let investments: [InvestmentItem] = apiClient.get(path: "/api/v1/investment/getAll")
        async let properties: [RealEstateProperty] = realEstateService.list()
        async let allocation: PortfolioAllocation = apiClient.get(path: "/api/v1/investment/getPortfolioAllocation")
        async let forecast: [InvestmentForecast] = apiClient.post(
            path: "/api/v1/investment/getForecast",
            body: forecastRequestBody(activeScenario: activeScenario)
        )
        async let accountsResult: AccountsLoadResult = accountsService.load()

        let loadedAccounts = try await accountsResult
        let institutions = loadedAccounts.institutions
        let plaidInvestments = institutions.flatMap { institution in
            institution.accounts
                .filter { account in
                    account.type.lowercased() == "investment" && account.isActive && account.investmentHidden != true
                }
                .map { InvestmentItem.fromPlaid(account: $0, institutionName: institution.institutionName) }
        }

        return try await InvestmentsLoadResult(
            summary: summary,
            investments: investments + plaidInvestments,
            properties: properties,
            allocation: allocation,
            forecast: forecast,
            activeScenario: activeScenario,
            institutions: institutions
        )
    }

    func loadPropertyProjection(
        propertyId: String,
        scenario: RealEstateForecastScenario?,
        years: Int = 5
    ) async throws -> RealEstateProjection {
        try await realEstateService.loadProjection(
            propertyId: propertyId,
            scenario: scenario,
            years: years
        )
    }

    func saveInvestment(
        id: String?,
        type: InvestmentType,
        name: String,
        startingBalance: Double,
        monthlyContribution: Double,
        annualReturnRate: Double,
        notes: String?,
        autoUpdateBalance: Bool? = nil
    ) async throws -> String {
        var body: [String: JSONValue] = [
            "type": .string(type.rawValue),
            "name": .string(name),
            "startingBalance": .number(startingBalance),
            "monthlyContribution": .number(monthlyContribution),
            "annualReturnRate": .number(annualReturnRate)
        ]
        if let notes, !notes.isEmpty {
            body["notes"] = .string(notes)
        } else {
            body["notes"] = .null
        }
        if let autoUpdateBalance {
            body["autoUpdateBalance"] = .bool(autoUpdateBalance)
        }

        let path: String
        if let id {
            body["id"] = .string(id)
            path = "/api/v1/investment/update"
        } else {
            path = "/api/v1/investment/create"
        }

        let record: ManualInvestmentAPIRecord = try await apiClient.post(path: path, body: .object(body))
        return record.id
    }

    func createInvestment(
        id: String?,
        type: InvestmentType,
        name: String,
        startingBalance: Double,
        monthlyContribution: Double,
        annualReturnRate: Double,
        notes: String?,
        autoUpdateBalance: Bool?
    ) async throws -> String {
        var body: [String: JSONValue] = [
            "type": .string(type.rawValue),
            "name": .string(name),
            "startingBalance": .number(startingBalance),
            "monthlyContribution": .number(monthlyContribution),
            "annualReturnRate": .number(annualReturnRate)
        ]
        if let id {
            body["id"] = .string(id)
        }
        if let notes, !notes.isEmpty {
            body["notes"] = .string(notes)
        } else {
            body["notes"] = .null
        }
        if let autoUpdateBalance {
            body["autoUpdateBalance"] = .bool(autoUpdateBalance)
        }

        let record: ManualInvestmentAPIRecord = try await apiClient.post(
            path: "/api/v1/investment/create",
            body: .object(body)
        )
        return record.id
    }

    func deleteInvestment(id: String) async throws {
        let _: JSONValue = try await apiClient.post(
            path: "/api/v1/investment/delete",
            body: .object(["id": .string(id)])
        )
    }

    func saveProperty(id: String?, values: RealEstateFormValues) async throws {
        if let id {
            try await realEstateService.update(id: id, values: values)
        } else {
            try await realEstateService.create(values: values)
        }
    }

    func deleteProperty(id: String) async throws {
        try await realEstateService.delete(id: id)
    }

    private func summaryRequestBody(activeScenario: ForecastScenario?) -> JSONValue {
        var body: [String: JSONValue] = ["forecastMonths": .number(60)]
        if let activeScenario {
            body["scenarioReturnRate"] = .number(activeScenario.investmentReturn)
        }
        return .object(body)
    }

    private func forecastRequestBody(activeScenario: ForecastScenario?) -> JSONValue {
        var body: [String: JSONValue] = ["months": .number(60)]
        if let activeScenario {
            body["scenarioOverrides"] = .object([
                "annualReturnRate": .number(activeScenario.investmentReturn)
            ])
        }
        return .object(body)
    }
}
