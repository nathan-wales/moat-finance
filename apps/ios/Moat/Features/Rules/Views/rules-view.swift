import SwiftUI

struct RulesView: View {
    @StateObject private var viewModel = RulesViewModel()
    @State private var editorMode: RuleEditorMode?
    @State private var isSettingsPresented = false

    var body: some View {
        Group {
            switch viewModel.state {
            case .idle, .loading:
                LoadingView("Loading rules...")
            case .loaded, .refreshing:
                loadedContent
            case .error(let error):
                ErrorStateView(error: error) {
                    Task { await viewModel.refresh() }
                }
            }
        }
        .navigationTitle("Rules")
        .toolbar {
            ToolbarItem(placement: .topBarTrailing) {
                Menu {
                    Button {
                        editorMode = .create
                    } label: {
                        Label("New rule", systemImage: "plus")
                    }
                    Button {
                        isSettingsPresented = true
                    } label: {
                        Label("Settings", systemImage: "gearshape")
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
        .sheet(item: $editorMode) { mode in
            RuleEditorSheet(
                mode: mode,
                hashtags: viewModel.hashtags,
                onSave: { draft, applyToHistorical in
                    try await viewModel.save(rule: mode.rule, draft: draft, applyToHistorical: applyToHistorical)
                    editorMode = nil
                },
                onFetchPreview: { draft in
                    try await viewModel.previewDraft(rule: mode.rule, draft: draft)
                },
                onDelete: {
                    if let rule = mode.rule {
                        try await viewModel.delete(rule)
                    }
                    editorMode = nil
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
        .sheet(isPresented: $isSettingsPresented) {
            RuleSettingsSheet(
                preference: viewModel.settings?.ruleExecutionPreference,
                onPreferenceChange: { preference in
                    await viewModel.updatePreference(preference)
                    isSettingsPresented = false
                }
            )
        }
        .task {
            await viewModel.load()
        }
    }

    private var actionMessageBinding: Binding<RuleActionMessage?> {
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
                RulesSummaryCard(
                    totalCount: viewModel.rules.count,
                    activeCount: viewModel.activeCount,
                    preference: viewModel.settings?.ruleExecutionPreference,
                    onPreferenceChange: { preference in
                        Task { await viewModel.updatePreference(preference) }
                    }
                )

                if viewModel.rules.isEmpty {
                    emptyRules
                } else {
                    LazyVStack(spacing: MoatTheme.Spacing.small) {
                        ForEach(Array(viewModel.rules.enumerated()), id: \.element.id) { index, rule in
                            RuleRow(
                                rule: rule,
                                onEdit: { editorMode = .edit(rule) },
                                onToggle: { Task { await viewModel.toggleActive(rule) } },
                                canMoveUp: index > 0,
                                canMoveDown: index < viewModel.rules.count - 1,
                                onMoveUp: { Task { await viewModel.move(rule, direction: .up) } },
                                onMoveDown: { Task { await viewModel.move(rule, direction: .down) } }
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

    private var emptyRules: some View {
        VStack(spacing: MoatTheme.Spacing.medium) {
            Image(systemName: "wand.and.stars")
                .font(.system(size: 44))
                .foregroundStyle(.secondary)
            Text("No rules yet")
                .font(.headline)
            Button {
                editorMode = .create
            } label: {
                Label("New rule", systemImage: "plus")
            }
            .buttonStyle(.moatPrimary)
        }
        .frame(maxWidth: .infinity)
        .padding(.vertical, MoatTheme.Spacing.xxLarge)
    }
}

private struct RulesSummaryCard: View {
    let totalCount: Int
    let activeCount: Int
    let preference: RuleExecutionPreference?
    let onPreferenceChange: (RuleExecutionPreference) -> Void

    var body: some View {
        MoatCard {
            VStack(alignment: .leading, spacing: MoatTheme.Spacing.large) {
                HStack {
                    RuleMetric(title: "Rules", value: "\(totalCount)", systemImage: "wand.and.stars")
                    RuleMetric(title: "Active", value: "\(activeCount)", systemImage: "checkmark")
                    RuleMetric(title: "Inactive", value: "\(max(0, totalCount - activeCount))", systemImage: "pause.fill")
                }

                Picker("Historical behavior", selection: Binding(
                    get: { preference ?? .alwaysAsk },
                    set: { onPreferenceChange($0) }
                )) {
                    ForEach(RuleExecutionPreference.allCases) { preference in
                        Text(preference.title).tag(preference)
                    }
                }
                .pickerStyle(.segmented)
            }
        }
    }
}

private struct RuleMetric: View {
    let title: String
    let value: String
    let systemImage: String

    var body: some View {
        VStack(alignment: .leading, spacing: 3) {
            Image(systemName: systemImage)
                .foregroundStyle(MoatTheme.ColorToken.accent)
            Text(value)
                .font(.headline)
            Text(title)
                .font(.caption)
                .foregroundStyle(.secondary)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
    }
}

private struct RuleRow: View {
    let rule: TransactionRule
    let onEdit: () -> Void
    let onToggle: () -> Void
    let canMoveUp: Bool
    let canMoveDown: Bool
    let onMoveUp: () -> Void
    let onMoveDown: () -> Void

    var body: some View {
        VStack(alignment: .leading, spacing: MoatTheme.Spacing.medium) {
            HStack(alignment: .top) {
                VStack(alignment: .leading, spacing: 3) {
                    Text(rule.name)
                        .font(.subheadline.weight(.semibold))
                    Text("Priority \(rule.priority)")
                        .font(.caption)
                        .foregroundStyle(.secondary)
                }

                Spacer()

                Text(rule.isActive ? "Active" : "Paused")
                    .font(.caption.weight(.semibold))
                    .foregroundStyle(rule.isActive ? MoatTheme.ColorToken.positive : MoatTheme.ColorToken.warning)

                Menu {
                    Button(action: onEdit) {
                        Label("Edit", systemImage: "pencil")
                    }
                    Divider()
                    Button(action: onMoveUp) {
                        Label("Move up", systemImage: "arrow.up")
                    }
                    .disabled(!canMoveUp)
                    Button(action: onMoveDown) {
                        Label("Move down", systemImage: "arrow.down")
                    }
                    .disabled(!canMoveDown)
                    Divider()
                    Button(action: onToggle) {
                        Label(rule.isActive ? "Disable" : "Enable", systemImage: rule.isActive ? "pause.fill" : "play.fill")
                    }
                } label: {
                    MoatMoreMenuIcon()
                }
            }

            VStack(alignment: .leading, spacing: MoatTheme.Spacing.xSmall) {
                ForEach(Array(rule.resolvedGroups.enumerated()), id: \.offset) { groupIndex, group in
                    if groupIndex > 0 {
                        Text(rule.resolvedMatch.connector)
                            .font(.caption2.weight(.semibold))
                            .foregroundStyle(.tertiary)
                    }
                    ForEach(Array(group.conditions.enumerated()), id: \.offset) { conditionIndex, condition in
                        Label(
                            "\(conditionIndex > 0 ? "\(group.resolvedMatch.connector) " : "")\(condition.field.title) \(condition.operatorValue.title.lowercased()) \(condition.displayValue)",
                            systemImage: condition.field.systemImage
                        )
                        .font(.caption)
                        .foregroundStyle(.secondary)
                        .lineLimit(2)
                    }
                }

                ForEach(rule.actions) { action in
                    Label("\(action.type.displayTitle): \(action.displayValue)", systemImage: action.type.systemImage)
                        .font(.caption)
                        .foregroundStyle(.secondary)
                        .lineLimit(2)
                }
            }
        }
        .padding(MoatTheme.Spacing.medium)
        .background(MoatTheme.ColorToken.surface)
        .clipShape(RoundedRectangle(cornerRadius: MoatTheme.Radius.medium, style: .continuous))
        .opacity(rule.isActive ? 1 : 0.62)
    }
}

private struct RuleSettingsSheet: View {
    let preference: RuleExecutionPreference?
    let onPreferenceChange: (RuleExecutionPreference) async -> Void

    @State private var selectedPreference: RuleExecutionPreference
    @State private var isWorking = false

    init(
        preference: RuleExecutionPreference?,
        onPreferenceChange: @escaping (RuleExecutionPreference) async -> Void
    ) {
        self.preference = preference
        self.onPreferenceChange = onPreferenceChange
        _selectedPreference = State(initialValue: preference ?? .alwaysAsk)
    }

    var body: some View {
        MoatGlassSheet(title: "Rule settings") {
            VStack(alignment: .leading, spacing: MoatTheme.Spacing.large) {
                Picker("Historical behavior", selection: $selectedPreference) {
                    ForEach(RuleExecutionPreference.allCases) { preference in
                        Text(preference.title).tag(preference)
                    }
                }
                .pickerStyle(.inline)

                Text(settingDescription)
                    .font(.body)
                    .foregroundStyle(.secondary)
            }
        } footer: {
            Button {
                HapticFeedback.saveOrSubmit()
                Task { await save() }
            } label: {
                if isWorking {
                    ProgressView().frame(maxWidth: .infinity)
                } else {
                    Label("Save settings", systemImage: "checkmark")
                        .frame(maxWidth: .infinity)
                }
            }
            .buttonStyle(.moatPrimary)
            .disabled(isWorking)
        }
    }

    private var settingDescription: String {
        switch selectedPreference {
        case .alwaysAsk:
            return "Ask before applying a rule to existing matching transactions."
        case .applyHistorical:
            return "Apply saved rules to existing matching transactions when possible."
        case .futureOnly:
            return "Use new rules only for future transaction syncs and edits."
        }
    }

    private func save() async {
        isWorking = true
        defer { isWorking = false }
        await onPreferenceChange(selectedPreference)
    }
}

#Preview {
    NavigationStack {
        RulesView()
    }
}