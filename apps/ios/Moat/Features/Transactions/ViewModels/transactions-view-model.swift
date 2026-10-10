import Foundation
import Combine

@MainActor
final class TransactionsViewModel: ObservableObject {
    enum ViewState {
        case idle
        case loading
        case loaded
        case refreshing
        case error(Error)
    }

    @Published private(set) var state: ViewState = .idle
    @Published private(set) var transactions: [TransactionItem] = []
    @Published private(set) var totalCount: Int = 0
    @Published private(set) var summary: TransactionSummary?
    @Published private(set) var categories: [String] = []
    @Published private(set) var hashtags: [HashtagSummary] = []
    @Published var searchText = ""
    @Published private(set) var filters = TransactionFilterState()
    @Published private(set) var nextCursor: Int?
    @Published private(set) var isLoadingMore = false
    @Published private(set) var isBulkEditing = false
    @Published private(set) var selectedTransactionIds: Set<String> = []

    private let service: TransactionsService
    private let rulesService: RulesService
    private var cancellables = Set<AnyCancellable>()
    private var statsLookbackStart = TransactionStatsWindow.defaultStartDate()
    private var statsRefreshTask: Task<Void, Never>?

    private var statsFilters: TransactionFilterState {
        TransactionStatsWindow.summaryFilters(from: filters, lookbackStart: statsLookbackStart)
    }

    init(
        service: TransactionsService = TransactionsService(),
        rulesService: RulesService = RulesService(),
        initialFilters: TransactionFilterState = TransactionFilterState()
    ) {
        self.service = service
        self.rulesService = rulesService
        filters = initialFilters
        searchText = initialFilters.search

        NotificationCenter.default.publisher(for: MoatDataRefresh.transactionsDidChange)
            .receive(on: RunLoop.main)
            .sink { [weak self] _ in
                guard let self else { return }
                Task { await self.refreshIfLoaded() }
            }
            .store(in: &cancellables)
    }

    func load() async {
        guard case .idle = state else { return }
        resetStatsLookback()
        await reload(showLoading: true)
    }

    func refresh() async {
        filters.cursor = 0
        await reload(showLoading: false, showRefreshing: true)
    }

    func refreshIfLoaded() async {
        switch state {
        case .loaded, .refreshing:
            await refresh()
        default:
            break
        }
    }

    func fetchTransaction(id: String, around date: Date) async throws -> TransactionItem? {
        try await service.fetchTransaction(id: id, around: date)
    }

    func applySearch() async {
        filters.search = searchText
        filters.cursor = 0
        resetStatsLookback()
        await reload(showLoading: false)
    }

    func handleSearchTextChange() async {
        let trimmedSearchText = searchText.trimmingCharacters(in: .whitespacesAndNewlines)
        let appliedSearch = filters.search.trimmingCharacters(in: .whitespacesAndNewlines)
        guard trimmedSearchText.isEmpty, !appliedSearch.isEmpty else { return }
        await applySearch()
    }

    func setTypeFilter(_ type: TransactionKind?) async {
        filters.type = type
        filters.cursor = 0
        resetStatsLookback()
        await reload(showLoading: false)
    }

    func setCategoryFilter(_ category: String?) async {
        filters.category = category
        filters.categories = []
        filters.cursor = 0
        resetStatsLookback()
        await reload(showLoading: false)
    }

    func setHashtagFilter(_ hashtag: String?) async {
        filters.hashtag = hashtag
        filters.cursor = 0
        resetStatsLookback()
        await reload(showLoading: false)
    }

    func clearFilters() async {
        filters = TransactionFilterState()
        searchText = ""
        resetStatsLookback()
        await reload(showLoading: false)
    }

    func applyFilters(_ nextFilters: TransactionFilterState) async {
        filters = nextFilters
        filters.cursor = 0
        searchText = filters.search
        resetStatsLookback()
        await reload(showLoading: false)
    }

    func expandStats(forVisibleIDs ids: Set<String>) {
        let oldestVisibleDate = transactions
            .filter { ids.contains($0.id) }
            .map(\.canonicalDate)
            .min()
        guard let expandedStart = TransactionStatsWindow.expandedLookbackStart(
            current: statsLookbackStart,
            oldestVisibleDate: oldestVisibleDate,
            hasExplicitDateFilter: filters.hasExplicitDateFilter
        ) else { return }

        statsLookbackStart = expandedStart
        scheduleStatsRefresh()
    }

    func loadNextPage() async {
        guard let nextCursor, !isLoadingMore else { return }

        isLoadingMore = true
        defer { isLoadingMore = false }

        do {
            var nextFilters = filters
            nextFilters.cursor = nextCursor
            let page = try await service.loadPage(filters: nextFilters)
            transactions.append(contentsOf: page.items)
            transactions = groupSplitTransactions(transactions)
            filters = nextFilters
            self.nextCursor = page.nextCursor
        } catch {
            if error.isCancellation { return }
            state = .error(error)
        }
    }

    func toggleBulkEditing() {
        isBulkEditing.toggle()
        selectedTransactionIds.removeAll()
    }

    func endBulkEditing() {
        isBulkEditing = false
        selectedTransactionIds.removeAll()
    }

    func startBulkEditing(selecting transaction: TransactionItem) {
        isBulkEditing = true
        selectedTransactionIds.insert(transaction.id)
    }

    func toggleSelection(for transaction: TransactionItem) {
        if selectedTransactionIds.contains(transaction.id) {
            selectedTransactionIds.remove(transaction.id)
        } else {
            selectedTransactionIds.insert(transaction.id)
        }
    }

    func selectVisibleTransactions() {
        selectedTransactionIds = Set(transactions.map(\.id))
    }

    func clearSelection() {
        selectedTransactionIds.removeAll()
    }

    func bulkUpdateType(_ type: TransactionKind) async throws {
        let ids = Array(selectedTransactionIds)
        guard !ids.isEmpty else { return }
        try await service.bulkUpdateType(transactionIds: ids, type: type)
        isBulkEditing = false
        selectedTransactionIds.removeAll()
        await refresh()
    }

    func bulkHide() async throws {
        let ids = Array(selectedTransactionIds)
        guard !ids.isEmpty else { return }
        try await service.bulkDelete(transactionIds: ids)
        isBulkEditing = false
        selectedTransactionIds.removeAll()
        await refresh()
        MoatDataRefresh.notifyTransactionsChanged()
    }

    func bulkDelete() async throws {
        try await bulkHide()
    }

    func bulkUpdateCategory(_ category: String) async throws {
        let ids = Array(selectedTransactionIds)
        let trimmedCategory = category.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !ids.isEmpty, !trimmedCategory.isEmpty else { return }

        for id in ids {
            try await service.updateCategory(transactionId: id, categoryName: trimmedCategory)
        }

        isBulkEditing = false
        selectedTransactionIds.removeAll()
        await refresh()
        MoatDataRefresh.notifyTransactionsChanged()
    }

    func bulkAddHashtags(_ hashtags: [String]) async throws {
        let ids = Array(selectedTransactionIds)
        let normalizedHashtags = normalizedHashtagNames(hashtags)
        guard !ids.isEmpty, !normalizedHashtags.isEmpty else { return }

        let selectedTransactions = transactions.filter { ids.contains($0.id) }
        for transaction in selectedTransactions {
            let nextHashtags = normalizedHashtagNames(transaction.hashtagNames + normalizedHashtags)
            try await service.setHashtags(transactionId: transaction.id, names: nextHashtags)
        }

        isBulkEditing = false
        selectedTransactionIds.removeAll()
        await refresh()
        MoatDataRefresh.notifyTransactionsChanged()
    }

    func save(transaction: TransactionItem, description: String, amount: Double?, category: String, type: TransactionKind, hashtags: [String]? = nil) async throws -> TransactionRulePrompt? {
        let trimmedDescription = description.trimmingCharacters(in: .whitespacesAndNewlines)
        let trimmedCategory = category.trimmingCharacters(in: .whitespacesAndNewlines)
        let actions = buildRuleActions(
            transaction: transaction,
            description: trimmedDescription,
            category: trimmedCategory,
            type: type,
            hashtags: hashtags
        )

        var updatedDescription: String?
        var updatedAmount: Double?

        if trimmedDescription != (transaction.description ?? "") {
            updatedDescription = trimmedDescription
        }

        if transaction.canEditAmount, let amount, amount != transaction.amount {
            updatedAmount = amount
        }

        if updatedDescription != nil || updatedAmount != nil {
            try await service.update(transactionId: transaction.id, description: updatedDescription, amount: updatedAmount)
        }

        if !trimmedCategory.isEmpty, trimmedCategory != transaction.displayCategory {
            try await service.updateCategory(transactionId: transaction.id, categoryName: trimmedCategory)
        }

        if type != transaction.type {
            try await service.updateType(transactionId: transaction.id, type: type)
        }

        if let hashtags {
            let normalized = hashtags.map { $0.trimmingCharacters(in: .whitespacesAndNewlines) }
                .filter { !$0.isEmpty }
            let existing = transaction.hashtagNames.sorted()
            if normalized.sorted() != existing {
                try await service.setHashtags(transactionId: transaction.id, names: normalized)
            }
        }

        await refresh()
        MoatDataRefresh.notifyTransactionsChanged()

        guard !actions.isEmpty else { return nil }

        return makeRulePrompt(transaction: transaction, actions: actions)
    }

    func applyRulePrompt(_ prompt: TransactionRulePrompt, draft: EditableRuleDraft, applyToHistorical: Bool) async throws {
        try draft.validate()

        let existingRule: TransactionRule?
        switch prompt.mode {
        case .create:
            existingRule = nil
        case .update(let ruleId):
            existingRule = try await rulesService.getById(id: ruleId)
        }

        let rule = try await rulesService.save(rule: existingRule, draft: draft)
        MoatDataRefresh.notifySetupGuideChanged()
        try await rulesService.linkToTransaction(transactionId: prompt.transactionId, ruleId: rule.id)

        if applyToHistorical {
            let applyResult = try await rulesService.applyHistorical(id: rule.id)
            if applyResult.affected > 0 {
                MoatDataRefresh.notifyTransactionsChanged()
            }
        }

        await refresh()
    }

    func prepareRuleEditor(for prompt: TransactionRulePrompt) async throws -> TransactionRuleEditorContext {
        async let categories = rulesService.loadCategories()

        switch prompt.mode {
        case .create:
            let draft = EditableRuleDraft(
                name: ruleName(for: prompt),
                conditions: [
                    EditableRuleConditionDraft(
                        field: .description,
                        operatorValue: .contains,
                        text: prompt.originalDescription
                    )
                ],
                actions: prompt.actions.map(\.ruleActionDraft)
            )
            return try await TransactionRuleEditorContext(
                draft: draft,
                existingRule: nil,
                categories: categories
            )
        case .update(let ruleId):
            let rule = try await rulesService.getById(id: ruleId)
            var draft = EditableRuleDraft(rule: rule)
            draft.actions.append(contentsOf: prompt.actions.map(\.ruleActionDraft))
            return try await TransactionRuleEditorContext(
                draft: draft,
                existingRule: rule,
                categories: categories
            )
        }
    }

    func prepareSwipeRuleEditor(for transaction: TransactionItem) async throws -> (prompt: TransactionRulePrompt, context: TransactionRuleEditorContext) {
        let originalDescription = transaction.originalDescription.transactionNilIfBlank
            ?? transaction.description.transactionNilIfBlank
            ?? transaction.merchantName.transactionNilIfBlank
            ?? transaction.displayTitle
        let trimmedDescription = originalDescription.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !trimmedDescription.isEmpty else {
            throw TransactionSwipeRuleError.missingDescription
        }

        let mode = try await resolveRulePromptMode(
            for: transaction,
            originalDescription: trimmedDescription
        )
        let prompt = TransactionRulePrompt(
            transactionId: transaction.id,
            mode: mode,
            originalDescription: trimmedDescription,
            actions: []
        )
        let context = try await prepareRuleEditor(for: prompt)
        return (prompt, context)
    }

    func resolveManageRuleTitle(for transaction: TransactionItem) async -> String {
        let originalDescription = transaction.originalDescription.transactionNilIfBlank
            ?? transaction.description.transactionNilIfBlank
            ?? transaction.merchantName.transactionNilIfBlank
            ?? transaction.displayTitle
        let trimmedDescription = originalDescription.trimmingCharacters(in: .whitespacesAndNewlines)

        do {
            let mode = try await resolveRulePromptMode(
                for: transaction,
                originalDescription: trimmedDescription
            )
            switch mode {
            case .create:
                return "Create a rule"
            case .update:
                return "Update rule"
            }
        } catch {
            return transaction.appliedRuleId == nil ? "Create a rule" : "Update rule"
        }
    }

    private func resolveRulePromptMode(
        for transaction: TransactionItem,
        originalDescription: String
    ) async throws -> TransactionRulePrompt.Mode {
        if let ruleId = transaction.appliedRuleId {
            return .update(ruleId: ruleId)
        }

        let resolved = try await rulesService.resolveForTransaction(transactionId: transaction.id)
        if let ruleId = resolved.ruleId {
            return .update(ruleId: ruleId)
        }

        let rules = try await rulesService.load().rules
        if let matchedRule = TransactionRuleMatcher.matchingRule(
            for: transaction,
            originalDescription: originalDescription,
            in: rules
        ) {
            return .update(ruleId: matchedRule.id)
        }

        return .create
    }

    func previewRulePrompt(_ prompt: TransactionRulePrompt, draft: EditableRuleDraft) async throws -> RuleDraftPreview {
        let conditions = RulePreviewHelpers.committedConditions(from: draft.conditions)
        guard !conditions.isEmpty else {
            return RuleDraftPreview(totalCount: 0, preview: [])
        }

        let appliedRuleId: String?
        if case .update(let ruleId) = prompt.mode {
            appliedRuleId = ruleId
        } else {
            appliedRuleId = nil
        }

        var previewDraft = draft
        previewDraft.conditions = conditions
        return try await rulesService.previewConditions(draft: previewDraft, appliedRuleId: appliedRuleId)
    }

    func hide(_ transaction: TransactionItem) async throws -> TransactionRulePrompt? {
        let prompt = makeRulePromptForHide(transaction: transaction)
        let previousHidden = transaction.isHiddenTransaction
        applyHidden(true, to: transaction.id)
        do {
            try await service.delete(transactionId: transaction.id)
            MoatDataRefresh.notifyTransactionsChanged()
        } catch {
            applyHidden(previousHidden, to: transaction.id)
            throw error
        }
        return prompt
    }

    func unhide(_ transaction: TransactionItem) async throws {
        let previousHidden = transaction.isHiddenTransaction
        applyHidden(false, to: transaction.id)
        do {
            try await service.unhide(transactionId: transaction.id)
            MoatDataRefresh.notifyTransactionsChanged()
        } catch {
            applyHidden(previousHidden, to: transaction.id)
            throw error
        }
    }

    func delete(_ transaction: TransactionItem) async throws {
        _ = try await hide(transaction)
    }

    func split(
        transaction: TransactionItem,
        description: String,
        originalAmount: Double,
        splitAmount: Double,
        type: TransactionKind,
        originalCategoryName: String,
        splitCategoryName: String,
        hashtags: [String]
    ) async throws {
        let trimmedDescription = description.trimmingCharacters(in: .whitespacesAndNewlines)
        try await service.split(
            transactionId: transaction.id,
            description: trimmedDescription.isEmpty ? nil : trimmedDescription,
            originalAmount: originalAmount,
            splitAmount: splitAmount,
            type: type,
            originalCategoryName: originalCategoryName,
            splitCategoryName: splitCategoryName,
            hashtags: hashtags
        )
        await refresh()
        MoatDataRefresh.notifyTransactionsChanged()
    }

    func unsplit(_ transaction: TransactionItem) async throws {
        try await service.unsplit(transactionId: transaction.id)
        await refresh()
        MoatDataRefresh.notifyTransactionsChanged()
    }

    private func applyHidden(_ isHidden: Bool, to transactionId: String) {
        guard let index = transactions.firstIndex(where: { $0.id == transactionId }) else { return }
        let current = transactions[index]
        guard current.isHiddenTransaction != isHidden else { return }
        transactions[index] = current.withHidden(isHidden)
    }

    private func reload(showLoading: Bool, showRefreshing: Bool = true) async {
        if showLoading {
            state = .loading
        } else if showRefreshing {
            state = .refreshing
        }

        do {
            let result = try await service.load(filters: filters, statsFilters: statsFilters)
            transactions = groupSplitTransactions(result.list.items)
            totalCount = result.totalCount
            summary = result.summary
            categories = result.categories
            hashtags = result.hashtags
            nextCursor = result.list.nextCursor
            selectedTransactionIds.formIntersection(Set(transactions.map(\.id)))
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

    private func buildRuleActions(
        transaction: TransactionItem,
        description: String,
        category: String,
        type: TransactionKind,
        hashtags: [String]?
    ) -> [TransactionRulePrompt.Action] {
        var actions: [TransactionRulePrompt.Action] = []

        if description != (transaction.description ?? "").trimmingCharacters(in: .whitespacesAndNewlines) {
            actions.append(.setDescription(description))
        }

        if type != transaction.type {
            actions.append(.setType(type))
        }

        if !category.isEmpty, category != transaction.displayCategory {
            actions.append(.setCategory(category))
        }

        if let hashtags {
            let normalized = hashtags
                .map { $0.trimmingCharacters(in: .whitespacesAndNewlines) }
                .filter { !$0.isEmpty }
            let existing = Set(transaction.hashtagNames.map { $0.lowercased() })

            for tag in normalized where !existing.contains(tag.lowercased()) {
                actions.append(.addHashtag(tag))
            }

            if normalized.sorted() != transaction.hashtagNames.sorted(), actions.isEmpty {
                actions.append(contentsOf: fallbackRuleActions(description: description, category: category, type: type))
            }
        }

        return actions
    }

    private func fallbackRuleActions(
        description: String,
        category: String,
        type: TransactionKind
    ) -> [TransactionRulePrompt.Action] {
        if !category.isEmpty {
            return [.setCategory(category)]
        }
        if !description.isEmpty {
            return [.setDescription(description)]
        }
        return [.setType(type)]
    }

    private func makeRulePrompt(
        transaction: TransactionItem,
        actions: [TransactionRulePrompt.Action]
    ) -> TransactionRulePrompt? {
        let originalDescription = transaction.originalDescription.transactionNilIfBlank
            ?? transaction.description.transactionNilIfBlank
            ?? transaction.merchantName.transactionNilIfBlank
            ?? transaction.displayTitle
        guard !originalDescription.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty else { return nil }
        guard !actions.isEmpty else { return nil }

        let mode: TransactionRulePrompt.Mode = transaction.appliedRuleId.map { .update(ruleId: $0) } ?? .create

        return TransactionRulePrompt(
            transactionId: transaction.id,
            mode: mode,
            originalDescription: originalDescription,
            actions: actions
        )
    }

    private func makeRulePromptForHide(transaction: TransactionItem) -> TransactionRulePrompt? {
        let originalDescription = transaction.originalDescription.transactionNilIfBlank
            ?? transaction.description.transactionNilIfBlank
            ?? transaction.merchantName.transactionNilIfBlank
            ?? transaction.displayTitle
        guard !originalDescription.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty else { return nil }

        let description = (transaction.description ?? transaction.displayTitle)
            .trimmingCharacters(in: .whitespacesAndNewlines)
        let category = transaction.displayCategory.trimmingCharacters(in: .whitespacesAndNewlines)
        let actions = fallbackRuleActions(
            description: description,
            category: category,
            type: transaction.type
        )

        return makeRulePrompt(transaction: transaction, actions: actions)
    }

    private func resetStatsLookback() {
        statsRefreshTask?.cancel()
        statsRefreshTask = nil
        statsLookbackStart = TransactionStatsWindow.defaultStartDate()
    }

    private func scheduleStatsRefresh() {
        statsRefreshTask?.cancel()
        statsRefreshTask = Task {
            try? await Task.sleep(nanoseconds: 250_000_000)
            guard !Task.isCancelled else { return }
            await refreshStats()
        }
    }

    private func refreshStats() async {
        do {
            let loadedStats = try await service.loadStats(filters: statsFilters)
            summary = loadedStats.summary
            totalCount = loadedStats.totalCount
        } catch {
            if error.isCancellation { return }
            AppLogger.warn(
                "Failed to refresh transaction stats",
                metadata: ["operation": "transactions.stats.refresh"]
            )
        }
    }

    private func ruleName(for prompt: TransactionRulePrompt) -> String {
        switch prompt.primaryAction {
        case .setCategory:
            return "Categorize \(prompt.originalDescription)"
        case .setDescription:
            return "Rename \(prompt.originalDescription)"
        case .setType:
            return "Update type for \(prompt.originalDescription)"
        case .addHashtag:
            return "Tag \(prompt.originalDescription)"
        case .none:
            return prompt.originalDescription
        }
    }
}

private enum TransactionSwipeRuleError: LocalizedError {
    case missingDescription

    var errorDescription: String? {
        switch self {
        case .missingDescription:
            return "Couldn't open a rule for this transaction."
        }
    }
}

private func normalizedHashtagNames(_ hashtags: [String]) -> [String] {
    var seen = Set<String>()
    var normalized: [String] = []

    for hashtag in hashtags {
        let name = hashtag
            .trimmingCharacters(in: .whitespacesAndNewlines)
            .replacingOccurrences(of: "#", with: "")
        guard !name.isEmpty else { continue }

        let key = name.lowercased()
        guard !seen.contains(key) else { continue }

        seen.insert(key)
        normalized.append(name)
    }

    return normalized
}
