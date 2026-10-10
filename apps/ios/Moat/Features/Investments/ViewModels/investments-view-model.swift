import Foundation

@MainActor
final class InvestmentsViewModel: ObservableObject {
    enum ViewState {
        case idle
        case loading
        case loaded
        case refreshing
        case error(Error)
    }

    @Published private(set) var state: ViewState = .idle
    @Published private(set) var summary: InvestmentSummary?
    @Published private(set) var investments: [InvestmentItem] = []
    @Published private(set) var properties: [RealEstateProperty] = []
    @Published private(set) var allocation = PortfolioAllocation(sections: [])
    @Published private(set) var forecast: [InvestmentForecast] = []
    @Published private(set) var activeScenario: ForecastScenario?
    @Published private(set) var institutions: [PlaidInstitution] = []
    @Published private(set) var actionMessage: InvestmentActionMessage?

    private let service: InvestmentsService

    init(service: InvestmentsService = InvestmentsService()) {
        self.service = service
    }

    func load() async {
        guard case .idle = state else { return }
        await reload(showLoading: true)
    }

    func refresh() async {
        await reload(showLoading: false, showRefreshing: true)
    }

    func saveInvestment(
        investment: InvestmentItem?,
        type: InvestmentType,
        name: String,
        startingBalance: Double,
        monthlyContribution: Double,
        returnPercent: Double,
        notes: String?
    ) async throws {
        _ = try await service.saveInvestment(
            id: investment?.id,
            type: type,
            name: name,
            startingBalance: startingBalance,
            monthlyContribution: monthlyContribution,
            annualReturnRate: returnPercent / 100,
            notes: notes
        )
        actionMessage = InvestmentActionMessage(title: "Investment saved", message: name)
        await refresh()
    }

    func deleteInvestment(_ investment: InvestmentItem) async throws {
        try await service.deleteInvestment(id: investment.id)
        actionMessage = InvestmentActionMessage(title: "Investment removed", message: investment.name)
        await refresh()
    }

    func saveProperty(
        property: RealEstateProperty?,
        values: RealEstateFormValues
    ) async throws {
        try await service.saveProperty(id: property?.id, values: values)
        actionMessage = InvestmentActionMessage(title: "Property saved", message: values.name)
        await refresh()
    }

    func deleteProperty(_ property: RealEstateProperty) async throws {
        try await service.deleteProperty(id: property.id)
        actionMessage = InvestmentActionMessage(title: "Property removed", message: property.name)
        await refresh()
    }

    func loadProjection(for property: RealEstateProperty) async throws -> RealEstateProjection {
        try await service.loadPropertyProjection(
            propertyId: property.id,
            scenario: property.forecastScenario
        )
    }

    func clearActionMessage() {
        actionMessage = nil
    }

    func setActionMessage(title: String, message: String) {
        actionMessage = InvestmentActionMessage(title: title, message: message)
    }

    var linkedAccounts: [LinkedPlaidAccountSummary] {
        institutions.flatMap { institution in
            institution.accounts
                .filter { $0.isActive }
                .map { LinkedPlaidAccountSummary(account: $0, institutionName: institution.institutionName) }
        }
    }

    var mortgageAccountCandidates: [LinkedPlaidAccountSummary] {
        linkedAccounts.sorted { lhs, rhs in
            if lhs.isMortgageCandidate != rhs.isMortgageCandidate {
                return lhs.isMortgageCandidate && !rhs.isMortgageCandidate
            }
            return lhs.displayName < rhs.displayName
        }
    }

    func linkedAccount(for property: RealEstateProperty) -> LinkedPlaidAccountSummary? {
        guard let linkedPlaidAccountId = property.linkedPlaidAccountId else { return nil }
        return linkedAccounts.first { $0.id == linkedPlaidAccountId }
    }

    private func reload(showLoading: Bool, showRefreshing: Bool = true) async {
        if showLoading {
            state = .loading
        } else if showRefreshing {
            state = .refreshing
        }

        do {
            let result = try await service.load()
            summary = result.summary
            investments = result.investments
            properties = result.properties
            allocation = result.allocation
            forecast = result.forecast
            activeScenario = result.activeScenario
            institutions = result.institutions
            state = .loaded
        } catch {
            if error.isCancellation {
                if case .refreshing = state {
                    state = .loaded
                }
                return
            }
            state = .error(error)
        }
    }
}
