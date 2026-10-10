import Foundation

@MainActor
final class ScenariosViewModel: ObservableObject {
    enum ViewState {
        case idle
        case loading
        case loaded
        case refreshing
        case error(Error)
    }

    @Published private(set) var state: ViewState = .idle
    @Published private(set) var scenarios: [ForecastScenario] = []
    @Published private(set) var actionMessage: ScenarioActionMessage?

    private let service: ScenariosService

    init(service: ScenariosService = ScenariosService()) {
        self.service = service
    }

    var activeScenario: ForecastScenario? { scenarios.first(where: \.isActive) }

    var averageInvestmentReturn: Double {
        guard !scenarios.isEmpty else { return 0 }
        return scenarios.map(\.investmentReturn).reduce(0, +) / Double(scenarios.count)
    }

    func load() async {
        guard case .idle = state else { return }
        await reload(showLoading: true)
    }

    func refresh() async {
        await reload(showLoading: false, showRefreshing: true)
    }

    func save(_ draft: EditableScenarioDraft) async throws {
        let trimmedName = draft.name.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !trimmedName.isEmpty else { throw ScenarioValidationError.emptyName }

        var normalizedDraft = draft
        normalizedDraft.name = trimmedName

        if draft.sourceId == nil {
            let scenario = try await service.create(normalizedDraft)
            actionMessage = ScenarioActionMessage(title: "Scenario created", message: scenario.name)
        } else {
            let scenario = try await service.update(normalizedDraft)
            actionMessage = ScenarioActionMessage(title: "Scenario updated", message: scenario.name)
        }

        await refresh()
    }

    func delete(_ scenario: ForecastScenario) async throws {
        let deleted = try await service.delete(id: scenario.id)
        actionMessage = ScenarioActionMessage(title: "Scenario deleted", message: deleted.name)
        await refresh()
    }

    func setActive(_ scenario: ForecastScenario?) async {
        await performAction(title: scenario == nil ? "Active scenario cleared" : "Active scenario changed") {
            try await service.setActive(id: scenario?.id)
            return scenario?.name ?? "No active scenario"
        }
        await refresh()
    }

    func seedDefaults() async {
        await performAction(title: "Default scenarios") {
            let result = try await service.seedDefaults()
            return result.seeded ? "Defaults created" : "Defaults already exist"
        }
        await refresh()
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
            var loadedScenarios = try await service.load()
            if loadedScenarios.isEmpty {
                let result = try await service.seedDefaults()
                if result.seeded {
                    loadedScenarios = try await service.load()
                }
            }
            scenarios = loadedScenarios
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
            actionMessage = ScenarioActionMessage(title: title, message: message)
            state = .loaded
        } catch {
            actionMessage = ScenarioActionMessage(title: title, message: error.localizedDescription)
            state = .loaded
        }
    }
}

// MARK: - What If

@MainActor
final class WhatIfViewModel: ObservableObject {
    enum ViewState {
        case idle
        case loading
        case loaded
        case refreshing
        case error(Error)
    }

    static let baselineMonthOptions = [1, 2, 3, 6, 12]

    @Published private(set) var state: ViewState = .idle
    @Published private(set) var baseline: WhatIfBaseline?
    @Published private(set) var adjustments: [WhatIfAdjustment] = []
    @Published private(set) var baselineMonths: Int = 3

    private let service: ScenariosService

    init(service: ScenariosService = ScenariosService()) {
        self.service = service
    }

    func load() async {
        guard case .idle = state else { return }
        await reload(showLoading: true)
    }

    func refresh() async {
        guard !hasUnsavedChanges else { return }
        await reload(showLoading: false, showRefreshing: true)
    }

    func setBaselineMonths(_ months: Int) async {
        guard Self.baselineMonthOptions.contains(months) else { return }
        guard months != baselineMonths else { return }
        baselineMonths = months
        adjustments.removeAll()
        await reload(showLoading: false, showRefreshing: true)
    }

    /// Adjust a baseline item (e.g. salary, rent). Resets to baseline when removed.
    func adjustBaseline(_ item: WhatIfBaselineItem, monthlyAmount: Double) {
        guard abs(monthlyAmount - item.monthlyAmount) > 0.5 else {
            clearAdjustment(for: item)
            return
        }

        if let index = adjustments.firstIndex(where: { $0.id == item.id }) {
            adjustments[index].monthlyAmount = monthlyAmount
            adjustments[index].isRemoved = false
        } else {
            adjustments.append(WhatIfAdjustment(
                id: item.id,
                name: item.name,
                type: item.type,
                monthlyAmount: monthlyAmount,
                isCustom: false
            ))
        }
    }

    func clearAdjustment(for item: WhatIfBaselineItem) {
        adjustments.removeAll { $0.id == item.id }
    }

    func removeBaselineItem(_ item: WhatIfBaselineItem) {
        if let index = adjustments.firstIndex(where: { $0.id == item.id }) {
            adjustments[index].monthlyAmount = item.monthlyAmount
            adjustments[index].isRemoved = true
        } else {
            adjustments.append(WhatIfAdjustment(
                id: item.id,
                name: item.name,
                type: item.type,
                monthlyAmount: item.monthlyAmount,
                isCustom: false,
                isRemoved: true
            ))
        }
    }

    func addCustomItem(name: String, type: WhatIfItemType, monthlyAmount: Double) {
        let trimmed = name.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !trimmed.isEmpty, monthlyAmount > 0 else { return }
        adjustments.append(WhatIfAdjustment(
            id: "custom:\(UUID().uuidString)",
            name: trimmed,
            type: type,
            monthlyAmount: monthlyAmount,
            isCustom: true
        ))
    }

    func updateCustomItem(id: String, name: String, type: WhatIfItemType, monthlyAmount: Double) {
        let trimmed = name.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !trimmed.isEmpty, monthlyAmount > 0 else { return }
        guard let index = adjustments.firstIndex(where: { $0.id == id && $0.isCustom }) else { return }
        adjustments[index].name = trimmed
        adjustments[index].type = type
        adjustments[index].monthlyAmount = monthlyAmount
        adjustments[index].isRemoved = false
    }

    func removeAdjustment(_ adjustment: WhatIfAdjustment) {
        adjustments.removeAll { $0.id == adjustment.id }
    }

    func resetAllAdjustments() {
        adjustments.removeAll()
    }

    var hasUnsavedChanges: Bool {
        !adjustments.isEmpty
    }

    func adjustment(for item: WhatIfBaselineItem) -> WhatIfAdjustment? {
        adjustments.first { $0.id == item.id }
    }

    /// Effective monthly amount for an item after applying any adjustment.
    func effectiveAmount(for item: WhatIfBaselineItem) -> Double {
        let adjustment = adjustment(for: item)
        return adjustment?.monthlyAmount ?? item.monthlyAmount
    }

    /// Adjusted totals across baseline + custom items.
    var projection: WhatIfProjection {
        guard let baseline else {
            return WhatIfProjection(income: 0, expenses: 0, savings: 0, debt: 0)
        }

        var totals = WhatIfProjection(income: 0, expenses: 0, savings: 0, debt: 0)

        for item in baseline.baselineItems {
            if adjustment(for: item)?.isRemoved == true { continue }
            let amount = effectiveAmount(for: item)
            totals.add(amount: amount, type: item.type)
        }

        for adj in adjustments where adj.isCustom && !adj.isRemoved {
            totals.add(amount: adj.monthlyAmount, type: adj.type)
        }

        return totals
    }

    var customAdjustments: [WhatIfAdjustment] {
        adjustments.filter { $0.isCustom && !$0.isRemoved }
    }

    func baselineItem(id: String) -> WhatIfBaselineItem? {
        baseline?.baselineItems.first { $0.id == id }
    }

    func customAdjustment(id: String) -> WhatIfAdjustment? {
        adjustments.first { $0.id == id && $0.isCustom && !$0.isRemoved }
    }

    var monthlyPlanSections: [WhatIfMonthlyPlanSection] {
        guard let baseline else { return [] }

        let displayItems = baseline.baselineItems.compactMap { item -> WhatIfDisplayItem? in
            if adjustment(for: item)?.isRemoved == true { return nil }
            return WhatIfDisplayItem(
                id: item.id,
                name: item.name,
                type: item.type,
                monthlyAmount: effectiveAmount(for: item),
                baselineAmount: item.monthlyAmount,
                category: item.category,
                isCustom: false
            )
        } + customAdjustments.map { adjustment in
            WhatIfDisplayItem(
                id: adjustment.id,
                name: adjustment.name,
                type: adjustment.type,
                monthlyAmount: adjustment.monthlyAmount,
                baselineAmount: nil,
                category: nil,
                isCustom: true
            )
        }

        return WhatIfItemType.whatIfDisplayOrder.map { type in
            let items = displayItems
                .filter { $0.type == type }
                .sorted { $0.monthlyAmount > $1.monthlyAmount }
            return WhatIfMonthlyPlanSection(
                type: type,
                baselineTotal: baseline.total(for: type),
                adjustedTotal: projection.total(for: type),
                items: items
            )
        }
    }

    private func reload(showLoading: Bool, showRefreshing: Bool = true) async {
        if showLoading {
            state = .loading
        } else if showRefreshing {
            state = .refreshing
        }

        do {
            baseline = try await service.loadWhatIfBaseline(months: baselineMonths)
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

private extension String {
    var whatIfNilIfBlank: String? {
        let value = trimmingCharacters(in: .whitespacesAndNewlines)
        return value.isEmpty ? nil : value
    }
}

struct WhatIfDisplayItem: Identifiable, Equatable {
    let id: String
    let name: String
    let type: WhatIfItemType
    let monthlyAmount: Double
    let baselineAmount: Double?
    let category: String?
    let isCustom: Bool

    var isAdjusted: Bool {
        guard let baselineAmount else { return false }
        return abs(monthlyAmount - baselineAmount) > 0.5
    }

    var systemImage: String {
        if isCustom { return "plus" }
        return WhatIfCategoryIcon.systemImage(for: category?.whatIfNilIfBlank ?? name)
    }
}

struct WhatIfMonthlyPlanSection: Identifiable, Equatable {
    var id: String { type.rawValue }
    let type: WhatIfItemType
    let baselineTotal: Double
    let adjustedTotal: Double
    let items: [WhatIfDisplayItem]

    var title: String {
        switch type {
        case .income: "Income"
        case .expense: "Expenses"
        case .savings: "Savings & Investments"
        case .debt: "Debt"
        }
    }

    var emptyMessage: String {
        switch type {
        case .income: "No income data available"
        case .expense: "No expense data available"
        case .savings: "No savings data available"
        case .debt: "No debt payment data available"
        }
    }

    var signedBaselineTotal: Double { type.whatIfSignedAmount(baselineTotal) }
    var signedAdjustedTotal: Double { type.whatIfSignedAmount(adjustedTotal) }
    var hasTotalChange: Bool { abs(adjustedTotal - baselineTotal) > 0.5 }
}

struct WhatIfProjection: Equatable {
    var income: Double
    var expenses: Double
    var savings: Double
    var debt: Double

    var net: Double { income - expenses - savings - debt }

    mutating func add(amount: Double, type: WhatIfItemType) {
        switch type {
        case .income: income += amount
        case .expense: expenses += amount
        case .savings: savings += amount
        case .debt: debt += amount
        }
    }

    func total(for type: WhatIfItemType) -> Double {
        switch type {
        case .income: income
        case .expense: expenses
        case .savings: savings
        case .debt: debt
        }
    }
}

private extension WhatIfBaseline {
    func total(for type: WhatIfItemType) -> Double {
        switch type {
        case .income: baselineIncome
        case .expense: baselineExpenses
        case .savings: baselineSavings
        case .debt: baselineDebt
        }
    }
}

private extension WhatIfItemType {
    static let whatIfDisplayOrder: [WhatIfItemType] = [.income, .expense, .savings, .debt]

    func whatIfSignedAmount(_ amount: Double) -> Double {
        switch self {
        case .expense, .debt: -amount
        case .income, .savings: amount
        }
    }
}