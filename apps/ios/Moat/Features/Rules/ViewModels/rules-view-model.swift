import Foundation

@MainActor
final class RulesViewModel: ObservableObject {
    enum ViewState {
        case idle
        case loading
        case loaded
        case refreshing
        case error(Error)
    }

    @Published private(set) var state: ViewState = .idle
    @Published private(set) var rules: [TransactionRule] = []
    @Published private(set) var settings: RuleSettings?
    @Published private(set) var categories: [CategoryItem] = []
    @Published private(set) var hashtags: [HashtagSummary] = []
    @Published private(set) var actionMessage: RuleActionMessage?

    private let service: RulesService

    init(service: RulesService = RulesService()) {
        self.service = service
    }

    var activeCount: Int { rules.filter(\.isActive).count }

    func load() async {
        guard case .idle = state else { return }
        await reload(showLoading: true)
    }

    func refresh() async {
        await reload(showLoading: false, showRefreshing: true)
    }

    func save(rule: TransactionRule?, draft: EditableRuleDraft, applyToHistorical: Bool) async throws {
        try draft.validate()
        let result = try await service.save(rule: rule, draft: draft)
        MoatDataRefresh.notifySetupGuideChanged()
        var message = result.name

        if applyToHistorical {
            let applyResult = try await service.applyHistorical(id: result.id)
            if applyResult.affected > 0 {
                MoatDataRefresh.notifyTransactionsChanged()
                message = "\(result.name) — applied to \(applyResult.affected) transaction\(applyResult.affected == 1 ? "" : "s")."
            }
        }

        actionMessage = RuleActionMessage(
            title: rule == nil ? "Rule created" : "Rule updated",
            message: message
        )
        await refresh()
    }

    func delete(_ rule: TransactionRule) async throws {
        try await service.delete(id: rule.id)
        actionMessage = RuleActionMessage(title: "Rule deleted", message: rule.name)
        await refresh()
    }

    func toggleActive(_ rule: TransactionRule) async {
        await performAction(title: rule.isActive ? "Rule disabled" : "Rule enabled") {
            try await service.toggleActive(id: rule.id, isActive: !rule.isActive)
            return rule.name
        }
        await refresh()
    }

    func previewDraft(rule: TransactionRule?, draft: EditableRuleDraft) async throws -> RuleDraftPreview {
        let conditions = RulePreviewHelpers.committedConditions(from: draft.conditions)
        guard !conditions.isEmpty else {
            return RuleDraftPreview(totalCount: 0, preview: [])
        }

        var previewDraft = draft
        previewDraft.conditions = conditions
        return try await service.previewConditions(draft: previewDraft, appliedRuleId: rule?.id)
    }

    func move(_ rule: TransactionRule, direction: RuleMoveDirection) async {
        guard let index = rules.firstIndex(where: { $0.id == rule.id }) else { return }

        let targetIndex: Int
        switch direction {
        case .up:
            targetIndex = index - 1
        case .down:
            targetIndex = index + 1
        }

        guard rules.indices.contains(targetIndex) else { return }

        var ordered = rules
        ordered.swapAt(index, targetIndex)
        rules = ordered

        await performAction(title: "Rule order updated") {
            try await service.reorder(orderedIds: ordered.map(\.id))
            return rule.name
        }
        await refresh()
    }

    func updatePreference(_ preference: RuleExecutionPreference) async {
        await performAction(title: "Preference updated") {
            settings = try await service.updateSettings(preference)
            return preference.title
        }
    }

    func clearActionMessage() {
        actionMessage = nil
    }

    private func reload(showLoading: Bool, showRefreshing: Bool = true) async {
        if showLoading {
            state = .loading
        } else if showRefreshing {
            state = .refreshing
        }

        do {
            let result = try await service.load()
            rules = result.rules
            settings = result.settings
            categories = result.categories
            hashtags = result.hashtags
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

    private func performAction(title: String, operation: () async throws -> String) async {
        state = .refreshing

        do {
            let message = try await operation()
            actionMessage = RuleActionMessage(title: title, message: message)
            state = .loaded
        } catch {
            actionMessage = RuleActionMessage(title: title, message: error.localizedDescription)
            state = .loaded
        }
    }
}

enum RuleMoveDirection {
    case up
    case down
}

enum RuleValidationError: LocalizedError {
    case emptyName
    case invalidCondition
    case invalidAction

    var errorDescription: String? {
        switch self {
        case .emptyName:
            return "Enter a rule name."
        case .invalidCondition:
            return "Fill out the condition."
        case .invalidAction:
            return "Fill out the action."
        }
    }
}
