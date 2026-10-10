import Foundation

@MainActor
final class RetirementViewModel: ObservableObject {
    enum ViewState {
        case idle
        case loading
        case loaded
        case refreshing
        case error(Error)
    }

    @Published private(set) var state: ViewState = .idle
    @Published private(set) var overview: RetirementPlanOverview?
    @Published private(set) var projection: RetirementProjectionResponse?
    @Published var selectedTab: RetirementTab = .plan
    @Published var draftLevers: [RetirementLeverInput] = []
    @Published var savedScenarioId: String?

    private let service: RetirementService

    init(service: RetirementService = RetirementService()) {
        self.service = service
    }

    var activeProjection: RetirementProjection? {
        projection?.projection ?? overview?.projection
    }

    var baselineProjection: RetirementProjection? {
        projection?.baseline ?? overview?.projection
    }

    func load() async {
        guard case .idle = state else { return }
        await reload(showLoading: true)
    }

    func refresh() async {
        await reload(showLoading: false, showRefreshing: true)
    }

    func addLever(_ lever: RetirementLever, source: String) {
        draftLevers.append(RetirementLeverInput(lever: lever))
        savedScenarioId = nil
        Analytics.capture("retirement_lever_added", properties: [
            "leverType": lever.type,
            "source": source,
            "stackSize": draftLevers.count
        ])
        Task { await projectDraft() }
    }

    func removeLever(id: String) {
        let type = draftLevers.first(where: { $0.id == id })?.lever.type
        draftLevers.removeAll { $0.id == id }
        savedScenarioId = nil
        Analytics.capture("retirement_lever_removed", properties: [
            "leverType": type ?? "unknown",
            "stackSize": draftLevers.count
        ])
        Task { await projectDraft() }
    }

    func replaceLever(_ input: RetirementLeverInput) {
        guard let index = draftLevers.firstIndex(where: { $0.id == input.id }) else { return }
        draftLevers[index] = input
        savedScenarioId = nil
        Task { await projectDraft() }
    }

    func openScenario(_ scenario: RetirementScenario) {
        draftLevers = scenario.levers.map {
            RetirementLeverInput(id: $0.id, enabled: $0.enabled, lever: $0.lever)
        }
        savedScenarioId = scenario.id
        Task { await projectDraft() }
    }

    func clearDraft() {
        draftLevers = []
        savedScenarioId = nil
        projection = nil
    }

    func changeTab(_ tab: RetirementTab) {
        selectedTab = tab
        Analytics.capture("retirement_tab_changed", properties: ["tab": tab.rawValue])
    }

    private func reload(showLoading: Bool, showRefreshing: Bool = true) async {
        if showLoading {
            state = .loading
        } else if showRefreshing {
            state = .refreshing
        }

        do {
            overview = try await service.getPlanOverview()
            await projectDraft()
            state = .loaded
            Analytics.capture("retirement_page_viewed", properties: [
                "tab": selectedTab.rawValue,
                "hasBaseline": overview != nil
            ])
        } catch {
            if error.isCancellation {
                if case .refreshing = state { state = .loaded }
                return
            }
            state = .error(error)
        }
    }

    private func projectDraft() async {
        guard !draftLevers.isEmpty || savedScenarioId != nil else {
            projection = nil
            return
        }
        do {
            projection = try await service.projectScenario(
                levers: draftLevers,
                scenarioId: savedScenarioId
            )
        } catch {
            if error.isCancellation { return }
            state = .error(error)
        }
    }
}
