import Foundation

@MainActor
final class RetirementScenariosViewModel: ObservableObject {
    enum ViewState {
        case idle
        case loading
        case loaded
        case refreshing
        case error(Error)
    }

    @Published private(set) var state: ViewState = .idle
    @Published private(set) var scenarios: [RetirementScenario] = []
    @Published var compareIds: Set<String> = []
    @Published var actionMessage: String?

    private let service: RetirementService

    init(service: RetirementService = RetirementService()) {
        self.service = service
    }

    func load() async {
        guard case .idle = state else { return }
        await reload(showLoading: true)
    }

    func refresh() async {
        await reload(showLoading: false, showRefreshing: true)
    }

    func save(name: String, levers: [RetirementLeverInput]) async throws -> RetirementScenario {
        let scenario = try await service.createScenario(name: name, levers: levers)
        Analytics.capture("retirement_scenario_saved", properties: [
            "leverCount": levers.count,
            "isNew": true
        ])
        await refresh()
        return scenario
    }

    func delete(_ scenario: RetirementScenario) async {
        do {
            try await service.deleteScenario(id: scenario.id)
            await refresh()
        } catch {
            if error.isCancellation { return }
            state = .error(error)
        }
    }

    func toggleCompare(_ id: String) {
        if compareIds.contains(id) {
            compareIds.remove(id)
        } else if compareIds.count < 3 {
            compareIds.insert(id)
        }
        Analytics.capture("retirement_scenario_compared", properties: [
            "scenarioCount": compareIds.count
        ])
    }

    private func reload(showLoading: Bool, showRefreshing: Bool = true) async {
        if showLoading {
            state = .loading
        } else if showRefreshing {
            state = .refreshing
        }

        do {
            scenarios = try await service.listScenarios()
            state = .loaded
        } catch {
            if error.isCancellation {
                if case .refreshing = state { state = .loaded }
                return
            }
            state = .error(error)
        }
    }
}
