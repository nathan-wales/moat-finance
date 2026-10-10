import SwiftUI

struct ScenariosView: View {
    @StateObject private var viewModel = ScenariosViewModel()
    @State private var draft: EditableScenarioDraft?

    var body: some View {
        Group {
            switch viewModel.state {
            case .idle, .loading:
                LoadingView("Loading scenarios...")
            case .loaded, .refreshing:
                loadedContent
            case .error(let error):
                ErrorStateView(error: error) {
                    Task { await viewModel.refresh() }
                }
            }
        }
        .navigationTitle("Scenarios")
        .toolbar {
            ToolbarItem(placement: .topBarTrailing) {
                Menu {
                    Button {
                        draft = EditableScenarioDraft()
                    } label: {
                        Label("New scenario", systemImage: "plus")
                    }
                    Button {
                        Task { await viewModel.seedDefaults() }
                    } label: {
                        Label("Seed defaults", systemImage: "sparkles")
                    }
                    Button {
                        Task { await viewModel.refresh() }
                    } label: {
                        Label("Refresh", systemImage: "arrow.clockwise")
                    }
                } label: {
                    MoatMoreMenuIcon()
                }
            }
        }
        .sheet(item: $draft) { draft in
            ScenarioEditorSheet(
                draft: draft,
                onSave: { updatedDraft in
                    try await viewModel.save(updatedDraft)
                    self.draft = nil
                },
                onDelete: {
                    if let scenario = viewModel.scenarios.first(where: { $0.id == draft.sourceId }) {
                        try await viewModel.delete(scenario)
                    }
                    self.draft = nil
                }
            )
        }
        .sheet(item: actionMessageBinding) { message in
            MoatActionResultSheet(
                title: message.title,
                message: message.message
            ) {
                viewModel.clearActionMessage()
            }
        }
        .task { await viewModel.load() }
    }

    private var actionMessageBinding: Binding<ScenarioActionMessage?> {
        Binding(
            get: { viewModel.actionMessage },
            set: { value in
                if value == nil { viewModel.clearActionMessage() }
            }
        )
    }

    private var loadedContent: some View {
        ScrollView {
            VStack(spacing: MoatTheme.Spacing.large) {
                ScenariosSummaryCard(
                    count: viewModel.scenarios.count,
                    activeScenario: viewModel.activeScenario,
                    averageInvestmentReturn: viewModel.averageInvestmentReturn
                )

                if viewModel.scenarios.isEmpty {
                    emptyState
                } else {
                    LazyVStack(spacing: MoatTheme.Spacing.medium) {
                        ForEach(viewModel.scenarios) { scenario in
                            ScenarioRow(
                                scenario: scenario,
                                onEdit: { draft = EditableScenarioDraft(scenario: scenario) },
                                onSetActive: { Task { await viewModel.setActive(scenario) } },
                                onClearActive: { Task { await viewModel.setActive(nil) } }
                            )
                        }
                    }
                }
            }
            .padding(.horizontal, MoatTheme.Spacing.large)
            .padding(.top, MoatTheme.Spacing.large)
            .padding(.bottom, 112)
        }
        .moatPageBackground()
        .refreshable { await viewModel.refresh() }
    }

    private var emptyState: some View {
        VStack(spacing: MoatTheme.Spacing.medium) {
            Image(systemName: "chart.line.uptrend.xyaxis")
                .font(.system(size: 44))
                .foregroundStyle(.secondary)
            Text("No scenarios yet")
                .font(.headline)
            Button {
                Task { await viewModel.seedDefaults() }
            } label: {
                Label("Create defaults", systemImage: "sparkles")
            }
            .buttonStyle(.moatPrimary)
        }
        .frame(maxWidth: .infinity)
        .padding(.vertical, MoatTheme.Spacing.xxLarge)
    }
}

private struct ScenariosSummaryCard: View {
    let count: Int
    let activeScenario: ForecastScenario?
    let averageInvestmentReturn: Double

    var body: some View {
        MoatCard {
            HStack(alignment: .top, spacing: MoatTheme.Spacing.medium) {
                ScenarioMetric(title: "Scenarios", value: "\(count)", systemImage: "square.stack.3d.up")
                ScenarioMetric(title: "Active", value: activeScenario?.name ?? "None", systemImage: "checkmark.seal.fill")
                ScenarioMetric(title: "Avg return", value: averageInvestmentReturn.scenarioPercentDisplay, systemImage: "percent")
            }
        }
    }
}

private struct ScenarioMetric: View {
    let title: String
    let value: String
    let systemImage: String

    var body: some View {
        VStack(alignment: .leading, spacing: 3) {
            Image(systemName: systemImage)
                .foregroundStyle(MoatTheme.ColorToken.accent)
            Text(value)
                .font(.headline)
                .lineLimit(2)
                .minimumScaleFactor(0.76)
            Text(title)
                .font(.caption)
                .foregroundStyle(.secondary)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
    }
}

private struct ScenarioRow: View {
    let scenario: ForecastScenario
    let onEdit: () -> Void
    let onSetActive: () -> Void
    let onClearActive: () -> Void

    var body: some View {
        VStack(alignment: .leading, spacing: MoatTheme.Spacing.medium) {
            HStack(alignment: .top, spacing: MoatTheme.Spacing.medium) {
                Image(systemName: scenario.isActive ? "checkmark.seal.fill" : "chart.line.uptrend.xyaxis")
                    .foregroundStyle(scenario.isActive ? MoatTheme.ColorToken.positive : MoatTheme.ColorToken.accent)
                    .frame(width: 36, height: 36)
                    .background(MoatTheme.ColorToken.elevatedSurface)
                    .clipShape(RoundedRectangle(cornerRadius: MoatTheme.Radius.small, style: .continuous))

                VStack(alignment: .leading, spacing: 3) {
                    Text(scenario.name)
                        .font(.subheadline.weight(.semibold))
                    Text(scenario.type.displayName)
                        .font(.caption)
                        .foregroundStyle(.secondary)
                }

                Spacer()

                Menu {
                    Button(action: onEdit) {
                        Label("Edit", systemImage: "pencil")
                    }
                    Button(action: scenario.isActive ? onClearActive : onSetActive) {
                        Label(scenario.isActive ? "Clear active" : "Set active", systemImage: scenario.isActive ? "xmark" : "checkmark")
                    }
                } label: {
                    MoatMoreMenuIcon()
                }
            }

            HStack(spacing: MoatTheme.Spacing.small) {
                ScenarioPill(title: "Return", value: scenario.investmentReturn.scenarioPercentDisplay)
                ScenarioPill(title: "Inflation", value: scenario.inflationRate.scenarioPercentDisplay)
                ScenarioPill(title: "Salary", value: scenario.salaryGrowth.scenarioPercentDisplay)
            }
            HStack(spacing: MoatTheme.Spacing.small) {
                ScenarioPill(title: "Contrib", value: scenario.contributionChange.scenarioPercentDisplay)
                ScenarioPill(title: "Expenses", value: scenario.expenseGrowth.scenarioPercentDisplay)
            }
        }
        .padding(MoatTheme.Spacing.medium)
        .background(MoatTheme.ColorToken.surface)
        .clipShape(RoundedRectangle(cornerRadius: MoatTheme.Radius.medium, style: .continuous))
    }
}

private struct ScenarioPill: View {
    let title: String
    let value: String

    var body: some View {
        VStack(alignment: .leading, spacing: 2) {
            Text(value)
                .font(.caption.weight(.semibold))
            Text(title)
                .font(.caption2)
                .foregroundStyle(.secondary)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding(.vertical, 8)
        .padding(.horizontal, 10)
        .background(MoatTheme.ColorToken.elevatedSurface)
        .clipShape(RoundedRectangle(cornerRadius: MoatTheme.Radius.small, style: .continuous))
    }
}

private struct ScenarioEditorSheet: View {
    @State private var draft: EditableScenarioDraft
    let onSave: (EditableScenarioDraft) async throws -> Void
    let onDelete: () async throws -> Void
    @State private var isDeleteConfirmationPresented = false
    @State private var errorMessage: String?
    @State private var isSaving = false

    init(
        draft: EditableScenarioDraft,
        onSave: @escaping (EditableScenarioDraft) async throws -> Void,
        onDelete: @escaping () async throws -> Void
    ) {
        _draft = State(initialValue: draft)
        self.onSave = onSave
        self.onDelete = onDelete
    }

    var body: some View {
        MoatGlassSheet(title: draft.sourceId == nil ? "New Scenario" : "Edit Scenario") {
            VStack(alignment: .leading, spacing: MoatTheme.Spacing.large) {
                MoatTextField(placeholder: "Name", text: $draft.name)

                Picker("Type", selection: $draft.type) {
                    ForEach(ScenarioType.allCases) { type in
                        Text(type.displayName).tag(type)
                    }
                }
                .pickerStyle(.segmented)
                .disabled(draft.sourceId != nil)

                if draft.sourceId == nil {
                    ScenarioPresetPicker { preset in
                        draft.applyPreset(preset)
                    }
                }

                ScenarioPercentSlider(title: "Investment return", value: $draft.investmentReturn, range: -0.05...0.15)
                ScenarioPercentSlider(title: "Inflation", value: $draft.inflationRate, range: 0...0.12)
                ScenarioPercentSlider(title: "Salary growth", value: $draft.salaryGrowth, range: -0.05...0.12)
                ScenarioPercentSlider(title: "Contribution change", value: $draft.contributionChange, range: -0.1...0.15)
                ScenarioPercentSlider(title: "Expense growth", value: $draft.expenseGrowth, range: -0.05...0.12)

                if let errorMessage {
                    Text(errorMessage)
                        .font(.footnote)
                        .foregroundStyle(MoatTheme.ColorToken.destructive)
                }
            }
        } footer: {
            VStack(spacing: MoatTheme.Spacing.medium) {
                Button {
                    HapticFeedback.saveOrSubmit()
                    Task { await save() }
                } label: {
                    Text(isSaving ? "Saving..." : "Save scenario")
                        .frame(maxWidth: .infinity)
                }
                .buttonStyle(.moatPrimary)
                .disabled(isSaving)

                if draft.sourceId != nil {
                    Button(role: .destructive) {
                        isDeleteConfirmationPresented = true
                    } label: {
                        Text("Delete scenario")
                            .frame(maxWidth: .infinity)
                    }
                    .buttonStyle(.moatDestructive)
                    .disabled(isSaving)
                }
            }
        }
        .sheet(isPresented: $isDeleteConfirmationPresented) {
            MoatGlassSheet(title: "Delete scenario") {
                VStack(alignment: .leading, spacing: MoatTheme.Spacing.large) {
                    Text(draft.name)
                        .font(.headline)
                    Text("This removes the saved assumptions. Charts using this scenario will fall back to their default assumptions.")
                        .font(.body)
                        .foregroundStyle(.secondary)
                }
            } footer: {
                MoatSheetActionBar {
                    Button {
                        isDeleteConfirmationPresented = false
                    } label: {
                        Text("Cancel").frame(maxWidth: .infinity)
                    }
                    .buttonStyle(.moatSecondary)

                    Button(role: .destructive) {
                        Task { await delete() }
                    } label: {
                        if isSaving {
                            ProgressView().frame(maxWidth: .infinity)
                        } else {
                            Label("Delete", systemImage: "trash").frame(maxWidth: .infinity)
                        }
                    }
                    .buttonStyle(.moatDestructive)
                    .disabled(isSaving)
                }
            }
        }
    }

    private func save() async {
        isSaving = true
        defer { isSaving = false }

        do {
            try await onSave(draft)
        } catch {
            errorMessage = error.localizedDescription
        }
    }

    private func delete() async {
        isSaving = true
        defer { isSaving = false }

        do {
            try await onDelete()
        } catch {
            errorMessage = error.localizedDescription
        }
    }
}

private struct ScenarioPresetPicker: View {
    let onSelect: (ScenarioPreset) -> Void

    var body: some View {
        VStack(alignment: .leading, spacing: MoatTheme.Spacing.small) {
            Text("Presets")
                .font(.subheadline.weight(.semibold))
            HStack(spacing: MoatTheme.Spacing.small) {
                ForEach(ScenarioPreset.allCases) { preset in
                    Button(preset.title) {
                        onSelect(preset)
                    }
                    .buttonStyle(.bordered)
                    .controlSize(.small)
                }
            }
        }
    }
}

private struct ScenarioPercentSlider: View {
    let title: String
    @Binding var value: Double
    let range: ClosedRange<Double>

    var body: some View {
        VStack(alignment: .leading, spacing: MoatTheme.Spacing.small) {
            HStack {
                Text(title)
                    .font(.subheadline.weight(.semibold))
                Spacer()
                Text(value.scenarioPercentDisplay)
                    .font(.subheadline.monospacedDigit())
                    .foregroundStyle(.secondary)
            }
            Slider(value: $value, in: range, step: 0.005)
        }
    }
}

// MARK: - What If View

struct WhatIfView: View {
    @StateObject private var viewModel = WhatIfViewModel()
    @State private var editorDraft: WhatIfItemEditorDraft?
    @State private var resetConfirmationPresented = false
    @State private var refreshConfirmationPresented = false

    var body: some View {
        Group {
            switch viewModel.state {
            case .idle, .loading:
                LoadingView("Loading what-if baseline...")
            case .loaded, .refreshing:
                loadedContent
            case .error(let error):
                ErrorStateView(error: error) {
                    Task { await viewModel.refresh() }
                }
            }
        }
        .navigationTitle("What If")
        .navigationBarTitleDisplayMode(.inline)
        .toolbar {
            ToolbarItem(placement: .topBarTrailing) {
                Menu {
                    Button {
                        presentNewItemEditor(type: .income)
                    } label: {
                        Label("Add hypothetical", systemImage: "plus")
                    }
                    if !viewModel.adjustments.isEmpty {
                        Button(role: .destructive) {
                            resetConfirmationPresented = true
                        } label: {
                            Label("Reset adjustments", systemImage: "arrow.uturn.backward")
                        }
                    }
                    Button {
                        if viewModel.hasUnsavedChanges {
                            refreshConfirmationPresented = true
                        } else {
                            Task { await viewModel.refresh() }
                        }
                    } label: {
                        Label("Refresh", systemImage: "arrow.clockwise")
                    }
                } label: {
                    Image(systemName: "slider.horizontal.3")
                }
                .accessibilityLabel("What If actions")
            }
        }
        .confirmationDialog("Reset what-if changes?", isPresented: $resetConfirmationPresented, titleVisibility: .visible) {
            Button("Reset adjustments", role: .destructive) {
                viewModel.resetAllAdjustments()
            }
        } message: {
            Text("This clears your unsaved monthly plan changes.")
        }
        .confirmationDialog("Refresh baseline?", isPresented: $refreshConfirmationPresented, titleVisibility: .visible) {
            Button("Discard changes and refresh", role: .destructive) {
                viewModel.resetAllAdjustments()
                Task { await viewModel.refresh() }
            }
        } message: {
            Text("Refreshing reloads the baseline and clears unsaved adjustments.")
        }
        .sheet(item: $editorDraft) { draft in
            WhatIfItemEditorSheet(
                draft: draft,
                onSave: saveEditorDraft,
                onRevert: revertEditorDraft,
                onRemove: removeEditorDraft,
                onCancel: { editorDraft = nil }
            )
        }
        .task { await viewModel.load() }
    }

    @ViewBuilder
    private var loadedContent: some View {
        if let baseline = viewModel.baseline {
            ScrollView {
                LazyVStack(spacing: MoatTheme.Spacing.large, pinnedViews: [.sectionHeaders]) {
                    WhatIfTitleBlock(
                        baselineMonths: viewModel.baselineMonths,
                        onMonthsChange: { months in
                            Task { await viewModel.setBaselineMonths(months) }
                        }
                    )

                    Section {
                        if baseline.baselineItems.isEmpty && viewModel.customAdjustments.isEmpty {
                            WhatIfEmptyBaseline {
                                presentNewItemEditor(type: .income)
                            }
                        } else {
                            WhatIfMonthlyPlanView(
                                sections: viewModel.monthlyPlanSections,
                                onSelect: presentEditor
                            )
                        }
                    } header: {
                        WhatIfSummaryHeader(
                            baseline: baseline,
                            projection: viewModel.projection,
                            showReset: abs(viewModel.projection.net - baseline.baselineNet) > 0.5
                                || viewModel.hasUnsavedChanges,
                            onReset: { resetConfirmationPresented = true },
                            onAdd: presentNewItemEditor
                        )
                        .padding(.bottom, MoatTheme.Spacing.small)
                        .zIndex(1)
                    }
                }
                .padding(.horizontal, MoatTheme.Spacing.large)
                .padding(.top, MoatTheme.Spacing.large)
                .padding(.bottom, 112)
            }
            .moatPageBackground()
            .refreshable { await refreshWhatIf() }
        } else {
            LoadingView("Loading what-if baseline...")
        }
    }

    private func refreshWhatIf() async {
        if viewModel.hasUnsavedChanges {
            refreshConfirmationPresented = true
            return
        }
        await viewModel.refresh()
    }

    private func presentNewItemEditor(type: WhatIfItemType) {
        editorDraft = WhatIfItemEditorDraft(type: type)
    }

    private func presentEditor(for item: WhatIfDisplayItem) {
        if item.isCustom, let adjustment = viewModel.customAdjustment(id: item.id) {
            editorDraft = WhatIfItemEditorDraft(adjustment: adjustment)
            return
        }

        guard let baselineItem = viewModel.baselineItem(id: item.id) else { return }
        editorDraft = WhatIfItemEditorDraft(
            baselineItem: baselineItem,
            adjustedAmount: item.monthlyAmount
        )
    }

    private func saveEditorDraft(_ draft: WhatIfItemEditorDraft) {
        let amount = draft.parsedAmount
        guard amount > 0 else { return }

        switch draft.mode {
        case .new:
            viewModel.addCustomItem(name: draft.name, type: draft.type, monthlyAmount: amount)
        case .custom:
            guard let itemId = draft.itemId else { return }
            viewModel.updateCustomItem(id: itemId, name: draft.name, type: draft.type, monthlyAmount: amount)
        case .baseline:
            guard let baselineItem = draft.baselineItem else { return }
            viewModel.adjustBaseline(baselineItem, monthlyAmount: amount)
        }

        editorDraft = nil
    }

    private func revertEditorDraft(_ draft: WhatIfItemEditorDraft) {
        guard let baselineItem = draft.baselineItem else { return }
        viewModel.clearAdjustment(for: baselineItem)
        editorDraft = nil
    }

    private func removeEditorDraft(_ draft: WhatIfItemEditorDraft) {
        switch draft.mode {
        case .new:
            editorDraft = nil
        case .custom:
            guard let itemId = draft.itemId, let adjustment = viewModel.customAdjustment(id: itemId) else { return }
            viewModel.removeAdjustment(adjustment)
            editorDraft = nil
        case .baseline:
            guard let baselineItem = draft.baselineItem else { return }
            viewModel.removeBaselineItem(baselineItem)
            editorDraft = nil
        }
    }
}

private struct WhatIfTitleBlock: View {
    let baselineMonths: Int
    let onMonthsChange: (Int) -> Void

    var body: some View {
        VStack(alignment: .leading, spacing: MoatTheme.Spacing.small) {
            VStack(alignment: .leading, spacing: MoatTheme.Spacing.xSmall) {
                Text("What If")
                    .font(.largeTitle.bold())
                    .tracking(-0.6)
                Text("Model how monthly changes would affect your cash flow.")
                    .font(.subheadline)
                    .foregroundStyle(.secondary)
            }

            WhatIfBaselinePeriodControl(
                months: baselineMonths,
                onMonthsChange: onMonthsChange
            )
        }
        .frame(maxWidth: .infinity, alignment: .leading)
    }
}

private struct WhatIfBaselinePeriodControl: View {
    let months: Int
    let onMonthsChange: (Int) -> Void

    private var periodLabel: String {
        months == 1 ? "month" : "months"
    }

    var body: some View {
        HStack(spacing: 6) {
            Text("Based on the average over the last")
                .font(.subheadline)
                .foregroundStyle(.secondary)

            Menu {
                ForEach(WhatIfViewModel.baselineMonthOptions, id: \.self) { option in
                    Button {
                        onMonthsChange(option)
                    } label: {
                        if option == months {
                            Label("\(option)", systemImage: "checkmark")
                        } else {
                            Text("\(option)")
                        }
                    }
                }
            } label: {
                HStack(spacing: 4) {
                    Text("\(months)")
                        .font(.subheadline.weight(.semibold))
                    Image(systemName: "chevron.up.chevron.down")
                        .font(.caption2.weight(.semibold))
                }
                .padding(.horizontal, 10)
                .padding(.vertical, 6)
                .background(MoatTheme.ColorToken.elevatedSurface)
                .clipShape(RoundedRectangle(cornerRadius: MoatTheme.Radius.small, style: .continuous))
            }
            .accessibilityLabel("Baseline average months")

            Text(periodLabel)
                .font(.subheadline)
                .foregroundStyle(.secondary)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
    }
}

private struct WhatIfSummaryHeader: View {
    let baseline: WhatIfBaseline
    let projection: WhatIfProjection
    let showReset: Bool
    let onReset: () -> Void
    let onAdd: (WhatIfItemType) -> Void

    private var currentNet: Double { baseline.baselineNet }
    private var projectedNet: Double { projection.net }
    private var annualNet: Double { projectedNet * 12 }
    private var netChanged: Bool { abs(projectedNet - currentNet) > 0.5 }
    private var projectedTint: Color { whatIfAmountTint(projectedNet) }
    private var annualTint: Color { whatIfAmountTint(annualNet).opacity(0.82) }
    private var annualBannerBackground: Color {
        if annualNet > 0.5 { return MoatTheme.ColorToken.positiveSoft }
        if annualNet < -0.5 { return MoatTheme.ColorToken.destructiveSoft }
        return MoatTheme.ColorToken.elevatedSurface
    }

    var body: some View {
        MoatCard {
            VStack(alignment: .leading, spacing: MoatTheme.Spacing.medium) {
                HStack(alignment: .center, spacing: MoatTheme.Spacing.small) {
                    Text("Net Monthly:")
                        .font(.headline)
                    Spacer(minLength: MoatTheme.Spacing.small)
                    actionButtons
                        .layoutPriority(1)
                }

                netValuesView

                annualizedBanner
            }
        }
    }

    private var netValuesView: some View {
        VStack(alignment: .leading, spacing: MoatTheme.Spacing.xSmall) {
            if netChanged {
                HStack(alignment: .firstTextBaseline, spacing: 6) {
                    Text(whatIfSignedCurrency(currentNet))
                        .font(.subheadline.monospacedDigit())
                        .foregroundStyle(.secondary)
                        .strikethrough()
                    Text("->")
                        .font(.caption.weight(.semibold))
                        .foregroundStyle(.secondary)
                }

                Text(whatIfSignedCurrency(projectedNet))
                    .font(.title2.monospacedDigit().weight(.bold))
                    .foregroundStyle(projectedTint)
            } else {
                Text(whatIfSignedCurrency(projectedNet))
                    .font(.headline.monospacedDigit())
                    .foregroundStyle(projectedTint)
            }
        }
        .frame(maxWidth: .infinity, alignment: .leading)
    }

    private var annualizedBanner: some View {
        (
            Text("Annualized projection: ")
            + Text(whatIfSignedCurrency(annualNet))
                .fontWeight(.semibold)
                .foregroundColor(annualTint)
            + Text(" per year.")
        )
        .font(.caption)
        .foregroundStyle(.secondary)
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding(.horizontal, MoatTheme.Spacing.medium)
        .padding(.vertical, MoatTheme.Spacing.small)
        .background(annualBannerBackground)
        .clipShape(RoundedRectangle(cornerRadius: MoatTheme.Radius.small, style: .continuous))
    }

    private var actionButtons: some View {
        HStack(spacing: MoatTheme.Spacing.small) {
            if showReset {
                Button(action: onReset) {
                    Label("Reset", systemImage: "arrow.counterclockwise")
                }
                .buttonStyle(.moatSecondaryCompact)
                .fixedSize()
            }

            Menu {
                Button {
                    onAdd(.income)
                } label: {
                    Label("Add Income", systemImage: WhatIfItemType.income.systemImage)
                }
                Button {
                    onAdd(.expense)
                } label: {
                    Label("Add Expense", systemImage: WhatIfItemType.expense.systemImage)
                }
                Button {
                    onAdd(.savings)
                } label: {
                    Label("Add Savings or Investment", systemImage: WhatIfItemType.savings.systemImage)
                }
                Button {
                    onAdd(.debt)
                } label: {
                    Label("Add Debt Payment", systemImage: WhatIfItemType.debt.systemImage)
                }
            } label: {
                HStack(spacing: 4) {
                    Image(systemName: "plus")
                    Text("Scenario")
                    Image(systemName: "chevron.down")
                        .font(.caption2.weight(.semibold))
                }
            }
            .buttonStyle(.moatPrimaryCompact)
            .fixedSize()
        }
    }
}

private struct WhatIfMonthlyPlanView: View {
    let sections: [WhatIfMonthlyPlanSection]
    let onSelect: (WhatIfDisplayItem) -> Void

    var body: some View {
        VStack(spacing: MoatTheme.Spacing.large) {
            ForEach(sections) { section in
                WhatIfMonthlySection(section: section, onSelect: onSelect)
            }
        }
    }
}

private struct WhatIfMonthlySection: View {
    let section: WhatIfMonthlyPlanSection
    let onSelect: (WhatIfDisplayItem) -> Void
    @State private var isExpanded: Bool

    init(section: WhatIfMonthlyPlanSection, onSelect: @escaping (WhatIfDisplayItem) -> Void) {
        self.section = section
        self.onSelect = onSelect
        _isExpanded = State(initialValue: !section.items.isEmpty)
    }

    var body: some View {
        MoatCard {
            DisclosureGroup(isExpanded: $isExpanded) {
                if section.items.isEmpty {
                    Text(section.emptyMessage)
                        .font(.subheadline)
                        .foregroundStyle(.secondary)
                        .frame(maxWidth: .infinity, alignment: .leading)
                        .padding(.top, MoatTheme.Spacing.small)
                } else {
                    VStack(spacing: 2) {
                        ForEach(section.items) { item in
                            WhatIfMonthlyRow(item: item) {
                                onSelect(item)
                            }
                        }
                    }
                    .padding(.top, MoatTheme.Spacing.small)
                }
            } label: {
                WhatIfMonthlySectionHeader(section: section)
            }
        }
        .onChange(of: section.items.isEmpty) { isEmpty in
            if !isEmpty { isExpanded = true }
        }
    }
}

private struct WhatIfMonthlySectionHeader: View {
    let section: WhatIfMonthlyPlanSection

    var body: some View {
        HStack(alignment: .center, spacing: MoatTheme.Spacing.medium) {
            HStack(spacing: 6) {
                Text(section.title)
                    .font(.headline)
                    .foregroundStyle(.secondary)
                if section.items.isEmpty {
                    Text("(empty)")
                        .font(.caption)
                        .foregroundStyle(.secondary)
                }
            }

            Spacer(minLength: MoatTheme.Spacing.small)

            if !section.items.isEmpty {
                sectionTotals
            }
        }
        .padding(.trailing, MoatTheme.Spacing.small)
    }

    @ViewBuilder
    private var sectionTotals: some View {
        if section.hasTotalChange {
            VStack(alignment: .trailing, spacing: 2) {
                HStack(spacing: 6) {
                    Text(CurrencyFormatter.formatCompact(section.signedBaselineTotal))
                        .foregroundStyle(.secondary)
                        .strikethrough()
                    Text("->")
                        .font(.caption2.weight(.semibold))
                        .foregroundStyle(.secondary)
                }
                .font(.caption.monospacedDigit())

                Text(CurrencyFormatter.formatCompact(section.signedAdjustedTotal))
                    .font(.subheadline.monospacedDigit().weight(.semibold))
                    .foregroundStyle(whatIfAmountTint(section.signedAdjustedTotal))
            }
        } else {
            Text(CurrencyFormatter.formatCompact(section.signedAdjustedTotal))
                .font(.subheadline.monospacedDigit().weight(.semibold))
                .foregroundStyle(whatIfAmountTint(section.signedAdjustedTotal))
        }
    }
}

private struct WhatIfMonthlyRow: View {
    let item: WhatIfDisplayItem
    let onSelect: () -> Void

    var body: some View {
        Button(action: onSelect) {
            HStack(spacing: MoatTheme.Spacing.medium) {
                Image(systemName: item.systemImage)
                    .font(.subheadline.weight(.semibold))
                    .foregroundStyle(.secondary)
                    .frame(width: 20)

                HStack(spacing: MoatTheme.Spacing.xSmall) {
                    Text(item.name)
                        .font(.subheadline.weight(.semibold))
                        .foregroundStyle(.primary)
                        .lineLimit(1)
                    if item.isAdjusted {
                        WhatIfStatusPill(title: "Edited", tint: MoatTheme.ColorToken.accent)
                    }
                    if item.isCustom {
                        WhatIfStatusPill(title: "New", tint: MoatTheme.ColorToken.positive)
                    }
                }
                .frame(maxWidth: .infinity, alignment: .leading)

                WhatIfRowAmount(item: item)
            }
            .padding(.vertical, 9)
            .padding(.horizontal, MoatTheme.Spacing.small)
            .background(MoatTheme.ColorToken.elevatedSurface.opacity(0.001))
            .clipShape(RoundedRectangle(cornerRadius: MoatTheme.Radius.small, style: .continuous))
        }
        .buttonStyle(.plain)
        .contentShape(RoundedRectangle(cornerRadius: MoatTheme.Radius.small, style: .continuous))
    }
}

private struct WhatIfStatusPill: View {
    let title: String
    let tint: Color

    var body: some View {
        Text(title)
            .font(.caption2.weight(.semibold))
            .foregroundStyle(tint)
            .padding(.vertical, 3)
            .padding(.horizontal, 6)
            .background(tint.opacity(0.12), in: Capsule())
    }
}

private struct WhatIfRowAmount: View {
    let item: WhatIfDisplayItem

    var body: some View {
        HStack(spacing: 5) {
            if item.isAdjusted, let baselineAmount = item.baselineAmount {
                Text(CurrencyFormatter.formatCompact(item.type.whatIfRowSignedAmount(baselineAmount)))
                    .foregroundStyle(.secondary)
                    .strikethrough()
                Text("->")
                    .font(.caption2.weight(.semibold))
                    .foregroundStyle(.secondary)
            } else if item.isCustom {
                Text("0")
                    .foregroundStyle(.secondary)
                    .strikethrough()
                Text("->")
                    .font(.caption2.weight(.semibold))
                    .foregroundStyle(.secondary)
            }
            Text(CurrencyFormatter.formatCompact(item.type.whatIfRowSignedAmount(item.monthlyAmount)))
                .foregroundStyle(whatIfAmountTint(item.type.whatIfRowSignedAmount(item.monthlyAmount)))
        }
        .font(.subheadline.monospacedDigit().weight(.semibold))
        .lineLimit(1)
        .minimumScaleFactor(0.7)
    }
}

private struct WhatIfEmptyBaseline: View {
    let onAdd: () -> Void

    var body: some View {
        VStack(spacing: MoatTheme.Spacing.medium) {
            Image(systemName: "chart.bar.doc.horizontal")
                .font(.system(size: 44))
                .foregroundStyle(.secondary)
            Text("No baseline yet")
                .font(.headline)
            Text("Add monthly budget goals or income to build a baseline. You can still test hypothetical changes here.")
                .font(.subheadline)
                .foregroundStyle(.secondary)
                .multilineTextAlignment(.center)
                .padding(.horizontal, MoatTheme.Spacing.large)
            Button(action: onAdd) {
                Label("Add hypothetical", systemImage: "plus")
            }
            .buttonStyle(.moatPrimary)
        }
        .frame(maxWidth: .infinity)
        .padding(.vertical, MoatTheme.Spacing.xxLarge)
    }
}

private enum WhatIfItemEditorMode: Equatable {
    case new
    case custom
    case baseline
}

private struct WhatIfItemEditorDraft: Identifiable, Equatable {
    let id = UUID()
    let itemId: String?
    let mode: WhatIfItemEditorMode
    let baselineItem: WhatIfBaselineItem?
    let baselineAmount: Double?
    var name: String
    var type: WhatIfItemType
    var amountText: String

    init(type: WhatIfItemType) {
        itemId = nil
        mode = .new
        baselineItem = nil
        baselineAmount = nil
        name = ""
        self.type = type
        amountText = ""
    }

    init(adjustment: WhatIfAdjustment) {
        itemId = adjustment.id
        mode = .custom
        baselineItem = nil
        baselineAmount = nil
        name = adjustment.name
        type = adjustment.type
        amountText = AmountInputFormatter.format(adjustment.monthlyAmount)
    }

    init(baselineItem: WhatIfBaselineItem, adjustedAmount: Double) {
        itemId = baselineItem.id
        mode = .baseline
        self.baselineItem = baselineItem
        baselineAmount = baselineItem.monthlyAmount
        name = baselineItem.name
        type = baselineItem.type
        amountText = AmountInputFormatter.format(adjustedAmount)
    }

    var parsedAmount: Double {
        AmountInputFormatter.parse(amountText) ?? 0
    }

    var title: String {
        switch mode {
        case .new: "Add Item"
        case .custom: "Edit New Item"
        case .baseline: "Edit Item"
        }
    }

    var subtitle: String {
        switch mode {
        case .new: "Add a new hypothetical monthly item to your scenario."
        case .custom: "Update this hypothetical monthly item."
        case .baseline: "Adjust the monthly amount for this item."
        }
    }

    var saveTitle: String {
        mode == .new ? "Add to Scenario" : "Save Changes"
    }

    var canEditDetails: Bool {
        mode == .new || mode == .custom
    }

    var canRevert: Bool {
        guard mode == .baseline, let baselineAmount else { return false }
        return abs(parsedAmount - baselineAmount) > 0.5
    }
}

private struct WhatIfItemEditorSheet: View {
    @State private var draft: WhatIfItemEditorDraft
    @State private var errorMessage: String?
    @FocusState private var isAmountFocused: Bool
    let onSave: (WhatIfItemEditorDraft) -> Void
    let onRevert: (WhatIfItemEditorDraft) -> Void
    let onRemove: (WhatIfItemEditorDraft) -> Void
    let onCancel: () -> Void

    init(
        draft: WhatIfItemEditorDraft,
        onSave: @escaping (WhatIfItemEditorDraft) -> Void,
        onRevert: @escaping (WhatIfItemEditorDraft) -> Void,
        onRemove: @escaping (WhatIfItemEditorDraft) -> Void,
        onCancel: @escaping () -> Void
    ) {
        _draft = State(initialValue: draft)
        self.onSave = onSave
        self.onRevert = onRevert
        self.onRemove = onRemove
        self.onCancel = onCancel
    }

    var body: some View {
        MoatGlassSheet(title: draft.title) {
            VStack(alignment: .leading, spacing: MoatTheme.Spacing.large) {
                Text(draft.subtitle)
                    .font(.subheadline)
                    .foregroundStyle(.secondary)

                if draft.canEditDetails {
                    Picker("Type", selection: $draft.type) {
                        ForEach(WhatIfItemType.allCases) { type in
                            Text(type.displayName).tag(type)
                        }
                    }
                    .pickerStyle(.segmented)

                    MoatTextField(placeholder: "Name (e.g. Side gig)", text: $draft.name)
                } else {
                    VStack(alignment: .leading, spacing: MoatTheme.Spacing.xSmall) {
                        Text(draft.name)
                            .font(.headline)
                        Text(draft.type.displayName)
                            .font(.caption)
                            .foregroundStyle(.secondary)
                    }
                }

                if let baselineAmount = draft.baselineAmount {
                    VStack(alignment: .leading, spacing: MoatTheme.Spacing.xSmall) {
                        Text("Current Monthly Amount")
                            .font(.subheadline.weight(.semibold))
                        Text(CurrencyFormatter.formatCompact(baselineAmount))
                            .font(.title2.monospacedDigit().weight(.semibold))
                    }
                    .frame(maxWidth: .infinity, alignment: .leading)
                }

                VStack(alignment: .leading, spacing: MoatTheme.Spacing.small) {
                    Text(draft.canEditDetails ? "Monthly Amount" : "New Monthly Amount")
                        .font(.subheadline.weight(.semibold))
                    amountField
                }

                if let errorMessage {
                    Text(errorMessage)
                        .font(.footnote)
                        .foregroundStyle(MoatTheme.ColorToken.destructive)
                }
            }
        } footer: {
            VStack(spacing: MoatTheme.Spacing.small) {
                Button {
                    save()
                } label: {
                    Text(draft.saveTitle)
                        .frame(maxWidth: .infinity)
                }
                .buttonStyle(.moatPrimary)

                if draft.canRevert {
                    Button {
                        onRevert(draft)
                    } label: {
                        Label("Revert to Baseline", systemImage: "arrow.uturn.backward")
                            .frame(maxWidth: .infinity)
                    }
                    .buttonStyle(.moatSecondary)
                }

                if draft.mode != .new {
                    Button(role: .destructive) {
                        onRemove(draft)
                    } label: {
                        Label(draft.mode == .custom ? "Remove Item" : "Remove from Scenario", systemImage: "trash")
                            .frame(maxWidth: .infinity)
                    }
                    .buttonStyle(.moatDestructive)
                }

                Button {
                    onCancel()
                } label: {
                    Text("Cancel")
                        .frame(maxWidth: .infinity)
                }
                .buttonStyle(.moatSecondary)
            }
        }
    }

    private var amountField: some View {
        HStack {
            Text("$")
                .foregroundStyle(.secondary)
            TextField("0", text: $draft.amountText)
                .textFieldStyle(.plain)
                .keyboardType(.decimalPad)
                .focused($isAmountFocused)
                .onChange(of: draft.amountText) { newValue in
                    let formatted = AmountInputFormatter.formatTyping(newValue)
                    if formatted != newValue {
                        draft.amountText = formatted
                    }
                }
            Text("/ mo")
                .font(.caption)
                .foregroundStyle(.secondary)
        }
        .padding(MoatTheme.Spacing.small)
        .background(MoatTheme.ColorToken.elevatedSurface)
        .clipShape(RoundedRectangle(cornerRadius: MoatTheme.Radius.small, style: .continuous))
        .overlay {
            RoundedRectangle(cornerRadius: MoatTheme.Radius.small, style: .continuous)
                .strokeBorder(MoatTheme.ColorToken.softBorder, lineWidth: 1)
        }
        .moatInputFocusRing(isFocused: isAmountFocused, cornerRadius: MoatTheme.Radius.small)
    }

    private func save() {
        let trimmedName = draft.name.trimmingCharacters(in: .whitespacesAndNewlines)
        let amount = draft.parsedAmount
        if draft.canEditDetails && trimmedName.isEmpty {
            errorMessage = "Add a name"
            return
        }
        if amount <= 0 {
            errorMessage = "Add a monthly amount"
            return
        }
        draft.name = trimmedName
        onSave(draft)
    }
}

private func whatIfAmountTint(_ amount: Double) -> Color {
    if amount > 0 { return MoatTheme.ColorToken.positive }
    if amount < 0 { return MoatTheme.ColorToken.destructive }
    return .secondary
}

private func whatIfSignedCurrency(_ amount: Double) -> String {
    let formatted = CurrencyFormatter.formatCompact(amount)
    return amount > 0 ? "+\(formatted)" : formatted
}

private extension WhatIfItemType {
    func whatIfRowSignedAmount(_ amount: Double) -> Double {
        switch self {
        case .expense, .debt: -amount
        case .income, .savings: amount
        }
    }
}

#Preview {
    NavigationStack {
        WhatIfView()
    }
}
